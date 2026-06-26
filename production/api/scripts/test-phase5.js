/**
 * Phase 5 tests — merchant demo readiness (read-only by default).
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

let passed = 0;
let failed = 0;

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
  console.log(`\nCity Café Phase 5 Tests → ${BASE}\n`);

  let adminToken = null;
  let staffToken = null;
  let customerToken = null;

  await test('1. Login page loads (index.html)', async () => {
    const res = await fetch(`${BASE}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('City Café') || !html.includes('login-form')) {
      throw new Error('Login page content missing');
    }
  });

  await test('2. Admin login works', async () => {
    const d = await login('admin', 'admin123');
    adminToken = d.token;
    if (d.user.role !== 'admin') throw new Error('Wrong role');
  });

  await test('3. Staff login works', async () => {
    const d = await login('staff', 'staff123');
    staffToken = d.token;
    if (d.user.role !== 'staff') throw new Error('Wrong role');
  });

  await test('4. Customer login works', async () => {
    const d = await login('CU2024001', 'demo123');
    customerToken = d.token;
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  await test('5. Demo Guide section present in app', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    if (!html.includes('Demo Guide') || !html.includes('renderDemoGuide')) {
      throw new Error('Demo Guide not found in app');
    }
  });

  await test('6. Health check includes app version', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    if (!data.version) throw new Error('Missing version in /health');
    if (data.database !== 'connected') throw new Error('Database not connected');
  });

  await test('7. GET /api/menu returns image fields (POS/admin)', async () => {
    const { data } = await apiOk('/api/menu', {}, staffToken);
    if (!Array.isArray(data) || !data.length) throw new Error('Empty menu');
    const item = data[0];
    if (item.imageAlt === undefined || item.hasImage === undefined) {
      throw new Error('Menu missing Phase 4/5 image fields');
    }
  });

  await test('8. GET /api/offers still works', async () => {
    const { data } = await apiOk('/api/offers', {}, staffToken);
    if (!Array.isArray(data)) throw new Error('Expected offers array');
  });

  await test('9. Phase 1 scan still works', async () => {
    const { data } = await apiOk('/api/scan/CU2024001', {}, staffToken);
    if (!data.name) throw new Error('Scan failed');
  });

  await test('10. Phase 2 member code login still works', async () => {
    const d = await login('CU-M-2024001', 'demo123');
    if (!d.token) throw new Error('Login failed');
  });

  await test('11. Analytics/overview accessible to admin', async () => {
    const { data } = await apiOk('/api/analytics/overview', {}, adminToken);
    if (data.total_revenue === undefined && data.total_orders === undefined) {
      throw new Error('Analytics incomplete');
    }
  });

  await test('12. Customer can access own menu (active items)', async () => {
    const { data } = await apiOk('/api/menu', {}, customerToken);
    if (!Array.isArray(data)) throw new Error('Customer menu failed');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  console.log('Regression: also run npm run test:phase2, test:phase3, test:phase4 locally.\n');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
