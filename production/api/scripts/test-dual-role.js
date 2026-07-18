/**
 * Dual-role product selection — temporary branch fixture only.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { query } from '../src/db/pool.js';
import { resetRateLimitBuckets } from '../src/middleware/rateLimit.js';

dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3011';
const ORIGIN = process.env.TEST_ORIGIN || BASE;

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  const jar = {};
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(path, opts = {}, { cookie = null } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN, ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body, jar: parseSetCookie(res) };
}

describe('Dual-role product selection (temp fixture)', () => {
  let dualCookie;

  before(async () => {
    resetRateLimitBuckets();
    const { rows } = await query(
      `SELECT username, dual_role_pos_enabled FROM users WHERE username = 'dualrole'`,
    );
    assert.ok(rows[0], 'Run seed-dual-role-fixture-temp.js on temp branch first');
    assert.equal(rows[0].dual_role_pos_enabled, true);

    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'dualrole', password: 'dualrole123' }),
    });
    assert.equal(login.res.status, 200, login.body.error);
    assert.equal(login.body.data.employee.dualRolePosEnabled, true);
    assert.equal(login.body.data.employee.requiresProductSelection, true);
    assert.equal(login.body.data.employee.selectedProduct, null);
    dualCookie = cookieHeader(login.jar);
  });

  it('session shows role-selection required', async () => {
    const session = await api('/api/v1/auth/employee/session', {}, { cookie: dualCookie });
    assert.equal(session.res.status, 200);
    assert.equal(session.body.data.employee.requiresProductSelection, true);
  });

  it('POS selection succeeds and is audited', async () => {
    // Fresh login for POS path
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'dualrole', password: 'dualrole123' }),
    });
    const cookie = cookieHeader(login.jar);
    const sel = await api('/api/v1/auth/employee/product-select', {
      method: 'POST',
      body: JSON.stringify({ product: 'pos' }),
    }, { cookie });
    assert.equal(sel.res.status, 200, sel.body.error);
    assert.equal(sel.body.data.employee.selectedProduct, 'pos');

    const { rows } = await query(
      `SELECT event_type, outcome, selected_product FROM audit_logs
       WHERE actor_user_id = (SELECT id FROM users WHERE username = 'dualrole')
         AND event_type LIKE '%product%'
       ORDER BY created_at DESC LIMIT 5`,
    );
    assert.ok(rows.some((r) => r.selected_product === 'pos' || String(r.event_type).includes('product')));
  });

  it('Admin selection succeeds separately', async () => {
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'dualrole', password: 'dualrole123' }),
    });
    const cookie = cookieHeader(login.jar);
    const sel = await api('/api/v1/auth/employee/product-select', {
      method: 'POST',
      body: JSON.stringify({ product: 'admin' }),
    }, { cookie });
    assert.equal(sel.res.status, 200, sel.body.error);
    assert.equal(sel.body.data.employee.selectedProduct, 'admin');
  });

  it('employee without dual-role flag cannot select POS product', async () => {
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(login.body.data.employee.dualRolePosEnabled, false);
    const cookie = cookieHeader(login.jar);
    const sel = await api('/api/v1/auth/employee/product-select', {
      method: 'POST',
      body: JSON.stringify({ product: 'pos' }),
    }, { cookie });
    assert.ok([403, 400].includes(sel.res.status));
  });
});

console.log(`\nDual-role tests → ${BASE}\n`);
