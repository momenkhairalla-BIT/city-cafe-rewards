import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEmployeeSession,
  loginWithBadge,
  loginWithPassword,
  refreshEmployeeSessionFromServer,
} from '../auth/employeeSession';
import { resolvePostLoginPath } from '../auth/permissions';
import { fetchTerminalStatus } from '../auth/terminalCredential';
import type { TerminalLocation } from '../auth/types';
import {
  PREVIEW_DEMO_ACCOUNTS,
  PREVIEW_DEMO_NOTICE,
  PREVIEW_EXPIRED_ENROLMENT_CODE,
  PREVIEW_SAMPLE_ENROLMENT_CODE,
} from '../preview/demoAccounts';
import { previewTerminalRepository } from '../preview/repositories/previewTerminalRepository';
import { isUiPreviewMode, UI_PREVIEW_LABEL } from '../preview/uiPreviewMode';
import { UiPreviewBanner } from '../shared/components/UiPreviewBanner';
import './employee/employee.css';

type Mode = 'password' | 'badge';

export function EmployeeWelcomePage() {
  const navigate = useNavigate();
  const preview = isUiPreviewMode();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState(
    preview ? PREVIEW_DEMO_ACCOUNTS.admin.username : '',
  );
  const [password, setPassword] = useState('');
  const [badgeValue, setBadgeValue] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<TerminalLocation | null>(null);
  const [needsEnrol, setNeedsEnrol] = useState(false);
  const [enrolCode, setEnrolCode] = useState(
    preview ? PREVIEW_SAMPLE_ENROLMENT_CODE : '',
  );
  const [sampleExpiresInSec, setSampleExpiresInSec] = useState(15 * 60);
  const badgeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const session = await refreshEmployeeSessionFromServer();
      if (session.status === 'authenticated' && session.identity) {
        navigate(resolvePostLoginPath(session.identity), { replace: true });
        return;
      }
      await resolveTerminal();
    })();
  }, [navigate]);

  useEffect(() => {
    if (!preview || !needsEnrol) return;
    const id = window.setInterval(() => {
      setSampleExpiresInSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [preview, needsEnrol]);

  async function resolveTerminal() {
    if (preview) {
      const status = await previewTerminalRepository.getStatus();
      if (!status.enrolled) {
        setNeedsEnrol(true);
        setLocation(null);
        return;
      }
      setLocation(status.location);
      setNeedsEnrol(false);
      return;
    }

    const status = await fetchTerminalStatus();
    if (!status.enrolled) {
      setNeedsEnrol(true);
      setLocation(null);
      return;
    }
    setLocation({
      terminalId: status.location.terminalId,
      terminalCode: status.location.terminalCode,
      branchId: status.location.branchId,
      branchCode: status.location.branchCode,
      branchName: status.location.branchName,
      salesPointId: status.location.salesPointId,
      salesPointCode: status.location.salesPointCode,
      salesPointName: status.location.salesPointName,
    });
    setNeedsEnrol(false);
  }

  async function onEnrol(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (preview) {
        if (sampleExpiresInSec <= 0 && enrolCode.trim().toUpperCase() === PREVIEW_SAMPLE_ENROLMENT_CODE) {
          setError('This enrolment code has expired. Ask a manager to issue a new code.');
          return;
        }
        const result = await previewTerminalRepository.enrol(enrolCode);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setEnrolCode('');
        setLocation(result.location);
        setNeedsEnrol(false);
        return;
      }

      const res = await fetch('/api/v1/terminals/enrol', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ enrolmentCode: enrolCode.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Enrolment failed');
        return;
      }
      if (body?.data?.terminalCredential) {
        setError('Unexpected credential exposure');
        return;
      }
      setEnrolCode('');
      const loc = body.data.location;
      setLocation({
        terminalId: loc.terminalId,
        terminalCode: loc.terminalCode,
        branchId: loc.branchId,
        branchCode: loc.branchCode,
        branchName: loc.branchName,
        salesPointId: loc.salesPointId,
        salesPointCode: loc.salesPointCode,
        salesPointName: loc.salesPointName,
      });
      setNeedsEnrol(false);
    } catch {
      setError('Enrolment failed');
    } finally {
      setBusy(false);
    }
  }

  async function afterLogin() {
    const identity = getEmployeeSession().identity;
    if (!identity) return;
    navigate(resolvePostLoginPath(identity), { replace: true });
  }

  async function onPasswordLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginWithPassword(username.trim(), password);
      setPassword('');
      await afterLogin();
    } catch {
      setError(preview ? 'Invalid demonstration credentials' : 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  async function onBadgeLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const rawBadge = badgeValue;
    setBadgeValue('');
    try {
      await loginWithBadge(rawBadge, pin);
      setPin('');
      await afterLogin();
    } catch {
      setError(preview ? 'Invalid demonstration badge/PIN' : 'Invalid credentials');
    } finally {
      setBusy(false);
      badgeRef.current?.focus();
    }
  }

  const expireLabel = `${Math.floor(sampleExpiresInSec / 60)}:${String(sampleExpiresInSec % 60).padStart(2, '0')}`;

  if (needsEnrol) {
    return (
      <div className="employee-welcome">
        <UiPreviewBanner />
        <section className="employee-panel" aria-labelledby="enrol-title">
          <p className="brand-script">Aida Cafe</p>
          <p className="employee-kicker">Terminal activation</p>
          <h1 id="enrol-title">Activate this terminal</h1>
          <p className="employee-lede">
            Enter the one-time code issued by a manager. This device cannot generate its own code.
          </p>

          {preview ? (
            <aside className="preview-demo-card" aria-label="Preview enrolment helpers">
              <p className="preview-demo-card__label">{UI_PREVIEW_LABEL}</p>
              <p>
                Sample manager-issued code:{' '}
                <code className="preview-code">{PREVIEW_SAMPLE_ENROLMENT_CODE}</code>
              </p>
              <p className="form-hint">
                Binds to <strong>Main Café</strong> · <strong>Main Counter</strong> ·{' '}
                <strong>POS-MAIN-01</strong>
              </p>
              <p className="form-hint">
                Simulated expiry countdown: <strong>{expireLabel}</strong>
                {sampleExpiresInSec <= 0 ? ' (expired — use demo controls or reset)' : ''}
              </p>
              <p className="form-hint">
                Try invalid: <code>WRONG-CODE</code> · Try expired:{' '}
                <code>{PREVIEW_EXPIRED_ENROLMENT_CODE}</code>
              </p>
              <div className="preview-demo-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    previewTerminalRepository.markSampleCodeExpired();
                    setSampleExpiresInSec(0);
                    setError('Sample code marked expired for the next attempt.');
                  }}
                >
                  Simulate expiry now
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    previewTerminalRepository.clearLocalPreview();
                    setSampleExpiresInSec(15 * 60);
                    setEnrolCode(PREVIEW_SAMPLE_ENROLMENT_CODE);
                    setError('');
                  }}
                >
                  Reset preview terminal
                </button>
              </div>
            </aside>
          ) : (
            <p className="form-hint" role="note">
              Live enrolment requires a manager-issued OTC from Team 2 API. Enable{' '}
              <code>VITE_UI_PREVIEW_MODE=true</code> for the UI prototype path.
            </p>
          )}

          <form onSubmit={onEnrol}>
            <label htmlFor="enrol-code">Enrolment code</label>
            <input
              id="enrol-code"
              name="enrolmentCode"
              autoComplete="one-time-code"
              value={enrolCode}
              onChange={(e) => setEnrolCode(e.target.value)}
              required
            />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Activating…' : 'Activate terminal'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="employee-welcome">
      <UiPreviewBanner />
      <section className="employee-panel" aria-labelledby="employee-welcome-title">
        <p className="brand-script">Aida Cafe</p>
        <p className="employee-kicker">Employee Access</p>
        <h1 id="employee-welcome-title">Sign in</h1>
        <p className="employee-lede">Staff POS and management access only. No customer rewards or menu.</p>

        {location && (
          <div className="terminal-chip" aria-live="polite">
            <span>
              <strong>Terminal</strong> {location.terminalCode}
            </span>
            <span>
              <strong>Location</strong> {location.salesPointName || location.salesPointCode} ·{' '}
              {location.branchName || location.branchCode}
            </span>
          </div>
        )}

        {preview && (
          <aside className="preview-demo-card" aria-label="Demonstration accounts">
            <p className="preview-demo-card__label">{UI_PREVIEW_LABEL}</p>
            <p className="form-hint">{PREVIEW_DEMO_NOTICE}</p>
            <ul className="preview-account-list">
              <li>
                <strong>{PREVIEW_DEMO_ACCOUNTS.admin.label}</strong> —{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.admin.username}</code> /{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.admin.password}</code>
              </li>
              <li>
                <strong>{PREVIEW_DEMO_ACCOUNTS.staff.label}</strong> —{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.staff.username}</code> /{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.staff.password}</code>
              </li>
              <li>
                <strong>{PREVIEW_DEMO_ACCOUNTS.dual.label}</strong> —{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.dual.username}</code> /{' '}
                <code>{PREVIEW_DEMO_ACCOUNTS.dual.password}</code>
              </li>
              <li>
                Badge demo: <code>PREVIEW-BADGE</code> · PIN <code>4821</code>
              </li>
            </ul>
          </aside>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Login method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'password'}
            onClick={() => setMode('password')}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'badge'}
            onClick={() => setMode('badge')}
          >
            Badge + PIN
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={onPasswordLogin} aria-label="Password login">
            <label htmlFor="emp-username">Username</label>
            <input
              id="emp-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label htmlFor="emp-password">Password</label>
            <input
              id="emp-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={onBadgeLogin} aria-label="Badge and PIN login">
            <label htmlFor="emp-badge">Badge / card (keyboard wedge)</label>
            <input
              id="emp-badge"
              ref={badgeRef}
              name="badge"
              autoComplete="off"
              value={badgeValue}
              onChange={(e) => setBadgeValue(e.target.value)}
              required
              aria-describedby="badge-hint"
            />
            <p id="badge-hint" className="form-hint">
              Badge value is cleared after submit and never shown in logs.
            </p>
            <label htmlFor="emp-pin">PIN</label>
            <input
              id="emp-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with badge'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
