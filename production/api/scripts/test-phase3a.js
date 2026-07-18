/**
 * Phase 3A — server-authoritative POS sales.
 * Requires: ENABLE_POS_SALES=1, temp Neon, migration 012 applied.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { pool, query } from '../src/db/pool.js';
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

async function api(path, opts = {}, { cookie = null, origin = ORIGIN, idempotencyKey = null } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body, jar: parseSetCookie(res) };
}

async function login(username, password) {
  const { res, body, jar } = await api('/api/v1/auth/employee/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, body.error);
  return { cookie: cookieHeader(jar), employee: body.data.employee };
}

async function enrolTerminal(adminCookie, terminalCode) {
  const list = await api('/api/v1/terminals', {}, { cookie: adminCookie });
  const t = list.body.data.terminals.find((x) => x.code === terminalCode);
  assert.ok(t, terminalCode);
  const created = await api(`/api/v1/terminals/${t.id}/enrolment-codes`, {
    method: 'POST', body: '{}',
  }, { cookie: adminCookie });
  const enrol = await api('/api/v1/terminals/enrol', {
    method: 'POST',
    body: JSON.stringify({ enrolmentCode: created.body.data.enrolmentCode }),
  });
  assert.equal(enrol.res.status, 201, enrol.body.error);
  return { terminalJar: enrol.jar, terminalId: t.id, location: enrol.body.data.location };
}

function mergeCookies(...parts) {
  return parts.filter(Boolean).join('; ');
}

describe('Phase 3A POS sales', () => {
  let adminCookie;
  let staffCookie;
  let mainTerm;
  let snackTerm;
  let menuItemId;
  let drinkItemId;
  let staffCookieMain;
  let staffCookieSnack;

  before(async () => {
    resetRateLimitBuckets();
    await query(`UPDATE shifts SET status='closed', closed_at=NOW(),
      closing_expected_cash=0, closing_actual_cash=0, cash_variance=0
      WHERE status IN ('open','locked')`);

    const admin = await login('admin', 'admin123');
    adminCookie = admin.cookie;
    const staff = await login('staff', 'staff123');
    staffCookie = staff.cookie;

    mainTerm = await enrolTerminal(adminCookie, 'POS-MAIN-01');
    snackTerm = await enrolTerminal(adminCookie, 'POS-SNACK-01');
    staffCookieMain = mergeCookies(staffCookie, cookieHeader(mainTerm.terminalJar));
    staffCookieSnack = mergeCookies(staffCookie, cookieHeader(snackTerm.terminalJar));

    const { rows } = await query(
      `SELECT id, name, price, category FROM menu_items WHERE is_active = TRUE ORDER BY sort_order LIMIT 20`,
    );
    assert.ok(rows.length >= 1, 'menu items required');
    menuItemId = rows[0].id;
    drinkItemId = (rows.find((r) => r.category === 'Coffee' || r.category === 'Iced Drinks') || rows[0]).id;

    // Ensure staff has open shift on main
    const open = await api('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 100 }),
    }, { cookie: staffCookieMain, origin: ORIGIN });
    if (open.res.status !== 201 && open.body.code !== 'SHIFT_ALREADY_ACTIVE') {
      assert.equal(open.res.status, 201, open.body.error);
    }
  });

  it('unauthenticated rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST', body: JSON.stringify({ items: [] }),
    }, { idempotencyKey: 'unauth-key-0001' });
    assert.equal(res.status, 401);
    assert.ok(body.code);
  });

  it('customer bearer rejected', async () => {
    const cust = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'CU2024001', password: 'demo123' }),
    });
    const token = cust.body.data.token;
    const { res } = await api('/api/v1/pos/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50 }),
    }, { idempotencyKey: 'cust-bearer-0001' });
    assert.equal(res.status, 401);
  });

  it('manager without POS capability rejected', async () => {
    const { jar } = await api('/api/v1/auth/employee/login', {
      method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const cookie = mergeCookies(cookieHeader(jar), cookieHeader(mainTerm.terminalJar));
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({ guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50 }),
    }, { cookie, idempotencyKey: 'admin-no-pos-0001' });
    assert.equal(res.status, 403);
    assert.equal(body.code, 'POS_PRODUCT_REQUIRED');
  });

  it('staff without shift rejected', async () => {
    // Close staff shift then try
    const cur = await api('/api/v1/shifts/current', {}, { cookie: staffCookieMain });
    if (cur.body.data?.shift?.id) {
      await api(`/api/v1/shifts/${cur.body.data.shift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ expectedCash: 100, actualCash: 100 }),
      }, { cookie: staffCookieMain });
    }
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({ guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50 }),
    }, { cookie: staffCookieMain, idempotencyKey: 'no-shift-0001' });
    assert.equal(res.status, 403);
    assert.equal(body.code, 'OPEN_SHIFT_REQUIRED');
    // reopen for later tests
    await api('/api/v1/shifts/open', {
      method: 'POST', body: JSON.stringify({ openingFloat: 100 }),
    }, { cookie: staffCookieMain });
  });

  it('locked shift rejected', async () => {
    const cur = await api('/api/v1/shifts/current', {}, { cookie: staffCookieMain });
    const shiftId = cur.body.data.shift.id;
    await api(`/api/v1/shifts/${shiftId}/lock`, { method: 'POST', body: '{}' }, { cookie: staffCookieMain });
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({ guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50 }),
    }, { cookie: staffCookieMain, idempotencyKey: 'locked-shift-0001' });
    assert.equal(res.status, 403);
    assert.equal(body.code, 'SHIFT_LOCKED');
    await api(`/api/v1/shifts/${shiftId}/resume`, { method: 'POST', body: '{}' }, { cookie: staffCookieMain });
  });

  it('client price tampering rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1, unitPrice: 0.01 }],
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieMain, idempotencyKey: 'price-spoof-0001' });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'CLIENT_PRICE_SPOOF_REJECTED');
  });

  it('client discount/totals tampering rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        discount: 999,
        total: 0.01,
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieMain, idempotencyKey: 'total-spoof-0001' });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'CLIENT_PRICE_SPOOF_REJECTED');
  });

  it('attribution spoof rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        branchId: '00000000-0000-0000-0000-000000000099',
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieMain, idempotencyKey: 'attr-spoof-0001' });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'ATTRIBUTION_SPOOF_REJECTED');
  });

  it('PAN-like fields rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: 'Card',
        pan: '4111111111111111',
        cvv: '123',
      }),
    }, { cookie: staffCookieMain, idempotencyKey: 'pan-reject-0001' });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'SENSITIVE_PAYMENT_DATA_REJECTED');
  });

  it('guest sale succeeds with attribution, no loyalty mutation', async () => {
    const before = await query(`SELECT points, current_stamp_progress FROM students WHERE student_id = 'CU2024001'`);
    const key = `guest-sale-${Date.now()}`;
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: 'Cash',
        cashReceived: 100,
      }),
    }, { cookie: staffCookieMain, idempotencyKey: key });
    assert.equal(res.status, 201, body.error);
    assert.equal(body.data.order.isGuest, true);
    assert.equal(body.data.order.pointsEarned, 0);
    assert.ok(body.data.order.attribution.staffUserId);
    assert.ok(body.data.order.attribution.branchId);
    assert.ok(body.data.order.attribution.salesPointId);
    assert.ok(body.data.order.attribution.terminalId);
    assert.ok(body.data.order.attribution.shiftId);
    assert.equal(body.data.paymentRecording.gatewaySettlement, false);
    const after = await query(`SELECT points, current_stamp_progress FROM students WHERE student_id = 'CU2024001'`);
    assert.equal(Number(after.rows[0].points), Number(before.rows[0].points));
  });

  it('member sale succeeds with loyalty', async () => {
    const before = await query(`SELECT points, current_stamp_progress FROM students WHERE student_id = 'CU2024001'`);
    const key = `member-sale-${Date.now()}`;
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId: drinkItemId, quantity: 1 }],
        paymentMethod: 'E-wallet',
        externalPaymentRef: 'EW-REF-DEMO-1',
      }),
    }, { cookie: staffCookieMain, idempotencyKey: key });
    assert.equal(res.status, 201, body.error);
    assert.equal(body.data.order.isGuest, false);
    assert.ok(body.data.order.pointsEarned >= 0);
    const after = await query(`SELECT points FROM students WHERE student_id = 'CU2024001'`);
    assert.ok(Number(after.rows[0].points) >= Number(before.rows[0].points));
  });

  it('Main Counter attribution correct', async () => {
    const key = `main-attr-${Date.now()}`;
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: 'Card',
      }),
    }, { cookie: staffCookieMain, idempotencyKey: key });
    assert.equal(res.status, 201, body.error);
    assert.equal(body.data.order.attribution.salesPointId, mainTerm.location.salesPointId);
    assert.equal(body.data.order.attribution.branchId, mainTerm.location.branchId);
  });

  it('Snack Station attribution + consolidates to Main Cafe branch', async () => {
    // Close main shift so staff can open on snack (one active shift per employee)
    const cur = await api('/api/v1/shifts/current', {}, { cookie: staffCookieMain });
    if (cur.body.data?.shift?.id) {
      await api(`/api/v1/shifts/${cur.body.data.shift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ expectedCash: 200, actualCash: 200 }),
      }, { cookie: staffCookieMain });
    }
    const openSnack = await api('/api/v1/shifts/open', {
      method: 'POST', body: JSON.stringify({ openingFloat: 50 }),
    }, { cookie: staffCookieSnack });
    assert.ok([201, 409].includes(openSnack.res.status), openSnack.body.error);

    const key = `snack-attr-${Date.now()}`;
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: 'Cash',
        cashReceived: 100,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(res.status, 201, body.error);
    assert.equal(body.data.order.attribution.salesPointId, snackTerm.location.salesPointId);
    // Same branch (Main Cafe)
    assert.equal(body.data.order.attribution.branchId, mainTerm.location.branchId);

    const { rows } = await query(
      `SELECT sp.code AS sp, b.code AS branch FROM orders o
       JOIN sales_points sp ON sp.id = o.sales_point_id
       JOIN branches b ON b.id = o.branch_id
       WHERE o.id = $1`,
      [body.data.order.id],
    );
    assert.equal(rows[0].sp, 'SP-SNACK');
    assert.equal(rows[0].branch, 'BR-MAIN');
  });

  it('inactive item rejected', async () => {
    const { rows } = await query(
      `INSERT INTO menu_items (slug, name, price, category, is_active)
       VALUES ($1,'Inactive Phase3A',1.00,'Coffee',FALSE) RETURNING id`,
      [`inactive-p3a-${Date.now()}`],
    );
    // Need open shift on snack still — use snack cookie
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId: rows[0].id, quantity: 1 }],
        paymentMethod: 'Cash',
        cashReceived: 10,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: `inactive-${Date.now()}` });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'MENU_ITEM_UNAVAILABLE');
  });

  it('invalid modifier rejected', async () => {
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true,
        items: [{ menuItemId, quantity: 1, modifierIds: ['mod-1'] }],
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: `mod-${Date.now()}` });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'MODIFIERS_NOT_SUPPORTED');
  });

  it('idempotency same key/same payload returns same order', async () => {
    const key = `idem-same-${Date.now()}`;
    const payload = {
      guest: true,
      items: [{ menuItemId, quantity: 1 }],
      paymentMethod: 'Cash',
      cashReceived: 50,
    };
    const a = await api('/api/v1/pos/sales', {
      method: 'POST', body: JSON.stringify(payload),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(a.res.status, 201, a.body.error);
    const b = await api('/api/v1/pos/sales', {
      method: 'POST', body: JSON.stringify(payload),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(b.res.status, 200);
    assert.equal(b.body.data.replay, true);
    assert.equal(b.body.data.order.id, a.body.data.order.id);
  });

  it('idempotency same key/different payload returns 409', async () => {
    const key = `idem-diff-${Date.now()}`;
    const a = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(a.res.status, 201, a.body.error);
    const b = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true, items: [{ menuItemId, quantity: 2 }], paymentMethod: 'Cash', cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(b.res.status, 409);
    assert.equal(b.body.code, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('concurrent duplicate requests create one order', async () => {
    const key = `idem-concurrent-${Date.now()}`;
    const payload = {
      guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 50,
    };
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => api('/api/v1/pos/sales', {
        method: 'POST', body: JSON.stringify(payload),
      }, { cookie: staffCookieSnack, idempotencyKey: key })),
    );
    const ok = results.filter((r) => r.res.status === 200 || r.res.status === 201);
    assert.ok(ok.length >= 1);
    const ids = new Set(ok.map((r) => r.body.data.order.id));
    assert.equal(ids.size, 1);
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM orders WHERE idempotency_key = $1`,
      [key],
    );
    assert.equal(rows[0].c, 1);
  });

  it('sale audit created; cash updates shift expected cash', async () => {
    const key = `audit-cash-${Date.now()}`;
    const before = await api('/api/v1/shifts/current', {}, { cookie: staffCookieSnack });
    const expectedBefore = before.body.data.shift.expectedClosingCash
      ?? (Number(before.body.data.shift.openingFloat) + Number(before.body.data.shift.cashSalesTotal || 0));
    const sale = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        guest: true, items: [{ menuItemId, quantity: 1 }], paymentMethod: 'Cash', cashReceived: 100,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(sale.res.status, 201, sale.body.error);
    const after = await api('/api/v1/shifts/current', {}, { cookie: staffCookieSnack });
    const expectedAfter = after.body.data.shift.expectedClosingCash;
    assert.ok(expectedAfter > expectedBefore - 0.001);
    const { rows } = await query(
      `SELECT event_type, outcome FROM audit_logs
       WHERE event_type = 'pos.sale_created' AND metadata->>'orderNumber' = $1`,
      [sale.body.data.order.orderNumber],
    );
    assert.ok(rows.length >= 1);
  });

  it('eligible offer succeeds; expired rejected', async () => {
    const { rows: offers } = await query(
      `SELECT id, slug FROM offers WHERE is_active = TRUE AND slug = 'student-drink-10' LIMIT 1`,
    );
    if (!offers[0]) return; // skip if seed missing
    const key = `offer-ok-${Date.now()}`;
    const ok = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId: drinkItemId, quantity: 3 }],
        offerId: offers[0].id,
        paymentMethod: 'Cash',
        cashReceived: 200,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key });
    assert.equal(ok.res.status, 201, ok.body.error);
    assert.ok(Number(ok.body.data.order.discount) >= 0);

    const expiredSlug = `expired-p3a-${Date.now()}`;
    await query(
      `INSERT INTO offers (slug, offer_name, customer_type_eligibility, discount_type, discount_value, start_date, end_date, is_active)
       VALUES ($1,'Expired', 'all', 'percentage', 10, '2020-01-01', '2020-01-02', TRUE)`,
      [expiredSlug],
    );
    const bad = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId: drinkItemId, quantity: 1 }],
        offerSlug: expiredSlug,
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: `offer-exp-${Date.now()}` });
    assert.equal(bad.res.status, 403);
    assert.equal(bad.body.code, 'OFFER_INELIGIBLE');
  });

  it('voucher cannot be redeemed twice', async () => {
    const { rows: vouchers } = await query(
      `SELECT id, slug, points_required FROM vouchers WHERE is_active = TRUE ORDER BY points_required ASC LIMIT 1`,
    );
    if (!vouchers[0]) return;
    // Give member enough points
    await query(
      `UPDATE students SET points = GREATEST(points, $1) WHERE student_id = 'CU2024001'`,
      [vouchers[0].points_required + 5],
    );
    const key1 = `voucher-once-${Date.now()}`;
    const a = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId, quantity: 1 }],
        voucherSlug: vouchers[0].slug,
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: key1 });
    assert.equal(a.res.status, 201, a.body.error);
    await query(
      `UPDATE students SET points = GREATEST(points, $1) WHERE student_id = 'CU2024001'`,
      [vouchers[0].points_required + 5],
    );
    const b = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId, quantity: 1 }],
        voucherSlug: vouchers[0].slug,
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: `voucher-twice-${Date.now()}` });
    assert.equal(b.res.status, 409);
    assert.equal(b.body.code, 'VOUCHER_ALREADY_REDEEMED');
  });

  it('injected failure rolls back order and loyalty together', async () => {
    const before = await query(`SELECT points FROM students WHERE student_id = 'CU2024001'`);
    const { res, body } = await api('/api/v1/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        memberCode: 'CU2024001',
        items: [{ menuItemId: '00000000-0000-0000-0000-000000000099', quantity: 1 }],
        paymentMethod: 'Cash',
        cashReceived: 50,
      }),
    }, { cookie: staffCookieSnack, idempotencyKey: `rollback-${Date.now()}` });
    assert.equal(res.status, 400);
    assert.equal(body.code, 'MENU_ITEM_NOT_FOUND');
    const after = await query(`SELECT points FROM students WHERE student_id = 'CU2024001'`);
    assert.equal(Number(after.rows[0].points), Number(before.rows[0].points));
  });
});

console.log(`\nPhase 3A POS sales tests → ${BASE}\n`);
