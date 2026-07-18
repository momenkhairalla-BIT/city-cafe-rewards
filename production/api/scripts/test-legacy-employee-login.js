/**
 * Phase 2B Closure — legacy employee login + customer fallback rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3012';
const LEGACY_ENABLED = process.env.ENABLE_LEGACY_EMPLOYEE_LOGIN === '1'
  || process.env.TEST_LEGACY_ENABLED === '1';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

describe('legacy employee login + customer fallback', () => {
  it('valid customer → customer flow only (no employee token)', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'CU2024001', password: 'demo123' }),
    });
    assert.equal(res.status, 200);
    assert.equal(body.data?.user?.role, 'customer');
    assert.ok(body.data?.token);
    assert.equal(body.code, undefined);
  });

  it('wrong customer password → INVALID_CREDENTIALS (no EMPLOYEE_LOGIN_REQUIRED)', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'CU2024001', password: 'wrong-password-xyz' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
    assert.notEqual(body.code, 'EMPLOYEE_LOGIN_REQUIRED');
  });

  it('valid employee on customer endpoint → EMPLOYEE_LOGIN_REQUIRED only', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'EMPLOYEE_LOGIN_REQUIRED');
  });

  it('wrong employee password on customer endpoint → INVALID_CREDENTIALS (no fallback signal)', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'not-the-password' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });

  it('valid legacy employee with flag enabled → legacy employee flow', async () => {
    const { res, body } = await api('/api/v1/auth/employee/legacy-login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    if (!LEGACY_ENABLED && res.status === 403) {
      assert.equal(body.code, 'LEGACY_EMPLOYEE_LOGIN_DISABLED');
      return;
    }
    assert.equal(res.status, 200);
    assert.equal(body.data?.deprecated, true);
    assert.ok(body.data?.token);
    assert.equal(JSON.stringify(body).toLowerCase().includes('staff123'), false);
  });

  it('flag disabled → legacy employee flow denied', async () => {
    // When server started without ENABLE_LEGACY_EMPLOYEE_LOGIN=1
    if (LEGACY_ENABLED) {
      // Documented: run a second server instance with flag off for this assertion
      assert.ok(true, 'skipped when TEST_LEGACY_ENABLED=1 — run separately with flag off');
      return;
    }
    const { res, body } = await api('/api/v1/auth/employee/legacy-login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    assert.equal(res.status, 403);
    assert.equal(body.code, 'LEGACY_EMPLOYEE_LOGIN_DISABLED');
  });

  it('legacy endpoint rejects badge/PIN payloads', async () => {
    const { res, body } = await api('/api/v1/auth/employee/legacy-login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'staff',
        password: 'staff123',
        badgeValue: 'X',
        pin: '1234',
      }),
    });
    assert.ok(res.status === 400 || res.status === 403);
    if (res.status === 400) assert.equal(body.code, 'LEGACY_BADGE_NOT_ALLOWED');
  });
});

console.log(`\nLegacy employee login tests → ${BASE} (LEGACY_ENABLED hint=${LEGACY_ENABLED})\n`);
