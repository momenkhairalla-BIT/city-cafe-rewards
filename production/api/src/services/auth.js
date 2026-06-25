import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

export function getJwtSecret() {  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'city-cafe-dev-secret-change-in-production';
  }
  return process.env.JWT_SECRET;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  if (passwordHash.startsWith('DEMO:')) {
    return passwordHash === `DEMO:${password}`;
  }
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export async function upgradeLegacyPassword(client, userId, password) {
  const hash = await hashPassword(password);
  await client.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [userId, hash]
  );
  return hash;
}
