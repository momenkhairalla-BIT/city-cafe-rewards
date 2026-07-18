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
import './employee/employee.css';

type Mode = 'password' | 'badge';

export function EmployeeWelcomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [badgeValue, setBadgeValue] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<TerminalLocation | null>(null);
  const [needsEnrol, setNeedsEnrol] = useState(false);
  const [enrolCode, setEnrolCode] = useState('');
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

  async function resolveTerminal() {
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
      // Secret is HttpOnly cookie only — never present in JSON
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
        salesPointId: loc.salesPointId,
        salesPointCode: loc.salesPointCode,
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
      setError('Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  async function onBadgeLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const rawBadge = badgeValue;
    setBadgeValue(''); // clear immediately — never retain full badge in UI
    try {
      await loginWithBadge(rawBadge, pin);
      setPin('');
      await afterLogin();
    } catch {
      setError('Invalid credentials');
    } finally {
      setBusy(false);
      badgeRef.current?.focus();
    }
  }

  if (needsEnrol) {
    return (
      <div className="employee-welcome">
        <section className="employee-panel" aria-labelledby="enrol-title">
          <p className="brand-script">Aida Cafe</p>
          <p className="employee-kicker">Terminal activation</p>
          <h1 id="enrol-title">Activate this terminal</h1>
          <p className="employee-lede">
            Enter the one-time code issued by a manager. This device cannot generate its own code.
          </p>
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
      <section className="employee-panel" aria-labelledby="employee-welcome-title">
        <p className="brand-script">Aida Cafe</p>
        <p className="employee-kicker">Employee Access</p>
        <h1 id="employee-welcome-title">Sign in</h1>
        <p className="employee-lede">Staff POS and management access only. No customer rewards or menu.</p>

        {location && (
          <div className="terminal-chip" aria-live="polite">
            <span><strong>Terminal</strong> {location.terminalCode}</span>
            <span><strong>Location</strong> {location.salesPointCode} · {location.branchCode}</span>
          </div>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Login method">
          <button type="button" role="tab" aria-selected={mode === 'password'} onClick={() => setMode('password')}>
            Password
          </button>
          <button type="button" role="tab" aria-selected={mode === 'badge'} onClick={() => setMode('badge')}>
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
            {error && <p className="form-error" role="alert">{error}</p>}
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
            <p id="badge-hint" className="form-hint">Badge value is cleared after submit and never shown in logs.</p>
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
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with badge'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
