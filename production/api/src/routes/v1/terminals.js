import { Router } from 'express';
import { requireEmployeeSession } from '../../middleware/employeeSession.js';
import { requireEmployeeCsrf } from '../../middleware/csrf.js';
import { requireTerminalCredential } from '../../middleware/terminalAuth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { canAccessProduct, hasGlobalManagerCapability } from '../../authz/permissions.js';
import {
  createEnrolmentCode,
  enrolTerminal,
  heartbeatTerminal,
  revokeTerminal,
  resolveTerminalLocation,
} from '../../services/terminals.js';
import {
  setTerminalCredentialCookie,
  clearTerminalCredentialCookie,
} from '../../services/terminal-cookie.js';
import { query } from '../../db/pool.js';
import { writeAuditEvent } from '../../services/audit.js';

const router = Router();
const enrolMax = process.env.NODE_ENV === 'production' ? 15 : Number(process.env.ENROL_RATE_LIMIT_MAX || 100);
const enrolLimiter = rateLimit({ scope: 'terminal-enrol', windowMs: 60_000, max: enrolMax, code: 'ENROL_RATE_LIMITED' });

function requireManagerAdmin(req, res, next) {
  if (!canAccessProduct(req.employee, 'admin')) {
    return res.status(403).json({ error: 'Admin product required', code: 'ADMIN_PRODUCT_REQUIRED' });
  }
  if (!hasGlobalManagerCapability(req.employee) && !(req.employee.manageBranchIds || []).length) {
    return res.status(403).json({ error: 'Manager permission required', code: 'MANAGER_REQUIRED' });
  }
  return next();
}

/** Manager: create one-time enrolment code */
router.post(
  '/:terminalId/enrolment-codes',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireManagerAdmin,
  enrolLimiter,
  async (req, res, next) => {
    try {
      const result = await createEnrolmentCode({
        terminalId: req.params.terminalId,
        managerUserId: req.employee.id,
      });
      // Return OTC once — never log it
      return res.status(201).json({
        data: {
          terminalId: result.terminalId,
          enrolmentCode: result.enrolmentCode,
          expiresAt: result.expiresAt,
        },
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
      return next(err);
    }
  },
);

/** Device: exchange OTC for terminal credential (public + rate limited) */
router.post('/enrol', enrolLimiter, async (req, res, next) => {
  try {
    const { enrolmentCode, deviceFingerprint } = req.body || {};
    if (!enrolmentCode) {
      return res.status(400).json({ error: 'enrolmentCode required', code: 'VALIDATION_ERROR' });
    }
    // Fingerprint alone is ignored for auth — accepted only as telemetry with code
    const result = await enrolTerminal({ enrolmentCode, deviceFingerprint: deviceFingerprint || null });
    // Persist opaque credential in HttpOnly cookie — never return secret to JS
    setTerminalCredentialCookie(res, result.terminalCredential);
    return res.status(201).json({
      data: {
        enrolled: true,
        terminal: {
          id: result.terminal.id,
          code: result.terminal.code,
          status: result.terminal.status,
          credentialVersion: result.terminal.credential_version,
        },
        location: {
          branchId: result.location.branch_id,
          branchCode: result.location.branch_code,
          salesPointId: result.location.sales_point_id,
          salesPointCode: result.location.sales_point_code,
          terminalId: result.location.terminal_id,
          terminalCode: result.location.terminal_code,
        },
      },
    });
  } catch (err) {
    await writeAuditEvent({
      eventType: 'terminal.enrol_failed',
      outcome: 'failure',
      errorCode: err.code || 'ENROLMENT_FAILED',
      metadata: {},
    }).catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    return next(err);
  }
});

/** Public probe — no cookie → unenrolled (does not leak secrets). */
router.get('/status', async (req, res, next) => {
  try {
    const { readTerminalCredentialFromRequest } = await import('../../services/terminal-cookie.js');
    const { authenticateTerminalCredential } = await import('../../services/terminals.js');
    const credential = readTerminalCredentialFromRequest(req);
    if (!credential) {
      return res.json({ data: { enrolled: false, code: 'TERMINAL_UNENROLLED' } });
    }
    const auth = await authenticateTerminalCredential(credential);
    if (!auth) {
      clearTerminalCredentialCookie(res);
      return res.json({ data: { enrolled: false, code: 'TERMINAL_REVOKED_OR_INVALID' } });
    }
    return res.json({
      data: {
        enrolled: true,
        terminal: {
          id: auth.terminal.id,
          status: auth.terminal.status,
          credentialVersion: auth.terminal.credential_version,
        },
        location: {
          branchId: auth.location.branch_id,
          branchCode: auth.location.branch_code,
          branchName: auth.location.branch_name,
          salesPointId: auth.location.sales_point_id,
          salesPointCode: auth.location.sales_point_code,
          salesPointName: auth.location.sales_point_name,
          terminalId: auth.location.terminal_id,
          terminalCode: auth.location.terminal_code,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/current', requireTerminalCredential, async (req, res) => {
  return res.json({
    data: {
      enrolled: true,
      terminal: {
        id: req.terminal.id,
        status: req.terminal.status,
        credentialVersion: req.terminal.credential_version,
      },
      location: {
        branchId: req.terminalLocation.branch_id,
        branchCode: req.terminalLocation.branch_code,
        branchName: req.terminalLocation.branch_name,
        salesPointId: req.terminalLocation.sales_point_id,
        salesPointCode: req.terminalLocation.sales_point_code,
        salesPointName: req.terminalLocation.sales_point_name,
        terminalId: req.terminalLocation.terminal_id,
        terminalCode: req.terminalLocation.terminal_code,
      },
    },
  });
});

/** Clear local terminal cookie (reset / after revoke). */
router.post('/clear-credential', (req, res) => {
  clearTerminalCredentialCookie(res);
  return res.json({ data: { ok: true, enrolled: false } });
});

router.post('/heartbeat', requireTerminalCredential, async (req, res, next) => {
  try {
    await heartbeatTerminal(req.terminal.id);
    return res.json({ data: { ok: true, terminalId: req.terminal.id } });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/:terminalId/revoke',
  requireEmployeeSession,
  requireEmployeeCsrf,
  requireManagerAdmin,
  async (req, res, next) => {
    try {
      const replaced = await revokeTerminal({
        terminalId: req.params.terminalId,
        managerUserId: req.employee.id,
        replaceWithTerminalId: req.body?.replaceWithTerminalId || null,
      });
      // If this browser held the revoked terminal cookie, clear it
      if (req.terminal && String(req.terminal.id) === String(req.params.terminalId)) {
        clearTerminalCredentialCookie(res);
      } else {
        // Best-effort clear — client should call /clear-credential after revoke
        clearTerminalCredentialCookie(res);
      }
      return res.json({ data: { terminal: replaced, cookieCleared: true } });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
      return next(err);
    }
  },
);

/** Helper list for managers (Main Counter / Snack Station terminals) */
router.get(
  '/',
  requireEmployeeSession,
  requireManagerAdmin,
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT t.id, t.code, t.name, t.status, t.credential_version,
                sp.code AS sales_point_code, b.code AS branch_code
         FROM terminals t
         JOIN sales_points sp ON sp.id = t.sales_point_id
         JOIN branches b ON b.id = sp.branch_id
         ORDER BY t.code`,
      );
      return res.json({ data: { terminals: rows } });
    } catch (err) {
      return next(err);
    }
  },
);

export { resolveTerminalLocation };
export default router;
