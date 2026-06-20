// AD SOUTHERN SMART POS — App Entry / Router
// src/App.js

import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { initAutoSync } from './utils/offlineSync';

// Lazy-loaded pages
const LoginPage       = lazy(() => import('./pages/LoginPage'));
const SuperAdminShell = lazy(() => import('./pages/superadmin/SuperAdminShell'));
const AdminShell      = lazy(() => import('./pages/admin/AdminShell'));

/* ── Route guards ─────────────────────────────────────────────────────────── */
function RequireAuth({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function FullPageSpinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: '1rem',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid var(--clr-border)',
        borderTopColor: 'var(--clr-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>
        පූරණය වෙමින්...
      </span>
    </div>
  );
}

/* ── App ──────────────────────────────────────────────────────────────────── */
export default function App() {
  useEffect(() => { initAutoSync(); }, []);
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'pos-toast',
            duration: 3500,
            style: { fontFamily: 'var(--font-body)' },
          }}
        />
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Super Admin */}
            <Route
              path="/super-admin/*"
              element={
                <RequireAuth roles={['super_admin']}>
                  <SuperAdminShell />
                </RequireAuth>
              }
            />

            {/* Admin / Manager / Cashier */}
            <Route
              path="/dashboard/*"
              element={
                <RequireAuth roles={['admin', 'manager', 'cashier']}>
                  <AdminShell />
                </RequireAuth>
              }
            />

            {/* Default */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}

function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'super_admin') return <Navigate to="/super-admin" replace />;
  return <Navigate to="/dashboard" replace />;
}
