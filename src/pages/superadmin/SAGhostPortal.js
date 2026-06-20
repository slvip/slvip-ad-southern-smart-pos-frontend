// AD SOUTHERN SMART POS — Ghost Portal (Master Password + Ghost PIN protected)
// src/pages/superadmin/SAGhostPortal.js
// SPEC §4: ද්විත්ව සත්‍යාපන ආරක්ෂාව + Ghost PIN management

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SAGhostPortal() {
  const { user, enterGhost } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [ghosting, setGhosting] = useState(null);

  // Ghost PIN management state
  const [pinTabOpen,    setPinTabOpen]    = useState(false);
  const [masterPW,      setMasterPW]      = useState('');
  const [newGhostPin,   setNewGhostPin]   = useState('');
  const [pinStatus,     setPinStatus]     = useState(null);  // { ghostPinSet, ghostPinSetAt }
  const [pinLoading,    setPinLoading]    = useState(false);

  // Per-shop ghost credential modal
  const [ghostModal,    setGhostModal]    = useState(null);  // shop object
  const [ghostCredType, setGhostCredType] = useState('masterPW'); // 'masterPW' | 'ghostPin'
  const [ghostMasterPW, setGhostMasterPW] = useState('');
  const [ghostPinInput, setGhostPinInput] = useState('');

  const loadShops = useCallback(() => {
    setLoading(true);
    superAdminAPI.getShops()
      .then(r => setShops(r.data.shops || []))
      .catch(() => toast.error('Shops ලිස්ට් ලබා ගැනීම අසාර්ථකයි'))
      .finally(() => setLoading(false));
  }, []);

  const loadPinStatus = useCallback(() => {
    superAdminAPI.getGhostPinStatus?.()
      .then(r => setPinStatus(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadShops();
    loadPinStatus();
  }, [loadShops, loadPinStatus]);

  /* ── Ghost Login with credential modal ── */
  const openGhostModal = (shop) => {
    if (!shop.isActive) return;
    setGhostModal(shop);
    setGhostCredType(pinStatus?.ghostPinSet ? 'ghostPin' : 'masterPW');
    setGhostMasterPW('');
    setGhostPinInput('');
  };

  const handleGhostLogin = async () => {
    if (!ghostModal) return;
    setGhosting(ghostModal._id);
    try {
      const payload = ghostCredType === 'ghostPin'
        ? { ghostPin: ghostPinInput }
        : { masterPassword: ghostMasterPW };
      const res = await superAdminAPI.ghostLogin(ghostModal._id, payload);
      const { ghostToken, targetUser } = res.data;
      enterGhost(ghostToken, targetUser);
      toast.success(`👻 "${ghostModal.name}" ගේ Admin Panel වෙත ඇතුළු වෙමින්...`);
      setGhostModal(null);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ghost Login අසාර්ථකයි');
    } finally {
      setGhosting(null);
    }
  };

  /* ── Ghost PIN Management (single-step: masterPassword + newGhostPin together) ── */
  const handleSetGhostPin = async () => {
    if (!masterPW) { toast.error('Master Password ඇතුළත් කරන්න'); return; }
    if (!newGhostPin || !/^\d{4,8}$/.test(newGhostPin)) {
      toast.error('Ghost PIN ඉලක්කම් 4-8ක් ඇතුළත් කරන්න'); return;
    }
    setPinLoading(true);
    try {
      // Backend verifies masterPassword AND sets newGhostPin in one request
      await superAdminAPI.setGhostPin?.({ masterPassword: masterPW, newGhostPin });
      toast.success('Ghost PIN සාර්ථකව සකස් කළා 🔐');
      setMasterPW('');
      setNewGhostPin('');
      loadPinStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Master Password වැරදියි, හෝ Ghost PIN සැකසීම අසාර්ථකයි');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">👻 Ghost Portal</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            Admin ගේ Password නොමැතිව ඔහුගේ Panel වෙත ඇතුළු වන්න
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge badge-purple">Layer 2 Protected</span>
          <button
            className={`btn btn-sm ${pinTabOpen ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setPinTabOpen(p => !p); setMasterPW(''); setNewGhostPin(''); }}
          >
            🔐 Ghost PIN {pinStatus?.ghostPinSet ? '(Set)' : '(Not Set)'}
          </button>
        </div>
      </div>

      {/* Warning */}
      <div style={styles.warnBox}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Ghost Mode — දෙවරක් සිතන්න</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
            Ghost Login සෑම ක්‍රියාවක්ම Audit Log හි සටහන් වේ. Master Password හෝ Ghost PIN අවශ්‍යයි.
          </div>
        </div>
      </div>

      {/* ── Ghost PIN Management Panel ── */}
      {pinTabOpen && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--clr-ghost)' }}>
            🔐 Ghost PIN සකසන්න
          </div>
          {pinStatus?.ghostPinSet && (
            <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
              ✅ Ghost PIN දැනටමත් සකසා ඇත — {pinStatus.ghostPinSetAt ? new Date(pinStatus.ghostPinSetAt).toLocaleDateString('si-LK') : ''}
            </div>
          )}

          {/* Single-step: Master Password + new Ghost PIN submitted together */}
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
              Master Password සහ නව Ghost PIN එක එකවර ඇතුළත් කර Save කරන්න
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <input
                type="password"
                value={masterPW}
                onChange={e => setMasterPW(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetGhostPin()}
                placeholder="Master Password"
                style={styles.input}
              />
              <input
                type="password"
                value={newGhostPin}
                onChange={e => setNewGhostPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={e => e.key === 'Enter' && handleSetGhostPin()}
                placeholder="නව Ghost PIN — ඉලක්කම් 4-8ක් (eg: 7291)"
                maxLength={8}
                inputMode="numeric"
                style={styles.input}
              />
              <button
                className="btn btn-primary"
                onClick={handleSetGhostPin}
                disabled={pinLoading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {pinLoading ? '⏳ සකසමින්...' : '🔐 Verify & Set PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shop List ── */}
      {loading ? (
        <div className="empty-state">⏳ Shops ලෝඩ් වෙමින්...</div>
      ) : shops.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>🏪</div>
          <div>Ghost Login සඳහා Shops නොමැත</div>
        </div>
      ) : (
        <div style={styles.shopGrid}>
          {shops.map(shop => (
            <div key={shop._id} className="card" style={styles.shopCard}>
              <div style={styles.shopHeader}>
                <div style={styles.shopIcon}>🏪</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{shop.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                    Admin: <span style={{ fontFamily: 'var(--font-mono)' }}>{shop.ownerUsername}</span>
                  </div>
                </div>
              </div>
              <div style={styles.shopMeta}>
                <span className="badge badge-blue">{shop.businessCategory}</span>
                <span className={`badge ${shop.isActive ? 'badge-green' : 'badge-red'}`}>
                  {shop.isActive ? 'Online' : 'Offline'}
                </span>
              </div>
              <div style={styles.tierRow}>
                <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>Stock Tier:</span>
                <span className={`badge tier-${shop.stockTier}`}>{shop.stockTier?.toUpperCase()}</span>
              </div>
              <button
                className="btn btn-full"
                style={{
                  marginTop: '1rem',
                  background: 'rgba(139,92,246,0.15)',
                  color: 'var(--clr-ghost)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  fontWeight: 600,
                }}
                onClick={() => openGhostModal(shop)}
                disabled={ghosting === shop._id || !shop.isActive}
              >
                {ghosting === shop._id ? '⏳ ඇතුළු වෙමින්...' : '👻 Ghost Login'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Ghost Login Credential Modal ── */}
      {ghostModal && (
        <div className="modal-overlay" onClick={() => setGhostModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-title">👻 Ghost Login — {ghostModal.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>
              Admin: {ghostModal.ownerUsername}
            </div>

            {/* Credential type toggle */}
            {pinStatus?.ghostPinSet && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  className={`btn btn-sm btn-full ${ghostCredType === 'ghostPin' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGhostCredType('ghostPin')}
                >
                  🔐 Ghost PIN
                </button>
                <button
                  className={`btn btn-sm btn-full ${ghostCredType === 'masterPW' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGhostCredType('masterPW')}
                >
                  🔑 Master Password
                </button>
              </div>
            )}

            {ghostCredType === 'ghostPin' ? (
              <div className="form-group">
                <label>Ghost PIN</label>
                <input
                  type="password"
                  value={ghostPinInput}
                  onChange={e => setGhostPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleGhostLogin()}
                  placeholder="Ghost PIN ඇතුළත් කරන්න"
                  inputMode="numeric"
                  autoFocus
                  style={styles.input}
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Master Password</label>
                <input
                  type="password"
                  value={ghostMasterPW}
                  onChange={e => setGhostMasterPW(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGhostLogin()}
                  placeholder="Master Password ඇතුළත් කරන්න"
                  autoFocus
                  style={styles.input}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setGhostModal(null)}>අවලංගු</button>
              <button
                className="btn btn-full"
                style={{ background: 'rgba(139,92,246,0.2)', color: 'var(--clr-ghost)', border: '1px solid rgba(139,92,246,0.4)', fontWeight: 700 }}
                onClick={handleGhostLogin}
                disabled={!!ghosting}
              >
                {ghosting ? '⏳ ඇතුළු වෙමින්...' : '👻 Ghost Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  warnBox: {
    display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 'var(--radius)',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
    color: 'var(--clr-accent)',
  },
  shopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1rem',
  },
  shopCard: { padding: '1.25rem' },
  shopHeader: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.85rem' },
  shopIcon: {
    width: 40, height: 40, borderRadius: 'var(--radius-sm)',
    background: 'rgba(59,130,246,0.1)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
    flexShrink: 0,
  },
  shopMeta: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' },
  tierRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    flex: 1, width: '100%', padding: '0.55rem 0.75rem',
    borderRadius: 8, border: '1.5px solid var(--clr-border)',
    background: 'var(--clr-surface-2)', color: 'var(--clr-text)',
    fontSize: '0.9rem',
  },
};
