import './admin.css';

export function AdminIntegrationsPage() {
  return (
    <section className="admin-page" aria-labelledby="integrations-title">
      <header className="admin-page__header">
        <h2 id="integrations-title">Integrations</h2>
      </header>

      <article className="integration-card">
        <header>
          <h3>MyInvois e-Invoice</h3>
          <span className="status-pill status-pill--warn">Pending</span>
        </header>
        <p>Pending business and API decision</p>
        <p className="form-hint">
          LHDN MyInvois integration requires business registration details and API credentials.
          No connection configured in this preview.
        </p>
        <button type="button" className="btn-secondary" disabled>
          Configure (blocked)
        </button>
      </article>
    </section>
  );
}
