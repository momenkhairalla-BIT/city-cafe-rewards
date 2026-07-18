import { Router } from 'express';
import { requireEmployeeSession } from '../../middleware/employeeSession.js';
import { requireEmployeeCsrf } from '../../middleware/csrf.js';
import { requireTerminalCredential } from '../../middleware/terminalAuth.js';
import { canAccessProduct, canOperatePosAtBranch } from '../../authz/permissions.js';
import { getActiveShiftForEmployee, getActiveShiftForTerminal } from '../../services/shifts.js';
import {
  isPosSalesEnabled,
  createPosSale,
  publicSaleResponse,
} from '../../services/pos-sales.js';
import { writeAuditEvent } from '../../services/audit.js';

const router = Router();

function deny(res, status, error, code, retryable = false) {
  return res.status(status).json({ error, code, retryable });
}

/**
 * POST /api/v1/pos/sales
 * Employee cookie + terminal cookie + open shift + ENABLE_POS_SALES=1
 */
router.post(
  '/sales',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireTerminalCredential,
  async (req, res) => {
    try {
      if (!isPosSalesEnabled()) {
        return deny(res, 403, 'POS sales disabled', 'POS_SALES_DISABLED');
      }

      // Customer Bearer never reaches here (cookie session only)
      if (!canAccessProduct(req.employee, 'pos')) {
        return deny(res, 403, 'POS product required', 'POS_PRODUCT_REQUIRED');
      }
      if (!canOperatePosAtBranch(req.employee, req.terminalLocation.branch_id)) {
        return deny(res, 403, 'Branch not authorised', 'BRANCH_NOT_AUTHORIZED');
      }

      const byEmployee = await getActiveShiftForEmployee(req.employee.id);
      const byTerminal = await getActiveShiftForTerminal(req.terminalLocation.terminal_id);

      if (!byEmployee) {
        return deny(res, 403, 'Open shift required', 'OPEN_SHIFT_REQUIRED');
      }
      if (byEmployee.status === 'locked') {
        return deny(res, 403, 'Shift is locked', 'SHIFT_LOCKED');
      }
      if (byEmployee.status !== 'open') {
        return deny(res, 403, 'Open shift required', 'OPEN_SHIFT_REQUIRED');
      }
      if (!byTerminal || byTerminal.id !== byEmployee.id) {
        return deny(res, 403, 'Shift/terminal mismatch', 'SHIFT_TERMINAL_MISMATCH');
      }

      const idempotencyKey = req.get('idempotency-key') || req.get('Idempotency-Key');
      if (!idempotencyKey) {
        return deny(res, 400, 'Idempotency-Key header required', 'IDEMPOTENCY_KEY_REQUIRED');
      }

      const result = await createPosSale({
        employee: req.employee,
        employeeSession: req.employeeSession,
        terminal: req.terminal,
        terminalLocation: req.terminalLocation,
        shift: byEmployee,
        idempotencyKey: String(idempotencyKey),
        body: req.body || {},
      });

      const status = result.replay ? 200 : 201;
      return res.status(status).json({ data: publicSaleResponse(result) });
    } catch (err) {
      const status = err.status || 500;
      const code = err.code || 'POS_SALE_FAILED';
      const retryable = Boolean(err.retryable) || status >= 500;
      if (status >= 500) {
        await writeAuditEvent({
          eventType: 'pos.sale_failed',
          outcome: 'failure',
          actorUserId: req.employee?.id,
          actorRole: req.employee?.role,
          selectedProduct: 'pos',
          terminalId: req.terminal?.id,
          shiftId: req.shift?.id,
          errorCode: code,
          metadata: {},
        }).catch(() => {});
      }
      return res.status(status).json({
        error: err.message || 'Sale failed',
        code,
        retryable,
      });
    }
  },
);

export default router;
