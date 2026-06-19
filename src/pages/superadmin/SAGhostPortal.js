// AD SOUTHERN SMART POS — Ghost Portal (PIN-protected)
// src/pages/superadmin/SAGhostPortal.js

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SAGhostPortal() {
  const { user, enterGhost } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [ghosting, setGhosting] = useState(null); // shop._id being ghosted

  useEffect(() => {
    superAdminAPI.getShops()
      .then(r => setShops(r.data.shops || []))
      .catch(() => toast.error('Shops ලිස්ට් ලබා ගැනීම අසාර්ථකයි'))
      .finally(() => setLoading(false));
  }, []);

  const handleGhostLogin = async (shop) => {
    setGhosting(shop._id);
    try {
      // api.js: ghostLogin(shopId) → POST /super-admin/ghost/:shopId
      const res = await superAdminAPI.ghostLogin(shop._id);
      const { ghostToken, targetUser } = res.data;

      // AuthContext.enterGhost handles sessionStorage backup internally
      enterGhost(ghostToken, targetUser);
      toast.success(`👻 "${shop.name}" ගේ Admin Panel වෙත ඇතුළු වෙමින්...`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ghost Login අසාර්ථකයි');
    } finally {
      setGhosting(null);
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
        <span className="badge badge-purple">Layer 2 Protected</span>
      </div>

      {/* Warning box */}
      <div style={styles.warnBox}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Ghost Mode — දෙවරක් සිතන්න</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
            Ghost Login සෑම ක්‍රියාවක්ම Audit Log හි සටහන් වේ. Admin ගේ Session වෙත ඔබ ක්‍රියා කරන සෑම ක්‍රියාවක්ම ආරක්ෂිත ලෙස record කෙරේ.
          </div>
        </div>
      </div>

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
                onClick={() => handleGhostLogin(shop)}
                disabled={ghosting === shop._id || !shop.isActive}
              >
                {ghosting === shop._id ? '⏳ ඇතුළු වෙමින්...' : '👻 Ghost Login'}
              </button>
            </div>
          ))}
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
};
