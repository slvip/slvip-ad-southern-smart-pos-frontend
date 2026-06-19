// AD SOUTHERN SMART POS — Login Page (Module 1: Layer 1 Security)
// src/pages/LoginPage.js
// FIX: Removed incorrect '/#/' prefix in isAuthenticated redirect (line 24)
//      HashRouter manages the # automatically — '/#/path' causes double-hash.

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]           = useState({ username: '', password: '' });
  const [loading, setLoading]     = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [showPwd, setShowPwd]     = useState(false);
  const timerRef = useRef(null);
  const userRef  = useRef(null);

  // Redirect if already logged in
  // FIX: was '/#/super-admin' / '/#/dashboard' — wrong with HashRouter
  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.role === 'super_admin' ? '/super-admin' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Countdown timer for lock
  useEffect(() => {
    if (lockTimer > 0) {
      timerRef.current = setTimeout(() => setLockTimer(t => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [lockTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockTimer > 0) return;
    if (!form.username.trim() || !form.password) {
      toast.error('Username සහ Password ඇතුළත් කරන්න');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(form.username.trim(), form.password);
      toast.success(`ආයුබෝවන්, ${userData.displayName}!`);

      if (userData.role === 'super_admin') navigate('/super-admin');
      else navigate('/dashboard');

    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'LOGIN_LOCKED') {
        setLockTimer(data.retryAfter || 300);
        toast.error('ගිණුම අගුළු දමා ඇත. මිනිත්තු 5කින් නැවත උත්සාහ කරන්න.');
      } else {
        if (data?.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft);
        toast.error(data?.message || 'Login අසාර්ථකයි');
        userRef.current?.classList.add('shake');
        setTimeout(() => userRef.current?.classList.remove('shake'), 500);
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const isLocked = lockTimer > 0;

  return (
    <div style={styles.page}>
      <div style={styles.gridBg} aria-hidden="true" />

      <div style={styles.container}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logoBox}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6"/>
              <path d="M8 10h16M8 16h10M8 22h13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="3" fill="#f59e0b"/>
            </svg>
          </div>
          <div>
            <div style={styles.brandName}>AD SOUTHERN</div>
            <div style={styles.brandSub}>SMART POS</div>
          </div>
        </div>

        {/* Card */}
        <div className="card" style={styles.card} ref={userRef}>
          <h1 style={styles.title}>පද්ධතියට ලොගින් වන්න</h1>
          <p style={styles.subtitle}>ඔබේ Credentials ඇතුළත් කරන්න</p>

          {isLocked && (
            <div style={styles.lockBanner}>
              <span style={{fontSize:'1.2rem'}}>🔒</span>
              <div>
                <div style={{fontWeight:700}}>ගිණුම තාවකාලිකව අගුළු දමා ඇත</div>
                <div style={{fontSize:'0.82rem', opacity:0.8}}>
                  {fmtTime(lockTimer)} කින් නැවත උත්සාහ කරන්න
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isLocked || loading}
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="ඔබේ username"
              />
            </div>

            <div className="form-group" style={{position:'relative'}}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isLocked || loading}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                style={{paddingRight:'2.5rem'}}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
                aria-label="Show password"
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>

            {!isLocked && attemptsLeft < 5 && attemptsLeft > 0 && (
              <p style={styles.attemptsWarn}>
                ⚠️ අවවාදය: {attemptsLeft} වාරයකින් ගිණුම අගුළු දැමේ
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLocked || loading}
              style={{marginTop:'0.5rem'}}
            >
              {loading ? (
                <>
                  <span className="animate-spin" style={{display:'inline-block',width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%'}} />
                  පරීක්ෂා කරනවා...
                </>
              ) : isLocked ? (
                `🔒 ${fmtTime(lockTimer)}`
              ) : (
                '➜ ලොගින් වන්න'
              )}
            </button>
          </form>
        </div>

        <div style={styles.footer}>
          <div className="live-dot" />
          <span style={{color:'var(--clr-text-dim)', fontSize:'0.78rem'}}>
            AD SOUTHERN SMART POS v1.0 — Module 1
          </span>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-8px)}
          75%{transform:translateX(8px)}
        }
        .shake { animation: shake 0.4s ease; }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'fixed', inset: 0, zIndex: 0,
    backgroundImage: `
      linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  container: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: '400px',
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    justifyContent: 'center',
  },
  logoBox: {
    width: 48, height: 48,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: {
    fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.08em',
    color: 'var(--clr-text)',
    fontFamily: 'Inter, sans-serif',
  },
  brandSub: {
    fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.15em',
    color: 'var(--clr-primary)',
    fontFamily: 'Inter, sans-serif',
  },
  card: { padding: '2rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginBottom: '1.5rem' },
  lockBanner: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: 'var(--clr-danger)',
  },
  attemptsWarn: {
    fontSize: '0.8rem', color: 'var(--clr-accent)',
    background: 'rgba(245,158,11,0.1)',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '0.5rem',
  },
  eyeBtn: {
    position: 'absolute', right: '0.7rem', top: '2rem',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem',
  },
};
