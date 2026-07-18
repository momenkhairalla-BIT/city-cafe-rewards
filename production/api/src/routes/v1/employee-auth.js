import { Router } from 'express';
import { isCustomerRole, isEmployeeRole, canAccessProduct } from '../../authz/permissions.js';
import {
  findEmployeeUserByUsername,
  verifyEmployeePassword,
  verifyBadgePin,
  defaultSelectedProduct,
} from '../../services/staff-credentials.js';
import {
  createEmployeeSession,
  revokeEmployeeSessionByToken,
  setSelectedProduct,
  employeeCookieName,
  employeeCookieOptions,
  loadBranchAccess,
  buildAuthzUser,
} from '../../services/employee-sessions.js';
import { writeAuditEvent } from '../../services/audit.js';
import { requireEmployeeSession, readEmployeeSessionToken } from '../../middleware/employeeSession.js';
import { requireEmployeeCsrf } from '../../middleware/csrf.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const router = Router();

const loginMax = process.env.NODE_ENV === 'production' ? 10 : Number(process.env.LOGIN_RATE_LIMIT_MAX || 100);
const pinMax = process.env.NODE_ENV === 'production' ? 10 : Number(process.env.PIN_RATE_LIMIT_MAX || 100);
const loginLimiter = rateLimit({ scope: 'employee-login', windowMs: 60_000, max: loginMax, code: 'LOGIN_RATE_LIMITED' });
const pinLimiter = rateLimit({ scope: 'employee-pin', windowMs: 60_000, max: pinMax, code: 'PIN_RATE_LIMITED' });

function setSessionCookie(res, token) {
  const opts = employeeCookieOptions();
  const parts = [
    `${employeeCookieName()}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `Path=${opts.path}`,
    `SameSite=${opts.sameSite === 'strict' ? 'Strict' : 'Lax'}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
  ];
  if (opts.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const opts = employeeCookieOptions();
  const parts = [
    `${employeeCookieName()}=`,
    'HttpOnly',
    `Path=${opts.path}`,
    `SameSite=${opts.sameSite === 'strict' ? 'Strict' : 'Lax'}`,
    'Max-Age=0',
  ];
  if (opts.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function publicEmployee(user, session, branches) {
  const authz = buildAuthzUser(
    {
      ...session,
      user_id: user.id,
      role: user.role,
      is_global_manager: user.is_global_manager,
      dual_role_pos_enabled: user.dual_role_pos_enabled,
    },
    branches,
  );
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    isGlobalManager: user.is_global_manager === true,
    dualRolePosEnabled: user.dual_role_pos_enabled === true,
    selectedProduct: session.selected_product,
    authMethod: session.auth_method,
    assignedBranchIds: authz.assignedBranchIds,
    requiresProductSelection: session.selected_product == null && user.dual_role_pos_enabled === true,
  };
}

async function completeLogin(res, user, authMethod, { auditMeta = {} } = {}) {
  const selected = defaultSelectedProduct(user);
  const { token, session } = await createEmployeeSession({
    userId: user.id,
    authMethod,
    selectedProduct: selected,
  });
  const branches = await loadBranchAccess(user.id);
  setSessionCookie(res, token);
  // Cookie session only — React clients must never receive/store a Bearer token here.
  await writeAuditEvent({
    eventType: 'employee.login',
    outcome: 'success',
    actorUserId: user.id,
    actorRole: user.role,
    selectedProduct: selected,
    metadata: { authMethod, ...auditMeta },
  });
  return res.json({
    data: {
      employee: publicEmployee(user, session, branches),
      session: {
        idleExpiresAt: session.idle_expires_at,
        absoluteExpiresAt: session.absolute_expires_at,
      },
    },
  });
}

async function failLogin(res, { actorUserId = null, actorRole = null, errorCode, authMethod }) {
  await writeAuditEvent({
    eventType: 'employee.login',
    outcome: 'failure',
    actorUserId,
    actorRole,
    errorCode,
    metadata: { authMethod },
  });
  return res.status(401).json({
    error: 'Invalid credentials',
    code: 'INVALID_CREDENTIALS',
  });
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required', code: 'VALIDATION_ERROR' });
    }
    const user = await findEmployeeUserByUsername(username);
    if (!user || user.is_active === false || isCustomerRole(user.role) || !isEmployeeRole(user.role)) {
      return failLogin(res, { errorCode: 'INVALID_CREDENTIALS', authMethod: 'password' });
    }
    const ok = await verifyEmployeePassword(user, password);
    if (!ok) {
      return failLogin(res, {
        actorUserId: user.id,
        actorRole: user.role,
        errorCode: 'INVALID_CREDENTIALS',
        authMethod: 'password',
      });
    }
    return completeLogin(res, user, 'password');
  } catch (err) {
    return next(err);
  }
});

