// AD SOUTHERN SMART POS — API Client (Choreo Production Version)
// src/utils/api.js
//
// Single Axios instance — auto-attaches Bearer token, handles 401 globally.
// Grouped exports: authAPI, adminAPI, billingAPI, superAdminAPI
//
// ── FIX LOG ───────────────────────────────────────────────────────────────
// FIX 1: adminAPI.financialMatrix → /admin/finance/matrix
// FIX 2: superAdminAPI.updateTier added
// FIX 3: superAdminAPI.updateUser added
// FIX 4: superAdminAPI.resetUserPwd → resetUserPassword (name fix)
// FIX 5: authAPI.changePassword → /auth/change-password (route now exists)
// FIX 6: timeout 10000ms (Choreo always-on — cold-start නෑ)
// FIX 7: BASE_URL — REACT_APP_API_URL env var (GitHub Actions secret)
// FIX 8: timeout 10000ms → 30000ms — log data confirmed Choreo Development
//        environment can take 9-10s+ to respond on first contact after idle
//        (gateway cold path / pod wake), which was exceeding the old 10s
//        axios timeout and disconnecting client-side before any response
//        arrived. Backend itself responds in 10-20ms once reached.
// ──────────────────────────────────────────────────────────────────────────

import axios from 'axios';

/* ── Base URL ──────────────────────────────────────────────────────────────
   Dev  : http://localhost:8080/api  (.env.local හි REACT_APP_API_URL set කරන්න)
   Prod : Choreo endpoint — GitHub Actions secret REACT_APP_API_URL set කරන්න
          Format: https://<uuid>.e1-us-east-azure.choreoapis.dev/api
          Choreo Console → Component → Endpoints → Public URL + /api
────────────────────────────────────────────────────────────────────────── */
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // FIX 8: 10s was too short for Choreo Dev env response times
  headers: { 'Content-Type': 'application/json' },
});

/* ── Request interceptor: attach Bearer token ── */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pos_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

/* ── Response interceptor: handle 401 globally ── */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      sessionStorage.removeItem('sa_ghost_active');
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   AUTH API
══════════════════════════════════════════════════════════════════════════ */
export const authAPI = {
  login:          (data)  => api.post('/auth/login', data),
  logout:         ()      => api.post('/auth/logout'),
  me:             ()      => api.get('/auth/me'),
  verifyPin:      (pin)   => api.post('/auth/verify-pin', { pin }),
  changePassword: (data)  => api.put('/auth/change-password', data),  // FIX 5
};

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN API  (role: admin | manager | cashier)
══════════════════════════════════════════════════════════════════════════ */
export const adminAPI = {

  /* ── Dashboard ── */
  dashboard:       ()           => api.get('/admin/dashboard'),
  financialMatrix: ()           => api.get('/admin/finance/matrix'),  // FIX 1

  /* ── Inventory ── */
  getItems:        (params)     => api.get('/admin/items', { params }),
  getItem:         (id)         => api.get(`/admin/items/${id}`),
  createItem:      (data)       => api.post('/admin/items', data),
  updateItem:      (id, data)   => api.patch(`/admin/items/${id}`, data),
  deleteItem:      (id, data)   => api.delete(`/admin/items/${id}`, { data }),
  ocrInvoice:      (base64)     => api.post('/admin/items/ocr', { image: base64 }),
  bulkImportItems: (items)      => api.post('/admin/items/ocr/bulk-import', { items }),

  /* ── Staff Management ── */
  getStaff:        ()           => api.get('/admin/staff'),
  createStaff:     (data)       => api.post('/admin/staff', data),
  updateStaff:     (id, data)   => api.put(`/admin/staff/${id}`, data),
  deleteStaff:     (id)         => api.delete(`/admin/staff/${id}`),
  resetStaffPin:   (id, data)   => api.put(`/admin/staff/${id}/reset-password`, data),

  /* ── Cheque Manager ── */
  getCheques:          ()       => api.get('/admin/cheques'),
  addReceivedCheque:   (data)   => api.post('/admin/cheques/received', data),
  addIssuedCheque:     (data)   => api.post('/admin/cheques/issued', data),
  markChequeCashed:    (id)     => api.put(`/admin/cheques/${id}/cashed`),
  deleteCheque:        (id)     => api.delete(`/admin/cheques/${id}`),

  /* ── Settings (Choreo-7: geminiApiKey support included) ── */
  getSettings:     ()           => api.get('/admin/settings'),
  updateSettings:  (data)       => api.put('/admin/settings', data),

  /* ── Audit Logs ── */
  getAuditLogs:    (params)     => api.get('/admin/audit', { params }),
};

