/**
 * Phase 5 tests — merchant demo readiness.
 *
 * Scan fixture: PHASE5SCAN001
 * - Previously created in the shared demo database during Closure Gate (do not delete without approval).
 * - Mutating create/reactivate requires ALLOW_TEST_MUTATIONS=1.
 * - Mutations against production hosts require ALLOW_PRODUCTION_TEST_MUTATIONS=1 (extra guard).
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const SCAN_FIXTURE_STUDENT_ID = 'PHASE5SCAN001';
const SCAN_FIXTURE_NAME = 'Phase5 Scan Fixture';

function isProductionTestBase(base) {
  const b = String(base).toLowerCase();
  return b.includes('onrender.com') || b.includes('city-cafe-rewards');
}

function assertMutationAllowed(action) {
  if (process.env.ALLOW_TEST_MUTATIONS !== '1') {
    throw new Error(
      `${action} requires ALLOW_TEST_MUTATIONS=1. `
      + 'Refusing accidental demo/production writes. '
      + 'If PHASE5SCAN001 already exists and is active, the scan test uses it read-only.',
    );
  }
  if (isProductionTestBase(BASE) && process.env.ALLOW_PRODUCTION_TEST_MUTATIONS !== '1') {
    throw new Error(
      `${action} refused against production-like TEST_BASE_URL (${BASE}). `
      + 'Set ALLOW_PRODUCTION_TEST_MUTATIONS=1 only with explicit approval.',
    );
  }
}

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
  const body = await apiOk('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return body.data;
}

/** Phase 2B: staff/admin use deprecated legacy Bearer endpoint (feature-gated). */
async function employeeLogin(username, password) {
  const body = await apiOk('/api/v1/auth/employee/legacy-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!body.data?.token) {
    throw new Error('legacy employee login missing token');
  }
  return {
    token: body.data.token,
    user: body.data.user,
  };
}

/**
 * Prefer read-only use of existing PHASE5SCAN001.
 * Create/reactivate only when ALLOW_TEST_MUTATIONS=1 (never delete the demo fixture).
 */
async function ensureActiveScanFixture(adminToken, staffToken) {
  const existingScan = await api(`/api/scan/${encodeURIComponent(SCAN_FIXTURE_STUDENT_ID)}`, {}, staffToken);
  if (existingScan.res.ok && existingScan.body?.data?.name) {
    return existingScan.body.data;
  }

  assertMutationAllowed('Creating/reactivating PHASE5SCAN001');

  const create = await api('/api/members', {
    method: 'POST',
    body: JSON.stringify({
      customerType: 'city_student',
      studentId: SCAN_FIXTURE_STUDENT_ID,
      name: SCAN_FIXTURE_NAME,
      programme: 'Phase5 Test',
      email: 'phase5.scan.fixture@example.com',
    }),
  }, adminToken);

  let member = create.body?.data;
  if (create.res.status === 201 && member?.id) {
    return member;
  }

  if (create.res.status !== 409 && !create.res.ok) {
    throw new Error(create.body.error || `Fixture create failed HTTP ${create.res.status}`);
  }

  const list = await apiOk('/api/members', {}, adminToken);
  const rows = Array.isArray(list.data) ? list.data : [];
  member = rows.find((m) =>
    String(m.studentId || m.student_id || '').toUpperCase() === SCAN_FIXTURE_STUDENT_ID
    || String(m.memberCode || m.member_code || '').toUpperCase().includes('PHASE5SCAN'),
  );
  if (!member?.id) {
    throw new Error('Scan fixture member exists but could not be resolved from member list');
  }

  if (member.isActive === false || member.is_active === false) {
    assertMutationAllowed('Reactivating PHASE5SCAN001');
    const patched = await apiOk(`/api/members/${member.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    }, adminToken);
    member = patched.data || member;
  }

  return member;
}

async function main() {
  console.log(`\nAida Cafe Phase 5 Tests → ${BASE}\n`);

  let adminToken = null;
  let staffToken = null;
  let customerToken = null;
  let scanCode = SCAN_FIXTURE_STUDENT_ID;

  await test('1. Login page loads (index.html)', async () => {
    const res = await fetch(`${BASE}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('Aida') || !html.includes('login-form')) {
      throw new Error('Login page content missing');
    }
  });

  await test('2. Admin login works', async () => {
    const d = await employeeLogin('admin', 'admin123');
    adminToken = d.token;
    if (d.user.role !== 'admin') throw new Error('Wrong role');
  });

  await test('3. Staff login works', async () => {
    const d = await employeeLogin('staff', 'staff123');
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
    const version = data.version || data.appVersion;
    if (!version) throw new Error('Missing version in /health');
    if (version !== 'v1.5-demo-ready') throw new Error(`Unexpected version: ${version}`);
    if (data.database !== 'connected') throw new Error('Database not connected');
  });

  await test('7. GET /api/menu returns image fields (POS/admin)', async () => {
    const body = await apiOk('/api/menu', {}, staffToken);
    const data = body.data ?? body;
    if (!Array.isArray(data) || !data.length) throw new Error('Empty menu');
    const item = data[0];
    if (item.imageAlt === undefined || item.hasImage === undefined) {
      throw new Error('Menu missing Phase 4/5 image fields');
    }
  });

  await test('8. GET /api/offers still works', async () => {
    const body = await apiOk('/api/offers', {}, staffToken);
    const data = body.data ?? body;
    if (!Array.isArray(data)) throw new Error('Expected offers array');
  });

  await test('9. Phase 1 scan still works', async () => {
    const fixture = await ensureActiveScanFixture(adminToken, staffToken);
    scanCode = fixture.studentId || fixture.student_id || fixture.memberCode || fixture.member_code || SCAN_FIXTURE_STUDENT_ID;
    if (fixture.isActive === false || fixture.is_active === false) {
      throw new Error('Scan fixture is inactive after ensure');
    }
    const body = await apiOk(`/api/scan/${encodeURIComponent(scanCode)}`, {}, staffToken);
    const data = body.data ?? body;
    if (!data.name) throw new Error('Scan failed — missing member name');
    if (data.isActive === false || data.is_active === false) {
      throw new Error('Scan returned inactive member');
    }
  });

  await test('10. Phase 2 member code login still works', async () => {
    const d = await login('CU-M-2024001', 'demo123');
    if (!d.token) throw new Error('Login failed');
  });

  await test('11. Analytics/overview accessible to admin', async () => {
    const body = await apiOk('/api/analytics/overview', {}, adminToken);
    const data = body.data ?? body;
    if (data.total_revenue === undefined && data.total_orders === undefined
      && data.totalRevenue === undefined && data.totalOrders === undefined) {
      throw new Error('Analytics incomplete');
    }
  });

  await test('12. Customer can access own menu (active items)', async () => {
    const body = await apiOk('/api/menu', {}, customerToken);
    const data = body.data ?? body;
    if (!Array.isArray(data)) throw new Error('Customer menu failed');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  console.log('Regression: also run npm run test:phase2, test:phase3, test:phase4 locally.\n');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
