// AD SOUTHERN SMART POS — Admin Shell (Module 2)
// src/pages/admin/AdminShell.js

import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PinModal from '../../components/shared/PinModal';
import AdminDashboard from './AdminDashboard';
import Inventory      from './Inventory';
import BillingPOS     from './BillingPOS';
import StaffManage    from './StaffManage';
import ChequeManager  from './ChequeManager';
import AdminSettings  from './AdminSettings';
import AdminAuditLogs from './AdminAuditLogs';
import toast from 'react-hot-toast';

const buildTabs = (role) => {
  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard',    path: '',         roles: ['admin','manager','cashier'], pinRequired: false },
    { id: 'billing',   label: '🧾 Billing / POS', path: 'billing',  roles: ['admin','manager','cashier'], pinRequired: false },
    { id: 'inventory', label: '📦 Inventory',     path: 'inventory',roles: ['admin','manager'],           pinRequired: false },
    { id: 'staff',     label: '👥 Staff',          path: 'staff',    roles: ['admin'],                    pinRequired: true  },
    { id: 'cheques',   label: '💳 Cheques',        path: 'cheques',  roles: ['admin','manager'],           pinRequired: true  },
    { id: 'audit',     label: '📋 Audit Logs',     path: 'audit',    roles: ['admin'],                    pinRequired: true  },
    { id: 'settings',  label: '⚙️ Settings',       path: 'settings', roles: ['admin'],                    pinRequired: true  },
  ];
  return tabs.filter(t => t.roles.includes(role));
};

export default function AdminShell() {
  const { user, logout, isGhost, exitGhost } = useAuth();
  const navigate = useNavigate();
  const tabs = buildTabs(user?.role || 'cashier');

  const [pinModal, setPinModal]       = useState({ open: false, targetTab: null });
  const [unlockedTabs, setUnlockedTabs] = useState(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPath = window.location.hash.replace('#/dashboard', '').replace(/^\//, '');

  const handleTabClick = useCallback((tab) => {
    setMobileMenuOpen(false);
    if (tab.pinRequired && !unlockedTabs.has(tab.id)) {
      setPinModal({ open: true, targetTab: tab });
    } else {
      navigate(`/dashboard/${tab.path}`);
    }
  }, [unlockedTabs, navigate]);

  const handlePinSuccess = useCallback(() => {
    const tab = pinModal.targetTab;
    setUnlockedTabs(prev => new Set([...prev, tab.id]));
    setPinModal({ open: false, targetTab: null });
    navigate(`/dashboard/${tab.path}`);
    toast.success(`${tab.label} ගේට්ටුව විවෘතයි`);
  }, [pinModal, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleExitGhost = () => {
    const saToken = sessionStorage.getItem('sa_token_backup');
    const saUser  = JSON.parse(sessionStorage.getItem('sa_user_backup') || '{}');
    if (saToken) { exitGhost(saToken, saUser); navigate('/super-admin'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Ghost banner */}
      {isGhost && (
        <div className="ghost-banner">
          <span>👻</span>
          <span>Ghost Mode — Super Admin ඔබේ Panel වෙත ඇතුළු ව ඇත</span>
          <button
            className="btn btn-sm"
            style={{ marginLeft: 'auto', background: 'rgba(139,92,246,0.2)', color: 'var(--clr-ghost)', border: '1px solid rgba(139,92,246,0.4)' }}
            onClick={handleExitGhost}
          >
            ← Super Admin වෙත ආපසු
          </button>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMini}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6"/>
              <path d="M8 10h16M8 16h10M8 22h13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="3" fill="#f59e0b"/>
            </svg>
          </div>
          <div>
            <div style={styles.headerTitle}>AD SOUTHERN SMART POS</div>
            {user?.shop?.name && (
              <div style={styles.headerSub}>{user.shop.name}</div>
            )}
          </div>
        </div>
        <div style={styles.headerRight}>
          <div className="live-dot" title="Online" />
          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
            {user?.displayName}
          </span>
          <span className={`badge ${
            user?.role === 'admin' ? 'badge-blue' :
            user?.role === 'manager' ? 'badge-amber' : 'badge-green'
          }`}>
            {user?.role?.toUpperCase()}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav style={styles.nav}>
        {tabs.map(tab => {
          const active = currentPath === tab.path || (tab.path === '' && currentPath === '');
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              style={{ ...styles.navTab, ...(active ? styles.navTabActive : {}) }}
            >
              {tab.label}
              {tab.pinRequired && !unlockedTabs.has(tab.id) && (
                <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 4 }}>🔒</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="billing"   element={<BillingPOS />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="staff"     element={<StaffManage />} />
          <Route path="cheques"   element={<ChequeManager />} />
          <Route path="audit"     element={<AdminAuditLogs />} />
          <Route path="settings"  element={<AdminSettings />} />
          <Route path="*"         element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <PinModal
        open={pinModal.open}
        label={pinModal.targetTab?.label || ''}
        onSuccess={handlePinSuccess}
        onClose={() => setPinModal({ open: false, targetTab: null })}
      />
    </div>
  );
}

const styles = {
  header: {
    background: 'var(--clr-surface)',
    borderBottom: '1px solid var(--clr-border)',
    padding: '0.75rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  logoMini:    { display: 'flex', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.06em' },
  headerSub:   { fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: 'var(--clr-primary)', letterSpacing: '0.1em', fontWeight: 500 },
  nav: {
    background: 'var(--clr-surface)',
    borderBottom: '1px solid var(--clr-border)',
    display: 'flex',
    padding: '0 1.5rem',
    gap: '0.25rem',
    overflowX: 'auto',
  },
  navTab: {
    padding: '0.65rem 1rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--clr-text-muted)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.18s',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  },
  navTabActive: {
    color: 'var(--clr-primary)',
    borderBottomColor: 'var(--clr-primary)',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    padding: '1.5rem',
    maxWidth: 1400,
    width: '100%',
    margin: '0 auto',
  },
};