/* ══════════════════════════════════════════════════════════════════════════
   BILLING API  (role: cashier | manager | admin)
══════════════════════════════════════════════════════════════════════════ */
export const billingAPI = {
  searchItems:            (q)        => api.get('/billing/items/search', { params: { q } }),
  getItemByBarcode:       (barcode)  => api.get('/billing/items/barcode', { params: { barcode } }),
  getCosmeticSavingsRate: ()         => api.get('/billing/settings/cosmetic-rate'),
  createBill:             (data)     => api.post('/billing/bills', data),
  holdBill:               (data)     => api.post('/billing/holds', data),
  getHeldBills:           ()         => api.get('/billing/holds'),
  retrieveHeldBill:       (id)       => api.post(`/billing/holds/${id}/retrieve`),
  getBills:               (params)   => api.get('/billing/bills', { params }),
  getBill:                (id)       => api.get(`/billing/bills/${id}`),
  voidBill:               (id, data) => api.put(`/billing/bills/${id}/void`, data),
  pushOfflineData:        (data)     => api.post('/sync/offline-push', data),  // Module 4
};

/* ══════════════════════════════════════════════════════════════════════════
   SUPER ADMIN API  (role: super_admin only)
══════════════════════════════════════════════════════════════════════════ */
export const superAdminAPI = {

  /* ── Dashboard ── */
  dashboard:     ()            => api.get('/super-admin/dashboard'),

  /* ── Shops ── */
  getShops:      (params)      => api.get('/super-admin/shops', { params }),
  getShop:       (id)          => api.get(`/super-admin/shops/${id}`),
  createShop:    (data)        => api.post('/super-admin/shops', data),
  updateShop:    (id, data)    => api.put(`/super-admin/shops/${id}`, data),
  deleteShop:    (id, data)    => api.delete(`/super-admin/shops/${id}`, { data }),
  toggleShop:    (id)          => api.put(`/super-admin/shops/${id}/toggle`),
  updateTier:    (id, tier)    => api.patch(`/super-admin/shops/${id}/tier`, { stockTier: tier }),     // FIX 2
  updateGeminiKey: (id, key)   => api.patch(`/super-admin/shops/${id}/gemini-key`, { geminiApiKey: key }), // Choreo-6

  /* ── Users (global) ── */
  getUsers:      (params)      => api.get('/super-admin/users', { params }),
  createUser:    (data)        => api.post('/super-admin/users', data),
  deleteUser:    (id, data)    => api.delete(`/super-admin/users/${id}`, { data }),
  updateUser:    (id, data)    => api.patch(`/super-admin/users/${id}`, data),         // FIX 3
  resetUserPassword: (id, data) => api.put(`/super-admin/users/${id}/reset-password`, data), // FIX 4

  /* ── Ghost Portal ── */
  ghostLogin:    (shopId)      => api.post(`/super-admin/ghost/${shopId}`),

  /* ── Audit Logs (global) ── */
  getAuditLogs:    (params)    => api.get('/super-admin/audit', { params }),
  exportAuditLogs: (params)    => api.get('/super-admin/audit/export', { params, responseType: 'blob' }),
};

export default api;