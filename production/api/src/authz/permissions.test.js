import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessBranch,
  canAccessProduct,
  canOperatePosAtBranch,
  hasGlobalManagerCapability,
  isCustomerRole,
  isEmployeeRole,
} from './permissions.js';

describe('isEmployeeRole / isCustomerRole', () => {
  it('recognizes staff and admin as employees', () => {
    assert.equal(isEmployeeRole('staff'), true);
    assert.equal(isEmployeeRole('admin'), true);
    assert.equal(isEmployeeRole('customer'), false);
  });

  it('recognizes customer', () => {
    assert.equal(isCustomerRole('customer'), true);
    assert.equal(isCustomerRole('staff'), false);
  });
});

describe('hasGlobalManagerCapability', () => {
  it('requires explicit isGlobalManager true on admin', () => {
    assert.equal(hasGlobalManagerCapability({ role: 'admin', isGlobalManager: true }), true);
    assert.equal(hasGlobalManagerCapability({ role: 'admin', isGlobalManager: false }), false);
    assert.equal(hasGlobalManagerCapability({ role: 'admin' }), false);
    assert.equal(hasGlobalManagerCapability({ role: 'staff', isGlobalManager: true }), false);
    assert.equal(hasGlobalManagerCapability(null), false);
  });
});

describe('canAccessProduct', () => {
  it('allows staff into POS and denies Admin', () => {
    const staff = { role: 'staff', selectedProduct: 'pos', assignedBranchIds: ['b1'] };
    assert.equal(canAccessProduct(staff, 'pos'), true);
    assert.equal(canAccessProduct(staff, 'admin'), false);
    assert.equal(canAccessProduct(staff, 'employee'), true);
  });

  it('allows admin into Admin when not in POS product', () => {
    const admin = { role: 'admin', selectedProduct: 'admin', isGlobalManager: true };
    assert.equal(canAccessProduct(admin, 'admin'), true);
    assert.equal(canAccessProduct(admin, 'pos'), false);
  });

  it('allows dual-role admin into POS only with grant + selectedProduct=pos', () => {
    const dual = {
      role: 'admin',
      selectedProduct: 'pos',
      isGlobalManager: true,
      dualRolePosEnabled: true,
    };
    assert.equal(canAccessProduct(dual, 'pos'), true);
    assert.equal(canAccessProduct(dual, 'admin'), false);
    const noGrant = { role: 'admin', selectedProduct: 'pos', dualRolePosEnabled: false };
    assert.equal(canAccessProduct(noGrant, 'pos'), false);
  });

  it('denies customers and missing users', () => {
    assert.equal(canAccessProduct({ role: 'customer' }, 'pos'), false);
    assert.equal(canAccessProduct(null, 'admin'), false);
  });
});

describe('canAccessBranch', () => {
  it('never treats empty access as global', () => {
    const adminNoFlag = { role: 'admin', isGlobalManager: false, assignedBranchIds: [] };
    assert.equal(canAccessBranch(adminNoFlag, 'branch-1'), false);
  });

  it('denies when assignedBranchIds missing entirely', () => {
    const adminNoFlag = { role: 'admin', isGlobalManager: false };
    assert.equal(canAccessBranch(adminNoFlag, 'branch-1'), false);
  });

  it('allows explicit assignment', () => {
    const staff = { role: 'staff', assignedBranchIds: ['branch-1'] };
    assert.equal(canAccessBranch(staff, 'branch-1'), true);
    assert.equal(canAccessBranch(staff, 'branch-2'), false);
  });

  it('allows explicit global manager for admin product', () => {
    const gm = {
      role: 'admin',
      isGlobalManager: true,
      selectedProduct: 'admin',
      assignedBranchIds: [],
    };
    assert.equal(canAccessBranch(gm, 'any'), true);
  });

  it('does not let global manager bypass branch checks while selectedProduct is pos', () => {
    const gmPos = {
      role: 'admin',
      isGlobalManager: true,
      selectedProduct: 'pos',
      assignedBranchIds: [],
    };
    assert.equal(canAccessBranch(gmPos, 'any'), false);
  });
});

describe('canOperatePosAtBranch', () => {
  it('requires POS product access and explicit branch assignment', () => {
    const staff = { role: 'staff', assignedBranchIds: ['b1'] };
    assert.equal(canOperatePosAtBranch(staff, 'b1'), true);
    assert.equal(canOperatePosAtBranch(staff, 'b2'), false);
    assert.equal(canOperatePosAtBranch({ role: 'admin', selectedProduct: 'admin' }, 'b1'), false);
  });
});
