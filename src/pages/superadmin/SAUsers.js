// AD SOUTHERN SMART POS — Super Admin: User Management
// src/pages/superadmin/SAUsers.js

import React, { useEffect, useState, useCallback } from 'react';
import { superAdminAPI } from '../../utils/api';
import DoubleConfirmModal from '../../components/shared/DoubleConfirmModal';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'admin',   label: 'Admin',   badge: 'badge-blue'  },
  { value: 'manager', label: 'Manager', badge: 'badge-amber' },
  { value: 'cashier', label: 'Cashier', badge: 'badge-green' },
];

const EMPTY_FORM = {
  displayName: '',
  username: '',
  password: '',
  role: 'cashier',
  shopId: '',
};

export default function SAUsers() {
  const [users, setUsers]             = useState([]);
  const [shops, setShops]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('all');
  const [filterShop, setFilterShop]   = useState('all');

  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  const [form, setForm]               = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [newPwd, setNewPwd]           = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, shopsRes] = await Promise.all([
        superAdminAPI.getUsers(),
        superAdminAPI.getShops(),
      ]);
      setUsers(usersRes.data.users || []);
      setShops(shopsRes.data.shops || []);
    } catch {
      toast.error('දත්ත ලබා ගැනීම අසාර්ථකයි');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── Create user ── */
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.displayName || !form.username || !form.password || !form.shopId) {
      toast.error('සියලු ක්ෂේත්‍ර පුරවන්න'); return;
    }
    if (form.password.length < 8) {
      toast.error('Password අවම අක්ෂර 8ක් විය යුතුය'); return;
    }
    setFormLoading(true);
    try {
      await superAdminAPI.createUser(form);
      toast.success(`✅ "${form.displayName}" සාර්ථකව සාදන ලදී`);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'User සෑදීම අසාර්ථකයි');
    } finally {
      setFormLoading(false);
    }
  };

  /* ── Update user role ── */
  const handleRoleChange = async (userId, newRole) => {
    try {
      await superAdminAPI.updateUser(userId, { role: newRole });
      toast.success('Role සාර්ථකව යාවත්කාලීන කළා');
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch {
      toast.error('Role update අසාර්ථකයි');
    }
  };

  /* ── Reset password ── */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPwd.length < 8) { toast.error('Password අවම අක්ෂර 8ක්'); return; }
    setFormLoading(true);
    try {
      await superAdminAPI.resetUserPassword(resetTarget._id, { newPassword: newPwd });
      toast.success(`"${resetTarget.displayName}" ගේ Password Reset කළා`);
      setResetTarget(null);
      setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset අසාර්ථකයි');
    } finally {
      setFormLoading(false);
    }
  };

  /* ── Delete user ── */
  const handleDelete = async ({ confirmation, masterPassword }) => {
    try {
      await superAdminAPI.deleteUser(deleteTarget._id, { confirmation, masterPassword });
      toast.success(`"${deleteTarget.displayName}" සාර්ථකව මකා දමන ලදී`);
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete අසාර්ථකයි');
    }
  };

  /* ── Filter ── */
  const filtered = users.filter(u => {
    const matchSearch = u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
                        u.username?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchShop = filterShop === 'all' || u.shopId === filterShop;
    return matchSearch && matchRole && matchShop;
  });

  const shopName = (shopId) => shops.find(s => s._id === shopId)?.name || '—';
  const roleMeta = (role) => ROLES.find(r => r.value === role) || { label: role, badge: 'badge-blue' };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">👥 User Management</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {users.length} පරිශීලකයන් ලියාපදිංචි ව ඇත
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
          + නව User
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="🔍 නම හෝ username සොයන්න..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">සියලු Roles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select
            value={filterShop}
            onChange={e => setFilterShop(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">සියලු Shops</option>
            {shops.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="empty-state">
          <div className="animate-spin" style={spinnerStyle} />
          ලෝඩ් වෙමින්...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
          <div>Users හමු නොවීය</div>
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
                  <th>Shop</th>
                  <th>සෑදූ දිනය</th>
                  <th style={{ textAlign: 'right' }}>ක්‍රියා</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => {
                  const rm = roleMeta(user.role);
                  return (
                    <tr key={user._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                          #{user._id?.slice(-6)}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {user.username}
                      </td>
                      <td>
                        {/* Role change dropdown for non-super-admins */}
                        {user.role !== 'super_admin' ? (
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user._id, e.target.value)}
                            style={{ width: 'auto', fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                          >
                            {ROLES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge badge-purple">SUPER ADMIN</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>
                        {shopName(user.shopId)}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('si-LK') : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          {user.role !== 'super_admin' && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setResetTarget(user); setNewPwd(''); }}
                                title="Password Reset"
                              >
                                🔑
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setDeleteTarget(user)}
                              >
                                🗑
                              </button>
                            </>
                          )}
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

      {/* ── Create User Modal ── */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">👤 නව User සෑදීම</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  value={form.displayName}
                  onChange={e => set('displayName', e.target.value)}
                  placeholder="Kamal Perera"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    value={form.username}
                    onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    placeholder="kamal_perera"
                  />
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Password *</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="min 8 characters"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtnStyle}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Shop *</label>
                  <select value={form.shopId} onChange={e => set('shopId', e.target.value)}>
                    <option value="">-- Shop තෝරන්න --</option>
                    {shops.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  onClick={() => setCreateOpen(false)}
                  disabled={formLoading}
                >
                  අවලංගු
                </button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳ සාදනවා...' : '✅ User සාදන්න'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title">🔑 Password Reset</div>
            <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              <strong>{resetTarget.displayName}</strong> ({resetTarget.username}) ගේ නව Password
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
                <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtnStyle}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  onClick={() => setResetTarget(null)}
                  disabled={formLoading}
                >
                  අවලංගු
                </button>
                <button type="submit" className="btn btn-primary btn-full" disabled={formLoading}>
                  {formLoading ? '⏳...' : '🔑 Reset කරන්න'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Double Confirm Delete Modal ── */}
      <DoubleConfirmModal
        open={!!deleteTarget}
        title={`"${deleteTarget?.displayName}" User මකා දමන්නද?`}
        body="මෙම User ගේ Login ප්‍රවේශය සම්පූර්ණයෙන්ම ඉවත් කෙරේ. Bill records ආරක්ෂිතව පවතී."
        requiresMasterPwd
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const spinnerStyle = {
  display: 'inline-block', width: 24, height: 24,
  border: '2px solid var(--clr-border)',
  borderTopColor: 'var(--clr-primary)',
  borderRadius: '50%',
  marginBottom: '0.5rem',
};

const eyeBtnStyle = {
  position: 'absolute', right: '0.7rem', top: '2rem',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
};
