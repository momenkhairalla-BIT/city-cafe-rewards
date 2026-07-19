import { useState } from 'react';
import './admin.css';

export function AdminCampaignsPage() {
  const [title, setTitle] = useState('Summer Rose Latte');
  const [body, setBody] = useState('Try our floral seasonal special — member double stamps this week.');
  const [active, setActive] = useState(true);

  return (
    <section className="admin-page admin-page--split" aria-labelledby="campaigns-title">
      <div>
        <header className="admin-page__header">
          <h2 id="campaigns-title">Campaigns</h2>
          <p className="form-hint">Banner campaign — integration pending.</p>
        </header>

        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Banner title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Message
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          <button type="submit" className="btn-primary" disabled title="Integration pending">
            Publish (pending)
          </button>
        </form>
      </div>

      <aside className="mobile-preview" aria-label="Mobile preview">
        <div className="mobile-preview__frame">
          <div className="mobile-preview__status" />
          <div className={`mobile-preview__banner ${active ? '' : 'mobile-preview__banner--inactive'}`}>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
          <div className="mobile-preview__content" />
        </div>
      </aside>
    </section>
  );
}
