import { useState, type FormEvent } from 'react';
import { getEmployeeSession, reauthenticateForUnlock } from '../auth/employeeSession';

export function IdleLockModal() {
  const session = getEmployeeSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const username = session.identity?.username || '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await reauthenticateForUnlock(username, password);
      setPassword('');
    } catch {
      setError('Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="idle-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="idle-lock-title">
      <form className="idle-lock-card" onSubmit={onSubmit}>
        <h2 id="idle-lock-title">Session locked</h2>
        <p>Your shift stays open. Re-enter your password to continue.</p>
        <label htmlFor="idle-username">Employee</label>
        <input id="idle-username" value={username} readOnly aria-readonly="true" />
        <label htmlFor="idle-password">Password</label>
        <input
          id="idle-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
