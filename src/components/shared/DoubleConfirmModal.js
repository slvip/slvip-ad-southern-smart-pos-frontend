// AD SOUTHERN SMART POS — Double Confirm Modal
// src/components/shared/DoubleConfirmModal.js

import React, { useState } from 'react';

/**
 * DoubleConfirmModal: requires user to type "YES" to confirm destructive actions.
 * Usage: <DoubleConfirmModal open={open} title="..." body="..." onConfirm={fn} onClose={fn} />
 */
export default function DoubleConfirmModal({ open, title, body, onConfirm, onClose, requiresMasterPwd = false }) {
  const [typed, setTyped]       = useState('');
  const [masterPwd, setMasterPwd] = useState('');
  const [loading, setLoading]   = useState(false);

  if (!open) return null;

  const isReady = typed === 'YES' && (!requiresMasterPwd || masterPwd.length >= 8);

  const handleConfirm = async () => {
    if (!isReady) return;
    setLoading(true);
    await onConfirm({ confirmation: 'YES', masterPassword: masterPwd });
    setLoading(false);
    setTyped('');
    setMasterPwd('');
  };

  const handleClose = () => {
    setTyped('');
    setMasterPwd('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title" style={{color:'var(--clr-danger)'}}>
          ⚠️ {title}
        </div>

        <p style={{color:'var(--clr-text-muted)', fontSize:'0.9rem', marginBottom:'1.25rem'}}>
          {body}
        </p>

        <div style={{
          background:'rgba(239,68,68,0.08)',
          border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:'var(--radius)',
          padding:'1rem',
          marginBottom:'1.25rem',
        }}>
          <p style={{fontSize:'0.82rem', color:'var(--clr-danger)', marginBottom:'0.6rem'}}>
            ✍️ තහවුරු කිරීමට <strong>"YES"</strong> ටයිප් කරන්න:
          </p>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder='YES'
            autoFocus
            style={{
              border: typed === 'YES'
                ? '1.5px solid var(--clr-success)'
                : '1.5px solid var(--clr-border)',
            }}
          />
        </div>

        {requiresMasterPwd && (
          <div className="form-group">
            <label>Master Action Password (Layer 3 Verification)</label>
            <input
              type="password"
              value={masterPwd}
              onChange={e => setMasterPwd(e.target.value)}
              placeholder="ඔබේ Master Key ඇතුළත් කරන්න"
            />
          </div>
        )}

        <div style={{display:'flex', gap:'0.75rem'}}>
          <button className="btn btn-ghost btn-full" onClick={handleClose} disabled={loading}>
            අවලංගු
          </button>
          <button
            className="btn btn-danger btn-full"
            disabled={!isReady || loading}
            onClick={handleConfirm}
          >
            {loading ? 'ක්‍රියාත්මක වෙනවා...' : '🗑 ස්ථිරවම මකන්න'}
          </button>
        </div>
      </div>
    </div>
  );
}