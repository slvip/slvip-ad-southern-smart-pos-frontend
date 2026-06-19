// AD SOUTHERN SMART POS — Inventory Management (Module 2)
// src/pages/admin/Inventory.js
// Features: CRUD, AI OCR Invoice, Auto-Code Gen, Financial Matrix, Custom Thresholds

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import DoubleConfirmModal from '../../components/shared/DoubleConfirmModal';
import toast from 'react-hot-toast';

/* ── Measurement units by business category ── */
const UNITS_MAP = {
  Grocery:       ['kg','g','l','ml','Pkt','Btl','Nos'],
  Hardware:      ['m','ft','in','kg','Nos','Roll','Box'],
  Pharmacy:      ['Strips','Tablets','Bottles','Capsules','Nos'],
  Electronic:    ['Nos','Boxes','Sets'],
  Apparel:       ['Nos','Sets','Boxes'],
  Communication: ['Cards','Units','Nos'],
  Other:         ['Nos','Pkt','kg','l'],
};

const SUB_CATEGORIES = {
  Grocery:       ['Dairy','Dry Foods','Beverages','Snacks','Spices','Fresh','Frozen','Other'],
  Hardware:      ['Plumbing','Electrical','Tools','Cement & Sand','Paint','Fasteners','Other'],
  Pharmacy:      ['Prescription','OTC','Vitamins','First Aid','Personal Care','Other'],
  Electronic:    ['Mobile','Accessories','Home Appliances','Computing','Other'],
  Apparel:       ['Mens','Womens','Kids','Footwear','Accessories','Other'],
  Communication: ['SIM','Data','Accessories','Repairs','Other'],
  Other:         ['General','Other'],
};

const EMPTY_ITEM = {
  name: '', sku: '', subCategory: '', unit: '', costPrice: '', sellingPrice: '',
  quantity: '', minQuantity: 10, expiryDate: '', barcode: '', description: '',
};

/* Auto-generate SKU */
const genSKU = (category, subCat, existingCount) => {
  const catCode = (category || 'OTH').slice(0, 3).toUpperCase();
  const subCode = (subCat || 'GEN').slice(0, 3).toUpperCase();
  const num = String((existingCount || 0) + 1).padStart(3, '0');
  return `${catCode}-${subCode}-${num}`;
};

