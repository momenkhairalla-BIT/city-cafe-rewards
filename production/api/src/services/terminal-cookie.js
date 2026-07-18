/**
 * Persistent HttpOnly terminal credential cookie.
 * JS never reads the secret — only the browser sends it with credentials: 'include'.
 */

const DEV_COOKIE = 'aida_terminal';
const HOST_COOKIE = '__Host-aida_terminal';

export function terminalCookieName() {
  // __Host- requires Secure + Path=/ + no Domain — only in production HTTPS deployments
  if (process.env.NODE_ENV === 'production' && process.env.TERMINAL_COOKIE_HOST_PREFIX !== '0') {
    return HOST_COOKIE;
  }
  return process.env.TERMINAL_COOKIE_NAME || DEV_COOKIE;
}

export function terminalCookieMaxAgeMs() {
  return Number(process.env.TERMINAL_COOKIE_MAX_AGE_MS || 180 * 24 * 60 * 60 * 1000); // 180 days
}

export function terminalCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd || process.env.TERMINAL_COOKIE_SECURE === '1';
  const name = terminalCookieName();
  const useHost = name.startsWith('__Host-');

  if (useHost && !secure) {
    throw new Error('__Host- terminal cookie requires Secure');
  }

  return {
    httpOnly: true,
    secure: useHost ? true : secure,
    sameSite: 'strict',
    path: '/',
    maxAge: terminalCookieMaxAgeMs(),
    // never set Domain for __Host- or for fail-closed scoping
  };
}

export function setTerminalCredentialCookie(res, credential) {
  const name = terminalCookieName();
  const opts = terminalCookieOptions();
  const parts = [
    `${name}=${encodeURIComponent(credential)}`,
    'HttpOnly',
    `Path=${opts.path}`,
    'SameSite=Strict',
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
  ];
  if (opts.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearTerminalCredentialCookie(res) {
  const name = terminalCookieName();
  const opts = terminalCookieOptions();
  const parts = [
    `${name}=`,
    'HttpOnly',
    `Path=${opts.path}`,
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (opts.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function readTerminalCredentialFromRequest(req) {
  const name = terminalCookieName();
  const header = req.headers.cookie || '';
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}
