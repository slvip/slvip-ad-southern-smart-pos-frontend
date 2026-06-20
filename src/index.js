// AD SOUTHERN SMART POS — React Entry Point
// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import App from './App';

// ── Security: Disable DevTools & Right-Click (Module 5D Frontend Guard) ──────
// NOTE (Issue #4): this is cosmetic deterrence only — a developer can bypass
// it trivially (disable JS, use external tools, etc). It must NEVER be
// relied on as the actual security boundary. Real authorization is enforced
// server-side via requireAuth/requireAdmin/requireSuperAdmin/requirePinVerified
// middleware in the backend on every sensitive route — see server.js.
// Right-click block
document.addEventListener('contextmenu', (e) => e.preventDefault());

// DevTools keyboard shortcuts block
document.addEventListener('keydown', (e) => {
  const blocked =
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U');
  if (blocked) e.preventDefault();
});

// ── Service Worker + Background Sync (Issue #3) ──────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // Register a Background Sync so pending offline bills/stock
      // adjustments sync automatically once connectivity returns, even if
      // the tab is closed (Chromium-based browsers; other browsers fall
      // back to the existing foreground 'online' event listener already
      // wired in offlineSync.js / App.js).
      if ('sync' in reg) {
        try { await reg.sync.register('pos-offline-sync'); } catch (_) { /* not supported */ }
      }

      // When the SW wakes a closed tab back up / messages an open tab,
      // trigger the existing in-app sync routine.
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'POS_BACKGROUND_SYNC') {
          window.dispatchEvent(new CustomEvent('pos:trigger-sync'));
        }
      });
    } catch (err) {
      console.error('Service worker registration failed:', err);
    }
  });
}

// Re-register the sync whenever the browser regains connectivity, as an
// extra safety net for browsers without full Background Sync support.
window.addEventListener('online', async () => {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      try { await reg.sync.register('pos-offline-sync'); } catch (_) { /* ignore */ }
    }
  }
});

// ── Mount ────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
