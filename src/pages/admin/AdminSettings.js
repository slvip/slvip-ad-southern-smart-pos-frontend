// AD SOUTHERN SMART POS — Admin Settings (Module 3 + 5)
// src/pages/admin/AdminSettings.js
//
// UPDATED: Added Gemini API Key, WhatsApp Phone Number, Security PIN Management

import React, { useState, useEffect, useRef } from 'react';
import { adminAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    cosmeticSavingsPercent: 0,
    lowStockDefault: 10,
    voiceAlerts: true,
    whatsappEnabled: false,
    whatsappPhoneNumber: '',
    shopDisplayName: '',
    receiptFooter: '',
    geminiApiKey: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // PIN management state
  const [pinStatus, setPinStatus]       = useState({ pinSet: false, pinSetAt: null });
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinForm, setPinForm]           = useState({ currentPin: '', currentPassword: '', newPin: '', confirmPin: '' });
  const [pinLoading, setPinLoading]     = useState(false);
  const [showPinValues, setShowPinValues] = useState(false);

  useEffect(() => {
    Promise.all([
      adminAPI.getSettings(),
      authAPI.pinStatus(),
    ]).then(([r, pinR]) => {
      setSettings(prev => ({ ...prev, ...r.data.settings }));
      setPinStatus(pinR.data);
    }).catch(() => toast.error('Settings ලෝඩ් error'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));
  const setPin = (k, v) => setPinForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminAPI.updateSettings(settings);
      toast.success('✅ Settings සාර්ථකව Save කළා');
    } catch {
      toast.error('Save error');
    } finally { setSaving(false); }
  };

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinForm.newPin)) { toast.error('PIN ඉලක්කම් 4ක් ඇතුළත් කරන්න'); return; }
    if (pinForm.newPin !== pinForm.confirmPin) { toast.error('PIN ගැලපෙන්නේ නැත'); return; }
    if (pinStatus.pinSet && !pinForm.currentPin && !pinForm.currentPassword) {
      toast.error('PIN change කිරීමට වත්මන් PIN හෝ Password ඇතුළත් කරන්න'); return;
    }
    setPinLoading(true);
    try {
      await authAPI.setPin({
        pin:             pinForm.newPin,
        currentPin:      pinForm.currentPin || undefined,
        currentPassword: pinForm.currentPassword || undefined,
      });
      toast.success('✅ Personal PIN සාර්ථකව Set කළා!');
      setPinStatus({ pinSet: true, pinSetAt: new Date() });
      setPinForm({ currentPin: '', currentPassword: '', newPin: '', confirmPin: '' });
      setShowPinSetup(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'PIN Set error');
    } finally { setPinLoading(false); }
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

      {/* ── Security: Personal PIN ── */}
      <div className="card" style={{ marginBottom: '1rem', border: pinStatus.pinSet ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.4)' }}>
        <div style={styles.sectionHead}>🔐 Personal Action PIN (Layer 2 Security)</div>
        <div style={styles.sectionSub}>
          ඔබේ Panel හි සංවේදී Tabs (Staff, Cheques, Settings, Audit) ඇතුළු වීමට ඔබ ලවා සකස් කරන Personal 4-Digit PIN. සෑම User කෙනෙකුට වෙනම PIN ඇත.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <span className={`badge ${pinStatus.pinSet ? 'badge-green' : 'badge-amber'}`}>
            {pinStatus.pinSet ? '✅ PIN Set කර ඇත' : '⚠️ PIN Set කර නොමැත'}
          </span>
          {pinStatus.pinSetAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
              Last set: {new Date(pinStatus.pinSetAt).toLocaleDateString('si-LK')}
            </span>
          )}
          <button
            className={`btn btn-sm ${pinStatus.pinSet ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => setShowPinSetup(v => !v)}
          >
            {pinStatus.pinSet ? '🔧 PIN Change කරන්න' : '🔐 PIN Set කරන්න'}
          </button>
        </div>

        {!pinStatus.pinSet && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: 'var(--clr-accent)', marginBottom: '0.75rem' }}>
            ⚠️ ඔබ PIN Set නොකළ විට, Settings/Staff/Cheques Tabs ක්ලික් කිරීමේදී PIN Setup Page ස්වයංක්‍රීයව විවෘත වේ. දැනම Set කරන්න.
          </div>
        )}

        {showPinSetup && (
          <form onSubmit={handleSetPin} style={{ background: 'var(--clr-bg)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--clr-border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.88rem' }}>
              {pinStatus.pinSet ? '🔄 PIN Change' : '🆕 නව PIN Set'}
            </div>

            {pinStatus.pinSet && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
                  PIN change කිරීමට — වත්මන් PIN <strong>හෝ</strong> Password ඇතුළත් කරන්න:
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>වත්මන් PIN (4 digits)</label>
                    <input
                      type={showPinValues ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      value={pinForm.currentPin}
                      onChange={e => setPin('currentPin', e.target.value.replace(/\D/g, '').slice(0,4))}
                      placeholder="••••"
                    />
                  </div>
                  <div className="form-group">
                    <label>වත්මන් Login Password</label>
                    <input
                      type={showPinValues ? 'text' : 'password'}
                      value={pinForm.currentPassword}
                      onChange={e => setPin('currentPassword', e.target.value)}
                      placeholder="(PIN නොමතකනම් Password)"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>නව PIN (ඉලක්කම් 4ක්) *</label>
                <input
                  type={showPinValues ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={pinForm.newPin}
                  onChange={e => setPin('newPin', e.target.value.replace(/\D/g, '').slice(0,4))}
                  placeholder="0000"
                  required
                />
              </div>
              <div className="form-group">
                <label>නව PIN නැවත ඇතුළත් කරන්න *</label>
                <input
                  type={showPinValues ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={pinForm.confirmPin}
                  onChange={e => setPin('confirmPin', e.target.value.replace(/\D/g, '').slice(0,4))}
                  placeholder="0000"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={showPinValues} onChange={e => setShowPinValues(e.target.checked)} />
                PIN values පෙන්වන්න
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPinSetup(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={pinLoading}>
                {pinLoading ? '⏳...' : '🔐 PIN Save'}
              </button>
            </div>
          </form>
        )}
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
                type="number" min="0" max="50" step="0.5"
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
                type="number" min="1"
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

        {/* ── Gemini AI API ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={styles.sectionHead}>🤖 Gemini AI API Key (Invoice OCR)</div>
          <div style={styles.sectionSub}>
            Invoice Photo OCR (බිල්පත් ඡායාරූප කියවීම) සඳහා Google AI Studio Gemini 1.5 Flash API Key. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--clr-primary)' }}>API Key ලබා ගන්න →</a>
          </div>
          <div className="form-group">
            <label>Gemini API Key</label>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={e => set('geminiApiKey', e.target.value.trim())}
              placeholder="AIza..."
              autoComplete="off"
            />
            {settings.geminiApiKey && (
              <div style={{ fontSize: '0.75rem', color: 'var(--clr-success)', marginTop: '0.3rem' }}>
                ✅ API Key set — OCR Feature ක්‍රියාත්මකයි
              </div>
            )}
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
              <div style={{ fontWeight: 600 }}>WhatsApp Status: {settings.whatsappEnabled ? '🟢 Enabled' : '🔴 Disabled'}</div>
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
          {settings.whatsappEnabled && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Owner/Admin WhatsApp Number (Alert Alert ලැබෙන නිල අංකය)</label>
              <input
                type="tel"
                value={settings.whatsappPhoneNumber}
                onChange={e => set('whatsappPhoneNumber', e.target.value.replace(/[^0-9+]/g, ''))}
                placeholder="+94771234567"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginTop: '0.3rem' }}>
                ⚠️ Country code සමඟ ඇතුළත් කරන්න. උදා: +94771234567 (Sri Lanka)
              </div>
            </div>
          )}
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
