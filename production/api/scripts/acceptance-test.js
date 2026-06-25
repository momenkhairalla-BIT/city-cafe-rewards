/**
 * Full acceptance tests (includes writes — best for localhost).
 * For live Render URL, prefer: npm run test:production
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
let passed = 0;
let failed = 0;
let staffToken = null;
let adminToken = null;

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
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function login(username, password) {
  const { data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!data.token) throw new Error('No token returned');
  return data.token;
}

async function main() {
  console.log(`\nCity Café Acceptance Tests → ${BASE}\n`);

  await test('Health check (public)', async () => {
    const h = await api('/health');
    if (h.database !== 'connected') throw new Error('DB not connected');
    if (h.auth !== 'jwt') throw new Error('JWT auth not enabled');
  });

  await test('Protected route rejects unauthenticated', async () => {
    const res = await fetch(`${BASE}/api/members`);
    if (res.status !== 401) throw new Error('Expected 401 without token');
  });

  await test('Flow 1: Staff login returns JWT', async () => {
    staffToken = await login('staff', 'staff123');
  });

  await test('Flow 1: Admin login returns JWT', async () => {
    adminToken = await login('admin', 'admin123');
  });

  await test('Invalid login rejected', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    if (res.status !== 401) throw new Error('Expected 401 for bad password');
  });

  await test('Flow 4: Scan by student ID CU2024001', async () => {
    const { data } = await api('/api/scan/CU2024001', {}, staffToken);
    if (!data.name) throw new Error('Member not found by student ID');
    if (data.customerType !== 'city_student') throw new Error('Expected city_student');
  });

  await test('Flow 4: Scan by member code CU-M-2024001', async () => {
    const { data } = await api('/api/scan/CU-M-2024001', {}, staffToken);
    if (!data.name) throw new Error('Member not found by member code');
  });

  await test('Flow 4: Scan by barcode GC001 (general)', async () => {
    const { data } = await api('/api/scan/GC001', {}, staffToken);
    if (!data.name) throw new Error('Member not found by barcode');
    if (data.customerType !== 'general_customer') throw new Error('Expected general_customer');
  });

  await test('Flow 4: Scan by phone 60123456789', async () => {
    const { data } = await api('/api/scan/60123456789', {}, staffToken);
    if (data.name !== 'Ali Rahman') throw new Error(`Expected Ali Rahman, got ${data.name}`);
  });

  await test('Flow 4: Scan GC-M-001 (member code general)', async () => {
    const { data } = await api('/api/scan/GC-M-001', {}, staffToken);
    if (!data.name) throw new Error('General member not found');
  });

  await test('Flow 1: Student sale with offer (staff token)', async () => {
    const { data } = await api('/api/orders/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU-M-2024001',
        studentCode: 'CU2024001',
        customerType: 'city_student',
        offerUsed: '10% Student Drink Discount',
        discount: 0.8,
        paymentMethod: 'Cash',
        cashReceived: 20,
        items: [{ itemName: 'Latte', category: 'Coffee', quantity: 1, unitPrice: 8 }],
      }),
    }, staffToken);
    if (!data.receipt?.orderNumber) throw new Error('No order number');
  });

  await test('Flow 2: Register general customer (public)', async () => {
    const phone = '601' + Date.now().toString().slice(-8);
    const { data } = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        customerType: 'general_customer',
        name: 'Auth Test User',
        phone,
        password: 'secure123',
      }),
    });
    if (!data.token) throw new Error('Registration should return JWT');
  });

  await test('Flow 2: General customer sale', async () => {
    const { data } = await api('/api/orders/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'GC-M-001',
        customerType: 'general_customer',
        paymentMethod: 'Cash',
        cashReceived: 10,
        items: [{ itemName: 'Americano', category: 'Coffee', quantity: 1, unitPrice: 6 }],
      }),
    }, staffToken);
    if (data.receipt.total <= 0) throw new Error('Invalid total');
  });

  await test('Flow 3: Menu update (admin token)', async () => {
    const { data: items } = await api('/api/menu?all=true', {}, adminToken);
    await api(`/api/menu/${items[0].id}`, {
      method: 'PUT',
      body: JSON.stringify({ description: 'Auth test update' }),
    }, adminToken);
  });

  await test('Customer cannot access admin analytics', async () => {
    const customerToken = await login('CU2024001', 'demo123');
    const res = await fetch(`${BASE}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (res.status !== 403) throw new Error('Customer should get 403 on analytics');
  });

  await test('Flow 5: Members & offers (admin)', async () => {
    const members = await api('/api/members', {}, adminToken);
    const offers = await api('/api/offers', {}, adminToken);
    if (members.data.length < 5) throw new Error('Expected 5+ members');
    if (offers.data.length < 4) throw new Error('Expected 4+ offers');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
