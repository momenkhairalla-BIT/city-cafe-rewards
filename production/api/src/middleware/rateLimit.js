/**
 * Simple in-memory sliding-window rate limiter (per-process).
 * Suitable for Phase 2A foundation; replace with shared store later if multi-instance.
 */

const buckets = new Map();

function clientKey(req, scope) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${scope}:${ip}`;
}

/**
 * @param {{ scope: string, windowMs?: number, max?: number, code?: string }} opts
 */
export function rateLimit({ scope, windowMs = 60_000, max = 20, code = 'RATE_LIMITED' }) {
  return (req, res, next) => {
    const key = clientKey(req, scope);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - bucket.start)) / 1000)));
      return res.status(429).json({
        error: 'Too many attempts. Try again later.',
        code,
      });
    }
    return next();
  };
}

/** Test helper — clear buckets between tests. */
export function resetRateLimitBuckets() {
  buckets.clear();
}
