import { describe, expect, it } from 'vitest';
import { canAccessProduct, resolvePostLoginPath } from './permissions';
import type { EmployeeIdentity } from './types';

const staff: EmployeeIdentity = {
  id: '1',
  username: 'staff',
  role: 'staff',
  fullName: 'Staff',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['b1'],
};

const manager: EmployeeIdentity = {
  id: '2',
  username: 'admin',
  role: 'admin',
  fullName: 'Admin',
  isGlobalManager: true,
  dualRolePosEnabled: false,
  selectedProduct: 'admin',
  assignedBranchIds: [],
};

const dual: EmployeeIdentity = {
  id: '3',
  username: 'dual',
  role: 'admin',
  fullName: 'Dual',
  isGlobalManager: true,
  dualRolePosEnabled: true,
  selectedProduct: null,
  assignedBranchIds: ['b1'],
  requiresProductSelection: true,
};

describe('Phase 2B role routing helpers', () => {
  it('staff routes only to POS', () => {
    expect(resolvePostLoginPath(staff)).toBe('/pos');
    expect(canAccessProduct(staff, 'pos')).toBe(true);
    expect(canAccessProduct(staff, 'admin')).toBe(false);
  });

  it('manager routes only to Admin without dual-role', () => {
    expect(resolvePostLoginPath(manager)).toBe('/admin');
    expect(canAccessProduct(manager, 'admin')).toBe(true);
    expect(canAccessProduct(manager, 'pos')).toBe(false);
  });

  it('dual-role requires explicit selection', () => {
    expect(resolvePostLoginPath(dual)).toBe('/employee/select-role');
    expect(canAccessProduct({ ...dual, selectedProduct: 'pos' }, 'pos')).toBe(true);
    expect(canAccessProduct({ ...dual, selectedProduct: 'admin' }, 'admin')).toBe(true);
  });

  it('customer rejected', () => {
    const customer = { ...staff, role: 'customer' as const };
    expect(resolvePostLoginPath(customer)).toBe('/unauthorized');
    expect(canAccessProduct(customer, 'employee')).toBe(false);
  });

  it('manager cannot enter POS without dual-role grant', () => {
    expect(canAccessProduct({ ...manager, selectedProduct: 'pos' }, 'pos')).toBe(false);
  });
});
