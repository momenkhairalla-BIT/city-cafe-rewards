import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../auth/types';
import { formatKlTime } from '../shared/formatting/datetime';

interface Props {
  employee: EmployeeIdentity | null;
  location: TerminalLocation | null;
  shift: ShiftSummary | null;
  online?: boolean;
}

export function PosContextBar({ employee, location, shift, online = true }: Props) {
  const shiftStarted = shift?.openedAt ? formatKlTime(shift.openedAt) : null;

  return (
    <aside className="pos-context-bar" aria-label="POS context">
      <span className="pos-context-bar__product">
        <strong>Product</strong> Aida Counter
      </span>
      <span><strong>Employee</strong> {employee?.fullName || '—'}</span>
      <span><strong>Role</strong> {employee?.role || '—'}</span>
      <span><strong>Branch</strong> {location?.branchCode || '—'}</span>
      <span><strong>Sales Point</strong> {location?.salesPointCode || '—'}</span>
      <span><strong>Terminal</strong> {location?.terminalCode || '—'}</span>
      <span><strong>Shift</strong> {shift?.status || 'none'}</span>
      {shiftStarted && (
        <span><strong>Started</strong> {shiftStarted}</span>
      )}
      <span className="pos-context-bar__status">
        <strong>Status</strong>
        <span className={`status-pill ${online ? 'status-pill--ok' : 'status-pill--err'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </span>
    </aside>
  );
}
