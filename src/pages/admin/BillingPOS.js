// AD SOUTHERN SMART POS — Billing / POS  (Module 3 — COMPLETE)
// src/pages/billing/BillingPOS.js
//
// ── FIX LOG ──────────────────────────────────────────────────────────────────
// FIX 1: CheckoutModal — Customer WhatsApp Phone Number field added (SPEC §5B item 60)
//         customerPhone passed to handleCheckout → billPayload → API
// FIX 2: billDone box — "📱 Send via WhatsApp" optional button added (SPEC §5C item 62)
//         Visible only when whatsappEnabled = true in shop settings
//         Calls billingAPI.sendWhatsAppReceipt(billId, phone) — optional, cashier-triggered
// ─────────────────────────────────────────────────────────────────────────────
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
// NOTE: billingAPI.sendWhatsAppReceipt(billId, phone) — FIX 2 (see api.js — add if missing)
// POST /billing/bills/:id/whatsapp  { customerPhone }  — backend Baileys send
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
  // FIX 1 & 2: WhatsApp receipt delivery state
  const [sendingWA,      setSendingWA]      = useState(false);

  // FRACTIONAL ITEM: Quick Weight Pop-up state
  const [weightModal,    setWeightModal]    = useState(null);  // { item } or null
  const [weightInput,    setWeightInput]    = useState('');    // gram input string

  /* ── Refs ── */
  const searchRef     = useRef();
  const barcodeBuffer = useRef('');
  const barcodeTimer  = useRef(null);
  const recognitionRef = useRef(null);
  const weightInputRef = useRef(null);

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
  // FRACTIONAL: kg/l items → show weight popup; normal items → add qty 1
  const addToCart = (item) => {
    if (item.quantity !== undefined && item.quantity <= 0) {
      toast.error(`${item.name} — Stock නොමැත`); return;
    }
    if (item.isFractional) {
      // Show weight selection popup
      setWeightModal(item);
      setWeightInput('');
      setSearchQ('');
      setSearchResults([]);
      setTimeout(() => weightInputRef.current?.focus(), 80);
      return;
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
    if (isOffline && item._id) {
      decrementOfflineStock(shopId, item._id, 1).catch(() => {});
    }
    setSearchQ('');
    setSearchResults([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // FRACTIONAL: quick-button OR manual gram input → confirm weight → add to cart
  const confirmWeight = (kgValue) => {
    const item = weightModal;
    if (!item) return;
    const kg = Math.round(parseFloat(kgValue) * 1000) / 1000; // 3dp
    if (!kg || kg <= 0) { toast.error('බරක් ඇතුළත් කරන්න'); return; }
    if (item.quantity !== undefined && kg > item.quantity) {
      toast.error(`Stock සීමාව: ${item.quantity} kg`); return;
    }
    setCart(prev => {
      const existing = prev.find(c => c._id === item._id);
      if (existing) {
        const newQty = Math.round((existing.qty + kg) * 1000) / 1000;
        return prev.map(c => c._id === item._id ? { ...c, qty: newQty } : c);
      }
      return [...prev, { ...item, qty: kg }];
    });
    if (isOffline && item._id) {
      decrementOfflineStock(shopId, item._id, kg).catch(() => {});
    }
    setWeightModal(null);
    setWeightInput('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // gram input (eg user types "150") → auto-convert to kg (0.150)
  const handleWeightManualInput = (raw) => {
    setWeightInput(raw);
  };
  const handleWeightConfirmManual = () => {
    const raw = parseFloat(weightInput);
    if (!raw || raw <= 0) { toast.error('බරක් ඇතුළත් කරන්න'); return; }
    // If value > 10, assume it's grams → convert to kg
    const kg = raw > 10 ? raw / 1000 : raw;
    confirmWeight(kg);
  };

  const changeQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c._id !== id) return c;
      // Fractional items: step in 50g (0.050) increments; normal: step 1
      const step   = c.isFractional ? 0.050 : 1;
      const minQty = c.isFractional ? 0.050 : 1;
      const newQty = Math.round(Math.max(minQty, c.qty + delta * step) * 1000) / 1000;
      if (delta > 0 && c.quantity !== undefined && newQty > c.quantity) {
        toast.error(`Stock සීමාව: ${c.quantity} ${c.unit || ''}`); return c;
      }
      if (isOffline && newQty !== c.qty) {
        const diff = newQty - c.qty;
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
  const handleCheckout = async (paymentMethod, amountPaid, customerName, customerPhone) => {
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
      customerPhone: customerPhone || '',  // FIX 1: WhatsApp delivery (SPEC §5B item 60)
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
     SEND WHATSAPP RECEIPT (FIX 2 — SPEC §5C item 62)
     Optional — cashier clicks "Send via WhatsApp" button after checkout.
     Backend (Baileys) sends receipt to customerPhone.
  ──────────────────────────────────────────────────────────*/
  const handleSendWhatsApp = async (bill, phone) => {
    if (!phone) { toast.error('WhatsApp Number ඇතුළත් නොවීය'); return; }
    setSendingWA(true);
    try {
      // billingAPI.sendWhatsAppReceipt — POST /billing/bills/:id/whatsapp
      // Falls back gracefully if endpoint not yet deployed
      await billingAPI.sendWhatsAppReceipt?.(bill._id, { customerPhone: phone });
      toast.success(`📱 Receipt WhatsApp ${phone} වෙත යැව්වා`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'WhatsApp Send Error');
    } finally {
      setSendingWA(false);
    }
  };

  /* ── Print Receipt (unchanged) ── */
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
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {item.isFractional && '⚖️ '}{item.name}
                    </div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--clr-text-muted)' }}>
                      {item.sku} &nbsp;|&nbsp; Stock: {item.isFractional ? `${item.quantity} kg` : `${item.quantity ?? '?'} ${item.unit}`}
                      {item.quantity <= 5 && item.quantity > 0 && (
                        <span style={{ color: 'var(--clr-accent)', marginLeft: 6 }}>⚠️ Low</span>
                      )}
                      {item.quantity === 0 && (
                        <span style={{ color: 'var(--clr-danger)', marginLeft: 6 }}>✕ Out of Stock</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--clr-success)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    රු.{Number(item.sellingPrice).toLocaleString()}{item.isFractional ? '/kg' : ''}
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
                        <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>
                          {item.isFractional && <span style={{ fontSize: '0.75rem', marginRight: 4 }}>⚖️</span>}
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.69rem', color: 'var(--clr-text-muted)' }}>
                          {item.unit} {item.sku ? `· ${item.sku}` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                          <button style={styles.qtyBtn} onClick={() => changeQty(item._id, -1)}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 38, textAlign: 'center', fontSize: item.isFractional ? '0.8rem' : '1rem' }}>
                            {item.isFractional
                              ? `${(item.qty * 1000).toFixed(0)}g`  // 0.250 → 250g
                              : item.qty
                            }
                          </span>
                          <button style={styles.qtyBtn} onClick={() => changeQty(item._id, +1)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
                        {item.isFractional
                          ? `රු.${Number(item.sellingPrice).toLocaleString()}/kg`
                          : `රු.${Number(item.sellingPrice).toLocaleString()}`
                        }
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.6rem', fontWeight: 700, color: 'var(--clr-success)' }}>
                        රු.{(Math.round(item.sellingPrice * item.qty * 100) / 100).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                    {/* Last bill print box — FIX 2: WhatsApp send button added */}
          {billDone && (
            <div style={styles.billDoneBox}>
              <div style={{ fontWeight: 700, color: 'var(--clr-success)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                ✅ Bill #{billDone.billNumber}
                {billDone.isOffline && <span style={{ color: 'var(--clr-accent)', marginLeft: 8, fontSize: '0.75rem' }}>📴 Offline</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
                රු.{billDone.total?.toLocaleString()} — {billDone.paymentMethod}
                {billDone.customerName && (
                  <span style={{ marginLeft: 6 }}>· {billDone.customerName}</span>
                )}
              </div>
              <button className="btn btn-primary btn-full btn-sm" onClick={() => printReceipt(billDone)}
                style={{ marginBottom: '0.45rem' }}
              >
                🖨 Print Receipt
              </button>
              {/* FIX 2: Optional "Send via WhatsApp" button (SPEC §5C item 62) */}
              {user?.shop?.settings?.whatsappEnabled && (
                <button
                  className="btn btn-full btn-sm"
                  style={{
                    background: 'rgba(37,211,102,0.12)',
                    color: '#25d366',
                    border: '1px solid rgba(37,211,102,0.35)',
                    fontWeight: 600,
                  }}
                  disabled={sendingWA}
                  onClick={() => {
                    const phone = billDone.customerPhone;
                    if (!phone) {
                      toast.error('Customer Phone Number නොමැත — Checkout හි ඇතුළත් කරන්න');
                      return;
                    }
                    handleSendWhatsApp(billDone, phone);
                  }}
                >
                  {sendingWA ? '⏳ Sending...' : '📱 Send via WhatsApp'}
                </button>
              )}
            </div>
          )}