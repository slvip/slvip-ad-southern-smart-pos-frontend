// AD SOUTHERN SMART POS — Super Admin: Audit Logs
// src/pages/superadmin/SAAuditLogs.js

import React, { useEffect, useState, useCallback } from 'react';
import { superAdminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const SEVERITY_OPTIONS = [
  { value: 'all',    label: 'සියලු' },
  { value: 'high',   label: '🔴 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low',    label: '🟢 Low' },
];

const ACTION_GROUPS = [
  'all',
  'LOGIN',
  'LOGOUT',
  'GHOST_LOGIN',
  'CREATE_SHOP',
  'DELETE_SHOP',
  'CREATE_USER',
  'DELETE_USER',
  'RESET_PASSWORD',
  'TIER_CHANGE',
  'PIN_VERIFY',
];

export default function SAAuditLogs() {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [severity, setSeverity]     = useState('all');
  const [action, setAction]         = useState('all');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const PER_PAGE = 25;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PER_PAGE,
        ...(search   && { search }),
        ...(severity !== 'all' && { severity }),
        ...(action   !== 'all' && { action }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo   && { dateTo }),
      };
      const res = await superAdminAPI.getAuditLogs(params);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      toast.error('Audit Logs ලබා ගැනීම අසාර්ථකයි');
    } finally {
      setLoading(false);
    }
  }, [page, search, severity, action, dateFrom, dateTo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, severity, action, dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await superAdminAPI.exportAuditLogs({
        ...(severity !== 'all' && { severity }),
        ...(action   !== 'all' && { action }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo   && { dateTo }),
      });
      // Download CSV blob
      const url  = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export සාර්ථකයි');
    } catch {
      toast.error('Export අසාර්ථකයි');
    } finally {
      setExporting(false);
    }
  };

  const severityBadge = (s) => {
    if (s === 'high')   return 'badge-red';
    if (s === 'medium') return 'badge-amber';
    return 'badge-green';
  };

  const severityIcon = (s) => {
    if (s === 'high')   return '🔴';
    if (s === 'medium') return '🟡';
    return '🟢';
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">📋 Audit Logs</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            පද්ධතියේ සියලු ක්‍රියාකාරකම් සටහන
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? '⏳ Exporting...' : '📥 CSV Export'}
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1rem' }}>
        <div style={styles.filterGrid}>
          <input
            type="search"
            placeholder="🔍 Username, Shop, Action සොයන්න..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ width: 'auto' }}>
            {SEVERITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} style={{ width: 'auto' }}>
            {ACTION_GROUPS.map(a => (
              <option key={a} value={a}>{a === 'all' ? 'සියලු Actions' : a}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: 'auto' }}
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: 'auto' }}
            title="To date"
          />
          {(search || severity !== 'all' || action !== 'all' || dateFrom || dateTo) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch(''); setSeverity('all'); setAction('all');
                setDateFrom(''); setDateTo('');
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="empty-state">
          <div className="animate-spin" style={spinnerStyle} />
          <div style={{ marginTop: '0.5rem' }}>ලෝඩ් වෙමින්...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <div>Logs හමු නොවීය</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Shop</th>
                    <th>IP Address</th>
                    <th>විස්තර</th>
                    <th>දිනය / වේලාව</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td>
                        <span className={`badge ${severityBadge(log.severity)}`}>
                          {severityIcon(log.severity)} {log.severity?.toUpperCase() || '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            color: 'var(--clr-accent)',
                          }}
                        >
                          {log.action || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {log.displayName || log.username || '—'}
                        </div>
                        {log.username && log.displayName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {log.username}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
                        {log.shopName || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--clr-text-dim)' }}>
                        {log.ipAddress || '—'}
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--clr-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={log.details}
                        >
                          {log.details || '—'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString('si-LK')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← පෙර
              </button>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} style={{ color: 'var(--clr-text-dim)', padding: '0 0.25rem' }}>…</span>
                    ) : (
                      <button
                        key={p}
                        className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setPage(p)}
                        style={{ minWidth: 34, justifyContent: 'center' }}
                      >
                        {p}
                      </button>
                    )
                  )
                }
              </div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                ඊළඟ →
              </button>
              <span style={{ color: 'var(--clr-text-dim)', fontSize: '0.78rem' }}>
                {page} / {totalPages} පිටු
              </span>
            </div>
          )}
        </>
      )}
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
  filterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'center',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '1.25rem',
  },
};
