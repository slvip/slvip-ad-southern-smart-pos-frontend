// AD SOUTHERN SMART POS — Super Admin Dashboard
// src/pages/superadmin/SADashboard.js

import React, { useEffect, useState } from 'react';
import { superAdminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function SADashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminAPI.dashboard()
      .then(r => setData(r.data))
      .catch(() => toast.error('Dashboard දත්ත ලබා ගැනීම අසාර්ථකයි'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid />;

  const stats = [
    { label: 'මුළු Shops',         value: data?.totalShops      ?? '—', icon: '🏪', color: 'var(--clr-primary)' },
    { label: 'සක්‍රීය Shops',       value: data?.activeShops     ?? '—', icon: '✅', color: 'var(--clr-success)' },
    { label: 'මුළු පරිශීලකයන්',   value: data?.totalUsers      ?? '—', icon: '👥', color: 'var(--clr-accent)'  },
    { label: 'අද බිල් ගණන',        value: data?.todayBills      ?? '—', icon: '🧾', color: 'var(--clr-ghost)'   },
    { label: 'Micro Tier Shops',   value: data?.tierCounts?.micro      ?? 0, icon: '🌱', color: '#6ee7b7' },
    { label: 'Standard Shops',     value: data?.tierCounts?.standard   ?? 0, icon: '⭐', color: '#93c5fd' },
    { label: 'Mega Wholesale',     value: data?.tierCounts?.mega       ?? 0, icon: '🚀', color: '#fcd34d' },
    { label: 'Enterprise',         value: data?.tierCounts?.enterprise ?? 0, icon: '🏢', color: '#f9a8d4' },
  ];

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Super Admin Dashboard</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            පද්ධතියේ සම්පූර්ණ දළ විශ්ලේෂණය
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="live-dot" />
          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>Live</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={styles.statsGrid}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={styles.statCard}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'Inter, monospace' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent audit activity */}
      {data?.recentActivity?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title" style={{ fontSize: '0.95rem' }}>📋 මෑත ක්‍රියාකාරකම්</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Shop</th>
                  <th>දිනය / වේලාව</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.slice(0, 8).map((log, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${
                        log.severity === 'high'   ? 'badge-red'   :
                        log.severity === 'medium' ? 'badge-amber' : 'badge-blue'
                      }`}>{log.action}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{log.username}</td>
                    <td style={{ color: 'var(--clr-text-muted)' }}>{log.shopName || '—'}</td>
                    <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.8rem' }}>
                      {new Date(log.timestamp).toLocaleString('si-LK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card" style={{ height: 110, opacity: 0.4, animation: 'pulse 2s ease infinite' }} />
      ))}
    </div>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    textAlign: 'center',
    padding: '1.25rem 1rem',
  },
};
