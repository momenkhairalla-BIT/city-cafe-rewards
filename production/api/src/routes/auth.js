import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { generateMemberCode, memberSelectFields, mapMemberRow } from '../services/members.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  upgradeLegacyPassword,
} from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function resolveMemberCode(username, role) {
  if (role !== 'customer') return null;
  const key = username.trim();
  const { rows } = await pool.query(
    `SELECT member_code, student_id FROM students
     WHERE UPPER(student_id) = $1 OR member_code = $1 OR phone = $1
     LIMIT 1`,
    [key.toUpperCase()]
  );
  return rows[0]?.member_code || rows[0]?.student_id || null;
}

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

router.post('/register', async (req, res, next) => {
  try {
    const {
      customerType = 'general_customer',
      studentId, name, programme, email, phone,
      password,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

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

    const memberCode = generateMemberCode(customerType);
    const scanValue = customerType === 'city_student' ? studentId.toUpperCase() : memberCode;
    const username = customerType === 'city_student' ? studentId.toUpperCase() : (phone || memberCode);
    const passwordHash = await hashPassword(password);

    const { rows } = await query(
      `INSERT INTO students (
        student_id, name, programme, email, phone, member_code, barcode_value, qr_value, customer_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING ${memberSelectFields()}`,
      [
        customerType === 'city_student' ? studentId.toUpperCase() : null,
        name,
        customerType === 'city_student' ? (programme || '') : null,
        email || null,
        phone || null,
        memberCode,
        scanValue,
        scanValue,
        customerType,
      ]
    );

    const userResult = await query(
      `INSERT INTO users (username, email, password_hash, role, full_name)
       VALUES ($1,$2,$3,'customer',$4)
       RETURNING id, username, email, role, full_name`,
      [username, email || `${username}@member.local`, passwordHash, name]
    );
    const user = userResult.rows[0];
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
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { rows } = await query(
      `SELECT id, username, email, password_hash, role, full_name, is_active FROM users
       WHERE username = $1 OR email = $1 LIMIT 1`,
      [username.trim()]
    );
    const user = rows[0];
    if (!user || user.is_active === false) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.password_hash.startsWith('DEMO:')) {
      await upgradeLegacyPassword(pool, user.id, password);
    }

    const memberCode = await resolveMemberCode(user.username, user.role);
    const token = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      memberCode,
    });

    res.json({ data: authResponse(user, memberCode, token) });
  } catch (err) {
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
    const memberCode = req.user.memberCode || await resolveMemberCode(user.username, user.role);
    let member = null;
    if (memberCode) {
      const m = await query(
        `SELECT ${memberSelectFields()} FROM students
         WHERE member_code = $1 OR UPPER(student_id) = $1 LIMIT 1`,
        [memberCode.toUpperCase()]
      );
      if (m.rows[0]) member = mapMemberRow(m.rows[0]);
    }
    res.json({ data: { user: { ...user, fullName: user.full_name }, memberCode, member } });
  } catch (err) {
    next(err);
  }
});

export default router;
