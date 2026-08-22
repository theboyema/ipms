"use client";
import React, { useState, useEffect } from 'react';
import { getAuditLog, fmtDateTime, type AuditEntry } from '../../../lib/store';

const ACTION_COLOR: Record<string, React.CSSProperties> = {
  DOCUMENT_UPLOADED:   { background: 'var(--info-bg)',    color: 'var(--info-text)',    border: '1px solid var(--info-border)'    },
  DOCUMENT_DOWNLOADED: { background: 'var(--neutral-bg)', color: 'var(--neutral-text)', border: '1px solid var(--neutral-border)' },
  SUBMISSION_REVIEWED: { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  MESSAGE_SENT:        { background: 'var(--info-bg)',    color: 'var(--info-text)',    border: '1px solid var(--info-border)'    },
  LOGIN:               { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
  BULK_UPLOAD:         { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  ADMIN_APPROVED:      { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  ADMIN_REJECTED:      { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
};

const DEFAULT_BADGE: React.CSSProperties = { background: 'var(--neutral-bg)', color: 'var(--neutral-text)', border: '1px solid var(--neutral-border)' };

export default function AuditLogPage() {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getAuditLog().then(setLog);
  }, []);

  const filtered = filter
    ? log.filter(e => e.action.includes(filter) || e.userName.toLowerCase().includes(filter.toLowerCase()) || e.details.toLowerCase().includes(filter.toLowerCase()))
    : log;

  const actions = Array.from(new Set(log.map(e => e.action)));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Admin</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Activity Log</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Complete record of all system actions — uploads, reviews, messages, logins.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
          style={!filter
            ? { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }
            : { background: 'var(--bg-surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
          All ({log.length})
        </button>
        {actions.map(a => (
          <button key={a} onClick={() => setFilter(a)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
            style={filter === a
              ? { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }
              : { background: 'var(--bg-surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-3)' }}>
            No audit entries yet. Activity will appear here as users interact with the system.
          </div>
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
                {['Timestamp', 'User', 'Action', 'Details'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{fmtDateTime(e.timestamp)}</td>
                  <td className="px-5 py-3 text-sm font-medium" style={{ color: 'var(--text-1)' }}>{e.userName}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={ACTION_COLOR[e.action] ?? DEFAULT_BADGE}>
                      {e.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs max-w-xs" style={{ color: 'var(--text-3)' }}>{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
