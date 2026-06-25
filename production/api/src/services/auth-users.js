import { query, pool } from '../db/pool.js';
import { findMemberByScan, memberSelectFields } from './members.js';

const USER_FIELDS = `u.id, u.username, u.email, u.password_hash, u.role, u.full_name, u.is_active`;

/**
 * Resolve login by username, email, student ID, member code, barcode, QR, or phone.
 */
export async function findUserForLogin(identifier) {
  const key = (identifier || '').trim();
  if (!key) return null;
  const upper = key.toUpperCase();

  const { rows } = await query(
    `SELECT DISTINCT ${USER_FIELDS}
     FROM users u
     LEFT JOIN students s ON (
       u.username = s.student_id
       OR u.username = s.member_code
       OR u.username = s.phone
       OR (s.email IS NOT NULL AND LOWER(u.email) = LOWER(s.email))
     )
     WHERE u.username = $1
        OR u.email = $1
        OR LOWER(u.email) = LOWER($1)
        OR UPPER(s.student_id) = $2
        OR UPPER(s.member_code) = $2
        OR UPPER(s.barcode_value) = $2
        OR UPPER(s.qr_value) = $2
        OR s.phone = $1
     LIMIT 1`,
    [key, upper]
  );
  if (rows[0]) return rows[0];

  const member = await findMemberByScan(pool, key);
  if (!member) return null;

  const candidates = [member.student_id, member.member_code, member.phone].filter(Boolean);
  for (const candidate of candidates) {
    const r = await query(
      `SELECT ${USER_FIELDS} FROM users u WHERE u.username = $1 LIMIT 1`,
      [candidate]
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (member.email) {
    const r = await query(
      `SELECT ${USER_FIELDS} FROM users u WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [member.email]
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

export async function resolveMemberCodeForUser(user) {
  if (user.role !== 'customer') return null;
  let member = await findMemberByScan(pool, user.username);
  if (!member && user.email) {
    const { rows } = await query(
      `SELECT ${memberSelectFields()} FROM students WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [user.email]
    );
    member = rows[0] || null;
  }
  if (!member && user.username) {
    const { rows } = await query(
      `SELECT ${memberSelectFields()} FROM students WHERE phone = $1 LIMIT 1`,
      [user.username]
    );
    member = rows[0] || null;
  }
  return member?.member_code || member?.student_id || user.username;
}
