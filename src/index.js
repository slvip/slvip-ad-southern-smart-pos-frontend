// AD SOUTHERN SMART POS — React Entry Point
// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import App from './App';

// ── Security: Disable DevTools & Right-Click (Module 5D Frontend Guard) ──────
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

// ── Mount ────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
