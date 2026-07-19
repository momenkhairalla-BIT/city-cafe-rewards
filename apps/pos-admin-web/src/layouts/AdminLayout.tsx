import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { getEmployeeSession, subscribeEmployeeSession } from '../auth/employeeSession';
import { UiPreviewBanner } from '../shared/components/UiPreviewBanner';
import { ADMIN_NAV } from '../features/admin/adminNav';
import './layouts.css';

/**
 * Admin layout — separate product tree.
 * Must never render POS checkout controls or POS navigation.
 */
export function AdminLayout() {
  const location = useLocation();
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);

  return (
    <div className="layout layout-admin" data-product="admin">
      <UiPreviewBanner />
      <aside className="admin-sidebar">
        <p className="brand-script">Aida Cafe</p>
        <h1>Aida Office</h1>
        <p className="layout-sub">{session.identity?.fullName ?? 'Admin'}</p>
        <nav aria-label="Admin modules">
          {ADMIN_NAV.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <p className="admin-nav-group__title">{group.title}</p>
              <ul className="admin-nav-list">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        isActive || (item.path === '/admin' && location.pathname === '/admin')
                          ? 'admin-nav-link admin-nav-link--active'
                          : 'admin-nav-link'
                      }
                      end={item.path === '/admin'}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main className="layout-main admin-main">
        <Outlet />
      </main>
    </div>
  );
}
