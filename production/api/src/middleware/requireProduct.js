import { canAccessProduct } from '../authz/permissions.js';

/**
 * Express middleware: require authenticated user + product scope.
 * Does not activate shift/terminal workflows (Phase 2+).
 */
export function requireProduct(product) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }
    if (!canAccessProduct(req.user, product)) {
      return res.status(403).json({
        error: 'Insufficient permissions for this product',
        code: 'PRODUCT_FORBIDDEN',
        product,
      });
    }
    next();
  };
}
