import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { findMemberByScan, mapMemberRow, memberSelectFields } from '../services/members.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function customerCanAccess(req, code) {
  if (req.user.role !== 'customer') return true;
  const own = (req.user.memberCode || req.user.username || '').toUpperCase();
  const q = (code || '').trim().toUpperCase();
  return own === q || own === q.replace(/-/g, '');
}

function mapStudentRow(row) {
  return mapMemberRow(row);
}

router.get('/', requireRole('staff', 'admin'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${memberSelectFields()} FROM students ORDER BY customer_type, student_id, member_code`
    );
    res.json({ data: rows.map(mapStudentRow) });
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
    const member = await findMemberByScan(pool, code);
    if (!member) return res.status(404).json({ error: 'Member not found' });

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
      [member.id]
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
    const member = await findMemberByScan(pool, req.params.studentCode);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ data: mapStudentRow(member) });
  } catch (err) {
    next(err);
  }
});

export default router;
