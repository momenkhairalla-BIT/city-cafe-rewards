/**
 * Server-authoritative POS sale — single transactional path.
 * Reuses existing loyalty + offer services (no second source of truth).
 */
import crypto from 'crypto';
import { pool } from '../db/pool.js';
import {
  findStudentByCode,
  applyPurchaseLoyalty,
  applyRewardRedemption,
} from './loyalty.js';
import {
  getOfferBySlugOrId,
  validateOfferEligibility,
  calculateOfferDiscount,
  mapOfferRow,
} from './offers.js';
import { toSen, fromSen, mulQtySen, minSen, subSen, moneyFieldsFromSen } from './money.js';
import { writeAuditEvent } from './audit.js';

const PAYMENT_METHODS = ['Cash', 'Card', 'E-wallet', 'Student Wallet'];
const FORBIDDEN_PRICE_KEYS = [
  'unitPrice', 'unit_price', 'subtotal', 'discount', 'total', 'finalTotal',
  'pointsMultiplier', 'points', 'loyaltyPoints', 'stampCount', 'stamps',
  'cashierName',
];
const FORBIDDEN_ATTRIBUTION_KEYS = [
  'branchId', 'salesPointId', 'terminalId', 'shiftId', 'staffId', 'staffUserId',
];
const SENSITIVE_PAYMENT_KEYS = [
  'pan', 'cardNumber', 'card_number', 'cvv', 'cvc', 'track1', 'track2',
  'magneticStripe', 'pinBlock', 'paymentTerminalSecret', 'rawCardData',
];

export function isPosSalesEnabled() {
  return process.env.ENABLE_POS_SALES === '1';
}

export function canonicalSalePayload(body = {}) {
  const items = Array.isArray(body.items)
    ? body.items.map((i) => ({
      menuItemId: i.menuItemId || i.menu_item_id || null,
      quantity: Number(i.quantity),
      modifierIds: Array.isArray(i.modifierIds) ? [...i.modifierIds].map(String).sort() : [],
    })).sort((a, b) => String(a.menuItemId).localeCompare(String(b.menuItemId)))
    : [];
  return {
    memberCode: body.memberCode || body.studentCode || null,
    guest: Boolean(body.guest === true || (!body.memberCode && !body.studentCode && body.guest !== false && !body.memberCode)),
    items,
    offerId: body.offerId || body.offerSlug || null,
    voucherSlug: body.voucherSlug || body.voucherId || null,
    paymentMethod: body.paymentMethod || 'Cash',
    cashReceived: body.cashReceived != null ? String(body.cashReceived) : null,
    externalPaymentRef: body.externalPaymentRef || null,
    note: body.note || null,
  };
}

export function hashSalePayload(body) {
  const canonical = canonicalSalePayload(body);
  // guest flag: member sale when memberCode present
  if (canonical.memberCode) canonical.guest = false;
  else canonical.guest = true;
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function reject(code, message, status = 400, retryable = false) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.retryable = retryable;
  return err;
}

export function assertNoSpoofedFields(body = {}) {
  for (const key of FORBIDDEN_ATTRIBUTION_KEYS) {
    if (body[key] != null) {
      throw reject('ATTRIBUTION_SPOOF_REJECTED', `Client must not supply ${key}`, 400);
    }
  }
  for (const key of FORBIDDEN_PRICE_KEYS) {
    if (body[key] != null) {
      throw reject('CLIENT_PRICE_SPOOF_REJECTED', `Client must not supply ${key}`, 400);
    }
  }
  for (const item of body.items || []) {
    if (item.unitPrice != null || item.unit_price != null || item.price != null
      || item.lineTotal != null || item.subtotal != null) {
      throw reject('CLIENT_PRICE_SPOOF_REJECTED', 'Client must not supply item prices', 400);
    }
  }
  for (const key of SENSITIVE_PAYMENT_KEYS) {
    if (body[key] != null || body.payment?.[key] != null) {
      throw reject('SENSITIVE_PAYMENT_DATA_REJECTED', 'Card/PAN-like fields are not accepted', 400);
    }
  }
}

