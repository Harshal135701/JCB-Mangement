import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './layouts/Layout';
import { LoginPage } from './modules/auth/LoginPage';
import { LiveShopFloorDashboard } from './modules/manager/LiveShopFloorDashboard';
import { TriageQueuePage } from './modules/breakdowns/TriageQueuePage';
import { InventoryCatalogPage } from './modules/inventory/InventoryCatalogPage';
import { MachineMasterPage } from './modules/machines/MachineMasterPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        Loading JCB CMMS...
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
            <Route path="analytics" element={<LiveShopFloorDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

