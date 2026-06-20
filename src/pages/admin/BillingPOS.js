// AD SOUTHERN SMART POS — Billing / POS  (Module 3 — COMPLETE)
// src/pages/billing/BillingPOS.js
//
// ✅ Features implemented:
//   • USB/Bluetooth Hardware Barcode Scanner (keydown buffer)
//   • QuaggaJS Camera Scanner (CamBarcodeScanner component)
//   • Keyboard Shortcuts: F2 Search | Enter Add | +/- Qty | F4 Hold | F5 Retrieve | Esc Clear | Space Checkout
//   • Hold Bill (F4) + Retrieve Held Bills (F5)
//   • Past Bills Search (Bill # or Date) + Reprint
//   • Checkout Modal: Cash / Card / Transfer + Change Calculator
//   • Cosmetic Savings Display (receipt only — no accounting impact)
//   • Thermal Receipt Print (window.print() with 58mm/80mm layout)
//   • Voice Bill Cutting (Web Speech API — Sinhala/English)
//   • Offline detection + IndexedDB fallback notification
//   • Void Bill with reason + Master Password (Cashier level)
//   • GitHub Pages HashRouter compatible (no browser navigation used)

import React, {
  useState, useEffect, useRef, useCallback, Suspense, lazy,
} from 'react';
import { billingAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  saveOfflineBill, saveOfflineHold, getOfflineHolds, deleteOfflineHold,
  refreshStockSnapshot, searchOfflineItems, getOfflineItemByBarcode,
  decrementOfflineStock, restoreOfflineStock,
} from '../../utils/offlineSync';

// Lazy-load camera scanner to avoid QuaggaJS loading when not needed
const CamBarcodeScanner = lazy(() => import('../../components/CamBarcodeScanner'));

