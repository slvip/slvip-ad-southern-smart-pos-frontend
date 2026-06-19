// AD SOUTHERN SMART POS — Admin Settings (Module 3 + 5)
// src/pages/admin/AdminSettings.js

import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    cosmeticSavingsPercent: 0,
    lowStockDefault: 10,
    voiceAlerts: true,
    whatsappEnabled: false,
    shopDisplayName: '',
    receiptFooter: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [waBannerDismissed, setWaBannerDismissed] = useState(false);

  useEffect(() => {
    adminAPI.getSettings()
      .then(r => setSettings(prev => ({ ...prev, ...r.data.settings })))
      .catch(() => toast.error('Settings ලෝඩ් error'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminAPI.updateSettings(settings);
      toast.success('✅ Settings සාර්ථකව Save කළා');
    } catch {
      toast.error('Save error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="empty-state">
      <div className="animate-spin" style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--clr-border)', borderTopColor: 'var(--clr-primary)', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <div className="section-title">⚙️ Admin Settings</div>
      </div>

      <form onSubmit={handleSave}>
        {/* ── Cosmetic Savings ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={styles.sectionHead}>💰 Cosmetic Savings (Module 3C)</div>
          <div style={styles.sectionSub}>
            පාරිභෝගිකයාගේ Receipt එකේ "ලාභය" ලෙස පෙන්වන ප්‍රතිශතය. සැබෑ accounting ට බලපාන්නේ නැත.
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cosmetic Savings % (0 = Off)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={settings.cosmeticSavingsPercent}
                onChange={e => set('cosmeticSavingsPercent', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1.1rem' }}>
              <div style={styles.previewBox}>
                Receipt: "ඔබේ ලාභය: රු.{(1000 * settings.cosmeticSavingsPercent / 100).toFixed(2)} (රු.1,000 purchase)"
              </div>
            </div>
          </div>
        </div>

        {/* ── Stock Alerts ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={styles.sectionHead}>📦 Stock Alerts</div>
          <div className="form-row">
            <div className="form-group">
              <label>Default Low Stock Threshold (Qty)</label>
              <input
                type="number"
                min="1"
                value={settings.lowStockDefault}
                onChange={e => set('lowStockDefault', parseInt(e.target.value) || 10)}
              />
            </div>
            <div className="form-group">
              <label>Voice Alerts (Dashboard Startup)</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.55rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--clr-text)' }}>
                  <input type="radio" checked={settings.voiceAlerts === true} onChange={() => set('voiceAlerts', true)} />
                  🔊 On
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--clr-text)' }}>
                  <input type="radio" checked={settings.voiceAlerts === false} onChange={() => set('voiceAlerts', false)} />
                  🔇 Off
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── WhatsApp ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={styles.sectionHead}>📱 WhatsApp Integration (Module 5C)</div>
          <div style={styles.sectionSub}>
            Baileys Library හරහා WhatsApp Bot සම්බන්ධ කිරීම. Server Logs හි QR Code scan කරන්න.
          </div>
          <div style={styles.waBadge}>
            <span style={{ fontSize: '0.9rem' }}>⚡</span>
            <div>
              <div style={{ fontWeight: 600 }}>WhatsApp Status: {settings.whatsappEnabled ? '🟢 Connected' : '🔴 Disconnected'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                Hugging Face Space → Server Logs → Scan QR
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.whatsappEnabled}
                onChange={e => set('whatsappEnabled', e.target.checked)}
              />
              <span style={{ color: 'var(--clr-text)' }}>WhatsApp Bill Alerts Enable කරන්න</span>
            </label>
          </div>
        </div>

        {/* ── Receipt Customization ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={styles.sectionHead}>🖨️ Receipt Customization</div>
          <div className="form-group">
            <label>Shop Display Name (Receipt එකේ)</label>
            <input
              value={settings.shopDisplayName}
              onChange={e => set('shopDisplayName', e.target.value)}
              placeholder="Perera General Store"
            />
          </div>
          <div className="form-group">
            <label>Receipt Footer Text</label>
            <textarea
              value={settings.receiptFooter}
              onChange={e => set('receiptFooter', e.target.value)}
              rows={2}
              placeholder="ස්තූතියි! Hugs & Smiles 😊"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={saving}>
          {saving ? '⏳ Saving...' : '💾 Settings Save කරන්න'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  sectionHead: { fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' },
  sectionSub: { fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' },
  previewBox: {
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    color: 'var(--clr-success)',
    fontFamily: 'var(--font-mono)',
  },
  waBadge: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    background: 'rgba(59,130,246,0.06)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
  },
};