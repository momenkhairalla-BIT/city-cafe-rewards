/**
 * Phase 3 tests — offers + POS discount logic (localhost).
 * Write tests require ALLOW_WRITE_TESTS=1.
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const ALLOW_WRITE = process.env.ALLOW_WRITE_TESTS === '1';

let passed = 0;
let failed = 0;
let skipped = 0;
let staffToken = null;
let adminToken = null;
let offersBySlug = {};

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

function offerId(slug) {
  return offersBySlug[slug]?.offerId || offersBySlug[slug]?.id || slug;
}

async function main() {
  console.log(`\nCity Café Phase 3 Tests → ${BASE}`);
  console.log(`Write tests: ${ALLOW_WRITE ? 'enabled' : 'disabled'}\n`);

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

  await test('3. Customer login still works', async () => {
    const d = await login('CU2024001', 'demo123');
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  await test('4. Staff scan City University student', async () => {
    const { data } = await apiOk('/api/scan/CU2024001', {}, staffToken);
    if (data.customerType !== 'city_student') throw new Error('Expected city_student');
  });

  await test('5. Staff scan general customer', async () => {
    const { data } = await apiOk('/api/scan/GC-M-001', {}, staffToken);
    if (data.customerType !== 'general_customer') throw new Error('Expected general_customer');
  });

  await test('6. GET /api/offers returns default offers', async () => {
    const { data } = await apiOk('/api/offers', {}, staffToken);
    if (!Array.isArray(data) || data.length < 4) throw new Error('Expected 4+ offers');
    data.forEach(o => { if (o.slug) offersBySlug[o.slug] = o; });
    if (!offersBySlug['student-drink-10']) throw new Error('Missing student-drink-10');
  });

  await test('7. City student member type from scan', async () => {
    const { data } = await apiOk('/api/scan/CU2024001', {}, staffToken);
    if (data.customerType !== 'city_student') throw new Error('Not city_student');
  });

  if (ALLOW_WRITE) {
    await test('8. General customer cannot apply student-only offer', async () => {
      const { res } = await api('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'GC-M-001',
          customerType: 'general_customer',
          offerId: offerId('student-drink-10'),
          paymentMethod: 'Cash',
          cashReceived: 20,
          items: [{ itemName: 'Latte', category: 'Coffee', quantity: 1, unitPrice: 8 }],
        }),
      }, staffToken);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await test('9. Student 10% drink discount calculation', async () => {
      const { data } = await apiOk('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          offerId: offerId('student-drink-10'),
          paymentMethod: 'Cash',
          cashReceived: 20,
          items: [{ itemName: 'Latte', category: 'Coffee', quantity: 1, unitPrice: 8 }],
        }),
      }, staffToken);
      const discount = Number(data.receipt?.discount ?? data.order?.discount);
      if (Math.abs(discount - 0.8) > 0.01) throw new Error(`Expected discount 0.8, got ${discount}`);
    });

    await test('10. Student combo offer calculation', async () => {
      const { data } = await apiOk('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          offerId: offerId('student-combo'),
          paymentMethod: 'Cash',
          cashReceived: 30,
          items: [
            { itemName: 'Latte', category: 'Coffee', quantity: 1, unitPrice: 8 },
            { itemName: 'Croissant', category: 'Food', quantity: 1, unitPrice: 5 },
          ],
        }),
      }, staffToken);
      const total = Number(data.receipt?.total ?? data.order?.total);
      if (Math.abs(total - 12) > 0.01) throw new Error(`Expected total 12, got ${total}`);
    });

    await test('11. Double points calculation', async () => {
      const { data } = await apiOk('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          offerId: offerId('double-points'),
          paymentMethod: 'Cash',
          cashReceived: 20,
          items: [{ itemName: 'Americano', category: 'Coffee', quantity: 1, unitPrice: 6 }],
        }),
      }, staffToken);
      const pts = Number(data.receipt?.pointsEarned ?? data.order?.points_earned);
      if (pts !== 12) throw new Error(`Expected 12 points, got ${pts}`);
    });

    await test('12. Checkout stores offer name and discount', async () => {
      const { data } = await apiOk('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          offerId: offerId('student-drink-10'),
          paymentMethod: 'Cash',
          cashReceived: 20,
          items: [{ itemName: 'Cappuccino', category: 'Coffee', quantity: 1, unitPrice: 10 }],
        }),
      }, staffToken);
      if (!data.receipt?.offerUsed && !data.order?.offer_used) throw new Error('Missing offerUsed');
      if (Number(data.receipt?.discount ?? data.order?.discount) <= 0) throw new Error('Missing discount');
    });

    await test('13. Receipt includes applied offer fields', async () => {
      const { data } = await apiOk('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          offerId: offerId('double-points'),
          paymentMethod: 'Cash',
          cashReceived: 15,
          items: [{ itemName: 'Latte', category: 'Coffee', quantity: 1, unitPrice: 8 }],
        }),
      }, staffToken);
      if (!data.receipt?.offerUsed) throw new Error('Receipt missing offerUsed');
      if (!data.receipt?.customerType) throw new Error('Receipt missing customerType');
    });

    await test('14. Transaction history includes offer data', async () => {
      const { data } = await apiOk('/api/orders/transactions?limit=5', {}, staffToken);
      const withOffer = data.find(t => t.offer_used);
      if (!withOffer) throw new Error('No transaction with offer_used in history');
    });
  } else {
    skip('8–14 Offer checkout write tests', 'set ALLOW_WRITE_TESTS=1');
  }

  await test('15. /api/students compatibility', async () => {
    const list = await apiOk('/api/students', {}, staffToken);
    if (!Array.isArray(list.data) || !list.data.length) throw new Error('Empty students list');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
