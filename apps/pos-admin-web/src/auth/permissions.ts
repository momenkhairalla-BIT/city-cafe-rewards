import type { EmployeeIdentity, PermissionContext, ProductScope } from './types';

/** UI-side permission helpers — not a security boundary; server enforces. */

export function canAccessProduct(
  identity: EmployeeIdentity | null,
  product: ProductScope,
): boolean {
  if (!identity) return false;
  if (identity.role === 'customer') return false;
  if (product === 'employee') return identity.role === 'staff' || identity.role === 'admin';
  if (product === 'pos') {
    if (identity.role === 'staff') return true;
    return identity.role === 'admin'
      && identity.dualRolePosEnabled === true
      && identity.selectedProduct === 'pos';
  }
  if (product === 'admin') {
    return identity.role === 'admin' && identity.selectedProduct !== 'pos';
  }
  return false;
}

export function hasGlobalManagerCapability(identity: EmployeeIdentity | null): boolean {
  return Boolean(identity?.role === 'admin' && identity.isGlobalManager);
}

export function canAccessBranch(ctx: PermissionContext, branchId: string): boolean {
  if (!ctx.identity) return false;
  if (hasGlobalManagerCapability(ctx.identity) && ctx.identity.selectedProduct !== 'pos') {
    return true;
  }
  return ctx.assignedBranchIds.includes(branchId);
}

export function resolvePostLoginPath(identity: EmployeeIdentity): string {
  if (identity.role === 'customer') return '/unauthorized';
  if (identity.role === 'staff') return '/pos';
  if (identity.role === 'admin') {
    if (identity.dualRolePosEnabled && !identity.selectedProduct) return '/employee/select-role';
    if (identity.selectedProduct === 'pos') return '/pos';
    return '/admin';
  }
  return '/unauthorized';
}

export function assertProductSeparation(product: ProductScope): 'pos' | 'admin' | 'employee' {
  if (product === 'pos' || product === 'admin' || product === 'employee') return product;
  throw new Error('Invalid product scope');
}
