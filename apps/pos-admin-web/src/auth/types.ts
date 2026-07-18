/** Employee product surfaces — never mix POS and Admin navigation. */
export type ProductScope = 'pos' | 'admin' | 'employee';

export type EmployeeRole = 'staff' | 'admin' | 'customer';

/**
 * Stable identity claims for the employee session client.
 * Location/shift IDs are NOT stored here as authoritative claims.
 */
export interface EmployeeIdentity {
  id: string;
  username: string;
  role: EmployeeRole;
  fullName: string;
  isGlobalManager: boolean;
  dualRolePosEnabled: boolean;
  selectedProduct: 'pos' | 'admin' | null;
  assignedBranchIds: string[];
  requiresProductSelection?: boolean;
  authMethod?: string;
}

export interface PermissionContext {
  identity: EmployeeIdentity | null;
  assignedBranchIds: string[];
}

export interface TerminalLocation {
  terminalId: string;
  terminalCode: string;
  branchId: string;
  branchCode: string;
  branchName?: string;
  salesPointId: string;
  salesPointCode: string;
  salesPointName?: string;
}

export interface ShiftSummary {
  id: string;
  status: 'open' | 'locked' | 'closed';
  terminalId: string;
  salesPointId: string;
  branchId: string;
  staffUserId: string;
  openingFloat: number;
  closingExpectedCash: number | null;
  closingActualCash: number | null;
  cashVariance: number | null;
  openedAt?: string;
  lockedAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  handoverNotes?: string | null;
}
