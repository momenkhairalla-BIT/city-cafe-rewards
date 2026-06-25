import { Router } from 'express';
import { pool } from '../db/pool.js';
import {
  findStudentByCode,
  generateOrderNumber,
  applyPurchaseLoyalty,
  applyRewardRedemption,
  applyFreeDrinkRedemption,
} from '../services/loyalty.js';
import {
  getOfferBySlugOrId,
  validateOfferEligibility,
  calculateOfferDiscount,
  mapOfferRow,
} from '../services/offers.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const PAYMENT_METHODS = ['Cash', 'Card', 'E-wallet', 'Student Wallet'];

router.post('/sales', requireRole('staff', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      studentCode,
      memberCode,
      items = [],
      discount = 0,
      paymentMethod = 'Cash',
      cashReceived = 0,
      cashierName = 'Counter Staff',
      note = '',
      offerUsed = null,
      offerId = null,
      customerType = null,
      pointsMultiplier = 1,
    } = req.body;

    const lookupCode = memberCode || studentCode;
    if (!lookupCode) return res.status(400).json({ error: 'memberCode or studentCode is required' });
    if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const subtotal = items.reduce((sum, i) => sum + Number(i.unitPrice) * Number(i.quantity), 0);

    await client.query('BEGIN');

    const student = await findStudentByCode(client, lookupCode);
    if (!student) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Member not found' });
    }
    if (student.is_active === false) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Member account is inactive' });
    }

    const resolvedCustomerType = customerType || student.customer_type || 'city_student';
    let discountAmount = Math.min(Number(discount) || 0, subtotal);
    let resolvedOfferUsed = offerUsed;
    let resolvedOfferId = offerId;
    let resolvedPointsMultiplier = Number(pointsMultiplier) || 1;
    let discountType = null;

    if (offerId) {
      const offerRow = await getOfferBySlugOrId(client, offerId);
      const offer = mapOfferRow(offerRow);
      const check = validateOfferEligibility(offer, resolvedCustomerType);
      if (!check.ok) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: check.error });
      }
      const calc = calculateOfferDiscount(offer, items, subtotal);
      discountAmount = Math.min(calc.discount, subtotal);
      resolvedOfferUsed = calc.label || offer.offerName;
      resolvedOfferId = offer.offerId;
      resolvedPointsMultiplier = calc.pointsMultiplier;
      discountType = calc.discountType;
    } else if (offerUsed) {
      const offerRow = await getOfferBySlugOrId(client, offerUsed);
      if (offerRow) {
        const offer = mapOfferRow(offerRow);
        const check = validateOfferEligibility(offer, resolvedCustomerType);
        if (!check.ok) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: check.error });
        }
        const calc = calculateOfferDiscount(offer, items, subtotal);
        discountAmount = Math.min(Math.max(discountAmount, calc.discount), subtotal);
        resolvedOfferUsed = calc.label || offer.offerName;
        resolvedOfferId = offer.offerId;
        resolvedPointsMultiplier = calc.pointsMultiplier;
        discountType = calc.discountType;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);
    if (total <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Total must be greater than 0' });
    }
    if (paymentMethod === 'Cash' && Number(cashReceived) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient cash received' });
    }

    const loyalty = await applyPurchaseLoyalty(client, student, total, resolvedPointsMultiplier);
    const orderNumber = generateOrderNumber();
    const changeAmount = paymentMethod === 'Cash' ? Number(cashReceived) - total : 0;
    const memberName = student.name || student.email;
    const resolvedMemberCode = student.member_code || student.student_id;

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, student_id, transaction_type, subtotal, discount, total,
        payment_method, cash_received, change_amount, points_earned,
        stamp_before, stamp_after, free_drink_unlocked, cashier_name, note,
        member_code, customer_type, member_name, offer_used, offer_id, points_multiplier, discount_type
      ) VALUES ($1,$2,'Purchase',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        orderNumber, student.id, subtotal, discountAmount, total,
        paymentMethod, cashReceived || null, changeAmount || null,
        loyalty.pointsEarned, loyalty.stampBefore, loyalty.stampAfter,
        loyalty.freeDrinkUnlocked, cashierName, note,
        resolvedMemberCode, resolvedCustomerType, memberName,
        resolvedOfferUsed, resolvedOfferId, resolvedPointsMultiplier, discountType,
      ]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_name, category, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          order.id, item.itemName, item.category, item.quantity,
          item.unitPrice, Number(item.unitPrice) * Number(item.quantity),
        ]
      );
    }

    if (loyalty.freeDrinkUnlocked) {
      await client.query(
        `INSERT INTO orders (order_number, student_id, transaction_type, total, cashier_name)
         VALUES ($1,$2,'Free Drink Earned',0,$3)`,
        [`${orderNumber}-BONUS`, student.id, cashierName]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        order,
        student: loyalty.updatedStudent,
        receipt: {
          orderNumber,
          subtotal,
          discount: discountAmount,
          total,
          offerUsed: resolvedOfferUsed,
          offerId: resolvedOfferId,
          discountType,
          pointsMultiplier: resolvedPointsMultiplier,
          pointsEarned: loyalty.pointsEarned,
          stampAfter: loyalty.stampAfter,
          freeDrinkUnlocked: loyalty.freeDrinkUnlocked,
          changeAmount,
          customerType: resolvedCustomerType,
          memberCode: resolvedMemberCode,
        },
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/redeem', requireRole('staff', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { studentCode, type, voucherSlug, rewardName, cashierName = 'Counter Staff' } = req.body;
    if (!studentCode || !type) return res.status(400).json({ error: 'studentCode and type required' });

    await client.query('BEGIN');
    const student = await findStudentByCode(client, studentCode);
    if (!student) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }

    let pointsUsed = 0;
    let txType = 'Reward';
    let name = rewardName;

    if (type === 'voucher') {
      const voucher = await client.query(`SELECT * FROM vouchers WHERE slug = $1 AND is_active = TRUE`, [voucherSlug]);
      if (!voucher.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Voucher not found' });
      }
      pointsUsed = voucher.rows[0].points_required;
      name = voucher.rows[0].name;
      await applyRewardRedemption(client, student, pointsUsed);
    } else if (type === 'free_drink') {
      txType = 'Free Drink';
      name = 'Free Drink';
      await applyFreeDrinkRedemption(client, student);
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid redemption type' });
    }

    const orderNumber = generateOrderNumber();
    const { rows } = await client.query(
      `INSERT INTO orders (order_number, student_id, transaction_type, points_used, reward_name, cashier_name)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orderNumber, student.id, txType, pointsUsed, name, cashierName]
    );

    await client.query('COMMIT');
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message === 'Insufficient points' || err.message === 'No free drinks available') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  } finally {
    client.release();
  }
});

router.get('/sales', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT o.*, s.student_id AS student_code, s.member_code, s.customer_type,
              s.name AS member_name, s.email,
              (SELECT string_agg(oi.item_name || ' x' || oi.quantity, ', ') FROM order_items oi WHERE oi.order_id = o.id) AS items_summary
       FROM orders o
       JOIN students s ON s.id = o.student_id
       WHERE o.transaction_type = 'Purchase'
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const { rows } = await pool.query(
      `SELECT o.*, s.student_id AS student_code, s.member_code, s.customer_type,
              s.name AS member_name, s.email,
              (SELECT string_agg(oi.item_name || ' x' || oi.quantity, ', ') FROM order_items oi WHERE oi.order_id = o.id) AS items_summary
       FROM orders o
       JOIN students s ON s.id = o.student_id
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
