import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { memberSelectFields, mapMemberRow, findMemberByScan, generateStudentMemberCode, nextGeneralCustomerIds } from '../services/members.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function customerCanAccess(req, code) {
  if (req.user.role !== 'customer') return true;
  const own = (req.user.memberCode || req.user.username || '').toUpperCase();
  const q = (code || '').trim().toUpperCase();
  return own === q || own === q.replace(/-/g, '');
}

router.get('/', requireRole('staff', 'admin'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${memberSelectFields()} FROM students ORDER BY customer_type, member_code, student_id`
    );
    res.json({ data: rows.map(mapMemberRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    if (!customerCanAccess(req, req.params.code)) {
      return res.status(403).json({ error: 'You can only view your own member profile' });
    }
    const member = await findMemberByScan(pool, req.params.code);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ data: mapMemberRow(member) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const {
      customerType = 'general_customer',
      studentId, name, programme, email, phone,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    if (customerType === 'city_student') {
      if (!studentId) return res.status(400).json({ error: 'Student ID is required' });
      const dup = await query(`SELECT id FROM students WHERE UPPER(student_id) = $1`, [studentId.toUpperCase()]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Student ID already registered' });
    }

    if (phone) {
      const dup = await query(`SELECT id FROM students WHERE phone = $1`, [phone]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Phone number already registered' });
    }
    if (email) {
      const dup = await query(`SELECT id FROM students WHERE LOWER(email) = LOWER($1)`, [email]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Email already registered' });
    }

    let memberCode;
    let barcodeValue;
    let qrValue;

    if (customerType === 'city_student') {
      const sid = studentId.toUpperCase();
      memberCode = generateStudentMemberCode(sid);
      barcodeValue = sid;
      qrValue = sid;
    } else {
      const ids = await nextGeneralCustomerIds(pool);
      memberCode = ids.memberCode;
      barcodeValue = ids.barcodeValue;
      qrValue = ids.qrValue;
    }

    const { rows } = await query(
      `INSERT INTO students (
        student_id, name, programme, email, phone, member_code, barcode_value, qr_value,
        customer_type, membership_status, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active Member',TRUE)
      RETURNING ${memberSelectFields()}`,
      [
        customerType === 'city_student' ? studentId.toUpperCase() : null,
        name,
        customerType === 'city_student' ? (programme || '') : null,
        email || null,
        phone || null,
        memberCode,
        barcodeValue,
        qrValue,
        customerType,
      ]
    );
    res.status(201).json({ data: mapMemberRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, programme, email, phone, membershipStatus } = req.body;
    const { rows } = await query(
      `UPDATE students SET
        name = COALESCE($2, name),
        programme = COALESCE($3, programme),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        membership_status = COALESCE($6, membership_status),
        updated_at = NOW()
       WHERE id = $1
       RETURNING ${memberSelectFields()}`,
      [req.params.id, name, programme, email, phone, membershipStatus]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json({ data: mapMemberRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const { rows } = await query(
      `UPDATE students SET is_active = $2, updated_at = NOW() WHERE id = $1
       RETURNING ${memberSelectFields()}`,
      [req.params.id, !!isActive]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json({ data: mapMemberRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
