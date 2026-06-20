// AD SOUTHERN SMART POS — Staff Management (Module 2)
// src/pages/admin/StaffManage.js
//
// UPDATED: Added PIN Reset (Admin can clear staff member's PIN so they must re-set it)

import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import DoubleConfirmModal from '../../components/shared/DoubleConfirmModal';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'manager', label: 'Manager', badge: 'badge-amber' },
  { value: 'cashier', label: 'Cashier', badge: 'badge-green' },
];

const EMPTY = { displayName: '', username: '', password: '', role: 'cashier' };

export default function StaffManage() {
  const [staff, setStaff]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget]   = useState(null);
  const [pinResetTarget, setPinResetTarget] = useState(null);
  const [form, setForm]                 = useState(EMPTY);
  const [formLoading, setFormLoading]   = useState(false);
  const [newPwd, setNewPwd]             = useState('');
  const [showPwd, setShowPwd]           = useState(false);

  const loadStaff = useCallback(() => {
    setLoading(true);
    adminAPI.getStaff()
      .then(r => setStaff(r.data.staff || []))
      .catch(() => toast.error('Staff ලිස්ට් ලෝඩ් error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.displayName || !form.username || !form.password) {
      toast.error('සියලු ක්ෂේත්‍ර පුරවන්න'); return;
    }
    if (form.password.length < 8) { toast.error('Password min 8 chars'); return; }
    setFormLoading(true);
    try {
      await adminAPI.createStaff(form);
      toast.success(`✅ ${form.displayName} (${form.role}) Add කළා`);
      setCreateOpen(false); setForm(EMPTY); loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create error');
    } finally { setFormLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPwd.length < 8) { toast.error('Min 8 chars'); return; }
    setFormLoading(true);
    try {
      await adminAPI.resetStaffPin(resetTarget._id, { newPassword: newPwd });
      toast.success('Password Reset කළා');
      setResetTarget(null); setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset error');
    } finally { setFormLoading(false); }
  };

  const handleClearPin = async () => {
    try {
      const res = await adminAPI.clearStaffPin(pinResetTarget._id);
      toast.success(res.data.message || `${pinResetTarget.displayName} ගේ PIN Reset කළා`);
      setPinResetTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'PIN Reset error');
    }
  };

  const handleDelete = async () => {
    try {
      await adminAPI.deleteStaff(deleteTarget._id);
      toast.success(`"${deleteTarget.displayName}" Delete කළා`);
      setStaff(prev => prev.filter(s => s._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete error');
    }
  };

  const roleMeta = (role) => ROLES.find(r => r.value === role) || { label: role, badge: 'badge-blue' };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">👥 Staff Management</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {staff.length} staff members
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
          + Staff Add කරන්න
        </button>
      </div>

      {/* PIN Info Banner */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
        🔐 <strong style={{ color: 'var(--clr-text)' }}>Personal PIN System:</strong> Admin, Manager, Cashier — සෑම Staff Member කෙනෙකු ලොගින් වූ පසු Settings > Security හිදී ස්වකීය Personal 4-Digit PIN set කළ යුතුය. Admin හට Staff ගේ PIN "Clear" කළ හැකි නමුත් ඔවුන් ගේ PIN කියෙවිය නොහැක.
      </div>

      {loading ? (
        <div className="empty-state"><div className="animate-spin" style={spinnerStyle} /></div>
      ) : staff.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>👤</div>
          <div>Staff Members නොමැත</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>නම</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Add දිනය</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const rm = roleMeta(s.role);
                  return (
                    <tr key={s._id}>
                      <td><div style={{ fontWeight: 600 }}>{s.displayName}</div></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{s.username}</td>
                      <td><span className={`badge ${rm.badge}`}>{rm.label}</span></td>
                      <td>
                        <span className={`badge ${s.isActive ? 'badge-green' : 'badge-red'}`}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString('si-LK') : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setResetTarget(s); setNewPwd(''); }} title="Reset Password">🔑 Password</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--clr-accent)' }} onClick={() => setPinResetTarget(s)} title="Clear PIN (staff must re-set)">🔐 PIN Clear</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(s)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-title">👤 නව Staff Member</div>
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
              💡 Staff Member Add කළ පසු, ඔහු/ඇය ලොගින් වූ විට Settings > Security හිදී ඔවුන්ගේ Personal PIN Set කිරීමට ඔවුන්ව දැනුවත් කරන්න.
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Display Name *</label>
                <input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Nimal Silva" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, '_'))} placeholder="nimal_silva" />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Password * (min 8 chars)</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtn}>{showPwd ? '🙈' : '👁'}</button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setCreateOpen(false)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳...' : '✅ Staff Add කරන්න'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-title">🔑 Password Reset</div>
            <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
              <strong>{resetTarget.displayName}</strong> ගේ නව password
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>නව Password *</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="min 8 characters"
                  autoFocus
                  style={{ paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtn}>{showPwd ? '🙈' : '👁'}</button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setResetTarget(null)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳...' : '🔑 Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Clear Confirm Modal */}
      {pinResetTarget && (
        <div className="modal-overlay" onClick={() => setPinResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title" style={{ color: 'var(--clr-accent)' }}>🔐 Staff PIN Clear කරන්නද?</div>
            <p style={{ color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
              <strong>{pinResetTarget.displayName}</strong> ගේ Action PIN Remove කෙරේ.
            </p>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', fontSize: '0.82rem', color: 'var(--clr-accent)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              ⚠️ PIN Clear කළ පසු, ඊළඟ ලොගින් Session එකේදී Staff Member ස්වකීයව Settings → Security හිදී නව PIN Set කළ යුතුය. ඔවුන් PIN Set කරන තෙක් Sensitive Tabs block වේ.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setPinResetTarget(null)}>Cancel</button>
              <button className="btn btn-full" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--clr-accent)', border: '1px solid rgba(245,158,11,0.4)' }} onClick={handleClearPin}>
                🔐 PIN Clear කරන්න
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-title" style={{ color: 'var(--clr-danger)' }}>⚠️ Delete Staff?</div>
            <p style={{ color: 'var(--clr-text-muted)', marginBottom: '1.25rem' }}>
              <strong>{deleteTarget.displayName}</strong> ගේ account delete කෙරේ. Bill records ආරක්ෂිතයි.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger btn-full" onClick={handleDelete}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const spinnerStyle = { display: 'inline-block', width: 24, height: 24, border: '2px solid var(--clr-border)', borderTopColor: 'var(--clr-primary)', borderRadius: '50%' };
const eyeBtn = { position: 'absolute', right: '0.7rem', top: '2rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' };
