// AD SOUTHERN SMART POS — Super Admin: Shop Management
// src/pages/superadmin/SAShops.js

import React, { useEffect, useState, useCallback } from 'react';
import { superAdminAPI } from '../../utils/api';
import DoubleConfirmModal from '../../components/shared/DoubleConfirmModal';
import CreateShopModal from './CreateShopModal';
import toast from 'react-hot-toast';

const TIERS = [
  { value: 'micro',      label: 'Micro',      sub: '1,500 Items',     cls: 'badge tier-micro'      },
  { value: 'standard',   label: 'Standard Pro', sub: '15,000 Items',  cls: 'badge tier-standard'   },
  { value: 'mega',       label: 'Mega Wholesale', sub: '60,000 Items', cls: 'badge tier-mega'      },
  { value: 'enterprise', label: 'Enterprise', sub: 'Unlimited',        cls: 'badge tier-enterprise' },
];

export default function SAShops() {
  const [shops, setShops]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadShops = useCallback(() => {
    setLoading(true);
    superAdminAPI.getShops()
      .then(r => setShops(r.data.shops || []))
      .catch(() => toast.error('Shops ලිස්ට් ලබා ගැනීම අසාර්ථකයි'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadShops(); }, [loadShops]);

  const handleTierChange = async (shopId, newTier) => {
    try {
      await superAdminAPI.updateTier(shopId, newTier);
      toast.success('Tier සාර්ථකව යාවත්කාලීන කළා');
      setShops(prev => prev.map(s => s._id === shopId ? { ...s, stockTier: newTier } : s));
    } catch {
      toast.error('Tier update අසාර්ථකයි');
    }
  };

  const handleDelete = async ({ confirmation, masterPassword }) => {
    try {
      await superAdminAPI.deleteShop(deleteTarget._id, { confirmation, masterPassword });
      toast.success(`"${deleteTarget.name}" සාර්ථකව මකා දමන ලදී`);
      setShops(prev => prev.filter(s => s._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete අසාර්ථකයි');
    }
  };

  const filtered = shops.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerUsername?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">🏪 Shop Management</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {shops.length} shops ලියාපදිංචි ව ඇත
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          + නව Shop
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <input
          type="search"
          placeholder="🔍 Shop නම හෝ Admin username සොයන්න..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state"><div className="animate-spin" style={spinnerStyle} />ලෝඩ් වෙමින්...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
          <div>Shops හමු නොවීය</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shop නම</th>
                  <th>Admin</th>
                  <th>ව්‍යාපාර කාණ්ඩය</th>
                  <th>Stock Tier</th>
                  <th>සක්‍රීය</th>
                  <th>ලියාපදිංචි දිනය</th>
                  <th style={{ textAlign: 'right' }}>ක්‍රියා</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(shop => {
                  const tier = TIERS.find(t => t.value === shop.stockTier) || TIERS[0];
                  return (
                    <tr key={shop._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{shop.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                          #{shop._id?.slice(-6)}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {shop.ownerUsername}
                      </td>
                      <td>
                        <span className="badge badge-blue">{shop.businessCategory || '—'}</span>
                      </td>
                      <td>
                        <select
                          value={shop.stockTier || 'micro'}
                          onChange={e => handleTierChange(shop._id, e.target.value)}
                          style={{ width: 'auto', fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                        >
                          {TIERS.map(t => (
                            <option key={t.value} value={t.value}>{t.label} — {t.sub}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${shop.isActive ? 'badge-green' : 'badge-red'}`}>
                          {shop.isActive ? 'සක්‍රීය' : 'අක්‍රීය'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
                        {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('si-LK') : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(shop)}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateShopModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); loadShops(); }}
      />

      <DoubleConfirmModal
        open={!!deleteTarget}
        title={`"${deleteTarget?.name}" Shop මකා දමන්නද?`}
        body={`මෙම Shop, ඒ සමඟ ඇති Users, Bills, සහ Stock Data සම්පූර්ණයෙන්ම ස්ථිරවම මකා දැමෙනු ඇත. මෙම ක්‍රියාව ආපසු හැරවිය නොහැක.`}
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
};
