// AD SOUTHERN SMART POS — Cheque Manager (Module 5A)
// src/pages/admin/ChequeManager.js
// Features: Received cheques (Cloudinary image), Issued cheques, 2-day WhatsApp reminder, Mark as Cashed

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const EMPTY_RECEIVED = { party: '', amount: '', chequeNo: '', chequeDate: '', bank: '', note: '' };
const EMPTY_ISSUED   = { party: '', amount: '', chequeNo: '', chequeDate: '', bank: '', note: '' };

export default function ChequeManager() {
  const [tab, setTab]               = useState('received'); // 'received' | 'issued'
  const [cheques, setCheques]       = useState({ received: [], issued: [] });
  const [loading, setLoading]       = useState(true);
  const [addOpen, setAddOpen]       = useState(false);
  const [form, setForm]             = useState(EMPTY_RECEIVED);
  const [formLoading, setFormLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile]       = useState(null);
  const fileRef = useRef();

  const loadCheques = useCallback(() => {
    setLoading(true);
    adminAPI.getCheques()
      .then(r => setCheques(r.data || { received: [], issued: [] }))
      .catch(() => toast.error('Cheques ලෝඩ් error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCheques(); }, [loadCheques]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImgSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.party || !form.amount || !form.chequeDate) {
      toast.error('Party, Amount, Cheque Date අවශ්‍යයි'); return;
    }
    setFormLoading(true);
    try {
      const payload = { ...form };

      if (tab === 'received' && imgFile) {
        // Convert to base64 for upload to backend → Cloudinary
        const base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(imgFile);
        });
        payload.imageBase64 = base64;
        payload.imageType = imgFile.type;
      }

      if (tab === 'received') {
        await adminAPI.addReceivedCheque(payload);
        toast.success('✅ Received Cheque Add කළා');
      } else {
        await adminAPI.addIssuedCheque(payload);
        toast.success('✅ Issued Cheque Add කළා');
      }

      setAddOpen(false);
      setForm(tab === 'received' ? EMPTY_RECEIVED : EMPTY_ISSUED);
      setImgFile(null);
      setImgPreview(null);
      loadCheques();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Add error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleMarkCashed = async (chequeId) => {
    try {
      await adminAPI.markChequeCashed(chequeId);
      toast.success('✅ Cheque Cashed ලෙස සලකුණු කළා — ආදායමට Add විය');
      loadCheques();
    } catch {
      toast.error('Mark Cashed error');
    }
  };

  const daysUntil = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.ceil((d - now) / 86400000);
  };

  const list = cheques[tab] || [];

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">💳 Cheque Management</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            Received: {cheques.received?.length || 0} | Issued: {cheques.issued?.length || 0}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(tab === 'received' ? EMPTY_RECEIVED : EMPTY_ISSUED); setAddOpen(true); }}>
          + Cheque Add
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['received','issued'].map(t => (
          <button
            key={t}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'received' ? '📥 Received' : '📤 Issued'}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div style={styles.infoBox}>
        {tab === 'received'
          ? '📥 ලැබුණු Cheque Cash Balance එකට ගැනෙන්නේ නැත. "Mark as Cashed" කළ විට පමණක් ආදායමට Add වේ. Cheque Image Cloudinary හි Store වේ.'
          : '📤 Supplier/Others ලාට දෙන Cheques. Cheque Date 2 දිනකට පෙර WhatsApp Alert නිකුත් වේ.'}
      </div>

      {loading ? (
        <div className="empty-state"><div className="animate-spin" style={spinnerStyle} /></div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>💳</div>
          <div>{tab === 'received' ? 'Received Cheques' : 'Issued Cheques'} නොමැත</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cheque #</th>
                  <th>Party</th>
                  <th>Amount</th>
                  <th>Bank</th>
                  <th>Cheque Date</th>
                  <th>Status</th>
                  {tab === 'issued' && <th>Alert</th>}
                  {tab === 'received' && <th>Image</th>}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(c => {
                  const days = daysUntil(c.chequeDate);
                  return (
                    <tr key={c._id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--clr-accent)' }}>
                        {c.chequeNo || '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.party}</td>
                      <td style={{ fontWeight: 700, color: tab === 'received' ? 'var(--clr-success)' : 'var(--clr-danger)', fontFamily: 'var(--font-mono)' }}>
                        රු.{Number(c.amount).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>{c.bank || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {c.chequeDate ? new Date(c.chequeDate).toLocaleDateString('si-LK') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${c.isCashed ? 'badge-green' : 'badge-amber'}`}>
                          {c.isCashed ? 'Cashed ✅' : 'Pending'}
                        </span>
                      </td>
                      {tab === 'issued' && (
                        <td>
                          {days <= 2 && !c.isCashed ? (
                            <span className="badge badge-red">⚠️ {days}d</span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-dim)' }}>{days}d</span>
                          )}
                        </td>
                      )}
                      {tab === 'received' && (
                        <td>
                          {c.imageUrl ? (
                            <a href={c.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img src={c.imageUrl} alt="cheque" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                            </a>
                          ) : <span style={{ color: 'var(--clr-text-dim)', fontSize: '0.75rem' }}>No image</span>}
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>
                        {!c.isCashed && tab === 'received' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleMarkCashed(c._id)}>
                            ✅ Cashed
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-title">{tab === 'received' ? '📥 Received Cheque' : '📤 Issued Cheque'}</div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Party (Company/Person) *</label>
                <input value={form.party} onChange={e => set('party', e.target.value)} placeholder="ABC Suppliers" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cheque Amount (රු.) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Cheque #</label>
                  <input value={form.chequeNo} onChange={e => set('chequeNo', e.target.value)} placeholder="CHQ-001234" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cheque Date *</label>
                  <input type="date" value={form.chequeDate} onChange={e => set('chequeDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Bank</label>
                  <input value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="BOC, Sampath..." />
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Optional note..." />
              </div>

              {tab === 'received' && (
                <div className="form-group">
                  <label>Cheque Image (Cloudinary Upload)</label>
                  <div style={styles.imgUpload} onClick={() => fileRef.current?.click()}>
                    {imgPreview ? (
                      <img src={imgPreview} alt="preview" style={{ maxHeight: 120, borderRadius: 'var(--radius-sm)' }} />
                    ) : (
                      <div style={{ color: 'var(--clr-text-dim)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem' }}>📷</div>
                        <div style={{ fontSize: '0.8rem' }}>Click to select cheque photo</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgSelect} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setAddOpen(false)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳ Saving...' : '✅ Add Cheque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const spinnerStyle = { display: 'inline-block', width: 28, height: 28, border: '2px solid var(--clr-border)', borderTopColor: 'var(--clr-primary)', borderRadius: '50%' };
const styles = {
  infoBox: {
    background: 'rgba(59,130,246,0.06)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    fontSize: '0.82rem',
    color: 'var(--clr-text-muted)',
    marginBottom: '1rem',
  },
  imgUpload: {
    border: '2px dashed var(--clr-border)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    cursor: 'pointer',
    textAlign: 'center',
    minHeight: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
