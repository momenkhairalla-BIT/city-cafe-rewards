import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import {
  generateStudentMemberCode,
  nextGeneralCustomerIds,
  memberSelectFields,
  mapMemberRow,
  findMemberByScan,
} from '../services/members.js';
import { findUserForLogin, resolveMemberCodeForUser } from '../services/auth-users.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  upgradeLegacyPassword,
} from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function authResponse(user, memberCode, token) {
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    },
    memberCode,
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
}

function normalizeRegistrationType(body) {
  return body.registrationType || body.customerType || 'general_customer';
}

router.post('/register', async (req, res, next) => {
  try {
    const customerType = normalizeRegistrationType(req.body);
    const {
      studentId, name, programme, email, phone,
      password, confirmPassword,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (customerType === 'city_student') {
      if (!studentId?.trim()) return res.status(400).json({ error: 'Student ID is required' });
      if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
      const sid = studentId.trim().toUpperCase();
      const dup = await query(`SELECT id FROM students WHERE UPPER(student_id) = $1`, [sid]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Student ID already registered' });
    } else if (customerType === 'general_customer') {
      if (!phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
    } else {
      return res.status(400).json({ error: 'Invalid registration type' });
    }

    if (phone?.trim()) {
      const dup = await query(`SELECT id FROM students WHERE phone = $1`, [phone.trim()]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Phone number already registered' });
    }
    if (email?.trim()) {
      const dup = await query(
        `SELECT id FROM students WHERE LOWER(email) = LOWER($1)`,
        [email.trim()]
      );
      if (dup.rows[0]) return res.status(409).json({ error: 'Email already registered' });
      const dupUser = await query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [email.trim()]
      );
      if (dupUser.rows[0]) return res.status(409).json({ error: 'Email already registered' });
    }

    let memberCode;
    let barcodeValue;
    let qrValue;
    let username;

    if (customerType === 'city_student') {
      const sid = studentId.trim().toUpperCase();
      memberCode = generateStudentMemberCode(sid);
      barcodeValue = sid;
      qrValue = sid;
      username = sid;
    } else {
      const ids = await nextGeneralCustomerIds(pool);
      memberCode = ids.memberCode;
      barcodeValue = ids.barcodeValue;
      qrValue = ids.qrValue;
      username = phone.trim();
    }

    const dupUsername = await query(`SELECT id FROM users WHERE username = $1`, [username]);
    if (dupUsername.rows[0]) {
      return res.status(409).json({ error: 'An account with this login already exists' });
    }

    const passwordHash = await hashPassword(password);

    const { rows } = await query(
      `INSERT INTO students (
        student_id, name, programme, email, phone, member_code, barcode_value, qr_value,
        customer_type, membership_status, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active Member',TRUE)
      RETURNING ${memberSelectFields()}`,
      [
        customerType === 'city_student' ? studentId.trim().toUpperCase() : null,
        name.trim(),
        customerType === 'city_student' ? (programme?.trim() || '') : null,
        email?.trim() || null,
        phone?.trim() || null,
        memberCode,
        barcodeValue,
        qrValue,
        customerType,
      ]
    );

    const userEmail = email?.trim() || `${username}@member.local`;
    const userResult = await query(
      `INSERT INTO users (username, email, password_hash, role, full_name)
       VALUES ($1,$2,$3,'customer',$4)
       RETURNING id, username, email, role, full_name`,
      [username, userEmail, passwordHash, name.trim()]
    );
    const user = userResult.rows[0];
    await query(`UPDATE students SET user_id = $1, updated_at = NOW() WHERE id = $2`, [user.id, rows[0].id]);
    const token = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      memberCode,
    });

    res.status(201).json({
      data: {
        ...authResponse(user, memberCode, token),
        member: mapMemberRow(rows[0]),
      },
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    if (!process.env.DATABASE_URL?.trim()) {
      return res.status(503).json({ error: 'Database unavailable — DATABASE_URL not set' });
    }
    if (['ECONNREFUSED', 'ENOTFOUND', '57P01', 'ETIMEDOUT'].includes(err.code)) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await findUserForLogin(username);
    if (!user || user.is_active === false) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.password_hash?.startsWith('DEMO:')) {
      await upgradeLegacyPassword(pool, user.id, password);
    }

    const memberCode = await resolveMemberCodeForUser(user);
    const token = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      memberCode,
    });

    res.json({ data: authResponse(user, memberCode, token) });
  } catch (err) {
    if (!process.env.DATABASE_URL?.trim()) {
      return res.status(503).json({ error: 'Database unavailable — DATABASE_URL not set' });
    }
    if (['ECONNREFUSED', 'ENOTFOUND', '57P01', 'ETIMEDOUT'].includes(err.code)) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, email, role, full_name FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const memberCode = req.user.memberCode || await resolveMemberCodeForUser(user);
    let member = null;
    if (memberCode) {
      member = await findMemberByScan(pool, memberCode);
      if (member) member = mapMemberRow(member);
    }
    res.json({ data: { user: { ...user, fullName: user.full_name }, memberCode, member } });
  } catch (err) {
    next(err);
  }
});

export default router;
