import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Layout } from './layouts/Layout';
import { RoleGuard } from './components/common/RoleGuard';
import { resolveNotificationRoute } from './utils/notificationRouteResolver';

// Pages & Dashboards
import { WelcomePage } from './modules/welcome/WelcomePage';
import { LoginPage } from './modules/auth/LoginPage';
import { LiveShopFloorDashboard } from './modules/manager/LiveShopFloorDashboard';
import { TechnicianDashboard } from './modules/technician/TechnicianDashboard';
import { OperatorDashboard } from './modules/operator/OperatorDashboard';
import { AdminDashboard } from './modules/admin/AdminDashboard';
import { StoreManagerDashboard } from './modules/store/StoreManagerDashboard';

// Module Pages
import { TriageQueuePage } from './modules/breakdowns/TriageQueuePage';
import { InventoryCatalogPage } from './modules/inventory/InventoryCatalogPage';
import { MachineMasterPage } from './modules/machines/MachineMasterPage';
import { ProcurementPage } from './modules/procurement/ProcurementPage';
import { RDCPage } from './modules/rdc/RDCPage';
import { PMCalendarPage } from './modules/pm/PMCalendarPage';
import { DowntimeAnalyticsPage } from './modules/downtime/DowntimeAnalyticsPage';
import { AuditLogsPage } from './modules/audit/AuditLogsPage';
import { UserManagementPage } from './modules/users/UserManagementPage';
import { PreShiftInspectionPage } from './modules/inspections/PreShiftInspectionPage';
import { WorkOrderListPage } from './modules/work-orders/WorkOrderListPage';
import { WorkOrderDetailPage } from './modules/work-orders/WorkOrderDetailPage';

function BreakdownRedirectRoute() {
  const { user } = useAuth();
  const { id } = useParams<{ id?: string }>();
  const target = resolveNotificationRoute(
    { link_url: id ? `/breakdowns/${id}` : '/breakdowns' },
    user?.role
  );
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Welcome Page */}
            <Route path="/" element={<WelcomePage />} />

            {/* Public Login Page */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Enterprise CMMS Layout Shell */}
            <Route
              element={
                <RoleGuard>
                  <Layout />
                </RoleGuard>
              }
            >
              {/* Role-Specific Dashboard Routes */}
              {/* Manager & Admin Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin']}>
                    <LiveShopFloorDashboard />
                  </RoleGuard>
                }
              />

              {/* Admin-Only Enterprise Dashboard */}
              <Route
                path="/admin/dashboard"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminDashboard />
                  </RoleGuard>
                }
              />

              {/* Technician Operational Dashboard */}
              <Route
                path="/technician/dashboard"
                element={
                  <RoleGuard allowedRoles={['technician', 'admin']}>
                    <TechnicianDashboard />
                  </RoleGuard>
                }
              />

              {/* Operator Shop Floor Dashboard */}
              <Route
                path="/operator/dashboard"
                element={
                  <RoleGuard allowedRoles={['operator', 'admin']}>
                    <OperatorDashboard />
                  </RoleGuard>
                }
              />

              {/* Store Manager Dashboard */}
              <Route
                path="/store/dashboard"
                element={
                  <RoleGuard allowedRoles={['store_manager', 'admin']}>
                    <StoreManagerDashboard />
                  </RoleGuard>
                }
              />

              {/* Manager & Admin Modules */}
              <Route
                path="/triage"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin']}>
                    <TriageQueuePage />
                  </RoleGuard>
                }
              />

              {/* Breakdown Redirect Routes (Role-aware mapping for direct links and legacy URLs) */}
              <Route path="/breakdowns" element={<BreakdownRedirectRoute />} />
              <Route path="/breakdowns/:id" element={<BreakdownRedirectRoute />} />

              {/* Work Order Engine */}
              <Route
                path="/work-orders"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician', 'store_manager']}>
                    <WorkOrderListPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/work-orders/:id"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician', 'store_manager']}>
                    <WorkOrderDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/procurement"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin', 'technician', 'store_manager']}>
                    <ProcurementPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/procurement/pr/:id"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin', 'technician', 'store_manager']}>
                    <ProcurementPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/rdc"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin', 'technician', 'store_manager']}>
                    <RDCPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/downtime"
                element={
                  <RoleGuard allowedRoles={['manager', 'admin']}>
                    <DowntimeAnalyticsPage />
                  </RoleGuard>
                }
              />

              {/* Operator Pre-Shift Safety Inspections & Audit Logs */}
              <Route
                path="/inspections"
                element={
                  <RoleGuard allowedRoles={['operator', 'manager', 'admin', 'technician']}>
                    <PreShiftInspectionPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/inspections/run"
                element={
                  <RoleGuard allowedRoles={['operator', 'manager', 'admin', 'technician']}>
                    <PreShiftInspectionPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/inspections/records/:id"
                element={
                  <RoleGuard allowedRoles={['operator', 'manager', 'admin', 'technician']}>
                    <PreShiftInspectionPage />
                  </RoleGuard>
                }
              />

              {/* Shared Operational Modules */}
              <Route
                path="/machines"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician', 'operator']}>
                    <MachineMasterPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/inventory"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician', 'store_manager']}>
                    <InventoryCatalogPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/pm"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician']}>
                    <PMCalendarPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/pm/plans"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'technician']}>
                    <PMCalendarPage />
                  </RoleGuard>
                }
              />

              {/* Personnel & Governance Modules */}
              <Route
                path="/users"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager']}>
                    <UserManagementPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/audit"
                element={
                  <RoleGuard allowedRoles={['admin', 'manager', 'store_manager']}>
                    <AuditLogsPage />
                  </RoleGuard>
                }
              />
            </Route>

            {/* Fallback to Welcome */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
