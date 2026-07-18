import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getEmployeeSession, selectProduct } from '../auth/employeeSession';
import './employee/employee.css';

export function RoleSelectPage() {
  const navigate = useNavigate();
  const identity = getEmployeeSession().identity;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!identity) return <Navigate to="/employee" replace />;
  if (identity.role !== 'admin' || !identity.dualRolePosEnabled) {
    return <Navigate to={identity.role === 'admin' ? '/admin' : '/pos'} replace />;
  }
  if (identity.selectedProduct) {
    return <Navigate to={identity.selectedProduct === 'pos' ? '/pos' : '/admin'} replace />;
  }

  async function choose(product: 'pos' | 'admin') {
    setBusy(true);
    setError('');
    try {
      await selectProduct(product);
      navigate(product === 'pos' ? '/pos' : '/admin', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Selection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="employee-welcome">
      <section className="employee-panel" aria-labelledby="role-select-title">
        <p className="brand-script">Aida Cafe</p>
        <p className="employee-kicker">Dual-role access</p>
        <h1 id="role-select-title">Choose workspace</h1>
        <p className="employee-lede">
          Select POS or Admin. This choice is recorded in the audit log.
        </p>
        <div className="role-select-grid">
          <button type="button" disabled={busy} onClick={() => void choose('pos')}>
            Staff POS
          </button>
          <button type="button" disabled={busy} onClick={() => void choose('admin')}>
            Admin Dashboard
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
