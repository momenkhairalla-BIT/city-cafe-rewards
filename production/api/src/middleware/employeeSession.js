import {
  employeeCookieName,
  loadEmployeeSessionByToken,
  touchEmployeeSession,
  buildAuthzUser,
  loadBranchAccess,
} from '../services/employee-sessions.js';
import { isEmployeeRole } from '../authz/permissions.js';

function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

export function readEmployeeSessionToken(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[employeeCookieName()] || null;
}

/**
 * Require a valid employee session cookie. Does not use Bearer JWT.
 */
export async function requireEmployeeSession(req, res, next) {
  try {
    const token = readEmployeeSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' });
    }
    const loaded = await loadEmployeeSessionByToken(token);
    if (!loaded || loaded.expired) {
      return res.status(401).json({
        error: 'Employee session expired or revoked',
        code: 'EMPLOYEE_SESSION_EXPIRED',
      });
    }
    if (!isEmployeeRole(loaded.row.role)) {
      return res.status(403).json({ error: 'Not an employee account', code: 'NOT_EMPLOYEE' });
    }
    await touchEmployeeSession(loaded.row.id);
    const branches = await loadBranchAccess(loaded.row.user_id);
    req.employeeSessionToken = token;
    req.employeeSession = loaded.row;
    req.employee = buildAuthzUser(loaded.row, branches);
    return next();
  } catch (err) {
    return next(err);
  }
}