/* ─────────────────────────────────────────────────────────────
   NOTE — MODULE 4 GAP FIX:
   The IndexedDB helpers (saveOfflineBill / saveOfflineHold /
   getOfflineHolds / deleteOfflineHold / item-cache functions) now
   live in a single shared module: src/utils/offlineSync.js.
   Previously this file duplicated its own copies of these
   functions, opened at IndexedDB version 1 with only
   'pendingBills' + 'heldBills' stores — that meant item SEARCH
   and BARCODE lookup and stock DECREMENT had no offline data
   source at all once the network actually dropped (only bill /
   hold queuing worked). offlineSync.js now also owns a v2 schema
   with a 'stockItems' store that mirrors the server's inventory,
   refreshed opportunistically while online and read/written
   locally while offline — see handleSearch / lookupBarcode /
   addToCart / removeFromCart below.
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function BillingPOS() {
  const { user } = useAuth();
  const shopId   = user?.shopId;

  /* ── State ── */
  const [cart,           setCart]           = useState([]);
  const [searchQ,        setSearchQ]        = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [heldBills,      setHeldBills]      = useState([]);
  const [showHeld,       setShowHeld]       = useState(false);
  const [cosmeticRate,   setCosmeticRate]   = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [checkoutOpen,   setCheckoutOpen]   = useState(false);
  const [billDone,       setBillDone]       = useState(null);
  const [pastBillsOpen,  setPastBillsOpen]  = useState(false);
  const [pastBills,      setPastBills]      = useState([]);
  const [pastSearch,     setPastSearch]     = useState('');
  const [pastLoading,    setPastLoading]    = useState(false);
  const [voiceActive,    setVoiceActive]    = useState(false);
  const [camScanOpen,    setCamScanOpen]    = useState(false);
  const [isOffline,      setIsOffline]      = useState(!navigator.onLine);
  const [voidOpen,       setVoidOpen]       = useState(false);
  const [voidBillTarget, setVoidBillTarget] = useState(null);
  const [selectedPastBill, setSelectedPastBill] = useState(null);

  /* ── Refs ── */
  const searchRef     = useRef();
  const barcodeBuffer = useRef('');
  const barcodeTimer  = useRef(null);
  const recognitionRef = useRef(null);

  /* ── Online/Offline tracking ── */
  useEffect(() => {
    const goOnline  = () => {
      setIsOffline(false);
      // MODULE 4 GAP FIX: re-pull the latest stock snapshot the moment
      // connectivity returns, so the offline cache doesn't go stale.
      if (shopId) refreshStockSnapshot(shopId, billingAPI).catch(() => {});
    };
    const goOffline = () => { setIsOffline(true); toast('📴 Offline — Bills IndexedDB ට Save වේ', { icon: '📴' }); };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [shopId]);

  /* ── MODULE 4 GAP FIX: prime the offline item cache as soon as the POS
     screen mounts (while online), so the very first offline sale of the
     day already has a usable local stock mirror — not just after the
     first 'online' event fires later. ── */
  useEffect(() => {
    if (shopId && !isOffline) {
      refreshStockSnapshot(shopId, billingAPI).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  /* ── Load cosmetic rate ── */
  useEffect(() => {
    if (!isOffline) {
      billingAPI.getCosmeticSavingsRate()
        .then(r => setCosmeticRate(r.data.rate || 0))
        .catch(() => {});
    }
  }, [isOffline]);

  /* ─────────────────────────────────────────────────────────
     HARDWARE BARCODE SCANNER (USB/Bluetooth)
     Scans arrive as rapid keystrokes ending with Enter.
     Buffer clears after 100ms idle — distinguishes scanner
     from normal keyboard input.
  ──────────────────────────────────────────────────────────*/
  useEffect(() => {
    const handler = (e) => {
      // If search input is focused, let the default flow handle it
      if (document.activeElement === searchRef.current) return;
      // Modals take precedence — ignore scanner when modal open
      if (checkoutOpen || showHeld || pastBillsOpen || voidOpen) return;

      if (e.key === 'Enter' && barcodeBuffer.current.length > 3) {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        clearTimeout(barcodeTimer.current);
        lookupBarcode(code);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [checkoutOpen, showHeld, pastBillsOpen, voidOpen]);

  /* ─────────────────────────────────────────────────────────
     KEYBOARD SHORTCUTS
  ──────────────────────────────────────────────────────────*/
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger shortcuts when typing in an input/textarea
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'F2')  { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F4')  { e.preventDefault(); if (!inInput) handleHold(); }
      if (e.key === 'F5')  { e.preventDefault(); if (!inInput) openHeldBills(); }
      // MODULE 3 SPEC FIX: Checkout is bound to Spacebar (not F10).
      // Guarded by !inInput so a space typed into the search box or any
      // other input/textarea still types a normal space character.
      if ((e.key === ' ' || e.code === 'Space') && !inInput) {
        e.preventDefault();
        if (cart.length > 0) setCheckoutOpen(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (checkoutOpen)  { setCheckoutOpen(false); return; }
        if (showHeld)      { setShowHeld(false); return; }
        if (pastBillsOpen) { setPastBillsOpen(false); return; }
        if (camScanOpen)   { setCamScanOpen(false); return; }
        if (voidOpen)      { setVoidOpen(false); return; }
        if (cart.length > 0) clearCart();
      }
      // + / - for last item qty when not in input
      if (!inInput && e.key === '+') { e.preventDefault(); if (cart.length > 0) changeQty(cart[cart.length-1]._id, +1); }
      if (!inInput && e.key === '-') { e.preventDefault(); if (cart.length > 0) changeQty(cart[cart.length-1]._id, -1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, checkoutOpen, showHeld, pastBillsOpen, camScanOpen, voidOpen]);

  /* ─────────────────────────────────────────────────────────
     ITEM SEARCH (debounced)
  ──────────────────────────────────────────────────────────*/
  const searchTimer = useRef(null);
  const handleSearch = useCallback((q) => {
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    if (!q || q.length < 1) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      // MODULE 4 GAP FIX: true offline search — read the local stockItems
      // cache instead of hitting the network (which would just fail/hang).
      if (isOffline) {
        try {
          const items = await searchOfflineItems(shopId, q);
          setSearchResults(items);
        } catch { setSearchResults([]); }
        return;
      }
      try {
        const res = await billingAPI.searchItems(q);
        setSearchResults(res.data.items || []);
      } catch { setSearchResults([]); }
    }, 180); // 180ms debounce
  }, [isOffline, shopId]);

  const lookupBarcode = async (code) => {
    // MODULE 4 GAP FIX: offline barcode lookup via local cache.
    if (isOffline) {
      try {
        const item = await getOfflineItemByBarcode(shopId, code);
        if (item) { addToCart(item); toast.success(`✅ ${item.name} — Added (Offline)`); }
        else toast.error(`Barcode ${code} — Item හමු නොවීය (Offline Cache)`);
      } catch { toast.error('Barcode lookup error (Offline)'); }
      return;
    }
    try {
      const res = await billingAPI.getItemByBarcode(code);
      const item = res.data.item;
      if (item) { addToCart(item); toast.success(`✅ ${item.name} — Added`); }
      else toast.error(`Barcode ${code} — Item හමු නොවීය`);
    } catch { toast.error('Barcode lookup error'); }
  };

  /* ─────────────────────────────────────────────────────────
     CART OPERATIONS
  ──────────────────────────────────────────────────────────*/
  const addToCart = (item) => {
    if (item.quantity !== undefined && item.quantity <= 0) {
      toast.error(`${item.name} — Stock නොමැත`); return;
    }
    setCart(prev => {
      const existing = prev.find(c => c._id === item._id);
      if (existing) {
        const newQty = existing.qty + 1;
        if (item.quantity !== undefined && newQty > item.quantity) {
          toast.error(`Stock සීමාව: ${item.quantity}`);
          return prev;
        }
        return prev.map(c => c._id === item._id ? { ...c, qty: newQty } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
    // MODULE 4 GAP FIX: while offline, reserve the unit against the local
    // cache immediately so a second offline sale of the same item in the
    // same shift can't oversell stock that's already sitting in this cart.
    if (isOffline && item._id) {
      decrementOfflineStock(shopId, item._id, 1).catch(() => {});
    }
    setSearchQ('');
    setSearchResults([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const changeQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c._id !== id) return c;
      const newQty = Math.max(1, c.qty + delta);
      if (delta > 0 && c.quantity !== undefined && newQty > c.quantity) {
        toast.error(`Stock සීමාව: ${c.quantity}`); return c;
      }
      // MODULE 4 GAP FIX: keep the offline cache's reserved quantity in
      // sync as the cashier nudges qty up/down with +/-.
      if (isOffline && newQty !== c.qty) {
        const diff = newQty - c.qty; // positive = reserve more, negative = release
        if (diff > 0) decrementOfflineStock(shopId, id, diff).catch(() => {});
        else restoreOfflineStock(shopId, id, -diff).catch(() => {});
      }
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const removed = prev.find(c => c._id === id);
      // MODULE 4 GAP FIX: release the reserved offline stock back to the cache.
      if (isOffline && removed) {
        restoreOfflineStock(shopId, id, removed.qty).catch(() => {});
      }
      return prev.filter(c => c._id !== id);
    });
  };
  const clearCart = () => {
    // MODULE 4 GAP FIX: clearing the cart (Esc) releases all reservations
    // back to the local offline stock cache instead of "losing" the units.
    if (isOffline && cart.length > 0) {
      cart.forEach(c => restoreOfflineStock(shopId, c._id, c.qty).catch(() => {}));
    }
    setCart([]); setBillDone(null);
  };

  /* ── Totals ── */
  const subtotal       = cart.reduce((s, c) => s + c.sellingPrice * c.qty, 0);
  const cosmeticSaving = +(subtotal * cosmeticRate / 100).toFixed(2);
  const total          = subtotal; // Cosmetic savings never reduce actual total

  /* ─────────────────────────────────────────────────────────
     HOLD BILL (F4) — Online: API | Offline: IndexedDB
  ──────────────────────────────────────────────────────────*/
  const handleHold = async () => {
    if (cart.length === 0) { toast.error('Cart හිස්ය'); return; }
    const holdData = { items: cart, subtotal, total, heldAt: new Date().toISOString() };
    try {
      if (isOffline) {
        await saveOfflineHold(shopId, holdData);
        toast.success('📌 Bill Offline Hold කළා (F5 ↩ Retrieve)');
      } else {
        await billingAPI.holdBill(holdData);
        toast.success('📌 Bill Hold කළා (F5 ↩ Retrieve)');
      }
      clearCart();
    } catch { toast.error('Hold Error'); }
  };

  /* ── Load held bills (Online + Offline merged) ── */
  const openHeldBills = async () => {
    let online = [], offline = [];
    try {
      if (!isOffline) {
        const res = await billingAPI.getHeldBills();
        online = (res.data.holds || []).map(h => ({ ...h, source: 'online' }));
      }
    } catch {}
    try {
      const rows = await getOfflineHolds(shopId);
      offline = rows.map(h => ({ ...h, _id: `local_${h.localId}`, source: 'offline' }));
    } catch {}
    setHeldBills([...online, ...offline]);
    setShowHeld(true);
  };

  const retrieveHeld = async (hold) => {
    try {
      if (hold.source === 'offline') {
        setCart(hold.items || []);
        await deleteOfflineHold(shopId, hold.localId);
      } else {
        const res = await billingAPI.retrieveHeldBill(hold._id);
        setCart(res.data.items || []);
      }
      setShowHeld(false);
      toast.success('📂 Bill Retrieve කළා');
    } catch { toast.error('Retrieve Error'); }
  };

  /* ─────────────────────────────────────────────────────────
     CHECKOUT — Online: API | Offline: IndexedDB
  ──────────────────────────────────────────────────────────*/
  const handleCheckout = async (paymentMethod, amountPaid, customerName) => {
    if (cart.length === 0) return;
    setLoading(true);
    const billPayload = {
      items: cart.map(c => ({
        itemId: c._id,
        name:   c.name,
        qty:    c.qty,
        price:  c.sellingPrice,
        unit:   c.unit || '',
        sku:    c.sku  || '',
      })),
      subtotal,
      total,
      cosmeticSaving,
      cosmeticRate,
      paymentMethod,
      amountPaid:    parseFloat(amountPaid),
      change:        Math.max(0, parseFloat(amountPaid) - total),
      customerName:  customerName || '',
      cashierName:   user?.displayName || user?.username,
      createdAt:     new Date().toISOString(),
    };

    try {
      if (isOffline) {
        // Save to IndexedDB and reduce local stock
        await saveOfflineBill(shopId, billPayload);
        const fakeBill = {
          ...billPayload,
          billNumber: `OFF-${Date.now()}`,
          _id: `local_${Date.now()}`,
          isOffline: true,
        };
        setBillDone(fakeBill);
        setCart([]);
        setCheckoutOpen(false);
        toast.success('📴 Offline Bill Saved — Internet ලැබුණු විට Sync වේ');
      } else {
        const res = await billingAPI.createBill(billPayload);
        setBillDone(res.data.bill);
        setCart([]);
        setCheckoutOpen(false);
        toast.success(`🧾 Bill #${res.data.bill.billNumber} නිකුත් කළා`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout Error');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     PAST BILLS SEARCH
  ──────────────────────────────────────────────────────────*/
  const loadPastBills = async () => {
    setPastLoading(true);
    try {
      const res = await billingAPI.getBills({ search: pastSearch, limit: 40 });
      setPastBills(res.data.bills || []);
    } catch { toast.error('Past Bills ලෝඩ් error'); }
    finally { setPastLoading(false); }
  };

  /* ─────────────────────────────────────────────────────────
     VOID BILL
  ──────────────────────────────────────────────────────────*/
  const handleVoid = async (billId, reason, masterPassword) => {
    try {
      await billingAPI.voidBill(billId, { reason, masterPassword });
      toast.success('🗑 Bill Void කළා — WhatsApp Alert යවන ලදී');
      setVoidOpen(false);
      setVoidBillTarget(null);
      loadPastBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Void Error');
    }
  };

  /* ─────────────────────────────────────────────────────────
     VOICE BILL CUTTING (Web Speech API)
  ──────────────────────────────────────────────────────────*/
  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice recognition supported නැත (Chrome use කරන්න)'); return;
    }
    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.lang              = 'si-LK';
    r.continuous        = false;
    r.interimResults    = false;
    r.maxAlternatives   = 3;

    r.onresult = async (e) => {
      // Try all alternatives for best match
      for (let i = 0; i < e.results[0].length; i++) {
        const transcript = e.results[0][i].transcript.trim();
        toast(`🎙 Voice: "${transcript}"`, { icon: '🎙' });
        try {
          const res = await billingAPI.searchItems(transcript);
          if (res.data.items?.[0]) { addToCart(res.data.items[0]); return; }
        } catch {}
      }
      toast.error('Voice — Item හමු නොවීය');
    };
    r.onerror = (e) => { toast.error(`Voice Error: ${e.error}`); setVoiceActive(false); };
    r.onend   = () => setVoiceActive(false);
    r.start();
    recognitionRef.current = r;
    setVoiceActive(true);
    toast('🎙 කතා කරන්න...', { duration: 2500 });
  };

  /* ─────────────────────────────────────────────────────────
     PRINT RECEIPT
  ──────────────────────────────────────────────────────────*/
  const printReceipt = (bill) => {
    const html = generateReceiptHTML(bill, user?.shop, cosmeticSaving, cosmeticRate);
    const w    = window.open('', '_blank', 'width=420,height=650,toolbar=0,scrollbars=0');
    if (!w) { toast.error('Pop-up blocked — Browser settings allow pop-ups'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={styles.posRoot}>

      {/* ── OFFLINE BANNER ── */}
      {isOffline && (
        <div style={styles.offlineBanner}>
          📴 OFFLINE MODE — Bills IndexedDB ට Save වේ | Internet ලැබුණු විට Auto Sync
        </div>
      )}

      <div style={styles.posLayout}>

        {/* ════════════════════════════════════════════════════
            LEFT PANEL — Search + Cart
        ════════════════════════════════════════════════════ */}
        <div style={styles.cartPanel}>

          {/* Search row */}
          <div style={styles.searchRow}>
            <input
              ref={searchRef}
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  e.preventDefault(); addToCart(searchResults[0]);
                }
              }}
              placeholder="🔍 F2 — Item නම, SKU, Barcode ..."
              style={{ flex: 1 }}
              autoFocus
              autoComplete="off"
            />
            <button
              className={`btn btn-sm ${voiceActive ? 'btn-danger' : 'btn-ghost'}`}
              onClick={startVoice}
              title={voiceActive ? 'Stop Voice' : 'Voice Input (සිංහල)'}
              style={{ minWidth: 38 }}
            >
              {voiceActive ? '⏹' : '🎙'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCamScanOpen(true)}
              title="Camera Barcode Scanner (QuaggaJS)"
              style={{ minWidth: 38 }}
            >
              📷
            </button>
          </div>

          {/* Search dropdown */}
          {searchResults.length > 0 && (
            <div style={styles.searchDrop}>
              {searchResults.slice(0, 8).map((item, idx) => (
                <div
                  key={item._id}
                  style={{
                    ...styles.searchItem,
                    background: idx === 0 ? 'rgba(99,102,241,0.06)' : undefined,
                  }}
                  onClick={() => addToCart(item)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--clr-text-muted)' }}>
                      {item.sku} &nbsp;|&nbsp; Stock: {item.quantity ?? '?'} {item.unit}
                      {item.quantity <= 5 && item.quantity > 0 && (
                        <span style={{ color: 'var(--clr-accent)', marginLeft: 6 }}>⚠️ Low</span>
                      )}
                      {item.quantity === 0 && (
                        <span style={{ color: 'var(--clr-danger)', marginLeft: 6 }}>✕ Out of Stock</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--clr-success)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    රු.{Number(item.sellingPrice).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Cart Table ── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛒</div>
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Cart හිස්ය</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-dim)', lineHeight: 1.7 }}>
                  F2 → Search &nbsp;|&nbsp; Enter → Add<br/>
                  F4 Hold &nbsp;|&nbsp; F5 Retrieve &nbsp;|&nbsp; Esc Clear
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--clr-border)' }}>
                    {['Item', 'Qty', 'Price', 'Total', ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right',
                        padding: '0.45rem 0.6rem',
                        color: 'var(--clr-text-muted)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--clr-border)' }}>
                      <td style={{ padding: '0.5rem 0.6rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.69rem', color: 'var(--clr-text-muted)' }}>
                          {item.unit} {item.sku ? `· ${item.sku}` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                          <button style={styles.qtyBtn} onClick={() => changeQty(item._id, -1)}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{item.qty}</span>
                          <button style={styles.qtyBtn} onClick={() => changeQty(item._id, +1)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
                        රු.{Number(item.sellingPrice).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.6rem', fontWeight: 700, color: 'var(--clr-success)' }}>
                        රු.{(item.sellingPrice * item.qty).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.5rem 0.4rem' }}>
                        <button
                          onClick={() => removeFromCart(item._id)}
                          style={{ background: 'none', border: 'none', color: 'var(--clr-danger)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                          title="Remove"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Shortcuts bar */}
          <div style={styles.shortcutsBar}>
            {[
              ['F2','Search'],['Enter','Add'],
              ['+/−','Qty'],['F4','Hold'],
              ['F5','Retrieve'],['Space','Checkout'],['Esc','Clear'],
            ].map(([k, v]) => (
              <span key={k} style={styles.shortcutChip}>
                <kbd style={styles.kbdKey}>{k}</kbd> {v}
              </span>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            RIGHT PANEL — Summary + Actions
        ════════════════════════════════════════════════════ */}
        <div style={styles.summaryPanel}>

          {/* Bill Summary Card */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>
              Bill Summary
            </div>

            <SummaryRow label={`Items (${cart.reduce((s, c) => s + c.qty, 0)})`} value={`රු.${subtotal.toLocaleString()}`} />

            {cosmeticRate > 0 && cart.length > 0 && (
              <SummaryRow
                label={`🎁 ඔබේ ලාභය (${cosmeticRate}%)`}
                value={`රු.${cosmeticSaving.toLocaleString()}`}
                color="var(--clr-success)"
                small
              />
            )}

            <div style={{ borderTop: '2px solid var(--clr-border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>Total</span>
              <span style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--clr-primary)', fontFamily: 'var(--font-mono)' }}>
                රු.{total.toLocaleString()}
              </span>
            </div>

            {/* Item count badge */}
            {cart.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--clr-text-dim)', textAlign: 'right' }}>
                {cart.length} line item{cart.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={cart.length === 0 || loading}
              onClick={() => setCheckoutOpen(true)}
            >
              {loading ? '⏳ Processing...' : '✅ Checkout (Space)'}
            </button>
            <button
              className="btn btn-ghost btn-full"
              onClick={handleHold}
              disabled={cart.length === 0}
            >📌 Hold Bill (F4)</button>
            <button
              className="btn btn-ghost btn-full"
              onClick={openHeldBills}
            >📂 Held Bills (F5)</button>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => { setPastBillsOpen(true); loadPastBills(); }}
            >📋 Past Bills</button>
            <button
              className="btn btn-ghost btn-full"
              style={{ color: 'var(--clr-danger)' }}
              onClick={clearCart}
              disabled={cart.length === 0}
            >🗑 Clear (Esc)</button>
          </div>

          {/* Last bill print box */}
          {billDone && (
            <div style={styles.billDoneBox}>
              <div style={{ fontWeight: 700, color: 'var(--clr-success)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                ✅ Bill #{billDone.billNumber}
                {billDone.isOffline && <span style={{ color: 'var(--clr-accent)', marginLeft: 8, fontSize: '0.75rem' }}>📴 Offline</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
                රු.{billDone.total?.toLocaleString()} — {billDone.paymentMethod}
              </div>
              <button className="btn btn-primary btn-full btn-sm" onClick={() => printReceipt(billDone)}>
                🖨 Print Receipt
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════ */}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <CheckoutModal
          total={total}
          onConfirm={handleCheckout}
          onClose={() => setCheckoutOpen(false)}
          loading={loading}
        />
      )}

      {/* Held Bills Modal */}
      {showHeld && (
        <div className="modal-overlay" onClick={() => setShowHeld(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">📂 Hold කළ Bills (F5)</div>
            {heldBills.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>Hold කළ Bills නොමැත</div>
            ) : heldBills.map((h, i) => (
              <div key={h._id || i} style={styles.heldRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {h.items?.length} items — රු.{h.subtotal?.toLocaleString()}
                    {h.source === 'offline' && <span style={{ color: 'var(--clr-accent)', marginLeft: 8, fontSize: '0.72rem' }}>📴 Offline</span>}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--clr-text-muted)' }}>
                    {new Date(h.heldAt || h.createdAt || h.savedAt).toLocaleTimeString('si-LK')}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => retrieveHeld(h)}>
                  ↩ Retrieve
                </button>
              </div>
            ))}
            <button className="btn btn-ghost btn-full" style={{ marginTop: '1rem' }} onClick={() => setShowHeld(false)}>
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Past Bills Modal */}
      {pastBillsOpen && (
        <div className="modal-overlay" onClick={() => setPastBillsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, width: '95vw' }}>
            <div className="modal-title">📋 Past Bills</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                value={pastSearch}
                onChange={e => setPastSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadPastBills()}
                placeholder="Bill # හෝ Cashier නම සොයන්න..."
                style={{ flex: 1 }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={loadPastBills}>
                🔍
              </button>
            </div>

            {pastLoading ? (
              <div className="empty-state">⏳ Loading...</div>
            ) : pastBills.length === 0 ? (
              <div className="empty-state">Bills හමු නොවීය</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {pastBills.map(b => (
                  <div
                    key={b._id}
                    style={{
                      ...styles.pastBillRow,
                      background: selectedPastBill?._id === b._id ? 'rgba(99,102,241,0.06)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedPastBill(selectedPastBill?._id === b._id ? null : b)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--clr-accent)', fontSize: '0.88rem' }}>
                        #{b.billNumber}
                        {b.isVoided && <span style={{ color: 'var(--clr-danger)', marginLeft: 8, fontSize: '0.72rem' }}>VOID</span>}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--clr-text-muted)' }}>
                        {new Date(b.createdAt).toLocaleString('si-LK')} — {b.cashierName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--clr-success)' }}>
                        රු.{b.total?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{b.paymentMethod}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded bill actions */}
            {selectedPastBill && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--clr-bg)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Bill #{selectedPastBill.billNumber} — Actions
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => printReceipt(selectedPastBill)}>
                    🖨 Print
                  </button>
                  {!selectedPastBill.isVoided && (
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--clr-danger)', border: '1px solid var(--clr-danger)', background: 'none' }}
                      onClick={() => { setVoidBillTarget(selectedPastBill); setVoidOpen(true); }}
                    >
                      🗑 Void Bill
                    </button>
                  )}
                </div>
              </div>
            )}

            <button className="btn btn-ghost btn-full" style={{ marginTop: '1rem' }} onClick={() => setPastBillsOpen(false)}>
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Void Bill Modal */}
      {voidOpen && voidBillTarget && (
        <VoidBillModal
          bill={voidBillTarget}
          onConfirm={handleVoid}
          onClose={() => { setVoidOpen(false); setVoidBillTarget(null); }}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      {camScanOpen && (
        <div className="modal-overlay" onClick={() => setCamScanOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title">📷 Camera Barcode Scanner</div>
            <Suspense fallback={<div className="empty-state">⏳ Scanner Loading...</div>}>
              <CamBarcodeScanner
                onDetected={(code) => {
                  setCamScanOpen(false);
                  lookupBarcode(code);
                }}
                onClose={() => setCamScanOpen(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */

function SummaryRow({ label, value, color, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: small ? '0.82rem' : '0.9rem', color: color || 'var(--clr-text)' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ── Checkout Modal ── */
function CheckoutModal({ total, onConfirm, onClose, loading }) {
  const [method,       setMethod]       = useState('cash');
  const [paid,         setPaid]         = useState('');
  const [customerName, setCustomerName] = useState('');

  const change   = Math.max(0, parseFloat(paid || 0) - total);
  const shortfall = parseFloat(paid || 0) < total;

  const confirm = () => {
    const amt = method === 'cash' ? paid : String(total);
    onConfirm(method, amt, customerName);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-title">💳 Checkout</div>

        {/* Payment method toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[['cash','💵 Cash'],['card','💳 Card'],['transfer','📱 Transfer']].map(([m, label]) => (
            <button
              key={m}
              className={`btn btn-full ${method === m ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: '0.83rem' }}
              onClick={() => setMethod(m)}
            >{label}</button>
          ))}
        </div>

        {/* Total display */}
        <div style={{ background: 'var(--clr-bg)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem' }}>
            <span>Total</span>
            <span style={{ color: 'var(--clr-primary)' }}>රු.{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Cash amount */}
        {method === 'cash' && (
          <>
            <div className="form-group">
              <label>ලැබුණු Cash (රු.)</label>
              <input
                type="number"
                value={paid}
                onChange={e => setPaid(e.target.value)}
                placeholder={`${total}`}
                autoFocus
                min={0}
              />
            </div>
            {paid && !shortfall && (
              <div style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 'var(--radius)',
                padding: '0.85rem 1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>Change (ඉතිරිය)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--clr-success)', fontFamily: 'var(--font-mono)' }}>
                    රු.{change.toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: '2rem' }}>💵</div>
              </div>
            )}
            {paid && shortfall && (
              <div style={{ color: 'var(--clr-danger)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ රු.{(total - parseFloat(paid)).toLocaleString()} අඩු
              </div>
            )}
          </>
        )}

        {/* Optional customer name */}
        <div className="form-group">
          <label>Customer නම (Optional)</label>
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Perera..."
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-ghost btn-full" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary btn-full"
            disabled={loading || (method === 'cash' && (!paid || shortfall))}
            onClick={confirm}
          >
            {loading ? '⏳ Processing...' : '✅ Bill Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Void Bill Modal ── */
function VoidBillModal({ bill, onConfirm, onClose }) {
  const [reason,   setReason]   = useState('');
  const [masterPw, setMasterPw] = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    if (!reason.trim())   { toast.error('Void Reason ඇතුළත් කරන්න'); return; }
    if (!masterPw.trim()) { toast.error('Master Password ඇතුළත් කරන්න'); return; }
    setLoading(true);
    await onConfirm(bill._id, reason, masterPw);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title" style={{ color: 'var(--clr-danger)' }}>🗑 Void Bill #{bill.billNumber}</div>
        <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
          ⚠️ Void කළ Bill නැවත Restore කළ නොහැක. WhatsApp Void Alert ස්වයංක්‍රීයව යවයි.
        </div>
        <div className="form-group">
          <label>Void Reason *</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Customer cancel, Data entry error..."
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Master Password *</label>
          <input
            type="password"
            value={masterPw}
            onChange={e => setMasterPw(e.target.value)}
            placeholder="Master Action Password"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-full" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-full"
            style={{ background: 'var(--clr-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '0.6rem 1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? '⏳...' : '🗑 Void Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RECEIPT HTML GENERATOR  (58mm / 80mm Thermal)
════════════════════════════════════════════════════════════ */
function generateReceiptHTML(bill, shop, cosmeticSaving, cosmeticRate) {
  const shopName    = shop?.settings?.shopDisplayName || shop?.name || 'AD SOUTHERN';
  const footerText  = shop?.settings?.receiptFooter   || 'ස්තූතියි! AD SOUTHERN SMART POS';
  const payLabel    = { cash: 'Cash', card: 'Card', transfer: 'Transfer' }[bill.paymentMethod] || bill.paymentMethod || '';

  const rows = (bill.items || []).map(i => `
    <tr>
      <td style="padding:3px 2px;vertical-align:top">${i.name}</td>
      <td style="text-align:center;padding:3px 2px;white-space:nowrap">${i.qty}${i.unit ? ` ${i.unit}` : ''}</td>
      <td style="text-align:right;padding:3px 2px;white-space:nowrap">Rs.${(i.price * i.qty).toLocaleString()}</td>
    </tr>`).join('');

  const cosmeticLine = (cosmeticSaving > 0 || (bill.cosmeticSaving > 0))
    ? `<div style="text-align:center;color:#059669;font-size:11px;padding:4px 0;border-top:1px dashed #ccc;margin-top:4px">
         🎁 ඔබට ලැබුණු ලාභය: Rs.${(bill.cosmeticSaving || cosmeticSaving).toLocaleString()}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans Sinhala','Noto Sans','Arial Narrow','Arial',sans-serif;font-size:12px;width:280px;margin:0 auto;padding:4px 0}
  .center{text-align:center}
  .bold{font-weight:700}
  .hr{border:none;border-top:1px dashed #555;margin:5px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:2px 2px 4px;border-bottom:1px solid #aaa}
  td{font-size:11.5px;vertical-align:top}
  .total-row td{font-weight:700;font-size:13px;padding-top:5px;border-top:2px solid #333}
  .sub-row td{font-size:11px;color:#555;padding-top:2px}
  .footer{text-align:center;font-size:9.5px;color:#666;margin-top:6px;line-height:1.5}
  @media print{
    @page{margin:2mm;size:80mm auto}
    body{width:100%}
  }
</style>
</head><body>
<div class="center bold" style="font-size:15px;letter-spacing:.02em">${shopName}</div>
<div class="center" style="font-size:9.5px;color:#666">AD SOUTHERN SMART POS</div>
<hr class="hr"/>
<div style="font-size:11px;line-height:1.7">
  <div>Bill&nbsp;#: <strong>${bill.billNumber}</strong></div>
  <div>Date: ${new Date(bill.createdAt).toLocaleString('si-LK')}</div>
  <div>Cashier: ${bill.cashierName || '—'}</div>
  ${bill.customerName ? `<div>Customer: ${bill.customerName}</div>` : ''}
</div>
<hr class="hr"/>
<table>
  <thead>
    <tr>
      <th style="text-align:left">Item</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<hr class="hr"/>
<table>
  <tr class="total-row">
    <td>TOTAL</td>
    <td style="text-align:right">Rs.${bill.total?.toLocaleString()}</td>
  </tr>
  ${bill.paymentMethod ? `<tr class="sub-row"><td>${payLabel}</td><td style="text-align:right">${bill.amountPaid ? `Rs.${bill.amountPaid.toLocaleString()}` : ''}</td></tr>` : ''}
  ${bill.change > 0 ? `<tr class="sub-row"><td>Change</td><td style="text-align:right">Rs.${bill.change.toLocaleString()}</td></tr>` : ''}
</table>
${cosmeticLine}
<hr class="hr"/>
<div class="footer">${footerText}</div>
<div style="margin-top:8px"></div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
const styles = {
  posRoot: { display: 'flex', flexDirection: 'column', height: '100%' },
  offlineBanner: {
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.4)',
    color: 'var(--clr-accent)',
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '0.45rem 1rem',
    borderRadius: 'var(--radius)',
    marginBottom: '0.75rem',
    textAlign: 'center',
  },
  posLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '1.25rem',
    flex: 1,
    minHeight: 0,
  },
  cartPanel: {
    background: 'var(--clr-surface)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflow: 'hidden',
    minHeight: 0,
  },
  summaryPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    overflowY: 'auto',
  },
  searchRow: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  searchDrop: {
    background: 'var(--clr-bg)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    maxHeight: 280,
    overflowY: 'auto',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  searchItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.85rem',
    cursor: 'pointer',
    borderBottom: '1px solid var(--clr-border)',
    transition: 'background 0.1s',
  },
  qtyBtn: {
    width: 28, height: 28,
    background: 'var(--clr-bg)',
    border: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--clr-text)',
    fontWeight: 700,
    fontSize: '0.95rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  shortcutsBar: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--clr-border)',
  },
  shortcutChip: {
    fontSize: '0.68rem',
    color: 'var(--clr-text-dim)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  kbdKey: {
    background: 'var(--clr-bg)',
    border: '1px solid var(--clr-border)',
    borderBottom: '2px solid var(--clr-border)',
    borderRadius: 3,
    padding: '1px 4px',
    fontSize: '0.67rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--clr-text)',
  },
  billDoneBox: {
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 'var(--radius)',
    padding: '0.85rem',
    marginTop: '1rem',
  },
  heldRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 0', borderBottom: '1px solid var(--clr-border)',
  },
  pastBillRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.6rem 0.5rem',
    borderBottom: '1px solid var(--clr-border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'background 0.1s',
  },
};
