import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { PosLayout } from './layouts/PosLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { EmployeeWelcomePage } from './pages/EmployeeWelcomePage';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { PosShellPage } from './pages/PosShellPage';
import { AdminShellPage } from './pages/AdminShellPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/employee" replace />} />

          <Route element={<ProtectedRoute product="employee" allowAnonymous />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee" element={<EmployeeWelcomePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="employee" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/select-role" element={<RoleSelectPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="pos" />}>
            <Route element={<PosLayout />}>
              <Route path="/pos" element={<PosShellPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminShellPage />} />
            </Route>
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
