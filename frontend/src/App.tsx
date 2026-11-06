import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './layouts/Layout';
import { RoleGuard } from './components/common/RoleGuard';

// Pages & Dashboards
import { WelcomePage } from './modules/welcome/WelcomePage';
import { LoginPage } from './modules/auth/LoginPage';
import { LiveShopFloorDashboard } from './modules/manager/LiveShopFloorDashboard';
import { TechnicianDashboard } from './modules/technician/TechnicianDashboard';
import { OperatorDashboard } from './modules/operator/OperatorDashboard';
import { AdminDashboard } from './modules/admin/AdminDashboard';

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

/**
 * Smart Dashboard Router: Routes /dashboard to the specific home dashboard of the authenticated user
 */
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'technician':
      return <TechnicianDashboard />;
    case 'operator':
      return <OperatorDashboard />;
    case 'manager':
    default:
      return <LiveShopFloorDashboard />;
  }
};

export default function App() {
  return (
    <AuthProvider>
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
            {/* Dynamic Dashboard Home */}
            <Route path="/dashboard" element={<DashboardRouter />} />

            {/* Dedicated Role Dashboard URLs */}
            <Route
              path="/admin/dashboard"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/technician/dashboard"
              element={
                <RoleGuard allowedRoles={['technician', 'admin']}>
                  <TechnicianDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/operator/dashboard"
              element={
                <RoleGuard allowedRoles={['operator', 'admin']}>
                  <OperatorDashboard />
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

            {/* Work Order Engine (Phase 3) */}
            <Route
              path="/work-orders"
              element={
                <RoleGuard allowedRoles={['admin', 'manager', 'technician']}>
                  <WorkOrderListPage />
                </RoleGuard>
              }
            />
            <Route
              path="/work-orders/:id"
              element={
                <RoleGuard allowedRoles={['admin', 'manager', 'technician']}>
                  <WorkOrderDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="/procurement"
              element={
                <RoleGuard allowedRoles={['manager', 'admin']}>
                  <ProcurementPage />
                </RoleGuard>
              }
            />
            <Route
              path="/rdc"
              element={
                <RoleGuard allowedRoles={['manager', 'admin']}>
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

            {/* Operator Pre-Shift Safety Inspections (Phase 2) */}
            <Route
              path="/inspections/run"
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
                <RoleGuard allowedRoles={['admin', 'manager', 'technician']}>
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

            {/* Admin-Only Governance Modules */}
            <Route
              path="/users"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <UserManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="/audit"
              element={
                <RoleGuard allowedRoles={['admin', 'manager']}>
                  <AuditLogsPage />
                </RoleGuard>
              }
            />
          </Route>

          {/* Fallback to Welcome */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

