import { Outlet } from 'react-router-dom';
import './layouts.css';

/**
 * Staff POS layout — separate product tree.
 * Must never render Admin navigation or Admin management chrome.
 */
export function PosLayout() {
  return (
    <div className="layout layout-pos" data-product="pos">
      <main className="layout-main-flush">
        <Outlet />
      </main>
    </div>
  );
}
