/**
 * Server-side authorization helpers (Phase 1A).
 * UI route checks are NOT security controls — use these on the API.
 *
 * Rules from Phase 0 amendments:
 * - Empty / missing branch access never implies global access.
 * - Global manager requires explicit isGlobalManager / is_global_manager.
 * - Location/shift claims in JWTs are not authoritative (resolved later in Phase 2/3).
 */

export const PRODUCT_SCOPES = Object.freeze(['pos', 'admin', 'employee']);

/**
 * @typedef {object} AuthzUser
 * @property {string} [id]
 * @property {string} [role] - admin | staff | customer
 * @property {boolean} [isGlobalManager]
 * @property {'pos'|'admin'|null} [selectedProduct]
 * @property {string[]} [assignedBranchIds]
 */

export function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

export function isEmployeeRole(role) {
  const r = normalizeRole(role);
  return r === 'staff' || r === 'admin';
}

export function isCustomerRole(role) {
  return normalizeRole(role) === 'customer';
}

/** Explicit capability only — never inferred from empty access arrays. */
export function hasGlobalManagerCapability(user) {
  if (!user) return false;
  if (normalizeRole(user.role) !== 'admin') return false;
  return user.isGlobalManager === true;
}

/**
 * Product scope gate for POS vs Admin separation.
 * @param {AuthzUser|null|undefined} user
 * @param {'pos'|'admin'|'employee'} product
 */
export function canAccessProduct(user, product) {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (role === 'customer') return false;

  if (product === 'employee') {
    return isEmployeeRole(role);
  }

  if (product === 'pos') {
    if (role === 'staff') return true;
    // Manager/Admin may operate POS only with explicit dual-role grant + selectedProduct=pos
    if (role === 'admin') {
      return user.dualRolePosEnabled === true && user.selectedProduct === 'pos';
    }
    return false;
  }

  if (product === 'admin') {
    if (role !== 'admin') return false;
    // Dual-role admin currently in POS product cannot use Admin APIs
    if (user.selectedProduct === 'pos') return false;
    return true;
  }

  return false;
}

/**
 * Branch scope: explicit assignment OR explicit global manager (admin product).
 * Empty assignedBranchIds never grants access.
 * @param {AuthzUser|null|undefined} user
 * @param {string} branchId
 */
export function canAccessBranch(user, branchId) {
  if (!user || !branchId) return false;

  if (hasGlobalManagerCapability(user) && user.selectedProduct !== 'pos') {
    return true;
  }

  const assigned = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : [];
  if (assigned.length === 0) return false;
  return assigned.includes(branchId);
}

/**
 * Whether user may operate POS at a branch (explicit can_operate_pos semantics).
 * For Phase 1A helpers we treat assignedBranchIds as POS-operable branches
 * when provided by the caller; empty list denies.
 */
export function canOperatePosAtBranch(user, branchId) {
  if (!canAccessProduct(user, 'pos')) return false;
  if (!branchId) return false;
  const assigned = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : [];
  return assigned.includes(branchId);
}

export function assertDenied(condition, message = 'denied') {
  if (condition) {
    const err = new Error(message);
    err.code = 'AUTHZ_DENIED';
    throw err;
  }
}
