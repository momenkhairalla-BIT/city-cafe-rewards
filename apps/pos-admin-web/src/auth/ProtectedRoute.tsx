import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSyncExternalStore, useEffect, useState } from 'react';
import {
  getEmployeeSession,
  refreshEmployeeSessionFromServer,
  subscribeEmployeeSession,
} from './employeeSession';
import { canAccessProduct } from './permissions';
import { isAuthBypassAllowed, isEmployeeAuthEnforced } from './authMode';
import type { ProductScope } from './types';
import { IdleLockModal } from '../components/IdleLockModal';

interface ProtectedRouteProps {
  product: ProductScope;
  /** When true, allow anonymous access (employee welcome / enrol). */
  allowAnonymous?: boolean;
}

export function ProtectedRoute({ product, allowAnonymous = false }: ProtectedRouteProps) {
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const [ready, setReady] = useState(session.status !== 'unknown');
  const location = useLocation();

  useEffect(() => {
    void refreshEmployeeSessionFromServer().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="shell-loading" role="status">
        Checking employee session…
      </div>
    );
  }

  if (isAuthBypassAllowed()) {
    return <Outlet />;
  }

  if (allowAnonymous && (session.status === 'anonymous' || session.status === 'unknown')) {
    return <Outlet />;
  }

  if (isEmployeeAuthEnforced()) {
    if (session.status === 'locked' || session.idleLocked) {
      return (
        <>
          <IdleLockModal />
          <Outlet />
        </>
      );
    }
    if (session.status !== 'authenticated' || !session.identity) {
      return <Navigate to="/employee" replace state={{ from: location.pathname }} />;
    }
    if (!canAccessProduct(session.identity, product)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return (
    <>
      {(session.idleLocked || session.status === 'locked') && <IdleLockModal />}
      <Outlet />
    </>
  );
}
