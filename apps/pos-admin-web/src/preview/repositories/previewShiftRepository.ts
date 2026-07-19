import type { ShiftSummary, TerminalLocation } from '../../auth/types';
import { PREVIEW_MAIN_COUNTER_LOCATION } from './terminalAdapter';

/**
 * Team 2 live adapter:
 * - POST /api/v1/shifts/open
 * - GET  /api/v1/shifts/current
 * - POST /api/v1/shifts/:id/lock|resume|close
 */

let previewShift: ShiftSummary | null = null;

export const previewShiftRepository = {
  getCurrent(): ShiftSummary | null {
    return previewShift;
  },

  open(location: TerminalLocation, staffUserId: string, openingFloat: number): ShiftSummary {
    previewShift = {
      id: `preview-shift-${Date.now()}`,
      status: 'open',
      terminalId: location.terminalId,
      salesPointId: location.salesPointId,
      branchId: location.branchId,
      staffUserId,
      openingFloat,
      closingExpectedCash: null,
      closingActualCash: null,
      cashVariance: null,
      openedAt: new Date().toISOString(),
      lockedAt: null,
      closedAt: null,
    };
    return previewShift;
  },

  lock(): ShiftSummary {
    if (!previewShift) throw new Error('No shift');
    previewShift = {
      ...previewShift,
      status: 'locked',
      lockedAt: new Date().toISOString(),
    };
    return previewShift;
  },

  resume(): ShiftSummary {
    if (!previewShift) throw new Error('No shift');
    previewShift = {
      ...previewShift,
      status: 'open',
      lockedAt: null,
    };
    return previewShift;
  },

  close(expectedCash: number, actualCash: number, notes?: string, handoverNotes?: string): ShiftSummary {
    if (!previewShift) throw new Error('No shift');
    previewShift = {
      ...previewShift,
      status: 'closed',
      closingExpectedCash: expectedCash,
      closingActualCash: actualCash,
      cashVariance: actualCash - expectedCash,
      closedAt: new Date().toISOString(),
      notes: notes || null,
      handoverNotes: handoverNotes || null,
    };
    return previewShift;
  },

  reset() {
    previewShift = null;
  },

  defaultLocation: PREVIEW_MAIN_COUNTER_LOCATION,
};
