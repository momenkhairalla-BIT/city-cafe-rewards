import { query, pool } from '../db/pool.js';
import { generateOpaqueToken, hashToken } from './secure-tokens.js';

const COOKIE_NAME = process.env.EMPLOYEE_SESSION_COOKIE || 'aida_employee_session';
const IDLE_MS = Number(process.env.EMPLOYEE_SESSION_IDLE_MS || 30 * 60 * 1000);
const ABSOLUTE_MS = Number(process.env.EMPLOYEE_SESSION_ABSOLUTE_MS || 12 * 60 * 60 * 1000);

export function employeeCookieName() {
  return COOKIE_NAME;
}

export function employeeCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd || process.env.EMPLOYEE_COOKIE_SECURE === '1',
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/v1',
    maxAge: ABSOLUTE_MS,
  };
}

export async function createEmployeeSession({ userId, authMethod, selectedProduct = null }) {
  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const now = Date.now();
  const idleExpires = new Date(now + IDLE_MS);
  const absoluteExpires = new Date(now + ABSOLUTE_MS);

  const { rows } = await query(
    `INSERT INTO employee_sessions (
      user_id, token_hash, auth_method, selected_product,
      idle_expires_at, absolute_expires_at
    ) VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, user_id, auth_method, selected_product, created_at,
              last_seen_at, idle_expires_at, absolute_expires_at, revoked_at`,
    [userId, tokenHash, authMethod, selectedProduct, idleExpires.toISOString(), absoluteExpires.toISOString()],
  );

  return { token, session: rows[0] };
}

export async function loadEmployeeSessionByToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { rows } = await query(
    `SELECT s.*, u.username, u.email, u.role, u.full_name, u.is_active,
            u.is_global_manager, u.dual_role_pos_enabled
     FROM employee_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.revoked_at) return { expired: true, reason: 'revoked', row };
  if (row.is_active === false) return { expired: true, reason: 'user_inactive', row };
  const now = Date.now();
  if (new Date(row.absolute_expires_at).getTime() <= now) {
    return { expired: true, reason: 'absolute_expired', row };
  }
  if (new Date(row.idle_expires_at).getTime() <= now) {
    return { expired: true, reason: 'idle_expired', row };
  }
  return { expired: false, row };
}

export async function touchEmployeeSession(sessionId) {
  const idleExpires = new Date(Date.now() + IDLE_MS);
  await query(
    `UPDATE employee_sessions
     SET last_seen_at = NOW(), idle_expires_at = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, idleExpires.toISOString()],
  );
}

export async function revokeEmployeeSessionByToken(token) {
  if (!token) return false;
  const tokenHash = hashToken(token);
  const { rowCount } = await query(
    `UPDATE employee_sessions SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  return rowCount > 0;
}

export async function setSelectedProduct(sessionId, product) {
  const { rows } = await query(
    `UPDATE employee_sessions
     SET selected_product = $2, last_seen_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING *`,
    [sessionId, product],
  );
  return rows[0] || null;
}

export async function loadBranchAccess(userId) {
  const { rows } = await query(
    `SELECT branch_id, can_operate_pos, can_manage, is_default
     FROM user_branch_access WHERE user_id = $1`,
    [userId],
  );
  return rows;
}

export function buildAuthzUser(sessionRow, branchRows) {
  const posBranches = branchRows
    .filter((r) => r.can_operate_pos)
    .map((r) => r.branch_id);
  return {
    id: sessionRow.user_id,
    role: sessionRow.role,
    isGlobalManager: sessionRow.is_global_manager === true,
    dualRolePosEnabled: sessionRow.dual_role_pos_enabled === true,
    selectedProduct: sessionRow.selected_product || null,
    assignedBranchIds: posBranches,
    manageBranchIds: branchRows.filter((r) => r.can_manage).map((r) => r.branch_id),
    authMethod: sessionRow.auth_method,
    sessionId: sessionRow.id,
  };
}

export { pool };
