import type { TerminalLocation } from '../../auth/types';

/**
 * Team 2 adapter contract — production implementation must use the shared API.
 * Preview repository satisfies the same interface for UI development only.
 *
 * Expected live endpoints (do not invent alternate contracts):
 * - GET  /api/v1/terminals/status
 * - POST /api/v1/terminals/enrol  { enrolmentCode }
 * - GET  /api/v1/terminals/current
 * - POST /api/v1/terminals/:id/enrolment-codes  (manager)
 * - POST /api/v1/terminals/:id/revoke
 *
 * Rules Team 2 must enforce:
 * - OTC is manager-issued, single-use, time-limited
 * - Device never generates its own code
 * - Terminal secret is HttpOnly cookie only (never JSON)
 * - Fingerprint is telemetry, never authentication
 * - Location resolved server-side from enrolled terminal
 */
export type TerminalEnrolErrorCode =
  | 'INVALID_ENROLMENT_CODE'
  | 'ENROLMENT_CODE_EXPIRED'
  | 'ENROLMENT_CODE_CONSUMED'
  | 'TERMINAL_UNENROLLED'
  | 'NETWORK_ERROR';

export type TerminalStatusResult =
  | { enrolled: true; location: TerminalLocation }
  | { enrolled: false; code: TerminalEnrolErrorCode };

export interface TerminalRepository {
  getStatus(): Promise<TerminalStatusResult>;
  enrol(enrolmentCode: string): Promise<
    | { ok: true; location: TerminalLocation }
    | { ok: false; code: TerminalEnrolErrorCode; message: string }
  >;
  clearLocalPreview?(): void;
}

export const PREVIEW_MAIN_COUNTER_LOCATION: TerminalLocation = {
  terminalId: 'preview-term-main-01',
  terminalCode: 'POS-MAIN-01',
  branchId: 'preview-branch-main',
  branchCode: 'BR-MAIN',
  branchName: 'Main Café',
  salesPointId: 'preview-sp-main',
  salesPointCode: 'SP-MAIN',
  salesPointName: 'Main Counter',
};
