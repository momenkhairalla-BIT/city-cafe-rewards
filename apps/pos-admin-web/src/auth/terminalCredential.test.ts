import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchTerminalStatus, clearTerminalEnrolment } from './terminalCredential';

describe('terminal cookie client (Phase 2B Closure)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchTerminalStatus uses credentials include and never reads document.cookie', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            enrolled: true,
            location: {
              terminalId: 't1',
              terminalCode: 'POS-MAIN-01',
              branchId: 'b1',
              branchCode: 'BR-MAIN',
              salesPointId: 's1',
              salesPointCode: 'SP-MAIN',
            },
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    let cookieReads = 0;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        cookieReads += 1;
        return cookieDesc?.get?.call(document) ?? '';
      },
      set(v: string) {
        cookieDesc?.set?.call(document, v);
      },
    });

    const status = await fetchTerminalStatus();
    expect(status.enrolled).toBe(true);
    if (status.enrolled) expect(status.location.terminalCode).toBe('POS-MAIN-01');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/terminals/status',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(cookieReads).toBe(0);
  });

  it('unenrolled when server reports false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { enrolled: false, code: 'TERMINAL_UNENROLLED' } }), {
          status: 200,
        }),
      ),
    );
    const status = await fetchTerminalStatus();
    expect(status).toEqual({ enrolled: false, code: 'TERMINAL_UNENROLLED' });
  });

  it('clearTerminalEnrolment posts with credentials include', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await clearTerminalEnrolment();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/terminals/clear-credential',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
