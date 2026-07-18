import { describe, expect, it, vi, afterEach } from 'vitest';

describe('authMode fail-closed (Phase 1A)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('production auth bypass fails closed', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ALLOW_AUTH_BYPASS', 'true');
    const { isAuthBypassAllowed, isEmployeeAuthEnforced } = await import('./authMode');
    expect(isAuthBypassAllowed()).toBe(false);
    expect(isEmployeeAuthEnforced()).toBe(true);
  });

  it('production without bypass env still enforces auth', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ALLOW_AUTH_BYPASS', undefined);
    const { isAuthBypassAllowed, isEmployeeAuthEnforced } = await import('./authMode');
    expect(isAuthBypassAllowed()).toBe(false);
    expect(isEmployeeAuthEnforced()).toBe(true);
  });

  it('DEV bypass allowed only when VITE_ALLOW_AUTH_BYPASS=true', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_ALLOW_AUTH_BYPASS', 'true');
    const { isAuthBypassAllowed, isEmployeeAuthEnforced } = await import('./authMode');
    expect(isAuthBypassAllowed()).toBe(true);
    expect(isEmployeeAuthEnforced()).toBe(false);
  });

  it('DEV without bypass flag still enforces auth', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_ALLOW_AUTH_BYPASS', 'false');
    const { isAuthBypassAllowed, isEmployeeAuthEnforced } = await import('./authMode');
    expect(isAuthBypassAllowed()).toBe(false);
    expect(isEmployeeAuthEnforced()).toBe(true);
  });
});
