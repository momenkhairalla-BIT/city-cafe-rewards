import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { PosLayout } from './layouts/PosLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { EmployeeWelcomePage } from './pages/EmployeeWelcomePage';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { PosShellPage } from './pages/PosShellPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { AdminOverviewPage } from './features/admin/AdminOverviewPage';
import { AdminSalesReportPage } from './features/admin/AdminSalesReportPage';
import { AdminTerminalsPage } from './features/admin/AdminTerminalsPage';
import { AdminShiftsPage } from './features/admin/AdminShiftsPage';
import { AdminMenuPage } from './features/admin/AdminMenuPage';
import { AdminEmployeesPage } from './features/admin/AdminEmployeesPage';
import { AdminCampaignsPage } from './features/admin/AdminCampaignsPage';
import { AdminIntegrationsPage } from './features/admin/AdminIntegrationsPage';
import { PreviewPlaceholderPage } from './features/admin/PreviewPlaceholderPage';

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
              <Route path="/admin" element={<AdminOverviewPage />} />
              <Route path="/admin/live" element={<PreviewPlaceholderPage module="Live Ops" />} />
              <Route path="/admin/reports/sales" element={<AdminSalesReportPage />} />
              <Route path="/admin/reports/transactions" element={<PreviewPlaceholderPage module="Transactions" />} />
              <Route path="/admin/reports/products" element={<PreviewPlaceholderPage module="Products" />} />
              <Route path="/admin/reports/members" element={<PreviewPlaceholderPage module="Members" />} />
              <Route path="/admin/operations/branches" element={<PreviewPlaceholderPage module="Branches" />} />
              <Route path="/admin/operations/terminals" element={<AdminTerminalsPage />} />
              <Route path="/admin/operations/shifts" element={<AdminShiftsPage />} />
              <Route path="/admin/operations/employees" element={<AdminEmployeesPage />} />
              <Route path="/admin/catalogue/menu" element={<AdminMenuPage />} />
              <Route path="/admin/catalogue/categories" element={<PreviewPlaceholderPage module="Categories" />} />
              <Route path="/admin/catalogue/variants" element={<PreviewPlaceholderPage module="Variants" />} />
              <Route path="/admin/rewards/loyalty" element={<PreviewPlaceholderPage module="Loyalty" />} />
              <Route path="/admin/rewards/stamps" element={<PreviewPlaceholderPage module="Stamps" />} />
              <Route path="/admin/rewards/offers" element={<PreviewPlaceholderPage module="Offers" />} />
              <Route path="/admin/rewards/campaigns" element={<AdminCampaignsPage />} />
              <Route path="/admin/system/audit" element={<PreviewPlaceholderPage module="Audit" />} />
              <Route path="/admin/system/integrations" element={<AdminIntegrationsPage />} />
              <Route path="/admin/system/settings" element={<PreviewPlaceholderPage module="Settings" />} />
            </Route>
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
