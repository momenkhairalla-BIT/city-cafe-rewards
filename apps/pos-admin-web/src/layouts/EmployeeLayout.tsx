import { Outlet } from 'react-router-dom';
import './layouts.css';

/** Minimal chrome for employee welcome / role select — no POS or Admin nav. */
export function EmployeeLayout() {
  return (
    <div className="layout layout-employee" data-product="employee">
      <Outlet />
    </div>
  );
}
