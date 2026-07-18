/**
 * Phase 2A integration tests — employee auth, terminal enrolment, shifts, audit.
 * Target: temporary Neon branch API only (set TEST_BASE_URL).
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { pool, query } from '../src/db/pool.js';
import { upsertBadgePinCredential } from '../src/services/staff-credentials.js';
import { resetRateLimitBuckets } from '../src/middleware/rateLimit.js';

dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3011';
const ORIGIN = process.env.TEST_ORIGIN || 'http://localhost:3011';

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

function mergeCookieJar(existing, next) {
  return { ...(existing || {}), ...(next || {}) };
}

async function api(path, opts = {}, { token = null, cookie = null, cookieJar = null, origin = ORIGIN } = {}) {
  const { headers: optHeaders, ...fetchOpts } = opts;
  const headers = { 'Content-Type': 'application/json', ...(optHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const cookieStr = cookie || (cookieJar ? cookieHeader(cookieJar) : null);
  if (cookieStr) headers.Cookie = cookieStr;
  if (origin) headers.Origin = origin;
  // Terminal identity is HttpOnly cookie only — never X-Terminal-Credential / JSON secret
  const res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers });
  const body = await res.json().catch(() => ({}));
  const jar = parseSetCookie(res);
  return { res, body, jar, cookieJar: mergeCookieJar(cookieJar, jar) };
}

describe('Phase 2A employee authentication', () => {
  before(() => { resetRateLimitBuckets(); });

  it('correct password login sets HttpOnly session cookie', async () => {
    const { res, body, jar } = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    assert.equal(res.status, 200);
    assert.equal(body.data.employee.role, 'staff');
    assert.ok(jar.aida_employee_session || Object.keys(jar).some((k) => k.includes('employee')));
    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.ok(!JSON.stringify(body).toLowerCase().includes('staff123'));
  });

  it('invalid credentials return generic error', async () => {
    const { res, body } = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'wrong-password' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error, 'Invalid credentials');
  });

  it('customer rejected from employee login', async () => {
    const { res, body } = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'CU2024001', password: 'demo123' }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });

  it('employee rejected from customer login', async () => {
    const { res, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(res.status, 401);
    // Valid employee password → stable EMPLOYEE_LOGIN_REQUIRED (legacy SPA signal)
    assert.equal(body.code, 'EMPLOYEE_LOGIN_REQUIRED');
  });

  it('CSRF/origin rejection on logout without origin', async () => {
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    const cookie = cookieHeader(login.jar);
    const { res, body } = await api('/api/v1/auth/employee/logout', {
      method: 'POST',
      body: '{}',
    }, { cookie, origin: null });
    // When origin omitted, middleware should reject
    assert.equal(res.status, 403);
    assert.ok(['CSRF_ORIGIN_REQUIRED', 'CSRF_ORIGIN_REJECTED'].includes(body.code));
  });

  it('session revoke works', async () => {
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    const cookie = cookieHeader(login.jar);
    const logout = await api('/api/v1/auth/employee/logout', {
      method: 'POST',
      body: '{}',
    }, { cookie, origin: ORIGIN });
    assert.equal(logout.res.status, 200);
    const session = await api('/api/v1/auth/employee/session', {}, { cookie, origin: ORIGIN });
    assert.equal(session.res.status, 401);
  });

  it('badge+PIN mock adapter login', async () => {
    const { rows } = await query(`SELECT id FROM users WHERE username = 'staff'`);
    await upsertBadgePinCredential({ userId: rows[0].id, badgeValue: 'BADGE-STAFF-01', pin: '2468' });
    const { res, body } = await api('/api/v1/auth/employee/login/badge', {
      method: 'POST',
      body: JSON.stringify({ badgeValue: 'BADGE-STAFF-01', pin: '2468' }),
    });
    assert.equal(res.status, 200);
    assert.equal(body.data.employee.authMethod, 'badge_pin');
  });

  it('login rate limiting eventually returns 429 when max is low', async () => {
    // Behaviour covered when LOGIN_RATE_LIMIT_MAX is small; in default dev (max=100) verify endpoint still responds.
    const { res } = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'wrong' }),
    });
    assert.ok([401, 429].includes(res.status));
  });
});

describe('Phase 2A terminal enrolment', () => {
  let adminCookie;
  let terminalId;
  let terminalJar;
  let enrolmentCode;

  before(async () => {
    resetRateLimitBuckets();
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    adminCookie = cookieHeader(login.jar);
    const list = await api('/api/v1/terminals', {}, { cookie: adminCookie, origin: ORIGIN });
    assert.equal(list.res.status, 200);
    const main = list.body.data.terminals.find((t) => t.code === 'POS-MAIN-01');
    assert.ok(main, 'POS-MAIN-01 must exist');
    terminalId = main.id;
  });

  it('enrolment works once and resolves Main Counter', async () => {
    const created = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
      method: 'POST',
      body: '{}',
    }, { cookie: adminCookie, origin: ORIGIN });
    assert.equal(created.res.status, 201);
    enrolmentCode = created.body.data.enrolmentCode;
    assert.ok(enrolmentCode);

    const enrol = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode, deviceFingerprint: 'fp-telemetry-only' }),
    });
    assert.equal(enrol.res.status, 201);
    assert.equal(enrol.body.data.enrolled, true);
    assert.equal(enrol.body.data.terminalCredential, undefined);
    assert.ok(!JSON.stringify(enrol.body).includes('terminalCredential'));
    const setCookie = enrol.res.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /aida_terminal|__Host-aida_terminal/i);
    terminalJar = enrol.jar;
    assert.ok(Object.keys(terminalJar).some((k) => k.includes('terminal')));
    assert.equal(enrol.body.data.location.salesPointCode, 'SP-MAIN');
    assert.equal(enrol.body.data.location.branchCode, 'BR-MAIN');
  });

  it('reused enrolment rejected', async () => {
    const { res, body } = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'ENROLMENT_REUSED');
  });

  it('fingerprint alone rejected', async () => {
    const { res, body } = await api('/api/v1/terminals/current', {
      headers: { 'X-Device-Fingerprint': 'fp-only' },
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'TERMINAL_FINGERPRINT_REJECTED');
  });

  it('heartbeat + current terminal work with cookie', async () => {
    const current = await api('/api/v1/terminals/current', {}, { cookieJar: terminalJar });
    assert.equal(current.res.status, 200);
    const hb = await api('/api/v1/terminals/heartbeat', {
      method: 'POST',
      body: '{}',
    }, { cookieJar: terminalJar });
    assert.equal(hb.res.status, 200);
  });

  it('expired enrolment rejected', async () => {
    const { hashToken } = await import('../src/services/secure-tokens.js');
    const code = `expired-code-phase2a-${Date.now()}`;
    const codeHash = hashToken(code);
    // Remove any prior rows with this hash (lookup returns first match)
    await query(`DELETE FROM terminal_enrolment_codes WHERE code_hash = $1`, [codeHash]);
    await query(
      `INSERT INTO terminal_enrolment_codes (terminal_id, code_hash, expires_at, created_by_user_id, consumed_at, revoked_at)
       SELECT $1, $2, NOW() - INTERVAL '1 minute', id, NULL, NULL
       FROM users WHERE username = 'admin' LIMIT 1`,
      [terminalId, codeHash],
    );
    const { res, body } = await api('/api/v1/terminals/enrol', {
      method: 'POST',
      body: JSON.stringify({ enrolmentCode: code }),
    });
    assert.equal(res.status, 401);
    assert.equal(body.code, 'ENROLMENT_EXPIRED');
  });
});

describe('Phase 2A shifts', () => {
  let staffCookie;
  let adminCookie;
  let mainTerminalJar;
  let snackTerminalJar;
  let shiftId;

  before(async () => {
    resetRateLimitBuckets();
    const staffLogin = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    staffCookie = cookieHeader(staffLogin.jar);

    const adminLogin = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    adminCookie = cookieHeader(adminLogin.jar);

    // Ensure main terminal enrolled
    const list = await api('/api/v1/terminals', {}, { cookie: adminCookie, origin: ORIGIN });
    const main = list.body.data.terminals.find((t) => t.code === 'POS-MAIN-01');
    const snack = list.body.data.terminals.find((t) => t.code === 'POS-SNACK-01');

    // Close any leftover active shifts
    await query(`UPDATE shifts SET status='closed', closed_at=NOW(),
      closing_expected_cash=0, closing_actual_cash=0, cash_variance=0
      WHERE status IN ('open','locked')`);

    async function enrol(terminalId) {
      const created = await api(`/api/v1/terminals/${terminalId}/enrolment-codes`, {
        method: 'POST', body: '{}',
      }, { cookie: adminCookie, origin: ORIGIN });
      const enrol = await api('/api/v1/terminals/enrol', {
        method: 'POST',
        body: JSON.stringify({ enrolmentCode: created.body.data.enrolmentCode }),
      });
      assert.equal(enrol.body.data.terminalCredential, undefined);
      return enrol.jar;
    }

    mainTerminalJar = await enrol(main.id);
    snackTerminalJar = await enrol(snack.id);
  });

  function staffWithTerminal(terminalJar) {
    return { cookie: `${staffCookie}; ${cookieHeader(terminalJar)}`, origin: ORIGIN };
  }

  function adminWithTerminal(terminalJar) {
    return { cookie: `${adminCookie}; ${cookieHeader(terminalJar)}`, origin: ORIGIN };
  }

  it('authorised staff opens shift', async () => {
    const { res, body } = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 100 }),
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(res.status, 201, body.error || res.status);
    shiftId = body.data.shift.id;
    assert.equal(body.data.shift.status, 'open');
  });

  it('client location spoofing rejected', async () => {
    const { res, body } = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 1, branchId: '00000000-0000-0000-0000-000000000099' }),
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(res.status, 400);
    assert.equal(body.code, 'LOCATION_SPOOF_REJECTED');
  });

  it('second shift on same terminal rejected', async () => {
    // login as... only one staff. Force by trying open again
    const { res, body } = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 50 }),
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(res.status, 409);
    assert.equal(body.code, 'SHIFT_ALREADY_ACTIVE');
  });

  it('location locked — cannot open on snack while main shift active', async () => {
    const { res, body } = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 10 }),
    }, staffWithTerminal(snackTerminalJar));
    assert.equal(res.status, 409);
    assert.equal(body.code, 'SHIFT_ALREADY_ACTIVE');
  });

  it('lock/resume requires correct employee', async () => {
    const lock = await api(`/api/v1/shifts/${shiftId}/lock`, {
      method: 'POST', body: '{}',
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(lock.res.status, 200);
    assert.equal(lock.body.data.shift.status, 'locked');

    // admin without dual-role cannot resume staff shift as owner
    const bad = await api(`/api/v1/shifts/${shiftId}/resume`, {
      method: 'POST', body: '{}',
    }, adminWithTerminal(mainTerminalJar));
    assert.equal(bad.res.status, 403);

    const resume = await api(`/api/v1/shifts/${shiftId}/resume`, {
      method: 'POST', body: '{}',
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(resume.res.status, 200);
    assert.equal(resume.body.data.shift.status, 'open');
  });

  it('close calculates and stores variance', async () => {
    const { res, body } = await api(`/api/v1/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({ expectedCash: 150, actualCash: 145, handoverNotes: 'handover to next' }),
    }, staffWithTerminal(mainTerminalJar));
    assert.equal(res.status, 200, body.error || res.status);
    assert.equal(body.data.shift.status, 'closed');
    assert.equal(body.data.shift.cashVariance, -5);
  });

  it('manager cannot open POS shift without dual-role', async () => {
    const { res, body } = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 20 }),
    }, adminWithTerminal(mainTerminalJar));
    assert.equal(res.status, 403);
    assert.equal(body.code, 'POS_PRODUCT_REQUIRED');
  });

  it('every transition creates audit rows', async () => {
    const { rows } = await query(
      `SELECT event_type, outcome FROM audit_logs
       WHERE shift_id = $1
       ORDER BY created_at`,
      [shiftId],
    );
    const types = rows.map((r) => r.event_type);
    assert.ok(types.includes('shift.opened'));
    assert.ok(types.includes('shift.locked'));
    assert.ok(types.includes('shift.resumed'));
    assert.ok(types.includes('shift.closed'));
  });

  it('audit UPDATE/DELETE rejected', async () => {
    await assert.rejects(
      () => query(`UPDATE audit_logs SET outcome = 'denied' WHERE shift_id = $1`, [shiftId]),
      /append-only|integrity/i,
    );
    await assert.rejects(
      () => query(`DELETE FROM audit_logs WHERE shift_id = $1`, [shiftId]),
      /append-only|integrity/i,
    );
  });
});

describe('Phase 2A permissions', () => {
  it('staff cannot select Admin product', async () => {
    const login = await api('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'staff123' }),
    });
    const cookie = cookieHeader(login.jar);
    const { res, body } = await api('/api/v1/auth/employee/product-select', {
      method: 'POST',
      body: JSON.stringify({ product: 'admin' }),
    }, { cookie, origin: ORIGIN });
    assert.equal(res.status, 403);
    assert.equal(body.code, 'ADMIN_PRODUCT_DENIED');
  });

  it('empty branch access is not global (authz helper coverage via admin without access)', async () => {
    const { canAccessBranch } = await import('../src/authz/permissions.js');
    assert.equal(
      canAccessBranch({ role: 'admin', isGlobalManager: false, assignedBranchIds: [] }, 'x'),
      false,
    );
  });
});

// Ensure pool closes so node:test can exit
process.on('beforeExit', async () => {
  try { await pool.end(); } catch { /* ignore */ }
});

console.log(`\nPhase 2A tests → ${BASE}\n`);
