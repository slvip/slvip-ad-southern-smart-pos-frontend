// AD SOUTHERN SMART POS — PIN Modal (Layer 2 Action PIN)
// src/components/shared/PinModal.js

import React, { useState, useRef, useEffect } from 'react';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * PinModal: blocks access to sensitive tabs until the 4-digit Action PIN is entered.
 * Usage: <PinModal open={open} onSuccess={handleSuccess} onClose={handleClose} label="Ghost Portal" />
 */
export default function PinModal({ open, onSuccess, onClose, label = 'සංවේදී ෆීචර්' }) {
  const [pins, setPins]     = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const inputRefs           = useRef([]);

  useEffect(() => {
    if (open) {
      setPins(['', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pins];
    next[idx] = val;
    setPins(next);
    if (val && idx < 3) inputRefs.current[idx + 1]?.focus();
    // Auto-submit when 4 digits filled
    if (val && idx === 3) {
      const full = next.join('');
      if (full.length === 4) submitPin(full);
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pins[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const submitPin = async (pin) => {
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verifyPin(pin);
      if (res.data.success) {
        toast.success('PIN සාර්ථකව තහවුරු කළා');
        // FIX (Issue #7): persist pinToken so api.js automatically attaches
        // it as `x-pin-token` on subsequent requests to PIN-protected routes.
        if (res.data.pinToken) sessionStorage.setItem('pos_pin_token', res.data.pinToken);
        onSuccess(res.data.pinToken);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'PIN වැරදියි';
      setError(msg);
      setPins(['', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    const pin = pins.join('');
    if (pin.length !== 4) { setError('PIN ඉලක්කම් 4ක් ඇතුළත් කරන්න'); return; }
    submitPin(pin);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:360, textAlign:'center'}}>
        <div style={{fontSize:'2rem', marginBottom:'0.5rem'}}>🔐</div>
        <div className="modal-title" style={{justifyContent:'center'}}>
          Action PIN අවශ්‍යයි
        </div>
        <p style={{color:'var(--clr-text-muted)', fontSize:'0.85rem', marginBottom:'0.5rem'}}>
          <strong style={{color:'var(--clr-accent)'}}>{label}</strong> ප්‍රවේශ කිරීමට ඔබේ 4-ඉලක්කම් PIN ඇතුළත් කරන්න
        </p>

        <div className="pin-inputs">
          {pins.map((p, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              className="pin-input"
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={p}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
            />
          ))}
        </div>

        {error && (
          <p style={{color:'var(--clr-danger)', fontSize:'0.82rem', marginBottom:'0.75rem'}}>
            ⚠️ {error}
          </p>
        )}

        <div style={{display:'flex', gap:'0.75rem', marginTop:'0.5rem'}}>
          <button className="btn btn-ghost btn-full" onClick={onClose} disabled={loading}>
            අවලංගු කරන්න
          </button>
          <button className="btn btn-primary btn-full" onClick={handleManualSubmit} disabled={loading}>
            {loading ? '...' : 'තහවුරු කරන්න'}
          </button>
        </div>
      </div>
    </div>
  );
}