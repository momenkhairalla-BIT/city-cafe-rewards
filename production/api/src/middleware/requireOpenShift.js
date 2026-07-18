import { getActiveShiftForEmployee, getActiveShiftForTerminal } from '../services/shifts.js';
import { canOperatePosAtBranch, canAccessProduct } from '../authz/permissions.js';

/**
 * Reusable middleware for future checkout — requires open (not merely locked) shift
 * matching the authenticated terminal, with employee authorised for the branch.
 * Client-supplied branch/salesPoint IDs are ignored.
 */
export async function requireOpenShift(req, res, next) {
  try {
    if (!req.employee) {
      return res.status(401).json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' });
    }
    if (!req.terminalLocation) {
      return res.status(401).json({ error: 'Terminal credential required', code: 'TERMINAL_CREDENTIAL_REQUIRED' });
    }
    if (!canAccessProduct(req.employee, 'pos')) {
      return res.status(403).json({ error: 'POS product required', code: 'POS_PRODUCT_REQUIRED' });
    }
    if (!canOperatePosAtBranch(req.employee, req.terminalLocation.branch_id)) {
      return res.status(403).json({ error: 'Branch not authorised', code: 'BRANCH_NOT_AUTHORIZED' });
    }

    // Reject client location spoofing when body tries to override
    if (req.body?.branchId && req.body.branchId !== req.terminalLocation.branch_id) {
      return res.status(400).json({ error: 'Client branch override rejected', code: 'LOCATION_SPOOF_REJECTED' });
    }
    if (req.body?.salesPointId && req.body.salesPointId !== req.terminalLocation.sales_point_id) {
      return res.status(400).json({ error: 'Client sales point override rejected', code: 'LOCATION_SPOOF_REJECTED' });
    }

    const byEmployee = await getActiveShiftForEmployee(req.employee.id);
    const byTerminal = await getActiveShiftForTerminal(req.terminalLocation.terminal_id);

    if (!byEmployee || byEmployee.status !== 'open') {
      return res.status(409).json({ error: 'Open shift required', code: 'OPEN_SHIFT_REQUIRED' });
    }
    if (!byTerminal || byTerminal.id !== byEmployee.id) {
      return res.status(409).json({ error: 'Shift/terminal mismatch', code: 'SHIFT_TERMINAL_MISMATCH' });
    }
    if (byEmployee.branch_id !== req.terminalLocation.branch_id
      || byEmployee.sales_point_id !== req.terminalLocation.sales_point_id) {
      return res.status(409).json({ error: 'Location locked for active shift', code: 'LOCATION_LOCKED' });
    }

    req.shift = byEmployee;
    return next();
  } catch (err) {
    return next(err);
  }
}
