/**
 * /api/v1 security parity + negative authorization tests (Phase 1A closure).
 * Does not call planned endpoints as if they were live.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {
  canAccessProduct,
  hasGlobalManagerCapability,
  canAccessBranch,
} from '../src/authz/permissions.js';

dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function api(path, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function loginCustomer(username, password) {
  const { res, body } = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `customer login ${username}: ${body.error || res.status}`);
  return body.data;
}

async function loginEmployee(username, password) {
  const { res, body } = await api('/api/v1/auth/employee/legacy-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `legacy employee login ${username}: ${body.error || res.status}`);
  assert.ok(body.data?.token, 'legacy Bearer token required for dual-run APIs');
  assert.equal(body.data?.deprecated, true);
  return { token: body.data.token, employee: body.data.user };
}

describe('/api/v1 catalog (public, no secrets)', () => {
  it('exposes implemented vs planned without secrets or DB config', async () => {
    const { res, body } = await api('/api/v1');
    assert.equal(res.status, 200);
    assert.equal(body.version, 'v1');
    assert.ok(Array.isArray(body.endpoints?.implemented));
    assert.ok(Array.isArray(body.endpoints?.planned_not_implemented));
    const blob = JSON.stringify(body).toLowerCase();
    for (const forbidden of ['password', 'jwt_secret', 'database_url', 'connectionstring', 'neon.tech', 'postgres://']) {
      assert.equal(blob.includes(forbidden), false, `catalog must not contain ${forbidden}`);
    }
  });

  it('still-planned endpoints are not operational success handlers', async () => {
    const planned = [
      { path: '/api/v1/audit-logs', method: 'GET' },
    ];
    for (const { path, method } of planned) {
      const { res } = await api(path, {
        method,
        body: method === 'POST' ? '{}' : undefined,
      });
      assert.notEqual(res.status, 200, `${path} must not succeed`);
      assert.notEqual(res.status, 201, `${path} must not create resources`);
      assert.ok(
        res.status === 404 || res.status === 401 || res.status === 405 || res.status === 501,
        `${path} unexpected status ${res.status}`,
      );
    }
  });

  it('employee login rejects customers with generic credentials error', async () => {
    const { res, body } = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'CU2024001', password: 'demo123' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });

  it('customer login rejects employees with EMPLOYEE_LOGIN_REQUIRED when password valid', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'EMPLOYEE_LOGIN_REQUIRED');
  });
});


describe('/api/v1 negative authz', () => {
  it('rejects unauthenticated access to secured resources', async () => {
    for (const path of ['/api/v1/menu', '/api/v1/members', '/api/v1/scan/CU2024001', '/api/v1/analytics/overview', '/api/v1/orders/transactions']) {
      const { res } = await api(path);
      assert.equal(res.status, 401, `${path} should be 401`);
    }
  });

  it('rejects customer access to employee/management resources', async () => {
    const customer = await loginCustomer('CU2024001', 'demo123');
    const token = customer.token;

    const scan = await api('/api/v1/scan/CU2024001', {}, token);
    assert.equal(scan.res.status, 403, 'customer scan');

    const analytics = await api('/api/v1/analytics/overview', {}, token);
    assert.equal(analytics.res.status, 403, 'customer analytics');

    const createMember = await api('/api/v1/members', {
      method: 'POST',
      body: JSON.stringify({ name: 'Nope', customerType: 'general_customer' }),
    }, token);
    assert.equal(createMember.res.status, 403, 'customer create member');

    const sales = await api('/api/v1/orders/sales', {
      method: 'POST',
      body: JSON.stringify({ memberCode: 'CU2024001', items: [] }),
    }, token);
    assert.equal(sales.res.status, 403, 'customer create sale');
  });

  it('rejects staff access to manager analytics', async () => {
    const staff = await loginEmployee('staff', 'staff123');
    const { res } = await api('/api/v1/analytics/overview', {}, staff.token);
    assert.equal(res.status, 403);
  });

  it('legacy /api and /api/v1 share role denial for analytics', async () => {
    const staff = await loginEmployee('staff', 'staff123');
    const legacy = await api('/api/analytics/overview', {}, staff.token);
    const v1 = await api('/api/v1/analytics/overview', {}, staff.token);
    assert.equal(legacy.res.status, 403);
    assert.equal(v1.res.status, 403);
  });
});

describe('authz helpers — manager POS capability', () => {
  it('denies manager POS product without explicit selectedProduct=pos', () => {
    const manager = {
      role: 'admin',
      isGlobalManager: true,
      selectedProduct: 'admin',
      assignedBranchIds: [],
    };
    assert.equal(canAccessProduct(manager, 'pos'), false);
    assert.equal(canAccessProduct(manager, 'admin'), true);
    assert.equal(hasGlobalManagerCapability(manager), true);
  });

  it('empty branch access never grants global for non-flagged admin', () => {
    const admin = { role: 'admin', isGlobalManager: false, assignedBranchIds: [] };
    assert.equal(canAccessBranch(admin, 'any-branch'), false);
  });
});

console.log(`\n/api/v1 security tests → ${BASE}\n`);
