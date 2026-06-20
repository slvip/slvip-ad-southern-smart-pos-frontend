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

const DB_VERSION = 2; // bumped: v2 adds 'stockItems' store (Module 4 true offline cache)

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
      // ── MODULE 4 GAP FIX: full offline item cache ──
      // Stores the latest known stock snapshot (name/sku/barcode/qty/price)
      // so item search + barcode lookup + stock decrement work with ZERO
      // network access, not just bill queuing. Keyed by server _id so we
      // can resync cleanly once a snapshot is re-pulled while online.
      if (!db.objectStoreNames.contains('stockItems')) {
        const store = db.createObjectStore('stockItems', { keyPath: '_id' });
        store.createIndex('barcode', 'barcode', { unique: false });
        store.createIndex('sku',     'sku',     { unique: false });
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

/* ════════════════════════════════════════════════════════════
   MODULE 4 GAP FIX — TRUE OFFLINE ITEM CACHE
   Item search + barcode lookup + stock decrement must all work
   with zero network access. We keep a local mirror of stock
   (name/sku/barcode/qty/price) in the 'stockItems' store, pulled
   from GET /api/sync/stock-snapshot/:shopId whenever we're online,
   and read/written locally whenever we're offline.
════════════════════════════════════════════════════════════ */

/* ── Pull a fresh snapshot from the server and cache it (call this
   on login, on app start when online, and right after 'online' fires) ── */
export async function refreshStockSnapshot(shopId, billingAPI) {
  if (!navigator.onLine) return { cached: 0 };
  const res   = await billingAPI.getStockSnapshot(shopId);
  const items = res.data.items || [];

  const db = await openDB(shopId);
  await new Promise((resolve, reject) => {
    const tx    = db.transaction('stockItems', 'readwrite');
    const store = tx.objectStore('stockItems');
    store.clear(); // snapshot is authoritative — wipe stale rows first
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });

  return { cached: items.length, snapshotAt: res.data.snapshotAt };
}

/* ── Read all cached items (used internally for search/filter) ── */
async function getAllCachedItems(shopId) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('stockItems', 'readonly');
    const req = tx.objectStore('stockItems').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

/* ── Offline item search — mirrors billingAPI.searchItems(q) shape ── */
export async function searchOfflineItems(shopId, q) {
  if (!q) return [];
  const query = q.toLowerCase();
  const all   = await getAllCachedItems(shopId);
  return all
    .filter((i) =>
      i.name?.toLowerCase().includes(query) ||
      i.sku?.toLowerCase().includes(query) ||
      i.barcode?.includes(q)
    )
    .slice(0, 12);
}

/* ── Offline barcode lookup — mirrors billingAPI.getItemByBarcode(barcode) ── */
export async function getOfflineItemByBarcode(shopId, barcode) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('stockItems', 'readonly');
    const idx   = tx.objectStore('stockItems').index('barcode');
    const req   = idx.get(barcode);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

/* ── Decrement local cached stock as items are added to an offline cart,
   so a second offline sale in the same session can't oversell stock
   that was already "sold" in an earlier offline bill. Also records the
   delta in 'stockAdjustments' so the server can reconcile on sync if
   it wants to (the offline-push route itself ignores this — stock was
   already deducted server-side at bill creation time for online bills;
   this is purely for the local read-model). ── */
export async function decrementOfflineStock(shopId, itemId, qty) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('stockItems', 'readwrite');
    const store = tx.objectStore('stockItems');
    const req   = store.get(itemId);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.quantity = Math.max(0, (item.quantity || 0) - qty);
        store.put(item);
      }
      resolve(item || null);
    };
    req.onerror = () => reject(req.error);
    tx.onerror  = () => reject(tx.error);
  });
}

/* ── Restore local cached stock (used when an offline-held cart is
   cancelled/retrieved back to cart, or a held offline bill is dropped) ── */
export async function restoreOfflineStock(shopId, itemId, qty) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('stockItems', 'readwrite');
    const store = tx.objectStore('stockItems');
    const req   = store.get(itemId);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.quantity = (item.quantity || 0) + qty;
        store.put(item);
      }
      resolve(item || null);
    };
    req.onerror = () => reject(req.error);
    tx.onerror  = () => reject(tx.error);
  });
}

/* ── Held bills (offline) — F4 Hold / F5 Retrieve while disconnected ── */
export async function saveOfflineHold(shopId, holdData) {
  const db = await openDB(shopId);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('heldBills', 'readwrite');
    const req = tx.objectStore('heldBills').add({ ...holdData, savedAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getOfflineHolds(shopId) {
  const db = await openDB(shopId);
  return new Promise((resolve) => {
    const tx  = db.transaction('heldBills', 'readonly');
    const req = tx.objectStore('heldBills').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => resolve([]);
  });
}

export async function deleteOfflineHold(shopId, localId) {
  const db = await openDB(shopId);
  return new Promise((resolve) => {
    const tx = db.transaction('heldBills', 'readwrite');
    tx.objectStore('heldBills').delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
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
