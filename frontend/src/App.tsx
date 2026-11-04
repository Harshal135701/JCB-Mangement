import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './layouts/Layout';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white text-xs font-bold tracking-widest uppercase">
        Loading JCB CMMS Platform...
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
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LiveShopFloorDashboard />} />
            <Route path="triage" element={<TriageQueuePage />} />
            <Route path="machines" element={<MachineMasterPage />} />
            <Route path="inventory" element={<InventoryCatalogPage />} />
            <Route path="procurement" element={<ProcurementPage />} />
            <Route path="rdc" element={<RDCPage />} />
            <Route path="pm" element={<PMCalendarPage />} />
            <Route path="downtime" element={<DowntimeAnalyticsPage />} />
            <Route path="audit" element={<AuditLogsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
