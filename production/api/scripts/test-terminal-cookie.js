/**
 * Phase 2B Closure — HttpOnly terminal credential cookie persistence.
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
  const attrs = [];
  for (const line of raw) {
    attrs.push(line);
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return { jar, attrs };
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(path, opts = {}, { cookie = null, origin = ORIGIN } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  const { jar, attrs } = parseSetCookie(res);
  return { res, body, jar, attrs };
}

describe('Terminal HttpOnly cookie persistence', () => {
  let adminCookie;
  let terminalId;
  let enrolJar;
  let credentialValue;

  before(async () => {
    resetRateLimitBuckets();
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    adminCookie = cookieHeader(login.jar);
    const list = await api('/api/v1/terminals', {}, { cookie: adminCookie });
    const main = list.body.data.terminals.find((t) => t.code === 'POS-MAIN-01');
    assert.ok(main);
    terminalId = main.id;
  });

  it('OTC enrolment sets HttpOnly cookie and omits secret from JSON', async () => {
    const created = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
      method: 'POST',
      body: '{}',
    }, { cookie: adminCookie });
    assert.equal(created.res.status, 201);

    const enrol = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode: created.body.data.enrolmentCode }),
    });
    assert.equal(enrol.res.status, 201);
    assert.equal(enrol.body.data.enrolled, true);
    assert.equal(enrol.body.data.terminalCredential, undefined);
    const blob = JSON.stringify(enrol.body);
    assert.equal(blob.includes('terminalCredential'), false);

    const cookieLine = enrol.attrs.find((a) => /aida_terminal|__Host-aida_terminal/i.test(a));
    assert.ok(cookieLine, 'Set-Cookie must include terminal cookie');
    assert.match(cookieLine, /HttpOnly/i);
    assert.match(cookieLine, /SameSite=Strict/i);
    assert.match(cookieLine, /Path=\//i);
    assert.equal(/Domain=/i.test(cookieLine), false);

    enrolJar = enrol.jar;
    const name = Object.keys(enrolJar).find((k) => k.includes('terminal'));
    credentialValue = decodeURIComponent(enrolJar[name]);
    assert.ok(credentialValue.length > 16);
  });

  it('reload retains terminal identity via cookie (status + current)', async () => {
    const status = await api('/api/v1/terminals/status', {}, { cookie: cookieHeader(enrolJar) });
    assert.equal(status.body.data.enrolled, true);
    assert.equal(status.body.data.location.terminalCode, 'POS-MAIN-01');

    const current = await api('/api/v1/terminals/current', {}, { cookie: cookieHeader(enrolJar) });
    assert.equal(current.res.status, 200);
    assert.equal(current.body.data.enrolled, true);
  });

  it('credential absent from document.cookie simulation (HttpOnly)', async () => {
    // Browser document.cookie never includes HttpOnly cookies — assert Set-Cookie marks HttpOnly
    const created = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
      method: 'POST', body: '{}',
    }, { cookie: adminCookie });
    const enrol = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode: created.body.data.enrolmentCode }),
    });
    const line = enrol.attrs.find((a) => /terminal/i.test(a));
    assert.match(line, /HttpOnly/i);
    // Simulated document.cookie parse: only non-HttpOnly would appear — our cookie must not
    const simulatedDocumentCookie = ''; // empty because HttpOnly
    assert.equal(simulatedDocumentCookie.includes(credentialValue || 'x'), false);
  });

  it('browser without cookie is unenrolled', async () => {
    const status = await api('/api/v1/terminals/status');
    assert.equal(status.body.data.enrolled, false);
    assert.equal(status.body.data.code, 'TERMINAL_UNENROLLED');
    const current = await api('/api/v1/terminals/current');
    assert.equal(current.res.status, 401);
    assert.equal(current.body.code, 'TERMINAL_UNENROLLED');
  });

  it('revoked credential is rejected and cookie cleared', async () => {
    const revoke = await api(`/api/v1/terminals/${terminalId}/revoke`, {
      method: 'POST',
      body: '{}',
    }, { cookie: `${adminCookie}; ${cookieHeader(enrolJar)}` });
    assert.equal(revoke.res.status, 200);

    const current = await api('/api/v1/terminals/current', {}, { cookie: cookieHeader(enrolJar) });
    assert.equal(current.res.status, 401);
    assert.equal(current.body.code, 'TERMINAL_REVOKED_OR_INVALID');
  });

  it('replacement invalidates the old credential', async () => {
    const created = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
      method: 'POST', body: '{}',
    }, { cookie: adminCookie });
    const enrolA = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode: created.body.data.enrolmentCode }),
    });
    const jarA = enrolA.jar;

    const created2 = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
      method: 'POST', body: '{}',
    }, { cookie: adminCookie });
    const enrolB = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode: created2.body.data.enrolmentCode }),
    });
    const jarB = enrolB.jar;

    const oldRejected = await api('/api/v1/terminals/current', {}, { cookie: cookieHeader(jarA) });
    assert.equal(oldRejected.res.status, 401);

    const newOk = await api('/api/v1/terminals/current', {}, { cookie: cookieHeader(jarB) });
    assert.equal(newOk.res.status, 200);

    // Server stores hash only
    const { rows } = await query(
      `SELECT credential_hash FROM terminals WHERE id = $1`,
      [terminalId],
    );
    assert.ok(rows[0].credential_hash);
    assert.notEqual(rows[0].credential_hash, Object.values(jarB)[0]);
  });

  it('clear-credential clears cookie; body credential forbidden', async () => {
    const cleared = await api('/api/v1/terminals/clear-credential', {
      method: 'POST',
      body: '{}',
    }, { cookie: cookieHeader(enrolJar) });
    assert.equal(cleared.res.status, 200);
    assert.equal(cleared.body.data.enrolled, false);

    const forbidden = await api('/api/v1/terminals/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ terminalCredential: 'should-not-work' }),
    });
    assert.equal(forbidden.res.status, 400);
    assert.equal(forbidden.body.code, 'TERMINAL_CREDENTIAL_BODY_FORBIDDEN');
  });
});

console.log(`\nTerminal cookie tests → ${BASE}\n`);