async function nextOrderNumber(client) {
  const { rows } = await client.query(`SELECT nextval('order_number_seq') AS n`);
  return `ORD-${String(rows[0].n).padStart(8, '0')}`;
}

async function loadMenuItems(client, ids) {
  const { rows } = await client.query(
    `SELECT id, slug, name, price, category, is_active
     FROM menu_items WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * @param {object} ctx
 * @param {object} ctx.employee
 * @param {object} ctx.employeeSession
 * @param {object} ctx.terminal
 * @param {object} ctx.terminalLocation
 * @param {object} ctx.shift — open shift row
 * @param {string} ctx.idempotencyKey
 * @param {object} ctx.body
 */
export async function createPosSale(ctx) {
  const { employee, employeeSession, terminal, terminalLocation, shift, idempotencyKey, body } = ctx;
  if (!idempotencyKey || String(idempotencyKey).length < 8) {
    throw reject('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header required (min 8 chars)', 400);
  }
  assertNoSpoofedFields(body);

  const itemsIn = Array.isArray(body.items) ? body.items : [];
  if (!itemsIn.length) throw reject('CART_EMPTY', 'Cart is empty', 400);

  for (const item of itemsIn) {
    if (Array.isArray(item.modifierIds) && item.modifierIds.length) {
      throw reject('MODIFIERS_NOT_SUPPORTED', 'Modifiers are not available in this schema', 400);
    }
    if (!item.menuItemId && !item.menu_item_id) {
      throw reject('MENU_ITEM_REQUIRED', 'Each item requires menuItemId', 400);
    }
  }

  const paymentMethod = body.paymentMethod || 'Cash';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw reject('INVALID_PAYMENT_METHOD', 'Invalid payment method', 400);
  }

  const payloadHash = hashSalePayload(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency lookup under lock scope
    const existing = await client.query(
      `SELECT * FROM orders
       WHERE staff_user_id = $1 AND terminal_id = $2 AND idempotency_key = $3
       FOR UPDATE`,
      [employee.id, terminal.id, idempotencyKey],
    );
    if (existing.rows[0]) {
      const prev = existing.rows[0];
      if (prev.idempotency_payload_hash !== payloadHash) {
        await client.query('ROLLBACK');
        throw reject('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused with different payload', 409);
      }
      const itemRows = await client.query(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at`,
        [prev.id],
      );
      await client.query('COMMIT');
      return { replay: true, order: prev, items: itemRows.rows };
    }

    // Re-validate shift open inside txn
    const { rows: shiftRows } = await client.query(
      `SELECT * FROM shifts WHERE id = $1 FOR UPDATE`,
      [shift.id],
    );
    const liveShift = shiftRows[0];
    if (!liveShift || liveShift.status !== 'open') {
      throw reject(
        liveShift?.status === 'locked' ? 'SHIFT_LOCKED' : 'OPEN_SHIFT_REQUIRED',
        'Open shift required to create a sale',
        403,
      );
    }
    if (liveShift.terminal_id !== terminal.id
      || liveShift.branch_id !== terminalLocation.branch_id
      || liveShift.sales_point_id !== terminalLocation.sales_point_id) {
      throw reject('LOCATION_LOCKED', 'Location cannot change during sale', 403);
    }

    const menuIds = itemsIn.map((i) => i.menuItemId || i.menu_item_id);
    const menuMap = await loadMenuItems(client, menuIds);
    const pricedLines = [];
    let subtotalSen = 0;

    for (const item of itemsIn) {
      const id = item.menuItemId || item.menu_item_id;
      const menu = menuMap.get(id);
      if (!menu) throw reject('MENU_ITEM_NOT_FOUND', `Unknown menu item ${id}`, 400);
      if (menu.is_active === false) {
        throw reject('MENU_ITEM_UNAVAILABLE', `Item unavailable: ${menu.name}`, 400);
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        throw reject('INVALID_QUANTITY', 'Quantity must be a positive integer', 400);
      }
      const unitSen = toSen(menu.price);
      const lineSen = mulQtySen(unitSen, qty);
      subtotalSen += lineSen;
      pricedLines.push({
        menuItemId: menu.id,
        itemName: menu.name,
        category: menu.category,
        quantity: qty,
        unitPrice: fromSen(unitSen),
        unitSen,
        lineTotal: fromSen(lineSen),
        lineSen,
      });
    }

    const memberCode = body.memberCode || body.studentCode || null;
    const isGuest = !memberCode;
    let student = null;

    if (!isGuest) {
      student = await findStudentByCode(client, memberCode);
      if (!student) throw reject('MEMBER_NOT_FOUND', 'Member not found', 404);
      // Lock loyalty row
      const locked = await client.query(
        `SELECT * FROM students WHERE id = $1 FOR UPDATE`,
        [student.id],
      );
      student = locked.rows[0];
      if (!student || student.is_active === false) {
        throw reject('MEMBER_INACTIVE', 'Member account is inactive', 403);
      }
    }

    let discountSen = 0;
    let pointsMultiplier = 1;
    let offerUsed = null;
    let offerId = null;
    let discountType = null;
    const cartForOffer = pricedLines.map((l) => ({
      category: l.category,
      name: l.itemName,
      itemName: l.itemName,
      unitPrice: l.unitPrice,
      price: l.unitPrice,
      quantity: l.quantity,
    }));

    const offerKey = body.offerId || body.offerSlug || null;
    if (offerKey) {
      if (isGuest) {
        throw reject('OFFER_REQUIRES_MEMBER', 'Guests cannot use member offers', 403);
      }
      const offerRow = await getOfferBySlugOrId(client, offerKey);
      const offer = mapOfferRow(offerRow);
      const check = validateOfferEligibility(offer, student.customer_type || 'city_student');
      if (!check.ok) throw reject('OFFER_INELIGIBLE', check.error, 403);
      const calc = calculateOfferDiscount(offer, cartForOffer, fromSen(subtotalSen));
      discountSen = minSen(toSen(calc.discount), subtotalSen);
      pointsMultiplier = calc.pointsMultiplier;
      offerUsed = calc.label || offer.offerName;
      offerId = offer.offerId;
      discountType = calc.discountType;
    }

    // Optional points-catalog voucher redeem in same txn
    let pointsUsed = 0;
    let rewardName = null;
    let voucherPending = null;
    const voucherKey = body.voucherSlug || body.voucherId || null;
    if (voucherKey) {
      if (isGuest) throw reject('VOUCHER_REQUIRES_MEMBER', 'Guests cannot redeem vouchers', 403);
      const { rows: vrows } = await client.query(
        `SELECT * FROM vouchers WHERE (id::text = $1 OR slug = $1) AND is_active = TRUE LIMIT 1 FOR UPDATE`,
        [voucherKey],
      );
      if (!vrows[0]) throw reject('VOUCHER_NOT_FOUND', 'Voucher not found', 404);
      const voucher = vrows[0];
      const prior = await client.query(
        `SELECT id FROM voucher_redemptions WHERE student_id = $1 AND voucher_id = $2 LIMIT 1`,
        [student.id, voucher.id],
      );
      if (prior.rows[0]) {
        throw reject('VOUCHER_ALREADY_REDEEMED', 'Voucher already redeemed for this member', 409);
      }
      try {
        await applyRewardRedemption(client, student, voucher.points_required);
      } catch (e) {
        if (e.message === 'Insufficient points') {
          throw reject('INSUFFICIENT_POINTS', 'Insufficient points', 400);
        }
        throw e;
      }
      pointsUsed = voucher.points_required;
      rewardName = voucher.name;
      voucherPending = { voucher, pointsUsed };
    }

    const totalSen = Math.max(0, subSen(subtotalSen, discountSen));
    if (totalSen <= 0 && !voucherKey) {
      throw reject('TOTAL_INVALID', 'Total must be greater than 0', 400);
    }

    let cashReceived = null;
    let changeAmount = null;
    if (paymentMethod === 'Cash') {
      const receivedSen = toSen(body.cashReceived ?? fromSen(totalSen));
      if (receivedSen < totalSen) {
        throw reject('INSUFFICIENT_CASH', 'Insufficient cash received', 400);
      }
      cashReceived = fromSen(receivedSen);
      changeAmount = fromSen(receivedSen - totalSen);
    }

    let loyalty = {
      pointsEarned: 0,
      stampBefore: null,
      stampAfter: null,
      freeDrinkUnlocked: false,
      updatedStudent: null,
    };

    if (!isGuest) {
      loyalty = await applyPurchaseLoyalty(client, student, fromSen(totalSen), pointsMultiplier);
    }

    const orderNumber = await nextOrderNumber(client);
    const amounts = moneyFieldsFromSen({
      subtotalSen,
      discountSen,
      totalSen,
    });
    const cashierName = employee.fullName || employee.username || 'Staff';

    let order;
    try {
      const orderResult = await client.query(
        `INSERT INTO orders (
          order_number, student_id, staff_user_id, transaction_type,
          subtotal, discount, total, payment_method, cash_received, change_amount,
          points_earned, points_used, stamp_before, stamp_after, free_drink_unlocked,
          reward_name, cashier_name, note,
          member_code, customer_type, member_name, offer_used, offer_id, points_multiplier, discount_type,
          branch_id, sales_point_id, terminal_id, shift_id,
          idempotency_key, idempotency_payload_hash,
          is_guest, employee_session_id, external_payment_ref, auth_method
        ) VALUES (
          $1,$2,$3,'Purchase',
          $4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,
          $15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,
          $25,$26,$27,$28,
          $29,$30,
          $31,$32,$33,$34
        ) RETURNING *`,
        [
          orderNumber,
          isGuest ? null : student.id,
          employee.id,
          amounts.subtotal,
          amounts.discount,
          amounts.total,
          paymentMethod,
          cashReceived,
          changeAmount,
          loyalty.pointsEarned,
          pointsUsed,
          loyalty.stampBefore,
          loyalty.stampAfter,
          loyalty.freeDrinkUnlocked,
          rewardName,
          cashierName,
          body.note || null,
          isGuest ? null : (student.member_code || student.student_id),
          isGuest ? null : (student.customer_type || null),
          isGuest ? null : (student.name || student.email),
          offerUsed,
          offerId,
          pointsMultiplier,
          discountType,
          terminalLocation.branch_id,
          terminalLocation.sales_point_id,
          terminal.id,
          liveShift.id,
          idempotencyKey,
          payloadHash,
          isGuest,
          employeeSession?.id || null,
          body.externalPaymentRef || null,
          employeeSession?.auth_method || employee.authMethod || null,
        ],
      );
      order = orderResult.rows[0];
    } catch (e) {
      if (e.code === '23505' && String(e.constraint || '').includes('idempotency')) {
        await client.query('ROLLBACK');
        // Concurrent winner — re-fetch
        const again = await pool.query(
          `SELECT * FROM orders WHERE staff_user_id = $1 AND terminal_id = $2 AND idempotency_key = $3`,
          [employee.id, terminal.id, idempotencyKey],
        );
        if (again.rows[0] && again.rows[0].idempotency_payload_hash === payloadHash) {
          const itemRows = await pool.query(
            `SELECT * FROM order_items WHERE order_id = $1`,
            [again.rows[0].id],
          );
          return { replay: true, order: again.rows[0], items: itemRows.rows };
        }
        throw reject('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused with different payload', 409);
      }
      throw e;
    }

    for (const line of pricedLines) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, category, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, line.menuItemId, line.itemName, line.category, line.quantity, line.unitPrice, line.lineTotal],
      );
    }

    if (voucherPending) {
      try {
        await client.query(
          `INSERT INTO voucher_redemptions (voucher_id, student_id, order_id, points_used)
           VALUES ($1,$2,$3,$4)`,
          [voucherPending.voucher.id, student.id, order.id, voucherPending.pointsUsed],
        );
      } catch (e) {
        if (e.code === '23505') {
          throw reject('VOUCHER_ALREADY_REDEEMED', 'Voucher already redeemed for this member', 409);
        }
        throw e;
      }
    }

    if (!isGuest && loyalty.freeDrinkUnlocked) {
      const bonusNum = `${orderNumber}-BONUS`;
      await client.query(
        `INSERT INTO orders (order_number, student_id, staff_user_id, transaction_type, total, cashier_name,
           branch_id, sales_point_id, terminal_id, shift_id, is_guest)
         VALUES ($1,$2,$3,'Free Drink Earned',0,$4,$5,$6,$7,$8,FALSE)`,
        [
          bonusNum, student.id, employee.id, cashierName,
          terminalLocation.branch_id, terminalLocation.sales_point_id, terminal.id, liveShift.id,
        ],
      );
    }

    // Shift aggregates
    const cashAdd = paymentMethod === 'Cash' ? amounts.total : 0;
    const nonCashAdd = paymentMethod === 'Cash' ? 0 : amounts.total;
    const { rows: updatedShift } = await client.query(
      `UPDATE shifts SET
         cash_sales_total = cash_sales_total + $2,
         non_cash_sales_total = non_cash_sales_total + $3,
         sale_count = sale_count + 1,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [liveShift.id, cashAdd, nonCashAdd],
    );

    await writeAuditEvent({
      eventType: 'pos.sale_created',
      outcome: 'success',
      actorUserId: employee.id,
      actorRole: employee.role,
      selectedProduct: 'pos',
      branchId: terminalLocation.branch_id,
      salesPointId: terminalLocation.sales_point_id,
      terminalId: terminal.id,
      shiftId: liveShift.id,
      metadata: {
        orderId: order.id,
        orderNumber,
        isGuest,
        paymentMethod,
        total: amounts.total,
        salesPointCode: terminalLocation.sales_point_code,
        branchCode: terminalLocation.branch_code,
      },
      client,
    });

    await client.query('COMMIT');

    const itemRows = pricedLines.map((l) => ({
      menu_item_id: l.menuItemId,
      item_name: l.itemName,
      category: l.category,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      line_total: l.lineTotal,
    }));

    return {
      replay: false,
      order,
      items: itemRows,
      loyalty,
      shift: updatedShift[0],
      amounts,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    if (err.code === '40P01' || err.code === '40001') {
      err.retryable = true;
    }
    if (err.status) throw err;
    // DB down etc.
    if (err.code === 'ECONNREFUSED' || err.code === '57P01') {
      throw reject('SERVICE_UNAVAILABLE', 'Database unavailable', 503, true);
    }
    throw err;
  } finally {
    client.release();
  }
}

export function publicSaleResponse(result) {
  const o = result.order;
  return {
    order: {
      id: o.id,
      orderNumber: o.order_number,
      isGuest: o.is_guest === true,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      total: Number(o.total),
      paymentMethod: o.payment_method,
      cashReceived: o.cash_received != null ? Number(o.cash_received) : null,
      changeAmount: o.change_amount != null ? Number(o.change_amount) : null,
      pointsEarned: o.points_earned,
      pointsUsed: o.points_used,
      stampBefore: o.stamp_before,
      stampAfter: o.stamp_after,
      freeDrinkUnlocked: o.free_drink_unlocked,
      offerUsed: o.offer_used,
      offerId: o.offer_id,
      memberCode: o.member_code,
      createdAt: o.created_at,
      attribution: {
        staffUserId: o.staff_user_id,
        branchId: o.branch_id,
        salesPointId: o.sales_point_id,
        terminalId: o.terminal_id,
        shiftId: o.shift_id,
        employeeSessionId: o.employee_session_id,
        authMethod: o.auth_method,
      },
    },
    items: (result.items || []).map((i) => ({
      menuItemId: i.menu_item_id || i.menuItemId,
      itemName: i.item_name || i.itemName,
      category: i.category,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price ?? i.unitPrice),
      lineTotal: Number(i.line_total ?? i.lineTotal),
    })),
    replay: Boolean(result.replay),
    paymentRecording: {
      method: o.payment_method,
      softPos: true,
      gatewaySettlement: false,
      note: 'Recorded payment method only — not gateway settlement',
    },
    member: result.loyalty?.updatedStudent || null,
  };
}
