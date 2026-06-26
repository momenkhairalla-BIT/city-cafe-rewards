import { query, pool } from '../db/pool.js';
import { findMemberByScan, memberSelectFields } from './members.js';

const USER_FIELDS = `u.id, u.username, u.email, u.password_hash, u.role, u.full_name, u.is_active`;

/**
 * Find the login user linked to a member record.
 */
export async function findUserForMember(member) {
  if (!member) return null;

  if (member.user_id) {
    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u WHERE u.id = $1 LIMIT 1`,
      [member.user_id]
    );
    if (rows[0]) return rows[0];
  }

  const usernameCandidates = [
    member.student_id,
    member.member_code,
    member.phone,
    member.barcode_value,
    member.qr_value,
  ]
    .filter(Boolean)
    .map(String);

  for (const candidate of usernameCandidates) {
    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u
       WHERE u.username = $1 OR LOWER(u.username) = LOWER($1)
       LIMIT 1`,
      [candidate]
    );
    if (rows[0]) return rows[0];
  }

  if (member.email) {
    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [member.email]
    );
    if (rows[0]) return rows[0];
  }

  const { rows: linked } = await query(
    `SELECT ${USER_FIELDS} FROM users u
     INNER JOIN students s ON s.user_id = u.id
     WHERE s.id = $1
     LIMIT 1`,
    [member.id]
  );
  return linked[0] || null;
}

/**
 * Resolve login by username, email, student ID, member code, barcode, QR, or phone.
 */
export async function findUserForLogin(identifier) {
  const key = (identifier || '').trim();
  if (!key) return null;

  const { rows: direct } = await query(
    `SELECT ${USER_FIELDS} FROM users u
     WHERE u.username = $1
        OR u.email = $1
        OR LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [key]
  );
  if (direct[0]) return direct[0];

  const member = await findMemberByScan(pool, key);
  return findUserForMember(member);
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
  if (!member) {
    const { rows } = await query(
      `SELECT ${memberSelectFields()} FROM students WHERE user_id = $1 LIMIT 1`,
      [user.id]
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
