import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSyncExternalStore } from 'react';
import {
  employeeFetch,
  getEmployeeSession,
  logoutEmployee,
  subscribeEmployeeSession,
} from '../auth/employeeSession';
import type { ShiftSummary, TerminalLocation } from '../auth/types';
import { PosContextBar } from '../components/PosContextBar';
import { previewShiftRepository } from '../preview/repositories/previewShiftRepository';
import { previewTerminalRepository } from '../preview/repositories/previewTerminalRepository';
import { isUiPreviewMode } from '../preview/uiPreviewMode';
import { UiPreviewBanner } from '../shared/components/UiPreviewBanner';
import { CounterWorkspace } from '../features/pos/CounterWorkspace';
import './employee/employee.css';

type Phase = 'loading' | 'need-location' | 'need-shift' | 'ready' | 'closing' | 'closed';

export function PosShellPage() {
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const [phase, setPhase] = useState<Phase>('loading');
  const [location, setLocation] = useState<TerminalLocation | null>(null);
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [openingFloat, setOpeningFloat] = useState('100');
  const [expectedCash, setExpectedCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const loadContext = useCallback(async () => {
    setError('');
    setPhase('loading');

    if (isUiPreviewMode()) {
      const status = await previewTerminalRepository.getStatus();
      if (!status.enrolled) {
        setError('Terminal not registered — activate from Employee Access (preview).');
        setPhase('need-location');
        return;
      }
      const loc = status.location;
      const assigned = session.identity?.assignedBranchIds || [];
      if (assigned.length && !assigned.includes(loc.branchId) && session.identity?.role === 'staff') {
        setError('Unauthorised location for this employee');
        setLocation(null);
        setPhase('need-location');
        return;
      }
      setLocation(loc);
      const s = previewShiftRepository.getCurrent();
      if (s) {
        setShift(s);
        setPhase(s.status === 'closed' ? 'closed' : 'ready');
      } else {
        setShift(null);
        setPhase('need-shift');
      }
      return;
    }

    const termRes = await employeeFetch('/api/v1/terminals/current');
    if (!termRes.ok) {
      setError('Terminal not registered or credential missing');
      setPhase('need-location');
      return;
    }
    const termBody = await termRes.json();
    const loc = termBody.data.location as TerminalLocation;
    const assigned = session.identity?.assignedBranchIds || [];
    if (assigned.length && !assigned.includes(loc.branchId) && session.identity?.role === 'staff') {
      setError('Unauthorised location for this employee');
      setLocation(null);
      setPhase('need-location');
      return;
    }
    setLocation(loc);

    const shiftRes = await employeeFetch('/api/v1/shifts/current');
    const shiftBody = await shiftRes.json().catch(() => ({}));
    if (shiftRes.ok && shiftBody.data?.shift) {
      const s = shiftBody.data.shift as ShiftSummary;
      setShift(s);
      setPhase(s.status === 'closed' ? 'closed' : 'ready');
    } else {
      setShift(null);
      setPhase('need-shift');
    }
  }, [session.identity?.assignedBranchIds, session.identity?.role]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  async function openShift(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isUiPreviewMode()) {
        if (!location || !session.identity) {
          setError('Preview terminal or employee missing');
          return;
        }
        const s = previewShiftRepository.open(
          location,
          session.identity.id,
          Number(openingFloat) || 0,
        );
        setShift(s);
        setPhase('ready');
        return;
      }

      const res = await employeeFetch('/api/v1/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat: Number(openingFloat) || 0 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.code === 'SHIFT_ALREADY_ACTIVE'
          ? 'An active shift already exists for this terminal or employee'
          : (body.error || 'Could not open shift'));
        return;
      }
      setShift(body.data.shift);
      setPhase('ready');
    } finally {
      setBusy(false);
    }
  }

  async function lockShift() {
    if (!shift) return;
    setBusy(true);
    try {
      if (isUiPreviewMode()) {
        setShift(previewShiftRepository.lock());
        return;
      }
      const res = await employeeFetch(`/api/v1/shifts/${shift.id}/lock`, {
        method: 'POST',
        body: '{}',
      });
      const body = await res.json();
      if (res.ok) setShift(body.data.shift);
    } finally {
      setBusy(false);
    }
  }

  async function resumeShift() {
    if (!shift) return;
    setBusy(true);
    try {
      if (isUiPreviewMode()) {
        setShift(previewShiftRepository.resume());
        return;
      }
      const res = await employeeFetch(`/api/v1/shifts/${shift.id}/resume`, {
        method: 'POST',
        body: '{}',
      });
      const body = await res.json();
      if (res.ok) setShift(body.data.shift);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;
    if (!confirmClose) {
      setConfirmClose(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (isUiPreviewMode()) {
        const closed = previewShiftRepository.close(
          Number(expectedCash),
          Number(actualCash),
          notes || undefined,
          handoverNotes || undefined,
        );
        setShift(closed);
        setPhase('closed');
        setConfirmClose(false);
        return;
      }
      const res = await employeeFetch(`/api/v1/shifts/${shift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          expectedCash: Number(expectedCash),
          actualCash: Number(actualCash),
          notes: notes || null,
          handoverNotes: handoverNotes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Close failed');
        return;
      }
      setShift(body.data.shift);
      setPhase('closed');
      setConfirmClose(false);
    } finally {
      setBusy(false);
    }
  }

  const identity = session.identity;

  return (
    <div className="pos-shell">
      <UiPreviewBanner />
      <PosContextBar employee={identity} location={location} shift={shift} online />
      {identity && location && shift && phase === 'ready' && shift.status === 'open' ? (
        <CounterWorkspace
          employee={identity}
          location={location}
          shift={shift}
          onLock={() => void lockShift()}
          onCloseRequest={() => setPhase('closing')}
          onLogout={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
          busy={busy}
        />
      ) : (
        <div className="layout-main">
          <div className="shift-panel">
            <h2>Aida Counter</h2>

            {error && <p className="form-error" role="alert">{error}</p>}

            {phase === 'loading' && <p role="status">Loading terminal and shift…</p>}

            {phase === 'need-location' && (
              <p role="alert">Register this terminal from Employee Access before using POS.</p>
            )}

            {phase === 'need-shift' && (
              <form onSubmit={openShift}>
                <h3>Open shift</h3>
                <p className="form-hint">
                  Location is locked to {location?.salesPointCode} at {location?.branchCode}.
                </p>
                <label htmlFor="opening-float">Opening float (RM)</label>
                <input
                  id="opening-float"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary" disabled={busy}>
                  Open shift
                </button>
              </form>
            )}

            {phase === 'ready' && shift && shift.status === 'locked' && (
              <div>
                <h3>Shift locked</h3>
                <p>Opening float: RM {shift.openingFloat.toFixed(2)}</p>
                <button type="button" className="btn-primary" onClick={() => void resumeShift()} disabled={busy}>
                  Resume shift
                </button>
              </div>
            )}

            {phase === 'closing' && shift && (
              <form onSubmit={closeShift}>
                <h3>Close shift</h3>
                <label htmlFor="expected-cash">Expected cash</label>
                <input id="expected-cash" type="number" step="0.01" value={expectedCash} onChange={(e) => setExpectedCash(e.target.value)} required />
                <label htmlFor="actual-cash">Actual cash</label>
                <input id="actual-cash" type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} required />
                {expectedCash !== '' && actualCash !== '' && (
                  <p>Variance: RM {(Number(actualCash) - Number(expectedCash)).toFixed(2)}</p>
                )}
                <label htmlFor="close-notes">Notes</label>
                <input id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <label htmlFor="handover-notes">Handover notes</label>
                <input id="handover-notes" value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} />
                <button type="submit" className="btn-primary" disabled={busy}>
                  {confirmClose ? 'Confirm close shift' : 'Review & close'}
                </button>
                {confirmClose && (
                  <button type="button" className="btn-secondary" onClick={() => setConfirmClose(false)}>
                    Back
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setPhase('ready')}>
                  Cancel
                </button>
              </form>
            )}

            {phase === 'closed' && shift && (
              <div>
                <h3>Shift closed</h3>
                <p>Expected: RM {Number(shift.closingExpectedCash).toFixed(2)}</p>
                <p>Actual: RM {Number(shift.closingActualCash).toFixed(2)}</p>
                <p>Variance: RM {Number(shift.cashVariance).toFixed(2)}</p>
                <button type="button" className="btn-primary" onClick={() => void loadContext()}>
                  Start next shift
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
