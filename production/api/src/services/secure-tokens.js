import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth.js';

const LOOKUP_PEPPER = () =>
  process.env.CREDENTIAL_LOOKUP_PEPPER
  || process.env.JWT_SECRET
  || 'city-cafe-dev-lookup-pepper';

/** High-entropy opaque token (returned once to client). */
export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest of a token (what we store). */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

/** Deterministic keyed digest for badge/barcode lookup — never store raw card values. */
export function lookupDigest(rawValue) {
  const normalized = String(rawValue || '').trim().toUpperCase();
  return crypto
    .createHmac('sha256', LOOKUP_PEPPER())
    .update(normalized, 'utf8')
    .digest('hex');
}

export async function hashSecret(secret) {
  return hashPassword(String(secret));
}

export async function verifySecret(secret, secretHash) {
  return verifyPassword(String(secret), secretHash);
}

export function timingSafeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
