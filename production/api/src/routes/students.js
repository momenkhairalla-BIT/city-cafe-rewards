import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function customerCanAccess(req, code) {
  if (req.user.role !== 'customer') return true;
  const own = (req.user.memberCode || req.user.username || '').toUpperCase();
  const q = (code || '').trim().toUpperCase();
  return own === q;
}

router.get('/', requireRole('staff', 'admin'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, student_id, name, member_code, customer_type, programme, email, phone,
              barcode_value, qr_value, points, total_purchases,
              current_stamp_progress, free_drinks_available, membership_status, is_active
       FROM students ORDER BY customer_type, student_id, member_code`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:studentCode/history', async (req, res, next) => {
  try {
    const code = req.params.studentCode;
    if (!customerCanAccess(req, code)) {
      return res.status(403).json({ error: 'You can only view your own history' });
    }
    const student = await query(
      `SELECT id FROM students WHERE student_id = $1 OR member_code = $1 OR barcode_value = $1 OR phone = $2`,
      [code.toUpperCase(), code]
    );
    if (!student.rows[0]) return res.status(404).json({ error: 'Student not found' });

    const { rows } = await query(
      `SELECT o.order_number, o.transaction_type, o.total, o.points_earned, o.points_used,
              o.payment_method, o.reward_name, o.free_drink_unlocked, o.created_at,
              COALESCE(
                (SELECT string_agg(oi.item_name || ' x' || oi.quantity, ', ')
                 FROM order_items oi WHERE oi.order_id = o.id),
                o.reward_name,
                ''
              ) AS items_summary
       FROM orders o
       WHERE o.student_id = $1
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [student.rows[0].id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:studentCode', async (req, res, next) => {
  try {
    if (!customerCanAccess(req, req.params.studentCode)) {
      return res.status(403).json({ error: 'You can only view your own profile' });
    }
    const { rows } = await query(
      `SELECT id, student_id, name, member_code, customer_type, programme, email, phone,
              barcode_value, qr_value, points, total_purchases,
              current_stamp_progress, free_drinks_available, membership_status, is_active
       FROM students WHERE student_id = $1 OR member_code = $1 OR barcode_value = $1 OR qr_value = $1 OR phone = $2
       LIMIT 1`,
      [req.params.studentCode.toUpperCase(), req.params.studentCode]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
