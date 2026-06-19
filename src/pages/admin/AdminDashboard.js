// AD SOUTHERN SMART POS — Admin Dashboard (Module 2)
// src/pages/admin/AdminDashboard.js

import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [matrix, setMatrix]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [matrixLoad, setMatrixLoad] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.dashboard().then(r => setData(r.data)),
      adminAPI.financialMatrix().then(r => setMatrix(r.data)),
    ])
    .catch(() => toast.error('Dashboard දත්ත ලබා ගැනීම අසාර්ථකයි'))
    .finally(() => { setLoading(false); setMatrixLoad(false); });
  }, []);

  // Voice alert on mount (Module 5 feature, graceful)
  useEffect(() => {
    if (!data) return;
    const { lowStockItems = [], expiringItems = [] } = data;
    if (lowStockItems.length === 0 && expiringItems.length === 0) return;

    // Check if voice alerts enabled (from settings stored in user.shop)
    const voiceOn = user?.shop?.settings?.voiceAlerts !== false;
    if (!voiceOn) return;

    if ('speechSynthesis' in window) {
      const msg = [];
      if (lowStockItems.length > 0) msg.push(`${lowStockItems.length} items low stock`);
      if (expiringItems.length > 0)  msg.push(`${expiringItems.length} items expiring soon`);
      const utt = new SpeechSynthesisUtterance('Warning: ' + msg.join(', '));
      utt.lang = 'en-US';
      utt.rate = 0.9;
      setTimeout(() => window.speechSynthesis.speak(utt), 800);
    }
  }, [data, user]);

  if (loading) return <LoadingGrid />;

  const stats = [
    { label: 'මුළු Stock Items',   value: data?.totalItems    ?? '—', icon: '📦', color: 'var(--clr-primary)' },
    { label: 'අඩු Stock Items',    value: data?.lowStockItems?.length ?? 0, icon: '⚠️', color: 'var(--clr-accent)' },
    { label: 'අදට Bills',          value: data?.todayBills    ?? '—', icon: '🧾', color: 'var(--clr-success)' },
    { label: 'අදට ආදායම',         value: `රු. ${(data?.todayRevenue || 0).toLocaleString()}`, icon: '💰', color: 'var(--clr-ghost)' },
    { label: 'කල් ඉකුත්වෙන Items', value: data?.expiringItems?.length ?? 0, icon: '📅', color: 'var(--clr-danger)' },
    { label: 'Pending Cheques',    value: data?.pendingCheques ?? 0, icon: '💳', color: 'var(--clr-accent)' },
  ];

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">📊 Admin Dashboard</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {user?.shop?.name} — {new Date().toLocaleDateString('si-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="live-dot" />
          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>Live</span>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={styles.statCard}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'Inter, monospace' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Financial Matrix */}
      {!matrixLoad && matrix && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title" style={{ fontSize: '0.95rem' }}>💹 Financial Live Matrix</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
              Stock අනුව ගණනය කළ අගයන්
            </span>
          </div>
          <div style={styles.matrixGrid}>
            <MatrixCard
              label="Stock Cost Value"
              value={`රු. ${(matrix.totalCostValue || 0).toLocaleString()}`}
              sub="Cost Price × Quantity"
              color="var(--clr-text-muted)"
              icon="📉"
            />
            <MatrixCard
              label="Potential Revenue"
              value={`රු. ${(matrix.totalSellingValue || 0).toLocaleString()}`}
              sub="Selling Price × Quantity"
              color="var(--clr-primary)"
              icon="📈"
            />
            <MatrixCard
              label="Net Profit (Potential)"
              value={`රු. ${(matrix.totalNetProfit || 0).toLocaleString()}`}
              sub="Revenue − Cost"
              color="var(--clr-success)"
              icon="💰"
            />
            <MatrixCard
              label="Profit Margin"
              value={`${matrix.profitMarginPercent?.toFixed(1) || 0}%`}
              sub="ශුද්ධ ලාභ අනුපාතය"
              color="var(--clr-accent)"
              icon="📊"
            />
          </div>
        </div>
      )}

      {/* Alerts */}
      {(data?.lowStockItems?.length > 0 || data?.expiringItems?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
          {data.lowStockItems?.length > 0 && (
            <AlertCard title="⚠️ අඩු Stock" color="amber" items={data.lowStockItems.slice(0, 6)} />
          )}
          {data.expiringItems?.length > 0 && (
            <AlertCard title="📅 කල් ඉකුත්වෙන Items" color="danger" items={data.expiringItems.slice(0, 6)} />
          )}
        </div>
      )}

      {/* Recent Bills */}
      {data?.recentBills?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title" style={{ fontSize: '0.95rem' }}>🧾 මෑත Bills</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Cashier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>වේලාව</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBills.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--clr-accent)' }}>#{b.billNumber}</td>
                    <td>{b.cashierName || '—'}</td>
                    <td>{b.itemCount} items</td>
                    <td style={{ fontWeight: 700, color: 'var(--clr-success)' }}>රු. {b.total?.toLocaleString()}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                      {new Date(b.createdAt).toLocaleTimeString('si-LK')}
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

function MatrixCard({ label, value, sub, color, icon }) {
  return (
    <div style={styles.matrixCard}>
      <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{icon}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, fontFamily: 'Inter, monospace' }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function AlertCard({ title, color, items }) {
  const clr = color === 'amber' ? 'var(--clr-accent)' : 'var(--clr-danger)';
  const bg  = color === 'amber' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  const br  = color === 'amber' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)';
  return (
    <div style={{ background: bg, border: `1px solid ${br}`, borderRadius: 'var(--radius)', padding: '1rem' }}>
      <div style={{ fontWeight: 700, color: clr, marginBottom: '0.75rem' }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
          <span>{item.name}</span>
          <span style={{ color: clr, fontWeight: 600 }}>
            {color === 'amber' ? `Qty: ${item.quantity}` : `${item.daysLeft}d`}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card" style={{ height: 100, opacity: 0.4, animation: 'pulse 2s ease infinite' }} />
      ))}
    </div>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '1rem',
  },
  statCard: { textAlign: 'center', padding: '1.1rem 0.75rem' },
  matrixGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  matrixCard: {
    background: 'var(--clr-bg)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius)',
    padding: '1.1rem',
    textAlign: 'center',
  },
};
