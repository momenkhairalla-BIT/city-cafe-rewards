/**
 * Phase 4 tests — menu image management.
 * Write tests require ALLOW_WRITE_TESTS=1.
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const ALLOW_WRITE = process.env.ALLOW_WRITE_TESTS === '1';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVQ42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let passed = 0;
let failed = 0;
let skipped = 0;
let adminToken = null;
let staffToken = null;
let testProductId = null;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`○ ${name} — skipped (${reason})`);
  skipped++;
}

async function api(path, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function apiOk(path, opts = {}, token = null) {
  const { res, body } = await api(path, opts, token);
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function login(username, password) {
  const { data } = await apiOk('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data;
}

async function main() {
  console.log(`\nCity Café Phase 4 Tests → ${BASE}`);
  console.log(`Write tests: ${ALLOW_WRITE ? 'enabled' : 'disabled (set ALLOW_WRITE_TESTS=1)'}\n`);

  await test('1. Admin login still works', async () => {
    const d = await login('admin', 'admin123');
    adminToken = d.token;
    if (d.user.role !== 'admin') throw new Error('Wrong role');
  });

  await test('2. Staff login still works', async () => {
    const d = await login('staff', 'staff123');
    staffToken = d.token;
    if (d.user.role !== 'staff') throw new Error('Wrong role');
  });

  await test('3. GET /api/menu returns image fields', async () => {
    const { data } = await apiOk('/api/menu?all=true', {}, adminToken);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Expected menu items');
    const item = data[0];
    const fields = ['description', 'imageUrl', 'imageData', 'imageAlt', 'isActive', 'isBestSeller', 'isStudentOfferEligible', 'hasImage'];
    for (const f of fields) {
      if (item[f] === undefined) throw new Error(`Missing field: ${f}`);
    }
  });

  if (ALLOW_WRITE) {
    const productName = `Phase4 Test ${Date.now()}`;

    await test('4. Admin can add product with imageData', async () => {
      const { data } = await apiOk('/api/menu', {
        method: 'POST',
        body: JSON.stringify({
          name: productName,
          price: 9.5,
          category: 'Coffee',
          description: 'Phase 4 test product',
          imageData: TINY_PNG,
          imageAlt: 'Test coffee image',
          isBestSeller: true,
          isStudentOfferEligible: true,
        }),
      }, adminToken);
      testProductId = data.id;
      if (!data.imageData && !data.hasImage) throw new Error('Expected image on new product');
      if (data.imageAlt !== 'Test coffee image') throw new Error('imageAlt not saved');
    });

    await test('5. Admin can update product imageData', async () => {
      const { data } = await apiOk(`/api/menu/${testProductId}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: 'Updated description',
          imageAlt: 'Updated alt text',
        }),
      }, adminToken);
      if (data.description !== 'Updated description') throw new Error('Description not updated');
      if (data.imageAlt !== 'Updated alt text') throw new Error('imageAlt not updated');
      if (!data.hasImage) throw new Error('Image lost after update');
    });

    await test('6. Admin can remove image and deactivate product safely', async () => {
      const removed = await apiOk(`/api/menu/${testProductId}`, {
        method: 'PUT',
        body: JSON.stringify({ removeImage: true }),
      }, adminToken);
      if (removed.data.hasImage) throw new Error('Image should be removed');

      const deactivated = await apiOk(`/api/menu/${testProductId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }, adminToken);
      if (deactivated.data.isActive !== false) throw new Error('Product should be inactive');
    });

    await test('6b. Reject oversized image upload', async () => {
      const big = 'data:image/png;base64,' + 'A'.repeat(700000);
      const { res, body } = await api('/api/menu', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Too Big Image',
          price: 5,
          category: 'Food',
          imageData: big,
        }),
      }, adminToken);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!body.error?.includes('500 KB')) throw new Error('Expected size validation message');
    });
  } else {
    skip('4–6 Menu write tests', 'ALLOW_WRITE_TESTS not set');
  }

  await test('7. POS menu returns only active products', async () => {
    const all = await apiOk('/api/menu?all=true', {}, staffToken);
    const active = await apiOk('/api/menu', {}, staffToken);
    if (active.data.length > all.data.length) throw new Error('Active list larger than full list');
    if (active.data.some(i => i.isActive === false)) throw new Error('Inactive item in POS menu');
  });

  await test('8. Menu item can include image data', async () => {
    const { data } = await apiOk('/api/menu?all=true', {}, adminToken);
    const withImage = data.find(i => i.hasImage || i.imageData);
    const withoutImage = data.find(i => !i.hasImage && !i.imageData);
    if (!withoutImage) throw new Error('Expected at least one product without image');
    if (ALLOW_WRITE && testProductId) {
      const testItem = data.find(i => i.id === testProductId);
      if (testItem?.isActive !== false) throw new Error('Test product should be inactive');
    }
    if (withImage && !withImage.imageAlt) throw new Error('Image product should have imageAlt');
  });

  await test('9. Product without image uses hasImage=false', async () => {
    const { data } = await apiOk('/api/menu', {}, staffToken);
    const noImg = data.find(i => !i.hasImage);
    if (!noImg) throw new Error('Expected product without image for placeholder POS rendering');
  });

  await test('10. Phase 1 scan still works', async () => {
    const { data } = await apiOk('/api/scan/CU2024001', {}, staffToken);
    if (!data.name) throw new Error('Scan lookup failed');
  });

  await test('11. Phase 2 login by member code still works', async () => {
    const d = await login('CU-M-2024001', 'demo123');
    if (!d.token) throw new Error('Login failed');
  });

  await test('12. Phase 3 offers endpoint still works', async () => {
    const { data } = await apiOk('/api/offers', {}, staffToken);
    if (!Array.isArray(data)) throw new Error('Expected offers array');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
