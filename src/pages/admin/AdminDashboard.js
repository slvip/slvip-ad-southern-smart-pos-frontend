// AD SOUTHERN SMART POS — Admin Dashboard (Module 2 + 5)
// src/pages/admin/AdminDashboard.js
//
// FIX LOG:
// FIX 1: Voice alert lang 'en-US' → 'si-LK' primary, 'en-US' fallback (SPEC §5A)
// FIX 2: Stat cards clickable — Pending Cheques → navigate('/dashboard/cheques') (SPEC §5 item 51)
//         Low Stock → navigate('/dashboard/inventory'), Expiring → navigate('/dashboard/inventory')
// FIX 3: WhatsApp Notification Alert Panel — per-alert-type on/off dashboard control (SPEC §5C item 61)
//         voiceAlert toggle per-session (SPEC §5A item 56)
// FIX 4: Pending Cheques dashboard indicator enhanced — daysLeft warning badges (SPEC §5 item 51)

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [data,       setData]       = useState(null);
  const [matrix,     setMatrix]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [matrixLoad, setMatrixLoad] = useState(true);

  // FIX 3: WhatsApp notification controls — per alert type, session-level state
  // Persisted to localStorage so refreshing doesn't reset them
  const [notifControls, setNotifControls] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_notif_controls');
      return stored ? JSON.parse(stored) : {
        lowStockWA:  true,
        expiryWA:    true,
        chequeWA:    true,
        voidAlertWA: true, // this is mandatory per spec — kept as display toggle only
      };
    } catch { return { lowStockWA: true, expiryWA: true, chequeWA: true, voidAlertWA: true }; }
  });

  // FIX 3: Voice toggle — session level (backs up to localStorage)
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const stored = localStorage.getItem('pos_voice_session');
    if (stored !== null) return stored === 'true';
    return user?.shop?.settings?.voiceAlerts !== false;
  });

  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const saveNotifControls = useCallback((next) => {
    setNotifControls(next);
    localStorage.setItem('pos_notif_controls', JSON.stringify(next));
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem('pos_voice_session', String(next));
      toast(next ? '🔊 Voice Alerts ක්‍රියාත්මකයි' : '🔇 Voice Alerts නවතා ඇත');
      return next;
    });
  }, []);

  const toggleNotif = useCallback((key) => {
    saveNotifControls(prev => ({ ...prev, [key]: !prev[key] }));
  }, [saveNotifControls]);

  // ── Data load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      adminAPI.dashboard().then(r => setData(r.data)),
      adminAPI.financialMatrix().then(r => setMatrix(r.data)),
    ])
    .catch(() => toast.error('Dashboard දත්ත ලබා ගැනීම අසාර්ථකයි'))
    .finally(() => { setLoading(false); setMatrixLoad(false); });
  }, []);

  // ── FIX 1: Voice alert — සිංහල primary, English fallback (SPEC §5A) ────────
  useEffect(() => {
    if (!data || !voiceEnabled) return;
    const { lowStockItems = [], expiringItems = [] } = data;
    if (lowStockItems.length === 0 && expiringItems.length === 0) return;
    if (!('speechSynthesis' in window)) return;

    const msg = [];
    if (lowStockItems.length > 0)
      msg.push(`අඩු stock ඇති භාණ්ඩ ${lowStockItems.length}ක් ඇත`);
    if (expiringItems.length > 0)
      msg.push(`කල් ඉකුත් වෙන භාණ්ඩ ${expiringItems.length}ක් ඇත`);

    const utt  = new SpeechSynthesisUtterance('අවවාදයයි. ' + msg.join('. '));
    // FIX 1: try si-LK first; if no Sinhala voice available, fall back to en-US
    const voices    = window.speechSynthesis.getVoices();
    const siVoice   = voices.find(v => v.lang === 'si-LK' || v.lang.startsWith('si'));
    utt.lang  = siVoice ? 'si-LK' : 'en-US';
    utt.rate  = 0.85;
    utt.pitch = 1;
    // Voices may not be loaded yet — use onvoiceschanged if empty
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const v2 = window.speechSynthesis.getVoices();
        const si = v2.find(v => v.lang === 'si-LK' || v.lang.startsWith('si'));
        utt.lang = si ? 'si-LK' : 'en-US';
        setTimeout(() => window.speechSynthesis.speak(utt), 800);
      };
    } else {
      setTimeout(() => window.speechSynthesis.speak(utt), 800);
    }
  }, [data, voiceEnabled]);

  if (loading) return <LoadingGrid />;

  const whatsappOn = user?.shop?.settings?.whatsappEnabled;

  // ── FIX 2: stat cards clickable — navigate to relevant tab ─────────────────
  const stats = [
    {
      label: 'මුළු Stock Items',
      value: data?.totalItems ?? '—',
      icon: '📦',
      color: 'var(--clr-primary)',
      onClick: null,
    },
    {
      label: 'අඩු Stock Items',
      value: data?.lowStockItems?.length ?? 0,
      icon: '⚠️',
      color: 'var(--clr-accent)',
      onClick: () => navigate('/dashboard/inventory'),
      clickable: true,
    },
    {
      label: 'අදට Bills',
      value: data?.todayBills ?? '—',
      icon: '🧾',
      color: 'var(--clr-success)',
      onClick: null,
    },
    {
      label: 'අදට ආදායම',
      value: `රු. ${(data?.todayRevenue || 0).toLocaleString()}`,
      icon: '💰',
      color: 'var(--clr-ghost)',
      onClick: null,
    },
    {
      label: 'කල් ඉකුත්වෙන Items',
      value: data?.expiringItems?.length ?? 0,
      icon: '📅',
      color: 'var(--clr-danger)',
      onClick: () => navigate('/dashboard/inventory'),
      clickable: true,
    },
    {
      label: 'Pending Cheques',
      value: data?.pendingCheques ?? 0,
      icon: '💳',
      color: 'var(--clr-accent)',
      // FIX 2: click → cheques tab (SPEC §5 item 51)
      onClick: () => navigate('/dashboard/cheques'),
      clickable: true,
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">📊 Admin Dashboard</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {user?.shop?.name} — {new Date().toLocaleDateString('si-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* FIX 3: Voice toggle button (SPEC §5A item 56) */}
          <button
            className={`btn btn-sm ${voiceEnabled ? 'btn-primary' : 'btn-ghost'}`}
            onClick={toggleVoice}
            title={voiceEnabled ? 'Voice Alerts ක්‍රියාත්මකයි — Click to disable' : 'Voice Alerts නවතා ඇත — Click to enable'}
            style={{ fontSize: '0.78rem' }}
          >
            {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
          </button>

          {/* FIX 3: WhatsApp notification alert panel toggle (SPEC §5C item 61) */}
          {whatsappOn && (
            <div style={{ position: 'relative' }}>
              <button
                className={`btn btn-sm ${notifPanelOpen ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setNotifPanelOpen(p => !p)}
                style={{ fontSize: '0.78rem' }}
              >
                📱 WA Alerts
              </button>

              {notifPanelOpen && (
                <div style={styles.notifPanel} onClick={e => e.stopPropagation()}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.75rem', color: 'var(--clr-text)' }}>
                    📱 WhatsApp Alert Controls
                  </div>
                  {[
                    { key: 'lowStockWA',  label: '⚠️ Low Stock Alerts',       sub: 'Stock අඩු වූ විට' },
                    { key: 'expiryWA',    label: '📅 Expiry Alerts',           sub: 'කල් ඉකුත් වීමට ආසන්නව' },
                    { key: 'chequeWA',    label: '💳 Cheque Due Alerts',       sub: 'Cheque Date 2 දිනකට ආසන්නව' },
                    { key: 'voidAlertWA', label: '🗑 Void Bill Alert',         sub: 'Mandatory — display only' },
                  ].map(({ key, label, sub }) => (
                    <div key={key} style={styles.notifRow}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{sub}</div>
                      </div>
                      <label style={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={notifControls[key]}
                          disabled={key === 'voidAlertWA'} // mandatory per spec
                          onChange={() => key !== 'voidAlertWA' && toggleNotif(key)}
                          style={{ display: 'none' }}
                        />
                        <span style={{
                          ...styles.toggleTrack,
                          background: notifControls[key] ? 'var(--clr-success)' : 'var(--clr-border)',
                          opacity: key === 'voidAlertWA' ? 0.5 : 1,
                        }}>
                          <span style={{
                            ...styles.toggleThumb,
                            transform: notifControls[key] ? 'translateX(16px)' : 'translateX(0)',
                          }} />
                        </span>
                      </label>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', marginTop: '0.75rem', borderTop: '1px solid var(--clr-border)', paddingTop: '0.5rem' }}>
                    💡 Void Bill alert අනිවාර්ය (Mandatory) — disable කළ නොහැක
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="live-dot" />
          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>Live</span>
        </div>
      </div>

      {/* Click-outside handler for notif panel */}
      {notifPanelOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setNotifPanelOpen(false)}
        />
      )}

      {/* ── Stats grid (FIX 2: clickable cards) ── */}
      <div style={styles.statsGrid}>
        {stats.map((s, i) => (
          <div
            key={i}
            className="card"
            style={{
              ...styles.statCard,
              cursor: s.clickable ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onClick={s.onClick || undefined}
            onMouseEnter={s.clickable ? e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
            } : undefined}
            onMouseLeave={s.clickable ? e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
            title={s.clickable ? 'Click to view →' : undefined}
          >
            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'Inter, monospace' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)', marginTop: 4 }}>{s.label}</div>
            {s.clickable && (
              <div style={{ fontSize: '0.65rem', color: s.color, marginTop: 3, opacity: 0.7 }}>→ view</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Financial Live Matrix (unchanged) ── */}
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

      {/* ── FIX 4: Pending Cheques Dashboard Panel (SPEC §5 item 51) ── */}
      {(data?.pendingChequesList?.length > 0) && (
        <div className="card" style={{ marginTop: '1.5rem', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title" style={{ fontSize: '0.95rem' }}>💳 Pending Cheques</div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => navigate('/dashboard/cheques')}
              style={{ fontSize: '0.78rem' }}
            >
              සියල්ල බලන්න →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.pendingChequesList.slice(0, 5).map((c, i) => {
              const daysLeft = c.daysLeft ?? Math.ceil((new Date(c.chequeDate) - new Date()) / 86400000);
              const urgent   = daysLeft <= 2;
              const overdue  = daysLeft < 0;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: overdue
                      ? 'rgba(239,68,68,0.08)'
                      : urgent
                        ? 'rgba(245,158,11,0.08)'
                        : 'var(--clr-bg)',
                    border: overdue
                      ? '1px solid rgba(239,68,68,0.25)'
                      : urgent
                        ? '1px solid rgba(245,158,11,0.25)'
                        : '1px solid var(--clr-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{c.party || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                      {c.bank} · #{c.chequeNo}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--clr-success)', fontSize: '0.88rem' }}>
                      රු. {Number(c.amount).toLocaleString()}
                    </div>
                    <span className={`badge ${overdue ? 'badge-red' : urgent ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>
                      {overdue ? `${Math.abs(daysLeft)}d Overdue` : urgent ? `${daysLeft}d ⚠️` : `${daysLeft}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alerts (unchanged logic, clickable to navigate) ── */}
      {(data?.lowStockItems?.length > 0 || data?.expiringItems?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
          {data.lowStockItems?.length > 0 && (
            <AlertCard
              title="⚠️ අඩු Stock"
              color="amber"
              items={data.lowStockItems.slice(0, 6)}
              onViewAll={() => navigate('/dashboard/inventory')}
            />
          )}
          {data.expiringItems?.length > 0 && (
            <AlertCard
              title="📅 කල් ඉකුත්වෙන Items"
              color="danger"
              items={data.expiringItems.slice(0, 6)}
              onViewAll={() => navigate('/dashboard/inventory')}
            />
          )}
        </div>
      )}

      {/* ── Recent Bills (unchanged) ── */}
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

/* ── Sub-components ───────────────────────────────────────────────────────── */

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

function AlertCard({ title, color, items, onViewAll }) {
  const clr = color === 'amber' ? 'var(--clr-accent)' : 'var(--clr-danger)';
  const bg  = color === 'amber' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  const br  = color === 'amber' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)';
  return (
    <div style={{ background: bg, border: `1px solid ${br}`, borderRadius: 'var(--radius)', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 700, color: clr }}>{title}</div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            style={{ background: 'none', border: 'none', color: clr, fontSize: '0.72rem', cursor: 'pointer', opacity: 0.8 }}
          >
            සියල්ල →
          </button>
        )}
      </div>
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

/* ── Styles ───────────────────────────────────────────────────────────────── */
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
  // FIX 3: WhatsApp notification panel dropdown
  notifPanel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 200,
    background: 'var(--clr-surface)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    width: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  notifRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.6rem',
    marginBottom: '0.6rem',
    borderBottom: '1px solid var(--clr-border)',
  },
  // Toggle switch
  toggle: { cursor: 'pointer', display: 'flex', alignItems: 'center' },
  toggleTrack: {
    display: 'inline-block',
    width: 36,
    height: 20,
    borderRadius: 10,
    position: 'relative',
    transition: 'background 0.2s',
  },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
};
