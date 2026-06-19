// AD SOUTHERN SMART POS — Admin Audit Logs (Module 2)
// src/pages/admin/AdminAuditLogs.js

import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminAuditLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch]   = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAuditLogs({ page, limit: 20, search: search || undefined });
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      toast.error('Audit Logs ලෝඩ් error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setPage(1); }, [search]);

  const severityBadge = (s) => s === 'high' ? 'badge-red' : s === 'medium' ? 'badge-amber' : 'badge-green';

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">📋 Audit Logs</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            ඔබේ Shop හි ක්‍රියාකාරකම් සටහන
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <input
          type="search"
          placeholder="🔍 Action, User, Details..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="animate-spin" style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--clr-border)', borderTopColor: 'var(--clr-primary)', borderRadius: '50%' }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>📋</div>
          <div>Logs නොමැත</div>
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
                    <th>Details</th>
                    <th>දිනය</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td><span className={`badge ${severityBadge(log.severity)}`}>{log.severity?.toUpperCase()}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--clr-accent)' }}>{log.action}</td>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.displayName || log.username}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>{log.details || '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('si-LK') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>← පෙර</button>
              <span style={{ color: 'var(--clr-text-muted)', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}>{page}/{totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>ඊළඟ →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}