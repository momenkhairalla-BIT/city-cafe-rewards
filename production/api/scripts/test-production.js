/**
 * Safe production verification — read-only by default.
 *
 * Usage:
 *   npm run test:production
 *   npm run test:production:live
 *
 * Optional write tests (creates 1 demo sale — use sparingly on live):
 *   ALLOW_WRITE_TESTS=1 TEST_BASE_URL=https://... npm run test:production
 */
const DEFAULT_LIVE_URL = 'https://city-cafe-rewards.onrender.com';
const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ALLOW_WRITE = process.env.ALLOW_WRITE_TESTS === '1';
const RETRIES = Number(process.env.TEST_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.TEST_RETRY_DELAY_MS || 15000);
const FETCH_TIMEOUT_MS = 60000;

let passed = 0;
let failed = 0;
let skipped = 0;
let staffToken = null;
let adminToken = null;
let dbConnected = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function memberName(data) {
  return data?.name || data?.fullName || null;
}

function validateBaseUrl() {
  if (/YOUR-RENDER-URL/i.test(BASE)) {
    console.error('\n✗ TEST_BASE_URL is still the placeholder YOUR-RENDER-URL.onrender.com');
    console.error('  Use your real Render hostname, e.g.:');
    console.error(`  npm run test:production:live`);
    console.error(`  or: $env:TEST_BASE_URL="${DEFAULT_LIVE_URL}"; npm run test:production\n`);
    process.exit(1);
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function fetchWithRetry(path, opts = {}) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const result = await fetchJson(path, opts);
      if (result.res.status === 503 && attempt < RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError || new Error(`Failed to reach ${BASE}${path}`);
}

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
  const { res, body } = await fetchJson(path, { ...opts, headers });
  if (!res.ok) throw new Error(body.error || body.reason || `HTTP ${res.status}`);
  return body;
}

async function login(username, password) {
  const { data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!data.token) throw new Error('No JWT returned');
  return { token: data.token, memberCode: data.memberCode, user: data.user };
}

async function checkHealth() {
  const { res, body } = await fetchWithRetry('/health');
  if (res.status === 404) {
    throw new Error('Host not found — check TEST_BASE_URL');
  }
  if (body.database !== 'connected') {
    const reason = body.reason || 'database not connected';
    throw new Error(reason);
  }
  if (body.status !== 'ok') throw new Error(`status=${body.status}`);
  if (body.auth !== 'jwt') throw new Error('JWT auth not active');
  return body;
}

async function main() {
  validateBaseUrl();

  console.log(`\nCity Café Production Verification (read-only) → ${BASE}`);
  console.log(`Write tests: ${ALLOW_WRITE ? 'ENABLED' : 'disabled (set ALLOW_WRITE_TESTS=1 to enable)'}`);
  if (BASE.includes('onrender.com')) {
    console.log(`Cold-start retries: ${RETRIES} × ${RETRY_DELAY_MS / 1000}s\n`);
  } else {
    console.log('');
  }

  await test('GET /health — API + database', async () => {
    await checkHealth();
    dbConnected = true;
  });

  if (!dbConnected) {
    console.log('\n⚠ Database is not connected. Remaining API tests require DATABASE_URL on Render.');
    console.log('  1. Render Dashboard → city-cafe-rewards → Environment');
    console.log('  2. Set DATABASE_URL to your Neon connection string (?sslmode=require)');
    console.log('  3. Redeploy, then run: npm run test:production:live\n');
    console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
    process.exit(1);
  }

  await test('GET / — serves index.html', async () => {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('City Café')) throw new Error('index.html not served');
  });

  await test('GET /js/city-cafe-v2.js — static assets', async () => {
    const res = await fetch(`${BASE}/js/city-cafe-v2.js`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await test('Unauthenticated /api/members → 401', async () => {
    const { res } = await fetchJson('/api/members');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('Login staff / staff123', async () => {
    const s = await login('staff', 'staff123');
    staffToken = s.token;
    if (s.user.role !== 'staff') throw new Error('Wrong role');
  });

  await test('Login admin / admin123', async () => {
    const a = await login('admin', 'admin123');
    adminToken = a.token;
    if (a.user.role !== 'admin') throw new Error('Wrong role');
  });

  await test('Invalid login rejected', async () => {
    const { res } = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('Staff scan CU2024001 (student ID)', async () => {
    const { data } = await api('/api/scan/CU2024001', {}, staffToken);
    if (!data.name) throw new Error('Member not found');
  });

  await test('Staff scan CU-M-2024001 (member code)', async () => {
    const { data } = await api('/api/scan/CU-M-2024001', {}, staffToken);
    if (!data.name) throw new Error('Member not found');
  });

  await test('Staff scan GC001 (barcode)', async () => {
    const { data } = await api('/api/scan/GC001', {}, staffToken);
    if (!data.name) throw new Error('Member not found');
  });

  await test('Staff scan 60123456789 (phone)', async () => {
    const { data } = await api('/api/scan/60123456789', {}, staffToken);
    if (!data.name) throw new Error('Member not found');
  });

  await test('Staff scan GC-M-001 (general customer)', async () => {
    const { data } = await api('/api/scan/GC-M-001', {}, staffToken);
    if (!data.name) throw new Error('General member not found');
  });

  await test('GET /api/menu (authenticated)', async () => {
    const { data } = await api('/api/menu', {}, staffToken);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Menu empty');
  });

  await test('GET /api/orders/transactions (staff)', async () => {
    const { data } = await api('/api/orders/transactions?limit=5', {}, staffToken);
    if (!Array.isArray(data)) throw new Error('Expected transaction array');
  });

  await test('GET /api/members (admin)', async () => {
    const { data } = await api('/api/members', {}, adminToken);
    if (!Array.isArray(data) || data.length < 5) throw new Error('Expected members list');
  });

  await test('GET /api/analytics/overview (admin)', async () => {
    const { data } = await api('/api/analytics/overview', {}, adminToken);
    if (data.total_revenue === undefined && data.total_orders === undefined) {
      throw new Error('Analytics payload incomplete');
    }
  });

  await test('GET /api/offers', async () => {
    const { data } = await api('/api/offers', {}, staffToken);
    if (!Array.isArray(data)) throw new Error('Expected offers array');
  });

  await test('Customer login CU2024001 / demo123', async () => {
    const c = await login('CU2024001', 'demo123');
    const code = c.memberCode || 'CU2024001';
    const member = await api(`/api/members/${encodeURIComponent(code)}`, {}, c.token);
    if (!memberName(member.data)) throw new Error('Customer cannot load own profile');
    const hist = await api(`/api/students/${encodeURIComponent(code)}/history`, {}, c.token);
    if (!Array.isArray(hist.data)) throw new Error('Customer cannot load history');
  });

  for (const [label, id] of [
    ['member code CU-M-2024001', 'CU-M-2024001'],
    ['phone 60123456789', '60123456789'],
    ['member code GC-M-001', 'GC-M-001'],
    ['barcode GC001', 'GC001'],
  ]) {
    await test(`Customer login by ${label} / demo123`, async () => {
      const c = await login(id, 'demo123');
      if (c.user.role !== 'customer') throw new Error('Wrong role');
    });
  }

  await test('Customer blocked from admin analytics (403)', async () => {
    const c = await login('CU2024001', 'demo123');
    const { res } = await fetchJson('/api/analytics/overview', {
      headers: { Authorization: `Bearer ${c.token}` },
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  if (ALLOW_WRITE) {
    await test('[WRITE] Single demo sale (Latte RM 8)', async () => {
      const { data } = await api('/api/orders/sales', {
        method: 'POST',
        body: JSON.stringify({
          memberCode: 'CU-M-2024001',
          studentCode: 'CU2024001',
          customerType: 'city_student',
          paymentMethod: 'Cash',
          cashReceived: 20,
          items: [{ itemName: 'Production Verify Latte', category: 'Coffee', quantity: 1, unitPrice: 8 }],
        }),
      }, staffToken);
      if (!data.receipt?.orderNumber) throw new Error('Sale failed');
    });
  } else {
    skip('Write tests (sale/register/menu update)', 'read-only mode');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
