import { query, pool } from '../db/pool.js';
import { lookupDigest, verifySecret, hashSecret } from './secure-tokens.js';
import { upgradeLegacyPassword } from './auth.js';

export async function findEmployeeUserByUsername(username) {
  const { rows } = await query(
    `SELECT id, username, email, role, full_name, password_hash, is_active,
            is_global_manager, dual_role_pos_enabled
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [String(username || '').trim()],
  );
  return rows[0] || null;
}

export async function verifyEmployeePassword(user, password) {
  // Prefer staff_credentials password row
  const { rows } = await query(
    `SELECT id, secret_hash FROM staff_credentials
     WHERE user_id = $1 AND credential_type = 'password'
       AND is_enabled = TRUE AND revoked_at IS NULL
     LIMIT 1`,
    [user.id],
  );
  const cred = rows[0];
  if (cred) {
    const ok = await verifySecret(password, cred.secret_hash);
    if (ok && cred.secret_hash.startsWith('DEMO:')) {
      const hash = await hashSecret(password);
      await query(
        `UPDATE staff_credentials SET secret_hash = $2, credential_version = credential_version + 1, updated_at = NOW()
         WHERE id = $1`,
        [cred.id, hash],
      );
      await upgradeLegacyPassword(pool, user.id, password);
    }
    return ok;
  }
  // Compatibility fallback to users.password_hash then sync
  const ok = await verifySecret(password, user.password_hash);
  if (ok) {
    const hash = user.password_hash.startsWith('DEMO:')
      ? await hashSecret(password)
      : user.password_hash;
    if (user.password_hash.startsWith('DEMO:')) {
      await upgradeLegacyPassword(pool, user.id, password);
    }
    await query(
      `INSERT INTO staff_credentials (user_id, credential_type, secret_hash, is_enabled)
       VALUES ($1,'password',$2,TRUE)
       ON CONFLICT DO NOTHING`,
      [user.id, hash],
    ).catch(async () => {
      // unique index is partial — insert if still missing
      await query(
        `INSERT INTO staff_credentials (user_id, credential_type, secret_hash, is_enabled)
         SELECT $1,'password',$2,TRUE
         WHERE NOT EXISTS (
           SELECT 1 FROM staff_credentials
           WHERE user_id = $1 AND credential_type = 'password' AND is_enabled AND revoked_at IS NULL
         )`,
        [user.id, hash],
      );
    });
  }
  return ok;
}

/**
 * Mock/software badge+PIN adapter: badgeValue is opaque identifier;
 * only lookup_digest is stored/compared. PIN verified via bcrypt.
 */
export async function verifyBadgePin({ badgeValue, pin }) {
  const digest = lookupDigest(badgeValue);
  const { rows } = await query(
    `SELECT sc.*, u.id AS user_id, u.username, u.email, u.role, u.full_name,
            u.is_active, u.is_global_manager, u.dual_role_pos_enabled, u.password_hash
     FROM staff_credentials sc
     JOIN users u ON u.id = sc.user_id
     WHERE sc.lookup_digest = $1
       AND sc.credential_type IN ('badge_pin','barcode_pin')
       AND sc.is_enabled = TRUE AND sc.revoked_at IS NULL
     LIMIT 1`,
    [digest],
  );
  const row = rows[0];
  if (!row || row.is_active === false) return null;
  const ok = await verifySecret(pin, row.secret_hash);
  if (!ok) return null;
  return {
    id: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    full_name: row.full_name,
    is_active: row.is_active,
    is_global_manager: row.is_global_manager,
    dual_role_pos_enabled: row.dual_role_pos_enabled,
    password_hash: row.password_hash,
  };
}

/** Test/seed helper — create badge+PIN credential for an employee. */
export async function upsertBadgePinCredential({ userId, badgeValue, pin, type = 'badge_pin' }) {
  const digest = lookupDigest(badgeValue);
  const secretHash = await hashSecret(pin);
  await query(
    `UPDATE staff_credentials
     SET is_enabled = FALSE, revoked_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND credential_type = $2 AND is_enabled = TRUE AND revoked_at IS NULL`,
    [userId, type],
  );
  const { rows } = await query(
    `INSERT INTO staff_credentials (user_id, credential_type, lookup_digest, secret_hash, is_enabled)
     VALUES ($1,$2,$3,$4,TRUE)
     RETURNING id`,
    [userId, type, digest, secretHash],
  );
  return rows[0];
}

export function defaultSelectedProduct(user) {
  if (user.role === 'staff') return 'pos';
  if (user.role === 'admin') {
    if (user.dual_role_pos_enabled) return null; // must select
    return 'admin';
  }
  return null;
}
