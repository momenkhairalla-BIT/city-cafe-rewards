import { Outlet } from 'react-router-dom';
import './layouts.css';

/**
 * Admin layout — separate product tree.
 * Must never render POS checkout controls or POS navigation.
 */
export function AdminLayout() {
  return (
    <div className="layout layout-admin" data-product="admin">
      <aside className="admin-sidebar">
        <p className="brand-script">Aida Cafe</p>
        <h1>Admin</h1>
        <p className="layout-sub">Management shell</p>
        <nav aria-label="Admin modules">
          <ul className="admin-nav-list">
            <li><span className="nav-current">Dashboard</span></li>
            <li className="admin-planned">Members (planned)</li>
            <li className="admin-planned">Menu (planned)</li>
            <li className="admin-planned">Offers (planned)</li>
            <li className="admin-planned">Analytics (planned)</li>
            <li className="admin-planned">Audit (planned)</li>
          </ul>
        </nav>
      </aside>
      <main className="layout-main admin-main">
        <Outlet />
      </main>
    </div>
  );
}
