import { describe, expect, it } from 'vitest';
import * as session from './employeeSession';
import * as terminal from './terminalCredential';

describe('React employee session safety (Phase 1A + 2B)', () => {
  it('session module exports cookie-based helpers without storage APIs in runtime', () => {
    expect(typeof session.employeeFetch).toBe('function');
    expect(typeof session.loginWithPassword).toBe('function');
    expect(typeof session.refreshEmployeeSessionFromServer).toBe('function');
    session.clearEmployeeSession();
    expect(session.getEmployeeSession().identity).toBeNull();
  });

  it('employeeFetch always uses credentials include (no terminal secret header API)', async () => {
    const calls: RequestInit[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init || {});
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    try {
      await session.employeeFetch('/api/v1/auth/employee/session');
      expect(calls[0]?.credentials).toBe('include');
      const headers = new Headers(calls[0]?.headers);
      expect(headers.has('X-Terminal-Credential')).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('terminal module exposes status probe only (no get/set secret)', () => {
    expect(typeof terminal.fetchTerminalStatus).toBe('function');
    expect(typeof terminal.clearTerminalEnrolment).toBe('function');
    expect('getTerminalCredential' in terminal).toBe(false);
    expect('setTerminalCredential' in terminal).toBe(false);
  });
});
