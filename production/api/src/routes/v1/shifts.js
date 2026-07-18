import { Router } from 'express';
import { requireEmployeeSession } from '../../middleware/employeeSession.js';
import { requireEmployeeCsrf } from '../../middleware/csrf.js';
import { requireTerminalCredential } from '../../middleware/terminalAuth.js';
import {
  openShift,
  getActiveShiftForEmployee,
  lockShift,
  resumeShift,
  closeShift,
  shiftSummary,
} from '../../services/shifts.js';
import { canAccessProduct } from '../../authz/permissions.js';

const router = Router();

function sendErr(res, err) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  throw err;
}

router.post(
  '/open',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireTerminalCredential,
  async (req, res, next) => {
    try {
      // Ignore client location overrides
      if (req.body?.branchId || req.body?.salesPointId) {
        if (
          (req.body.branchId && req.body.branchId !== req.terminalLocation.branch_id)
          || (req.body.salesPointId && req.body.salesPointId !== req.terminalLocation.sales_point_id)
        ) {
          return res.status(400).json({
            error: 'Client location override rejected',
            code: 'LOCATION_SPOOF_REJECTED',
          });
        }
      }
      if (!canAccessProduct(req.employee, 'pos')) {
        return res.status(403).json({ error: 'POS product required', code: 'POS_PRODUCT_REQUIRED' });
      }
      const shift = await openShift({
        employee: req.employee,
        terminalLocation: req.terminalLocation,
        openingFloat: req.body?.openingFloat ?? 0,
        notes: req.body?.notes || null,
      });
      return res.status(201).json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      try { return sendErr(res, err); } catch (e) { return next(e); }
    }
  },
);

router.get(
  '/current',
  requireEmployeeSession,
  requireTerminalCredential,
  async (req, res, next) => {
    try {
      const shift = await getActiveShiftForEmployee(req.employee.id);
      if (!shift) return res.json({ data: { shift: null } });
      if (shift.terminal_id !== req.terminalLocation.terminal_id) {
        return res.status(409).json({
          error: 'Active shift is bound to a different terminal',
          code: 'LOCATION_LOCKED',
        });
      }
      return res.json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  '/:shiftId/lock',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireTerminalCredential,
  async (req, res, next) => {
    try {
      const shift = await lockShift({ employee: req.employee, shiftId: req.params.shiftId });
      return res.json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      try { return sendErr(res, err); } catch (e) { return next(e); }
    }
  },
);

router.post(
  '/:shiftId/resume',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireTerminalCredential,
  async (req, res, next) => {
    try {
      const shift = await resumeShift({ employee: req.employee, shiftId: req.params.shiftId });
      return res.json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      try { return sendErr(res, err); } catch (e) { return next(e); }
    }
  },
);

router.post(
  '/:shiftId/close',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireTerminalCredential,
  async (req, res, next) => {
    try {
      const shift = await closeShift({
        employee: req.employee,
        shiftId: req.params.shiftId,
        expectedCash: req.body?.expectedCash,
        actualCash: req.body?.actualCash,
        notes: req.body?.notes || null,
        handoverNotes: req.body?.handoverNotes || null,
        handoverToUserId: req.body?.handoverToUserId || null,
      });
      return res.json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      try { return sendErr(res, err); } catch (e) { return next(e); }
    }
  },
);

router.get(
  '/:shiftId/summary',
  requireEmployeeSession,
  async (req, res, next) => {
    try {
      const { rows } = await (await import('../../db/pool.js')).query(
        `SELECT * FROM shifts WHERE id = $1`,
        [req.params.shiftId],
      );
      const shift = rows[0];
      if (!shift) return res.status(404).json({ error: 'Shift not found', code: 'SHIFT_NOT_FOUND' });
      if (shift.staff_user_id !== req.employee.id && !canAccessProduct(req.employee, 'admin')) {
        return res.status(403).json({ error: 'Forbidden', code: 'SHIFT_FORBIDDEN' });
      }
      return res.json({ data: { shift: shiftSummary(shift) } });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
