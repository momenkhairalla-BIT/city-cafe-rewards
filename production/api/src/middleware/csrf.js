/**
 * Origin / Referer CSRF protection for cookie-authenticated mutating requests.
 * Safe methods (GET/HEAD/OPTIONS) are skipped.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins() {
  const list = [];
  if (process.env.CORS_ORIGIN) {
    list.push(...process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean));
  }
  if (process.env.CSRF_ALLOWED_ORIGINS) {
    list.push(...process.env.CSRF_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
  }
  // Local defaults for development
  list.push('http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:5173', 'http://127.0.0.1:5173');
  return new Set(list);
}

function originFromRequest(req) {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function requireEmployeeCsrf(req, res, next) {
  if (SAFE.has(req.method)) return next();
  // Allow test bypass only when explicitly enabled (never production)
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_CSRF_BYPASS === '1') {
    return next();
  }

  const origin = originFromRequest(req);
  if (!origin) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_ORIGIN_REQUIRED',
    });
  }
  if (!allowedOrigins().has(origin)) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_ORIGIN_REJECTED',
    });
  }
  return next();
}
