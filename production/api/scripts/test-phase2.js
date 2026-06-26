/**
 * Phase 2 tests — registration + login improvements (localhost / writes).
 * Safe for production only when ALLOW_WRITE_TESTS=1 (skips registration writes otherwise).
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const ALLOW_WRITE = process.env.ALLOW_WRITE_TESTS === '1';

let passed = 0;
let failed = 0;
let skipped = 0;
let staffToken = null;

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
  if (!data.token) throw new Error('No token returned');
  return data;
}

async function main() {
  console.log(`\nCity Café Phase 2 Tests → ${BASE}`);
  console.log(`Write tests: ${ALLOW_WRITE ? 'enabled' : 'disabled (set ALLOW_WRITE_TESTS=1)'}\n`);

  await test('1. Login admin / admin123', async () => {
    const d = await login('admin', 'admin123');
    if (d.user.role !== 'admin') throw new Error('Wrong role');
  });

  await test('2. Login staff / staff123', async () => {
    staffToken = (await login('staff', 'staff123')).token;
  });

  await test('3. Login CU2024001 / demo123', async () => {
    const d = await login('CU2024001', 'demo123');
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  await test('3b. Login by member code CU-M-2024001', async () => {
    const d = await login('CU-M-2024001', 'demo123');
    if (!d.memberCode) throw new Error('No memberCode');
  });

  await test('3c. Login general customer by phone', async () => {
    const d = await login('60123456789', 'demo123');
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  await test('3d. Login general customer by member code GC-M-001', async () => {
    const d = await login('GC-M-001', 'demo123');
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  await test('3e. Login general customer by barcode GC001', async () => {
    const d = await login('GC001', 'demo123');
    if (d.user.role !== 'customer') throw new Error('Wrong role');
  });

  let newGeneralPhone = null;
  let newGeneralMemberCode = null;
  let newStudentId = null;
  let newStudentMemberCode = null;

  if (ALLOW_WRITE) {
    newGeneralPhone = '6019' + Date.now().toString().slice(-7);
    await test('4. Register new general customer', async () => {
      const { data } = await apiOk('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'general_customer',
          name: 'Phase2 General User',
          phone: newGeneralPhone,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      if (!data.token) throw new Error('No token');
      newGeneralMemberCode = data.member?.memberCode || data.memberCode;
      if (data.member?.customerType !== 'general_customer') throw new Error('Wrong customer type');
    });

    await test('5. New general customer can login', async () => {
      const d = await login(newGeneralPhone, 'testpass123');
      if (!d.token) throw new Error('Login failed');
    });

    await test('6. New general customer scannable by phone/member code', async () => {
      const byPhone = await apiOk(`/api/scan/${newGeneralPhone}`, {}, staffToken);
      if (!byPhone.data?.name) throw new Error('Not found by phone');
      const byCode = await apiOk(`/api/scan/${newGeneralMemberCode}`, {}, staffToken);
      if (!byCode.data?.name) throw new Error('Not found by member code');
    });

    newStudentId = 'CU' + (2025000 + Math.floor(Math.random() * 900));
    await test('7. Register new City University student', async () => {
      const { data } = await apiOk('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'city_student',
          studentId: newStudentId,
          name: 'Phase2 Student',
          programme: 'Bachelor of IT',
          email: `phase2.${Date.now()}@student.city.edu.my`,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      if (!data.token) throw new Error('No token');
      newStudentMemberCode = data.member?.memberCode;
      if (data.member?.customerType !== 'city_student') throw new Error('Wrong type');
      if (!newStudentMemberCode?.startsWith('CU-M-')) throw new Error(`Bad member code: ${newStudentMemberCode}`);
    });

    await test('8. New City student can login', async () => {
      await login(newStudentId, 'testpass123');
    });

    await test('9. New City student scannable by ID/member code', async () => {
      await apiOk(`/api/scan/${newStudentId}`, {}, staffToken);
      await apiOk(`/api/scan/${newStudentMemberCode}`, {}, staffToken);
    });

    await test('10. Duplicate student ID rejected', async () => {
      const { res } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'city_student',
          studentId: newStudentId,
          name: 'Dup',
          programme: 'IT',
          email: `dup.${Date.now()}@student.city.edu.my`,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
    });

    await test('11. Duplicate phone rejected', async () => {
      const { res } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'general_customer',
          name: 'Dup Phone',
          phone: newGeneralPhone,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
    });

    await test('12. Duplicate email rejected', async () => {
      const email = `dup.email.${Date.now()}@student.city.edu.my`;
      await apiOk('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'city_student',
          studentId: 'CU' + (2026000 + Math.floor(Math.random() * 900)),
          name: 'Email Test',
          programme: 'IT',
          email,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      const { res } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          registrationType: 'city_student',
          studentId: 'CU' + (2027000 + Math.floor(Math.random() * 900)),
          name: 'Email Dup',
          programme: 'IT',
          email,
          password: 'testpass123',
          confirmPassword: 'testpass123',
        }),
      });
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
    });
  } else {
    skip('4–12 Registration write tests', 'ALLOW_WRITE_TESTS not set');
  }

  await test('13. General customer profile is general_customer (no student offers eligibility)', async () => {
    const { data } = await apiOk('/api/scan/GC-M-001', {}, staffToken);
    if (data.customerType !== 'general_customer') throw new Error('Expected general_customer');
    const offers = await apiOk('/api/offers', {}, staffToken);
    const studentOnly = (offers.data || []).filter(o => o.customerTypeEligibility === 'city_student' && o.isActive);
    if (studentOnly.length === 0) throw new Error('Expected student-only offers in system');
  });

  await test('14. City University student has city_student type', async () => {
    const { data } = await apiOk('/api/scan/CU2024001', {}, staffToken);
    if (data.customerType !== 'city_student') throw new Error('Expected city_student');
    if (!data.name) throw new Error('Missing name');
  });

  await test('15. /api/students compatibility still works', async () => {
    const list = await apiOk('/api/students', {}, staffToken);
    if (!Array.isArray(list.data) || list.data.length < 5) throw new Error('Expected students list');
    const one = await apiOk('/api/students/CU2024001', {}, staffToken);
    if (!one.data?.student_id && !one.data?.studentId) throw new Error('Student lookup failed');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
