import { Outlet } from 'react-router-dom';
import './layouts.css';

/**
 * Staff POS layout — separate product tree.
 * Must never render Admin navigation or Admin management chrome.
 */
export function PosLayout() {
  return (
    <div className="layout layout-pos" data-product="pos">
      <header className="layout-header">
        <p className="brand-script">Aida Cafe</p>
        <h1>Staff POS</h1>
        <p className="layout-sub">Shift-gated workspace — checkout arrives in a later phase</p>
      </header>
      <main className="layout-main-flush">
        <Outlet />
      </main>
    </div>
  );
}
