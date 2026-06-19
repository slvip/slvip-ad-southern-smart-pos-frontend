// AD SOUTHERN SMART POS — Super Admin Shell
// src/pages/superadmin/SuperAdminShell.js

import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PinModal from '../../components/shared/PinModal';
import SADashboard  from './SADashboard';
import SAShops      from './SAShops';
import SAUsers      from './SAUsers';
import SAAuditLogs  from './SAAuditLogs';
import SAGhostPortal from './SAGhostPortal';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'dashboard',    label: '📊 Dashboard',      path: '',            pinRequired: false },
  { id: 'shops',        label: '🏪 Shops',           path: 'shops',       pinRequired: false },
  { id: 'users',        label: '👥 Users',           path: 'users',       pinRequired: false },
  { id: 'audit',        label: '📋 Audit Logs',      path: 'audit',       pinRequired: false },
  { id: 'ghost',        label: '👻 Ghost Portal',    path: 'ghost',       pinRequired: true  },
];

export default function SuperAdminShell() {
  const { user, logout, isGhost, exitGhost } = useAuth();
  const navigate = useNavigate();

  const [pinModal, setPinModal] = useState({ open: false, targetTab: null });
  const [unlockedTabs, setUnlockedTabs] = useState(new Set());

  // Which tab is active based on current path
  const currentPath = window.location.hash.replace('#/super-admin', '').replace(/^\//, '');

  const handleTabClick = useCallback((tab) => {
    if (tab.pinRequired && !unlockedTabs.has(tab.id)) {
      setPinModal({ open: true, targetTab: tab });
    } else {
      navigate(`/super-admin/${tab.path}`);
    }
  }, [unlockedTabs, navigate]);

  const handlePinSuccess = useCallback((pinToken) => {
    const tab = pinModal.targetTab;
    setUnlockedTabs(prev => new Set([...prev, tab.id]));
    setPinModal({ open: false, targetTab: null });
    navigate(`/super-admin/${tab.path}`);
    toast.success(`${tab.label} ගේට්ටුව විවෘතයි`);
  }, [pinModal, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Ghost mode banner */}
      {isGhost && (
        <div className="ghost-banner">
          <span>👻</span>
          <span>Ghost Mode — ඔබ Admin දැනට ගේ session වෙත ඇතුළු ව ඇත</span>
          <button
            className="btn btn-sm"
            style={{ marginLeft: 'auto', background: 'rgba(139,92,246,0.2)', color: 'var(--clr-ghost)', border: '1px solid rgba(139,92,246,0.4)' }}
            onClick={() => {
              const saToken = sessionStorage.getItem('sa_token_backup');
              const saUser  = JSON.parse(sessionStorage.getItem('sa_user_backup') || '{}');
              if (saToken) exitGhost(saToken, saUser);
            }}
          >
            ← Super Admin වෙත ආපසු යන්න
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
            <div style={styles.headerSub}>Super Admin Panel</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div className="live-dot" title="System Online" />
          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
            {user?.displayName}
          </span>
          <span className="badge badge-purple">SUPER ADMIN</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Nav tabs */}
      <nav style={styles.nav}>
        {TABS.map(tab => {
          const active = currentPath === tab.path || (tab.path === '' && currentPath === '');
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              style={{
                ...styles.navTab,
                ...(active ? styles.navTabActive : {}),
              }}
            >
              {tab.label}
              {tab.pinRequired && !unlockedTabs.has(tab.id) && (
                <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 4 }}>🔒</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main style={styles.main}>
        <Routes>
          <Route index element={<SADashboard />} />
          <Route path="shops"   element={<SAShops />} />
          <Route path="users"   element={<SAUsers />} />
          <Route path="audit"   element={<SAAuditLogs />} />
          <Route path="ghost"   element={<SAGhostPortal />} />
          <Route path="*"       element={<Navigate to="/super-admin" replace />} />
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
  headerSub:   { fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: 'var(--clr-primary)', letterSpacing: '0.12em', fontWeight: 500 },
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
    maxWidth: 1280,
    width: '100%',
    margin: '0 auto',
  },
};
