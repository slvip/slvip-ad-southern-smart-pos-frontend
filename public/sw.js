/* AD SOUTHERN SMART POS — Service Worker
 * FIX (Critical Issue #3): the previous offline implementation only synced
 * IndexedDB data while a tab was open and the app explicitly ran a sync
 * function. If the connection came back while the tab was closed/backgrounded,
 * nothing synced. This worker registers a real Background Sync handler so the
 * browser itself wakes the worker up when connectivity returns, even with the
 * tab closed (supported in Chromium-based browsers; falls back gracefully
 * elsewhere — see SYNC_FALLBACK note in offlineSync.js).
 */

const SW_VERSION = 'v1';
const SYNC_TAG = 'pos-offline-sync';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── Background Sync: browser fires this automatically once the device is
   back online, regardless of whether any app tab is open. ── */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(doBackgroundSync());
  }
});

/* ── Periodic Background Sync (where supported) as an extra safety net,
   e.g. for cases where 'sync' didn't fire promptly. ── */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // The worker itself has no auth context / API base URL baked in, so it
  // delegates the actual sync logic back to an open client (app tab) if one
  // exists. If no client is open, it posts a notification so the user knows
  // to reopen the app — true headless sync would additionally require
  // storing the JWT + API URL in the SW's own cache, which is a larger change
  // best done deliberately (security: tokens persisted in SW scope).
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (allClients.length > 0) {
    allClients.forEach((client) => client.postMessage({ type: 'POS_BACKGROUND_SYNC' }));
    return;
  }

  if (self.registration.showNotification) {
    try {
      await self.registration.showNotification('AD SOUTHERN SMART POS', {
        body: 'Internet සම්බන්ධතාවය ආපසු ලැබුණා — sync කිරීමට app එක open කරන්න.',
        tag: 'pos-sync-reminder',
      });
    } catch (_) { /* notifications permission may not be granted */ }
  }
}
