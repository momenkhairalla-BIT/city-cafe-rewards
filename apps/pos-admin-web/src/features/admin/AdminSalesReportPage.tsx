import { PREVIEW_SALES_ROWS } from '../../preview/fixtures/catalog';
import { formatRmFromSen } from '../../shared/formatting/money';
import './admin.css';

export function AdminSalesReportPage() {
  return (
    <section className="admin-page" aria-labelledby="sales-report-title">
      <header className="admin-page__header admin-page__header--row">
        <div>
          <h2 id="sales-report-title">Sales report</h2>
          <p className="form-hint">Sample transactions — export API pending.</p>
        </div>
        <button type="button" className="btn-secondary" disabled title="API pending">
          Export CSV
        </button>
      </header>

      <div className="admin-filters">
        <label>
          From
          <input type="date" defaultValue="2026-07-19" />
        </label>
        <label>
          To
          <input type="date" defaultValue="2026-07-19" />
        </label>
        <label>
          Sales point
          <select defaultValue="all">
            <option value="all">All</option>
            <option value="main">Main Counter</option>
            <option value="snack">Snack Station</option>
          </select>
        </label>
      </div>

      <table className="data-table admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>When</th>
            <th>Staff</th>
            <th>Sales point</th>
            <th>Method</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_SALES_ROWS.map((row) => (
            <tr key={row.order}>
              <td>{row.order}</td>
              <td>{row.when}</td>
              <td>{row.staff}</td>
              <td>{row.salesPoint}</td>
              <td>{row.method}</td>
              <td>{formatRmFromSen(row.totalSen)}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
