import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeWelcomePage } from '../pages/EmployeeWelcomePage';
import { IdleLockModal } from '../components/IdleLockModal';

describe('Accessibility smoke (Phase 2B Closure)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/employee/session')) {
          return new Response(JSON.stringify({ code: 'EMPLOYEE_SESSION_REQUIRED' }), { status: 401 });
        }
        if (url.includes('/terminals/status')) {
          return new Response(
            JSON.stringify({ data: { enrolled: false, code: 'TERMINAL_UNENROLLED' } }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('terminal activation has labelled heading and alert-ready form', async () => {
    render(
      <MemoryRouter>
        <EmployeeWelcomePage />
      </MemoryRouter>,
    );
    const heading = await screen.findByRole('heading', { name: /activate this terminal/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByLabelText(/enrolment code/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /activate terminal/i });
    expect(btn).toBeInTheDocument();
  });

  it('idle-lock modal has dialog, aria-modal, and password label', () => {
    render(
      <MemoryRouter>
        <IdleLockModal />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: /session locked/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument();
  });
});
