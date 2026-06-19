// AD SOUTHERN SMART POS — Offline Sync Manager (Module 4)
// src/utils/offlineSync.js
// Features: IndexedDB per-Shop-ID, Service Worker trigger, Auto push on reconnect
//
// ── PATCH LOG ──────────────────────────────────────────────────────────────
// FIX 5: IndexedDB object store name 'bills' → 'pendingBills'
//   BillingPOS.js saves offline bills to store 'pendingBills'.
//   The old name 'bills' caused syncOfflineData() to read from an empty
//   store and never upload anything, silently failing every time.
// ──────────────────────────────────────────────────────────────────────────

const DB_VERSION = 1;

/* ── Open IndexedDB isolated per Shop ID ── */
function openDB(shopId) {
  return new Promise((resolve, reject) => {
    const dbName = `pos_offline_${shopId}`;
    const req = indexedDB.open(dbName, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // FIX 5: store name corrected to 'pendingBills' (matches BillingPOS.js)
      if (!db.objectStoreNames.contains('pendingBills')) {
        db.createObjectStore('pendingBills', { keyPath: 'localId', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('stockAdjustments')) {
        db.createObjectStore('stockAdjustments', { keyPath: 'localId', autoIncrement: true });
      }
      // Keep heldBills store in sync with BillingPOS.js offline hold feature
      if (!db.objectStoreNames.contains('heldBills')) {
        db.createObjectStore('heldBills', { keyPath: 'localId', autoIncrement: true });
      }
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

/* ── Save offline bill ── */
export async function saveOfflineBill(shopId, bill) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    // FIX 5: store name corrected to 'pendingBills'
    const tx = db.transaction('pendingBills', 'readwrite');
    const req = tx.objectStore('pendingBills').add({
      ...bill,
      shopId,
      savedAt: new Date().toISOString(),
      synced: false,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ── Save stock adjustment ── */
export async function saveOfflineStockAdjustment(shopId, adj) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stockAdjustments', 'readwrite');
    const req = tx.objectStore('stockAdjustments').add({
      ...adj,
      shopId,
      savedAt: new Date().toISOString(),
      synced: false,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ── Get all pending (unsynced) bills ── */
export async function getPendingBills(shopId) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    // FIX 5: store name corrected to 'pendingBills'
    const tx  = db.transaction('pendingBills', 'readonly');
    const req = tx.objectStore('pendingBills').getAll();
    req.onsuccess = () => resolve((req.result || []).filter(b => !b.synced));
    req.onerror   = () => reject(req.error);
  });
}

/* ── Get all pending adjustments ── */
export async function getPendingAdjustments(shopId) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('stockAdjustments', 'readonly');
    const req = tx.objectStore('stockAdjustments').getAll();
    req.onsuccess = () => resolve((req.result || []).filter(a => !a.synced));
    req.onerror   = () => reject(req.error);
  });
}

/* ── Mark records as synced ── */
async function markBillsSynced(shopId, localIds) {
  const db = await openDB(shopId);
  for (const lid of localIds) {
    await new Promise((res) => {
      // FIX 5: store name corrected to 'pendingBills'
      const tx  = db.transaction('pendingBills', 'readwrite');
      const req = tx.objectStore('pendingBills').get(lid);
      req.onsuccess = () => {
        const record = req.result;
        if (record) {
          record.synced = true;
          tx.objectStore('pendingBills').put(record);
        }
        res();
      };
    });
  }
}

async function markAdjustmentsSynced(shopId, localIds) {
  const db = await openDB(shopId);
  for (const lid of localIds) {
    await new Promise((res) => {
      const tx  = db.transaction('stockAdjustments', 'readwrite');
      const req = tx.objectStore('stockAdjustments').get(lid);
      req.onsuccess = () => {
        const record = req.result;
        if (record) {
          record.synced = true;
          tx.objectStore('stockAdjustments').put(record);
        }
        res();
      };
    });
  }
}

/* ── Push offline data to server ──
   syncAPI must have a pushOfflineData() method.
   Usage: syncOfflineData(shopId, billingAPI, onProgress)
   (Pass billingAPI from api.js — it now includes pushOfflineData)
── */
export async function syncOfflineData(shopId, syncAPI, onProgress) {
  const bills = await getPendingBills(shopId);
  const adjs  = await getPendingAdjustments(shopId);

  if (bills.length === 0 && adjs.length === 0) return { synced: 0 };

  onProgress?.(`Syncing ${bills.length} bills + ${adjs.length} adjustments...`);

  try {
    const res = await syncAPI.pushOfflineData({
      shopId,
      bills: bills.map(b => ({ ...b, localId: undefined })),
      stockAdjustments: adjs.map(a => ({ ...a, localId: undefined })),
    });

    // Mark synced
    await markBillsSynced(shopId, bills.map(b => b.localId));
    await markAdjustmentsSynced(shopId, adjs.map(a => a.localId));

    onProgress?.(`✅ Sync complete: ${bills.length} bills uploaded`);
    return { synced: bills.length + adjs.length };
  } catch (err) {
    onProgress?.(`❌ Sync failed: ${err.message}`);
    throw err;
  }
}

/* ── Offline-aware bill creator ── */
export async function createBillWithOfflineFallback(shopId, billData, billingAPI) {
  if (navigator.onLine) {
    try {
      const res = await billingAPI.createBill(billData);
      return { bill: res.data.bill, offline: false };
    } catch (err) {
      // Network error — fallback to offline
      if (!err.response) {
        const localId = await saveOfflineBill(shopId, billData);
        return { bill: { ...billData, billNumber: `OFFLINE-${Date.now()}` }, offline: true, localId };
      }
      throw err;
    }
  } else {
    // No internet — save to IndexedDB
    const localId = await saveOfflineBill(shopId, billData);
    return { bill: { ...billData, billNumber: `OFFLINE-${Date.now()}` }, offline: true, localId };
  }
}
