import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import authRoutes from '../auth.js';
import menuRoutes from '../menu.js';
import studentsRoutes from '../students.js';
import membersRoutes from '../members.js';
import scanRoutes from '../scan.js';
import offersRoutes from '../offers.js';
import ordersRoutes from '../orders.js';
import analyticsRoutes from '../analytics.js';
import employeeAuthRoutes from './employee-auth.js';
import terminalsRoutes from './terminals.js';
import shiftsRoutes from './shifts.js';
import posSalesRoutes from './pos-sales.js';
import { APP_VERSION, healthMeta } from '../../version.js';

/**
 * /api/v1 foundation — reuses existing handlers where safe.
 * Legacy /api routes remain mounted separately and unchanged.
 */
const v1 = Router();

function sendV1Catalog(_req, res) {
  const meta = healthMeta();
  res.json({
    api: 'aida-cafe',
    version: 'v1',
    appVersion: meta.appVersion || APP_VERSION,
    status: 'ok',
    auth: {
      customer: 'Bearer JWT via POST /api/v1/auth/login',
      employee: 'HttpOnly cookie via POST /api/v1/auth/employee/login',
      terminal: 'HttpOnly cookie via POST /api/v1/terminals/enrol (hash stored server-side)',
    },
    endpoints: {
      implemented: [
        'GET /api/v1',
        'POST /api/v1/auth/login (customers only — employees rejected)',
        'POST /api/v1/auth/register',
        'GET /api/v1/auth/me',
        'POST /api/v1/auth/employee/login',
        'POST /api/v1/auth/employee/login/badge',
        'POST /api/v1/auth/employee/legacy-login (deprecated; ENABLE_LEGACY_EMPLOYEE_LOGIN=1; remove Phase 5)',
        'GET /api/v1/auth/employee/session',
        'POST /api/v1/auth/employee/logout',
        'POST /api/v1/auth/employee/product-select',
        'GET /api/v1/terminals',
        'POST /api/v1/terminals/:id/enrolment-codes',
        'POST /api/v1/terminals/enrol',
        'GET /api/v1/terminals/status',
        'GET /api/v1/terminals/current',
        'POST /api/v1/terminals/clear-credential',
        'POST /api/v1/terminals/heartbeat',
        'POST /api/v1/terminals/:id/revoke',
        'POST /api/v1/shifts/open',
        'GET /api/v1/shifts/current',
        'POST /api/v1/shifts/:id/lock|resume|close',
        'GET /api/v1/shifts/:id/summary',
        'POST /api/v1/pos/sales (ENABLE_POS_SALES=1; employee cookie + terminal + open shift)',
        'GET /api/v1/menu',
        'POST|PUT|PATCH /api/v1/menu (admin)',
        'GET /api/v1/members',
        'GET|POST|PUT|PATCH /api/v1/members…',
        'GET /api/v1/students…',
        'GET /api/v1/scan/:code (staff|admin)',
        'GET|POST|PUT|PATCH /api/v1/offers…',
        'POST /api/v1/orders/sales|redeem',
        'GET /api/v1/orders/sales|transactions',
        'GET /api/v1/analytics/overview (admin)',
      ],
      planned_not_implemented: [
        'GET /api/v1/audit-logs (manager read API)',
        'POST /api/v1/orders/void|refund (approval workflow)',
        'React POS cart/checkout UI',
        'Payment gateway settlement / terminal SDK',
      ],
      note: 'POS sales require ENABLE_POS_SALES=1 (temp/demo only until Team 1 contract review). Employee cookie + CSRF + terminal cookie + open shift.',
    },
  });
}

v1.get('/', sendV1Catalog);
export { sendV1Catalog };

// Public + employee auth (cookie) — before Bearer-secured router
v1.use('/auth/employee', employeeAuthRoutes);
v1.use('/auth', authRoutes);

// Terminal enrol (public OTC exchange) + secured terminal/shift routes
v1.use('/terminals', terminalsRoutes);
v1.use('/shifts', shiftsRoutes);
// Employee POS sales (cookie) — not Bearer; feature-flagged
v1.use('/pos', posSalesRoutes);

// Authenticated surface — same handlers as legacy /api/* (Bearer JWT)
const secured = Router();
secured.use(requireAuth);

secured.use('/menu', menuRoutes);
secured.use('/students', studentsRoutes);
secured.use('/members', membersRoutes);
secured.use('/scan', requireRole('staff', 'admin'), scanRoutes);
secured.use('/offers', offersRoutes);
secured.use('/orders', ordersRoutes);
secured.use('/analytics', requireRole('admin'), analyticsRoutes);

v1.use(secured);

export default v1;
