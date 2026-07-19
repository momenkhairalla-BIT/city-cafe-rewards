import { useState } from 'react';
import { PREVIEW_SHIFT_ROWS } from '../../preview/fixtures/catalog';
import { formatRmFromSen } from '../../shared/formatting/money';
import './admin.css';

type ShiftFilter = 'all' | 'open' | 'locked' | 'closed';

export function AdminShiftsPage() {
  const [filter, setFilter] = useState<ShiftFilter>('all');
  const rows = PREVIEW_SHIFT_ROWS.filter((r) => filter === 'all' || r.status === filter);

  return (
    <section className="admin-page" aria-labelledby="shifts-title">
      <header className="admin-page__header">
        <h2 id="shifts-title">Shifts</h2>
        <div className="admin-filters">
          {(['all', 'open', 'locked', 'closed'] as ShiftFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`menu-tab ${filter === f ? 'menu-tab--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <table className="data-table admin-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Terminal</th>
            <th>Sales point</th>
            <th>Status</th>
            <th>Opened</th>
            <th>Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.staff}</td>
              <td>{row.terminal}</td>
              <td>{row.salesPoint}</td>
              <td><span className={`status-pill status-pill--${row.status === 'open' ? 'ok' : row.status === 'locked' ? 'warn' : 'info'}`}>{row.status}</span></td>
              <td>{row.openedAt}</td>
              <td>
                {row.varianceSen !== null
                  ? <span className={row.varianceSen < 0 ? 'variance-neg' : 'variance-pos'}>{formatRmFromSen(Math.abs(row.varianceSen))}</span>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
