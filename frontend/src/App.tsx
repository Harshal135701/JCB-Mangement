import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './layouts/Layout';
import { WelcomePage } from './modules/welcome/WelcomePage';
import { LoginPage } from './modules/auth/LoginPage';
import { LiveShopFloorDashboard } from './modules/manager/LiveShopFloorDashboard';
import { TriageQueuePage } from './modules/breakdowns/TriageQueuePage';
import { InventoryCatalogPage } from './modules/inventory/InventoryCatalogPage';
import { MachineMasterPage } from './modules/machines/MachineMasterPage';
import { ProcurementPage } from './modules/procurement/ProcurementPage';
import { RDCPage } from './modules/rdc/RDCPage';
import { PMCalendarPage } from './modules/pm/PMCalendarPage';
import { DowntimeAnalyticsPage } from './modules/downtime/DowntimeAnalyticsPage';
import { AuditLogsPage } from './modules/audit/AuditLogsPage';
import { UserManagementPage } from './modules/users/UserManagementPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 text-xs font-bold tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-jcb-yellow text-black font-black text-2xl px-4 py-1.5 rounded shadow tracking-widest border border-jcb-yellowDark">
            JCB
          </div>
          <span className="text-zinc-600 font-bold">Initializing CMMS Platform...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
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

          {/* Protected Enterprise CMMS Portal */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<LiveShopFloorDashboard />} />
            <Route path="/triage" element={<TriageQueuePage />} />
            <Route path="/machines" element={<MachineMasterPage />} />
            <Route path="/inventory" element={<InventoryCatalogPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
            <Route path="/rdc" element={<RDCPage />} />
            <Route path="/pm" element={<PMCalendarPage />} />
            <Route path="/downtime" element={<DowntimeAnalyticsPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/users" element={<UserManagementPage />} />
          </Route>

          {/* Fallback to Welcome */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
