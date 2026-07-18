import { useSyncExternalStore } from 'react';
import { getEmployeeSession, logoutEmployee, subscribeEmployeeSession } from '../auth/employeeSession';
import { hasGlobalManagerCapability } from '../auth/permissions';
import './employee/employee.css';

const PLANNED = [
  'Members & loyalty management',
  'Menu editor',
  'Offers & promotions',
  'Sales analytics',
  'Terminal registry management',
  'Audit log viewer',
];

export function AdminShellPage() {
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const identity = session.identity;
  const global = hasGlobalManagerCapability(identity);

  return (
    <section className="shell-card" aria-labelledby="admin-shell-title">
      <h2 id="admin-shell-title">Management shell</h2>
      <p>
        <strong>{identity?.fullName}</strong> · {identity?.role}
        {global ? ' · Global manager' : ' · Branch-scoped'}
      </p>
      <p>Admin does not require a POS location or open shift.</p>
      <p className="form-hint">POS controls are never shown in Admin.</p>

      <h3>Modules</h3>
      <ul>
        {PLANNED.map((name) => (
          <li key={name} className="admin-planned">{name} — planned, not operational</li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
      >
        Log out
      </button>
    </section>
  );
}