/**
 * DEPRECATED — temporary legacy SPA compatibility (password only).
 * Feature-gated: ENABLE_LEGACY_EMPLOYEE_LOGIN=1
 * Removal scheduled: Phase 5.
 * Badge/PIN must never use this endpoint.
 * React POS/Admin must never call or store the returned Bearer token.
 */
router.post('/legacy-login', loginLimiter, async (req, res, next) => {
  try {
    if (process.env.ENABLE_LEGACY_EMPLOYEE_LOGIN !== '1') {
      await writeAuditEvent({
        eventType: 'employee.legacy_login',
        outcome: 'denied',
        errorCode: 'LEGACY_EMPLOYEE_LOGIN_DISABLED',
        metadata: { authMethod: 'password', deprecated: true },
      });
      return res.status(403).json({
        error: 'Legacy employee login is disabled',
        code: 'LEGACY_EMPLOYEE_LOGIN_DISABLED',
        deprecation: 'Scheduled for removal in Phase 5. Use /api/v1/auth/employee/login (cookie session).',
      });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required', code: 'VALIDATION_ERROR' });
    }
    // Explicitly reject badge/PIN style payloads
    if (req.body?.badgeValue || req.body?.cardValue || req.body?.pin) {
      return res.status(400).json({
        error: 'Badge/PIN is not supported on the legacy employee login endpoint',
        code: 'LEGACY_BADGE_NOT_ALLOWED',
      });
    }

    const user = await findEmployeeUserByUsername(username);
    if (!user || user.is_active === false || isCustomerRole(user.role) || !isEmployeeRole(user.role)) {
      await writeAuditEvent({
        eventType: 'employee.legacy_login',
        outcome: 'failure',
        errorCode: 'INVALID_CREDENTIALS',
        metadata: { authMethod: 'password', deprecated: true },
      });
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const ok = await verifyEmployeePassword(user, password);
    if (!ok) {
      await writeAuditEvent({
        eventType: 'employee.legacy_login',
        outcome: 'failure',
        actorUserId: user.id,
        actorRole: user.role,
        errorCode: 'INVALID_CREDENTIALS',
        metadata: { authMethod: 'password', deprecated: true },
      });
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const selected = defaultSelectedProduct(user);
    const expiresIn = process.env.JWT_LEGACY_EMPLOYEE_EXPIRES_IN || '2h';
    const { default: jwt } = await import('jsonwebtoken');
    const { getJwtSecret } = await import('../../services/auth.js');
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        selectedProduct: selected,
        legacyEmployee: true,
      },
      getJwtSecret(),
      { expiresIn },
    );

    await writeAuditEvent({
      eventType: 'employee.legacy_login',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: user.role,
      selectedProduct: selected,
      metadata: { authMethod: 'password', deprecated: true, removalPhase: 'Phase 5' },
    });

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Phase-5');
    return res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        },
        token,
        expiresIn,
        deprecated: true,
        removalScheduled: 'Phase 5',
        note: 'Use cookie employee login for new clients. Never use this token in React POS/Admin.',
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** Mock/software badge + PIN adapter (keyboard-wedge style). */
router.post('/login/badge', pinLimiter, async (req, res, next) => {
  try {
    const { badgeValue, pin, cardValue } = req.body || {};
    const badge = badgeValue || cardValue;
    if (!badge || !pin) {
      return res.status(400).json({ error: 'Badge and PIN required', code: 'VALIDATION_ERROR' });
    }
    const user = await verifyBadgePin({ badgeValue: badge, pin });
    if (!user || isCustomerRole(user.role) || !isEmployeeRole(user.role)) {
      return failLogin(res, { errorCode: 'INVALID_CREDENTIALS', authMethod: 'badge_pin' });
    }
    return completeLogin(res, user, 'badge_pin', { auditMeta: { adapter: 'mock_software' } });
  } catch (err) {
    return next(err);
  }
});

router.get('/session', requireEmployeeSession, async (req, res) => {
  const branches = await loadBranchAccess(req.employee.id);
  return res.json({
    data: {
      employee: publicEmployee(
        {
          id: req.employee.id,
          username: req.employeeSession.username,
          email: req.employeeSession.email,
          role: req.employee.role,
          full_name: req.employeeSession.full_name,
          is_global_manager: req.employee.isGlobalManager,
          dual_role_pos_enabled: req.employee.dualRolePosEnabled,
        },
        req.employeeSession,
        branches,
      ),
      session: {
        idleExpiresAt: req.employeeSession.idle_expires_at,
        absoluteExpiresAt: req.employeeSession.absolute_expires_at,
        lastSeenAt: req.employeeSession.last_seen_at,
      },
    },
  });
});

router.post('/logout', requireEmployeeSession, requireEmployeeCsrf, async (req, res, next) => {
  try {
    const token = readEmployeeSessionToken(req);
    await revokeEmployeeSessionByToken(token);
    clearSessionCookie(res);
    await writeAuditEvent({
      eventType: 'employee.logout',
      outcome: 'success',
      actorUserId: req.employee.id,
      actorRole: req.employee.role,
      selectedProduct: req.employee.selectedProduct,
    });
    return res.json({ data: { ok: true } });
  } catch (err) {
    return next(err);
  }
});

router.post('/product-select', requireEmployeeSession, requireEmployeeCsrf, async (req, res, next) => {
  try {
    const product = String(req.body?.product || '').toLowerCase();
    if (product !== 'pos' && product !== 'admin') {
      return res.status(400).json({ error: 'product must be pos or admin', code: 'VALIDATION_ERROR' });
    }
    if (product === 'pos') {
      if (req.employee.role === 'admin' && !req.employee.dualRolePosEnabled) {
        await writeAuditEvent({
          eventType: 'employee.product_select',
          outcome: 'denied',
          actorUserId: req.employee.id,
          actorRole: req.employee.role,
          errorCode: 'DUAL_ROLE_REQUIRED',
          metadata: { product },
        });
        return res.status(403).json({ error: 'POS product not granted', code: 'DUAL_ROLE_REQUIRED' });
      }
      if (req.employee.role === 'staff' || (req.employee.role === 'admin' && req.employee.dualRolePosEnabled)) {
        // ok
      } else {
        return res.status(403).json({ error: 'POS product not granted', code: 'POS_PRODUCT_DENIED' });
      }
    }
    if (product === 'admin' && req.employee.role !== 'admin') {
      return res.status(403).json({ error: 'Admin product not granted', code: 'ADMIN_PRODUCT_DENIED' });
    }

    const probe = { ...req.employee, selectedProduct: product };
    if (!canAccessProduct(probe, product)) {
      return res.status(403).json({ error: 'Product not allowed', code: 'PRODUCT_DENIED' });
    }

    const session = await setSelectedProduct(req.employeeSession.id, product);
    await writeAuditEvent({
      eventType: 'employee.product_select',
      outcome: 'success',
      actorUserId: req.employee.id,
      actorRole: req.employee.role,
      selectedProduct: product,
    });
    const branches = await loadBranchAccess(req.employee.id);
    return res.json({
      data: {
        employee: publicEmployee(
          {
            id: req.employee.id,
            username: req.employeeSession.username,
            email: req.employeeSession.email,
            role: req.employee.role,
            full_name: req.employeeSession.full_name,
            is_global_manager: req.employee.isGlobalManager,
            dual_role_pos_enabled: req.employee.dualRolePosEnabled,
          },
          session,
          branches,
        ),
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