export default function Inventory() {
  const { user } = useAuth();
  const category = user?.shop?.businessCategory || 'Other';
  const units    = UNITS_MAP[category] || UNITS_MAP.Other;
  const subCats  = SUB_CATEGORIES[category] || SUB_CATEGORIES.Other;

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterSub, setFilterSub]   = useState('all');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_ITEM);
  const [formLoading, setFormLoading] = useState(false);

  // OCR
  const [ocrOpen, setOcrOpen]   = useState(false);
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState([]);
  const fileRef = useRef();
  const cameraRef = useRef();

  const loadItems = useCallback(() => {
    setLoading(true);
    adminAPI.getItems()
      .then(r => setItems(r.data.items || []))
      .catch(() => toast.error('Items ලෝඩ් කිරීම අසාර්ථකයි'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_ITEM, unit: units[0], subCategory: subCats[0] });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      name:        item.name || '',
      sku:         item.sku || '',
      subCategory: item.subCategory || subCats[0],
      unit:        item.unit || units[0],
      costPrice:   item.costPrice || '',
      sellingPrice:item.sellingPrice || '',
      quantity:    item.quantity || '',
      minQuantity: item.minQuantity ?? 10,
      expiryDate:  item.expiryDate ? item.expiryDate.slice(0,10) : '',
      barcode:     item.barcode || '',
      description: item.description || '',
    });
    setModalOpen(true);
  };

  // Auto-generate SKU when subCategory changes in create mode
  useEffect(() => {
    if (!editTarget && form.subCategory) {
      set('sku', genSKU(category, form.subCategory, items.length));
    }
  }, [form.subCategory, editTarget, category, items.length]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.unit || !form.sellingPrice || !form.quantity) {
      toast.error('නම, Unit, Selling Price, Quantity අවශ්‍යයි'); return;
    }
    setFormLoading(true);
    try {
      if (editTarget) {
        await adminAPI.updateItem(editTarget._id, form);
        toast.success('Item යාවත්කාලීන කළා ✅');
      } else {
        await adminAPI.createItem(form);
        toast.success('Item සාදන ලදී ✅');
      }
      setModalOpen(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save අසාර්ථකයි');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async ({ confirmation, masterPassword }) => {
    try {
      await adminAPI.deleteItem(deleteTarget._id, { confirmation, masterPassword });
      toast.success(`"${deleteTarget.name}" මකා දමන ලදී`);
      setItems(prev => prev.filter(i => i._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete අසාර්ථකයි');
    }
  };

  /* ── OCR: Image → Gemini → Items ── */
  const handleOcrFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setOcrImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const runOCR = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    setOcrResults([]);
    try {
      const base64 = ocrImage.split(',')[1];
      const res = await adminAPI.ocrInvoice(base64);
      setOcrResults(res.data.items || []);
      if ((res.data.items || []).length === 0) toast.error('Items හඳුනා ගැනීම අසාර්ථකයි');
    } catch {
      // Fallback: Tesseract.js client-side
      toast.error('Gemini OCR අසාර්ථකයි — Client-side OCR ධාවනය වෙනවා...');
      runTesseract();
    } finally {
      setOcrLoading(false);
    }
  };

  const runTesseract = async () => {
    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(ocrImage, 'eng');
      // Simple line-by-line parse
      const lines = data.text.split('\n').filter(l => l.trim().length > 3);
      const items = lines.slice(0, 20).map((l, i) => ({
        name: l.trim().slice(0, 50),
        qty: 1,
        price: 0,
      }));
      setOcrResults(items);
      toast.success(`Tesseract — ${items.length} lines detected. හොඳින් සීදුකරන්න.`);
    } catch {
      toast.error('Tesseract.js ද අසාර්ථකයි');
    }
  };

  const setOcrField = (idx, k, v) => {
    setOcrResults(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [k]: v };
      return next;
    });
  };

  const confirmOcrImport = async () => {
    const valid = ocrResults.filter(r => r.name && r.price > 0);
    if (valid.length === 0) { toast.error('Valid items නොමැත'); return; }
    setFormLoading(true);
    let created = 0;
    for (const item of valid) {
      try {
        await adminAPI.createItem({
          name:        item.name,
          quantity:    item.qty || 1,
          costPrice:   item.price,
          sellingPrice:parseFloat((item.price * 1.15).toFixed(2)),
          unit:        units[0],
          subCategory: subCats[0],
          sku:         genSKU(category, subCats[0], items.length + created),
          minQuantity: 10,
        });
        created++;
      } catch { /* skip */ }
    }
    toast.success(`${created} items import කළා ✅`);
    setOcrOpen(false);
    setOcrImage(null);
    setOcrResults([]);
    loadItems();
    setFormLoading(false);
  };

  /* ── Filters ── */
  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchQ = i.name?.toLowerCase().includes(q) ||
                   i.sku?.toLowerCase().includes(q) ||
                   i.barcode?.includes(q);
    const matchSub = filterSub === 'all' || i.subCategory === filterSub;
    return matchQ && matchSub;
  });

  const stockBadge = (item) => {
    if (item.quantity <= 0) return <span className="badge badge-red">Stock Out</span>;
    if (item.quantity <= (item.minQuantity || 10)) return <span className="badge badge-amber">Low</span>;
    return <span className="badge badge-green">OK</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">📦 Inventory</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {items.length} items — {category}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={() => setOcrOpen(true)}>
            📷 OCR Import
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            + නව Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
          <input
            type="search"
            placeholder="🔍 Item නම, SKU, Barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={filterSub} onChange={e => setFilterSub(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">සියලු Categories</option>
            {subCats.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="empty-state">
          <div className="animate-spin" style={spinnerStyle} />
          <div style={{ marginTop: '0.5rem' }}>ලෝඩ් වෙමින්...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>📦</div>
          <div>Items හමු නොවීය</div>
          <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={openCreate}>
            + First Item Add කරන්න
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Stock</th>
                  <th>Expiry</th>
                  <th style={{ textAlign: 'right' }}>ක්‍රියා</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                      {item.barcode && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {item.barcode}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--clr-accent)' }}>
                      {item.sku}
                    </td>
                    <td><span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{item.subCategory}</span></td>
                    <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>{item.unit}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {item.costPrice ? `රු.${Number(item.costPrice).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--clr-success)' }}>
                      රු.{Number(item.sellingPrice).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {item.quantity} <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)' }}>{item.unit}</span>
                    </td>
                    <td>{stockBadge(item)}</td>
                    <td style={{ fontSize: '0.78rem', color: item.expiryDate && new Date(item.expiryDate) < new Date(Date.now() + 7*86400000) ? 'var(--clr-danger)' : 'var(--clr-text-muted)' }}>
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('si-LK') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(item)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-title">{editTarget ? '✏️ Item Edit' : '📦 නව Item'}</div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Item නම *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Coconut Oil 1L" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sub Category *</label>
                  <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)}>
                    {subCats.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Unit *</label>
                  <select value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {units.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>SKU (Auto)</label>
                  <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Auto-generated" />
                </div>
                <div className="form-group">
                  <label>Barcode</label>
                  <input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="8901234567890" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cost Price (රු.)</label>
                  <input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => set('costPrice', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Selling Price (රු.) *</label>
                  <input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Min Qty (Low Stock Alert)</label>
                  <input type="number" min="0" value={form.minQuantity} onChange={e => set('minQuantity', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label>විස්තර</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Optional description..." />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setModalOpen(false)} disabled={formLoading}>අවලංගු</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳ සුරකිනවා...' : editTarget ? '✅ Update' : '✅ Item Add කරන්න'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── OCR Modal ── */}
      {ocrOpen && (
        <div className="modal-overlay" onClick={() => { setOcrOpen(false); setOcrImage(null); setOcrResults([]); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-title">📷 Invoice OCR Import</div>
            <div style={styles.ocrInfo}>
              සප්ලේවර් Invoice ෆොටෝ ගෙන AI මඟින් Items Auto-Extract කරගන්න.
              Gemini 1.5 Flash → Tesseract.js fallback.
            </div>

            {!ocrImage ? (
              <div style={styles.ocrDrop}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                <div style={{ marginBottom: '1rem', color: 'var(--clr-text-muted)' }}>Invoice Image Upload කරන්න</div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                    🗂 File Choose
                  </button>
                  <button className="btn btn-ghost" onClick={() => cameraRef.current?.click()}>
                    📷 Camera
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleOcrFile} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleOcrFile} />
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img src={ocrImage} alt="Invoice" style={{ maxHeight: 200, borderRadius: 'var(--radius)', border: '1px solid var(--clr-border)' }} />
                </div>
                {ocrResults.length === 0 ? (
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => { setOcrImage(null); setOcrResults([]); }}>
                      ← ආපසු
                    </button>
                    <button className="btn btn-primary" onClick={runOCR} disabled={ocrLoading}>
                      {ocrLoading ? '⏳ AI Reading...' : '🤖 AI Extract Items'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--clr-success)' }}>
                      ✅ {ocrResults.length} items detected — Review & Confirm
                    </div>
                    <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: '1rem' }}>
                      {ocrResults.map((item, idx) => (
                        <div key={idx} style={styles.ocrRow}>
                          <input
                            value={item.name}
                            onChange={e => setOcrField(idx, 'name', e.target.value)}
                            placeholder="Item name"
                            style={{ flex: 2 }}
                          />
                          <input
                            type="number"
                            value={item.qty}
                            onChange={e => setOcrField(idx, 'qty', +e.target.value)}
                            placeholder="Qty"
                            style={{ width: 70 }}
                          />
                          <input
                            type="number"
                            value={item.price}
                            onChange={e => setOcrField(idx, 'price', +e.target.value)}
                            placeholder="Cost රු."
                            style={{ width: 100 }}
                          />
                          <button
                            style={{ background: 'none', border: 'none', color: 'var(--clr-danger)', cursor: 'pointer' }}
                            onClick={() => setOcrResults(prev => prev.filter((_, i) => i !== idx))}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-ghost btn-full" onClick={() => { setOcrImage(null); setOcrResults([]); }}>← ආපසු</button>
                      <button className="btn btn-primary btn-full" onClick={confirmOcrImport} disabled={formLoading}>
                        {formLoading ? '⏳ Importing...' : `✅ ${ocrResults.filter(r=>r.name&&r.price>0).length} Items Import`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      <DoubleConfirmModal
        open={!!deleteTarget}
        title={`"${deleteTarget?.name}" Item මකා දමන්නද?`}
        body="Stock Record, Bill History ආරක්ෂිතව පවතී. Item ස්ථිරවම ඉවත් කෙරේ."
        requiresMasterPwd
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const spinnerStyle = {
  display: 'inline-block', width: 28, height: 28,
  border: '2px solid var(--clr-border)',
  borderTopColor: 'var(--clr-primary)',
  borderRadius: '50%',
};

const styles = {
  ocrInfo: {
    background: 'rgba(59,130,246,0.06)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    fontSize: '0.82rem',
    color: 'var(--clr-text-muted)',
    marginBottom: '1.25rem',
  },
  ocrDrop: {
    border: '2px dashed var(--clr-border)',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  ocrRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    alignItems: 'center',
  },
};
