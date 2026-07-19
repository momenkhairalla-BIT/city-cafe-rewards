import { useSyncExternalStore } from 'react';
import { getEmployeeSession, logoutEmployee, subscribeEmployeeSession } from '../../auth/employeeSession';
import { hasGlobalManagerCapability } from '../../auth/permissions';
import {
  PREVIEW_HOURLY_SALES,
  PREVIEW_OVERVIEW_KPIS,
  PREVIEW_SALES_BY_POINT,
} from '../../preview/fixtures/catalog';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import './admin.css';

export function AdminOverviewPage() {
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const identity = session.identity;
  const global = hasGlobalManagerCapability(identity);
  const maxHourly = Math.max(...PREVIEW_HOURLY_SALES);
  const maxPoint = Math.max(...PREVIEW_SALES_BY_POINT.map((p) => p.sen));

  return (
    <section className="admin-page" aria-labelledby="overview-title">
      <header className="admin-page__header">
        <h2 id="overview-title">Dashboard</h2>
        <p>
          <strong>{identity?.fullName}</strong>
          {global ? ' · Global manager' : ' · Branch-scoped'}
        </p>
      </header>

      <div className="metric-grid">
        {PREVIEW_OVERVIEW_KPIS.map((kpi) => (
          <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
        ))}
      </div>

      <div className="admin-charts">
        <article className="chart-card">
          <h3>Hourly sales (sample)</h3>
          <svg className="bar-chart" viewBox="0 0 320 120" role="img" aria-label="Hourly sales bar chart">
            {PREVIEW_HOURLY_SALES.map((val, i) => {
              const h = (val / maxHourly) * 90;
              return (
                <rect
                  key={i}
                  x={10 + i * 36}
                  y={100 - h}
                  width={24}
                  height={h}
                  fill="var(--aida-rose)"
                  rx={4}
                />
              );
            })}
          </svg>
        </article>

        <article className="chart-card">
          <h3>Main Counter vs Snack Station</h3>
          <ul className="point-compare">
            {PREVIEW_SALES_BY_POINT.map((row) => (
              <li key={row.point}>
                <span>{row.point}</span>
                <div className="point-bar">
                  <div
                    className="point-bar__fill"
                    style={{ width: `${(row.sen / maxPoint) * 100}%` }}
                  />
                </div>
                <span>{formatRmFromSen(row.sen)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="chart-card">
          <h3>Trend (sample)</h3>
          <svg className="line-chart" viewBox="0 0 320 80" role="img" aria-label="Sales trend line chart">
            <polyline
              fill="none"
              stroke="var(--aida-burgundy)"
              strokeWidth="2"
              points={PREVIEW_HOURLY_SALES.map((v, i) => `${10 + i * 36},${70 - (v / maxHourly) * 60}`).join(' ')}
            />
          </svg>
        </article>
      </div>

      <aside className="admin-alerts">
        <h3>Alerts</h3>
        <ul>
          <li><span className="status-pill status-pill--warn">Variance</span> Shift s3 closed with RM 3.50 short</li>
          <li><span className="status-pill status-pill--info">Terminal</span> MC-T03 enrolment pending</li>
        </ul>
      </aside>

      <button
        type="button"
        className="btn-secondary admin-logout"
        onClick={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
      >
        Log out
      </button>
    </section>
  );
}
