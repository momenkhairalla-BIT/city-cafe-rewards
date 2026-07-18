import { authenticateTerminalCredential, rejectFingerprintAuth } from '../services/terminals.js';
import {
  readTerminalCredentialFromRequest,
  clearTerminalCredentialCookie,
} from '../services/terminal-cookie.js';

/**
 * Resolve terminal from HttpOnly cookie (preferred).
 * Fingerprint headers alone are never sufficient.
 * JS must never supply the raw credential via JSON body.
 */
export async function requireTerminalCredential(req, res, next) {
  try {
    const fingerprintOnly = req.get('x-device-fingerprint') || req.body?.deviceFingerprint;
    // Reject body credential — secrets must not be handled by JS
    if (req.body?.terminalCredential) {
      return res.status(400).json({
        error: 'Terminal credential must be presented via HttpOnly cookie',
        code: 'TERMINAL_CREDENTIAL_BODY_FORBIDDEN',
      });
    }

    const credential = readTerminalCredentialFromRequest(req);

    if (!credential && fingerprintOnly) {
      await rejectFingerprintAuth();
      return res.status(401).json({
        error: 'Terminal credential required',
        code: 'TERMINAL_FINGERPRINT_REJECTED',
      });
    }
    if (!credential) {
      return res.status(401).json({
        error: 'Terminal not enrolled',
        code: 'TERMINAL_UNENROLLED',
      });
    }

    const auth = await authenticateTerminalCredential(credential);
    if (!auth) {
      clearTerminalCredentialCookie(res);
      return res.status(401).json({
        error: 'Terminal not authorised',
        code: 'TERMINAL_REVOKED_OR_INVALID',
      });
    }

    req.terminal = auth.terminal;
    req.terminalLocation = auth.location;
    req.terminalCredential = credential;
    return next();
  } catch (err) {
    return next(err);
  }
}
