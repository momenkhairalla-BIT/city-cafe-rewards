import type { EmployeeIdentity } from '../../auth/types';
import { PREVIEW_DEMO_ACCOUNTS } from '../demoAccounts';

/**
 * Team 2 live adapter (documented for handover):
 * - POST /api/v1/auth/employee/login
 * - POST /api/v1/auth/employee/login/badge
 * - GET  /api/v1/auth/employee/session
 * - POST /api/v1/auth/employee/logout
 * - POST /api/v1/auth/employee/product-select
 * Cookie + CSRF Origin; never localStorage tokens.
 */

const BRANCH_MAIN = 'preview-branch-main';

function staffIdentity(): EmployeeIdentity {
  return {
    id: 'preview-staff-01',
    username: PREVIEW_DEMO_ACCOUNTS.staff.username,
    role: 'staff',
    fullName: 'Preview Staff',
    isGlobalManager: false,
    dualRolePosEnabled: false,
    selectedProduct: 'pos',
    assignedBranchIds: [BRANCH_MAIN],
    authMethod: 'password',
  };
}

function adminIdentity(): EmployeeIdentity {
  return {
    id: 'preview-admin-01',
    username: PREVIEW_DEMO_ACCOUNTS.admin.username,
    role: 'admin',
    fullName: 'Preview Admin',
    isGlobalManager: true,
    dualRolePosEnabled: false,
    selectedProduct: 'admin',
    assignedBranchIds: [BRANCH_MAIN],
    authMethod: 'password',
  };
}

function dualIdentity(selected: 'pos' | 'admin' | null = null): EmployeeIdentity {
  return {
    id: 'preview-dual-01',
    username: PREVIEW_DEMO_ACCOUNTS.dual.username,
    role: 'admin',
    fullName: 'Preview Dual Role',
    isGlobalManager: false,
    dualRolePosEnabled: true,
    selectedProduct: selected,
    assignedBranchIds: [BRANCH_MAIN],
    requiresProductSelection: !selected,
    authMethod: 'password',
  };
}

let previewSession: EmployeeIdentity | null = null;

export const previewAuthRepository = {
  getSession(): EmployeeIdentity | null {
    return previewSession;
  },

  loginWithPassword(username: string, password: string): EmployeeIdentity {
    const u = username.trim().toLowerCase();
    const p = password;
    if (u === PREVIEW_DEMO_ACCOUNTS.staff.username && p === PREVIEW_DEMO_ACCOUNTS.staff.password) {
      previewSession = staffIdentity();
      return previewSession;
    }
    if (u === PREVIEW_DEMO_ACCOUNTS.admin.username && p === PREVIEW_DEMO_ACCOUNTS.admin.password) {
      previewSession = adminIdentity();
      return previewSession;
    }
    if (u === PREVIEW_DEMO_ACCOUNTS.dual.username && p === PREVIEW_DEMO_ACCOUNTS.dual.password) {
      previewSession = dualIdentity(null);
      return previewSession;
    }
    const err = new Error('Invalid demonstration credentials') as Error & { code?: string };
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  },

  loginWithBadge(badgeValue: string, pin: string): EmployeeIdentity {
    if (badgeValue.trim() === 'PREVIEW-BADGE' && pin === '4821') {
      previewSession = staffIdentity();
      return previewSession;
    }
    const err = new Error('Invalid demonstration badge/PIN') as Error & { code?: string };
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  },

  selectProduct(product: 'pos' | 'admin'): EmployeeIdentity {
    if (!previewSession?.dualRolePosEnabled) {
      const err = new Error('Product selection not allowed') as Error & { code?: string };
      err.code = 'FORBIDDEN';
      throw err;
    }
    previewSession = dualIdentity(product);
    return previewSession;
  },

  logout() {
    previewSession = null;
  },
};
