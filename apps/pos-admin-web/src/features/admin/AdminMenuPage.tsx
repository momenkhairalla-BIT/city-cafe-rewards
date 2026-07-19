import { useState } from 'react';
import { PREVIEW_MENU, type PreviewMenuItem } from '../../preview/fixtures/catalog';
import { formatRmFromSen } from '../../shared/formatting/money';
import './admin.css';

export function AdminMenuPage() {
  const [items, setItems] = useState(PREVIEW_MENU);
  const [editing, setEditing] = useState<PreviewMenuItem | null>(null);
  const [priceSen, setPriceSen] = useState('');
  const [available, setAvailable] = useState(true);

  function openEditor(item: PreviewMenuItem) {
    setEditing(item);
    setPriceSen(String(item.priceSen));
    setAvailable(item.available);
  }

  function saveEditor() {
    if (!editing) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === editing.id
          ? { ...i, priceSen: Number(priceSen) || i.priceSen, available }
          : i,
      ),
    );
    setEditing(null);
  }

  return (
    <section className="admin-page" aria-labelledby="menu-title">
      <header className="admin-page__header">
        <h2 id="menu-title">Menu</h2>
        <p className="form-hint">Preview catalogue editor — variants contract pending.</p>
      </header>

      <table className="data-table admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Price</th>
            <th>Available</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.sku}</td>
              <td>{item.category}</td>
              <td>{formatRmFromSen(item.priceSen)}</td>
              <td>{item.available ? 'Yes' : 'No'}</td>
              <td>
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEditor(item)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <aside className="admin-drawer" aria-labelledby="menu-editor-title">
          <h3 id="menu-editor-title">Edit {editing.name}</h3>
          <label>
            Base price (sen)
            <input type="number" value={priceSen} onChange={(e) => setPriceSen(e.target.value)} />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            Available
          </label>
          <section className="admin-drawer__pending">
            <h4>Variants</h4>
            <p className="form-hint">Pending contract — size/milk modifiers not editable here.</p>
          </section>
          <div className="admin-drawer__actions">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={saveEditor}>Save (preview)</button>
          </div>
        </aside>
      )}
    </section>
  );
}
