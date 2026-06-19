// AD SOUTHERN SMART POS — Auth Context (Module 1 / Core)
// src/context/AuthContext.js
//
// Provides: isAuthenticated, user, loading, login, logout, isGhost, exitGhost
// Storage  : localStorage (token + user JSON)
// Ghost Mode: Super Admin entering an admin shop — token backed up in sessionStorage

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';

/* ── Context ── */
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/* ── Provider ── */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);   // true until hydration done
  const [isGhost, setIsGhost] = useState(false);  // Super Admin ghost session

  /* ── Hydrate on mount ── */
  useEffect(() => {
    const token    = localStorage.getItem('pos_token');
    const stored   = localStorage.getItem('pos_user');
    const ghostFlag = sessionStorage.getItem('sa_ghost_active');

    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setIsGhost(ghostFlag === 'true');
      } catch {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
      }
    }
    setLoading(false);
  }, []);

  /* ── Login ── */
  const login = useCallback(async (username, password) => {
    const res  = await authAPI.login({ username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_user',  JSON.stringify(u));
    setUser(u);
    setIsGhost(false);
    return u;
  }, []);

  /* ── Logout ── */
  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    sessionStorage.removeItem('sa_ghost_active');
    sessionStorage.removeItem('sa_token_backup');
    sessionStorage.removeItem('sa_user_backup');
    setUser(null);
    setIsGhost(false);
  }, []);

  /* ── Ghost Mode: Super Admin enters a shop ── */
  const enterGhost = useCallback((shopToken, shopUser) => {
    // Back up current SA token & user
    const currentToken = localStorage.getItem('pos_token');
    const currentUser  = localStorage.getItem('pos_user');
    sessionStorage.setItem('sa_token_backup', currentToken || '');
    sessionStorage.setItem('sa_user_backup',  currentUser  || '{}');
    sessionStorage.setItem('sa_ghost_active', 'true');
    // Switch to shop session
    localStorage.setItem('pos_token', shopToken);
    localStorage.setItem('pos_user',  JSON.stringify(shopUser));
    setUser(shopUser);
    setIsGhost(true);
  }, []);

  /* ── Exit Ghost: return to Super Admin session ── */
  const exitGhost = useCallback((saToken, saUser) => {
    localStorage.setItem('pos_token', saToken);
    localStorage.setItem('pos_user',  JSON.stringify(saUser));
    sessionStorage.removeItem('sa_ghost_active');
    sessionStorage.removeItem('sa_token_backup');
    sessionStorage.removeItem('sa_user_backup');
    setUser(saUser);
    setIsGhost(false);
  }, []);

  /* ── Update local user (e.g. after settings save) ── */
  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      const u   = res.data.user;
      localStorage.setItem('pos_user', JSON.stringify(u));
      setUser(u);
    } catch (err) {
      // Token expired — force logout
      if (err.response?.status === 401) {
        toast.error('සැසිය කල් ඉකුත් විය. නැවත Login කරන්න.');
        await logout();
      }
    }
  }, [logout]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isGhost,
    login,
    logout,
    enterGhost,
    exitGhost,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
