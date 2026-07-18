export type AuthEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_ALLOW_AUTH_BYPASS?: string;
};

/**
 * Employee auth enforcement mode.
 *
 * Production builds ALWAYS fail closed (enforcement on).
 * Bypass is allowed only in Vite DEV when VITE_ALLOW_AUTH_BYPASS=true.
 * Production builds fail validation if VITE_ALLOW_AUTH_BYPASS is set (see vite.config.ts).
 */
export function isAuthBypassAllowed(env: AuthEnv = import.meta.env as AuthEnv): boolean {
  return env.DEV === true && env.VITE_ALLOW_AUTH_BYPASS === 'true';
}

/** True when protected routes must verify an employee session. */
export function isEmployeeAuthEnforced(env: AuthEnv = import.meta.env as AuthEnv): boolean {
  return !isAuthBypassAllowed(env);
}
