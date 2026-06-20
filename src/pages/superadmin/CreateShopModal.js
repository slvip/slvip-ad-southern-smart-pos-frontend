// AD SOUTHERN SMART POS — Create Shop Modal (Layer 3: Master Action Password)
// src/pages/superadmin/CreateShopModal.js

import React, { useState } from 'react';
import { superAdminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const BUSINESS_CATEGORIES = [
  'Grocery', 'Hardware', 'Pharmacy', 'Electronic', 'Apparel', 'Communication', 'Other',
];
const TIERS = [
  { value: 'micro',      label: 'Micro',            sub: '1,500 items' },
  { value: 'standard',   label: 'Standard Pro',     sub: '15,000 items' },
  { value: 'mega',       label: 'Mega Wholesale',   sub: '60,000 items' },
  { value: 'enterprise', label: 'Enterprise',       sub: 'Unlimited' },
];

const EMPTY = {
  shopName: '', businessCategory: 'Grocery', stockTier: 'standard',
  adminUsername: '', adminPassword: '', adminDisplayName: '', adminPin: '',
  geminiApiKey: '',
  masterPassword: '',
};

export default function CreateShopModal({ open, onClose, onCreated }) {
  const [form, setForm]     = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [step, setStep]     = useState(1); // 1 = shop details, 2 = master pwd confirm
  const [showPwd, setShowPwd] = useState(false);
  const [showPin, setShowPin] = useState(false);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.shopName || !form.adminUsername || !form.adminPassword || !form.adminDisplayName || !form.adminPin) {
      toast.error('සියලු ක්ෂේත්‍ර පුරවන්න'); return;
    }
    if (form.adminPassword.length < 8) {
      toast.error('Admin Password අවම අක්ෂර 8ක් විය යුතුය'); return;
    }
    if (!/^\d{4}$/.test(form.adminPin)) {
      toast.error('Admin PIN ඉලක්කම් 4ක් විය යුතුය'); return;
    }
    setStep(2);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.masterPassword || form.masterPassword.length < 8) {
      toast.error('Master Action Password අවම අක්ෂර 8ක් විය යුතුය'); return;
    }
    setLoading(true);
    try {
      await superAdminAPI.createShop({
        shopName:          form.shopName,
        businessCategory:  form.businessCategory,
        stockTier:         form.stockTier,
        adminUsername:     form.adminUsername,
        adminPassword:     form.adminPassword,
        adminDisplayName:  form.adminDisplayName,
        adminPin:          form.adminPin,
        geminiApiKey:      form.geminiApiKey,
        masterPassword:    form.masterPassword,
      });
      toast.success(`🏪 "${form.shopName}" සාර්ථකව සාදන ලදී!`);
      setForm(EMPTY);
      setStep(1);
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Shop සෑදීම අසාර්ථකයි');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY);
    setStep(1);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-title">
          🏪 නව Shop සෑදීම
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--clr-text-muted)', fontWeight: 400 }}>
            Step {step} / 2
          </span>
        </div>

        {/* Step indicator */}
        <div style={styles.stepBar}>
          {['Shop විස්තර', 'Layer 3 Verify'].map((s, i) => (
            <div key={i} style={{
              ...styles.stepItem,
              color: step > i ? 'var(--clr-success)' : step === i + 1 ? 'var(--clr-primary)' : 'var(--clr-text-dim)',
            }}>
              <div style={{
                ...styles.stepDot,
                background: step > i ? 'var(--clr-success)' : step === i + 1 ? 'var(--clr-primary)' : 'var(--clr-border)',
              }}>{step > i ? '✓' : i + 1}</div>
              <span style={{ fontSize: '0.78rem' }}>{s}</span>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1}>
            <div className="form-group">
              <label>Shop නම *</label>
              <input value={form.shopName} onChange={e => set('shopName', e.target.value)} placeholder="Perera Store" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ව්‍යාපාර කාණ්ඩය *</label>
                <select value={form.businessCategory} onChange={e => set('businessCategory', e.target.value)}>
                  {BUSINESS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Stock Tier *</label>
                <select value={form.stockTier} onChange={e => set('stockTier', e.target.value)}>
                  {TIERS.map(t => <option key={t.value} value={t.value}>{t.label} — {t.sub}</option>)}
                </select>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--clr-border)', margin: '1rem 0', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
                👤 Admin Account Details
              </div>
              <div className="form-group">
                <label>Admin Display Name *</label>
                <input value={form.adminDisplayName} onChange={e => set('adminDisplayName', e.target.value)} placeholder="Kamal Perera" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Admin Username *</label>
                  <input value={form.adminUsername} onChange={e => set('adminUsername', e.target.value)} placeholder="kamal_perera" />
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Admin Password *</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.adminPassword}
                    onChange={e => set('adminPassword', e.target.value)}
                    placeholder="min 8 characters"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={styles.eyeBtn}>{showPwd ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div className="form-group" style={{ position: 'relative', maxWidth: 200 }}>
                <label>Admin Action PIN (4 digits) *</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={form.adminPin}
                  onChange={e => set('adminPin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={{ paddingRight: '2.5rem', letterSpacing: '0.2em' }}
                />
                <button type="button" onClick={() => setShowPin(v => !v)} style={styles.eyeBtn}>{showPin ? '🙈' : '👁'}</button>
                <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.3rem' }}>
                  Layer 2 Security PIN — Admin ට පසුව Settings වලින් මෙය වෙනස් කරගත හැක.
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--clr-border)', margin: '1rem 0', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
                🤖 Gemini API Key <span style={{ opacity: 0.7 }}>(Optional)</span>
              </div>
              <div className="form-group">
                <input
                  value={form.geminiApiKey}
                  onChange={e => set('geminiApiKey', e.target.value)}
                  placeholder="AIza... (හිස්ව තැබුවොත් පසුව Settings වලින් දාගත හැක)"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-ghost btn-full" onClick={handleClose}>අවලංගු</button>
              <button type="submit" className="btn btn-primary btn-full">ඊළඟ → Layer 3 Verify</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate}>
            <div style={styles.layer3Box}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔐</div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Layer 3: Master Action Password</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
                Shop සෑදීම නිම කිරීමට ඔබේ Master Key ඇතුළත් කරන්න. මෙය ඔබේ Login Password එකට වෙනස් විශේෂ Key එකකි.
              </div>
            </div>

            <div className="form-group">
              <label>Master Action Password *</label>
              <input
                type="password"
                value={form.masterPassword}
                onChange={e => set('masterPassword', e.target.value)}
                placeholder="ඔබේ Master Key..."
                autoFocus
              />
            </div>

            {/* Summary */}
            <div style={styles.summary}>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>📋 සාරාංශය</div>
              <div style={styles.summaryRow}><span>Shop:</span> <strong>{form.shopName}</strong></div>
              <div style={styles.summaryRow}><span>Category:</span> <strong>{form.businessCategory}</strong></div>
              <div style={styles.summaryRow}><span>Tier:</span> <strong>{TIERS.find(t => t.value === form.stockTier)?.label}</strong></div>
              <div style={styles.summaryRow}><span>Admin:</span> <strong>{form.adminUsername}</strong></div>
              <div style={styles.summaryRow}><span>Admin PIN:</span> <strong>{'•'.repeat(form.adminPin.length || 4)}</strong></div>
              <div style={styles.summaryRow}><span>Gemini Key:</span> <strong>{form.geminiApiKey ? 'සැකසී ඇත' : 'හිස් (පසුව දාගත හැක)'}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => setStep(1)} disabled={loading}>← ආපසු</button>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? '⏳ සාදනවා...' : '✅ Shop සාදන්න'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  stepBar: { display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' },
  stepItem: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  stepDot: {
    width: 24, height: 24, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', fontWeight: 700, color: '#fff',
  },
  layer3Box: {
    background: 'rgba(59,130,246,0.06)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    textAlign: 'center',
    marginBottom: '1.25rem',
  },
  summary: {
    background: 'var(--clr-bg)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem 1rem',
    marginBottom: '1.25rem',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.25rem',
  },
  eyeBtn: {
    position: 'absolute', right: '0.7rem', top: '2rem',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
  },
};
