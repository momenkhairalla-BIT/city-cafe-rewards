import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../auth/types';

interface Props {
  employee: EmployeeIdentity | null;
  location: TerminalLocation | null;
  shift: ShiftSummary | null;
}

export function PosContextBar({ employee, location, shift }: Props) {
  return (
    <aside className="pos-context-bar" aria-label="POS context">
      <span><strong>Employee</strong> {employee?.fullName || '—'}</span>
      <span><strong>Role</strong> {employee?.role || '—'}</span>
      <span><strong>Branch</strong> {location?.branchCode || '—'}</span>
      <span><strong>Sales Point</strong> {location?.salesPointCode || '—'}</span>
      <span><strong>Terminal</strong> {location?.terminalCode || '—'}</span>
      <span><strong>Shift</strong> {shift?.status || 'none'}</span>
    </aside>
  );
}
