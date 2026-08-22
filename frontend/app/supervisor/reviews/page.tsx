"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../components/auth/auth-context';
import { subscribeSupervisorSubmissions, STAGE_LABELS, fmtDate, type Submission } from '../../../lib/store';

export default function SupervisorReviewsPage() {
  const { user, getAllUsers } = useAuth();
  const [subs, setSubs]     = useState<Submission[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REVISION_REQUIRED'>('ALL');

  const allUsers   = getAllUsers();
  const myStudents = allUsers.filter(u => (u as any).supervisorId === user?.id);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSupervisorSubmissions(user.id, setSubs);
    return () => unsub();
  }, [user?.id]);

  const pending  = subs.filter(s => s.status === 'PENDING').length;
  const approved = subs.filter(s => s.status === 'APPROVED').length;
  const revision = subs.filter(s => s.status === 'REVISION_REQUIRED').length;

  const filtered = filter === 'ALL' ? subs : subs.filter(s => s.status === filter);

  const STATUS_STYLE: Record<string, React.CSSProperties> = {
    PENDING:           { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
    APPROVED:          { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
    REVISION_REQUIRED: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Supervisor</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Review Queue</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>All submissions from your assigned students, sorted newest first.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Pending Review',    value: pending,  accent: '#f59e0b', bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)' },
          { label: 'Approved',          value: approved, accent: '#10b981', bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
          { label: 'Revision Required', value: revision, accent: '#ef4444', bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  text: 'var(--danger-text)'  },
        ].map(c => (
          <div key={c.label} className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl font-bold"
              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{c.value}</div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filter — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 p-1 rounded-xl w-fit min-w-max" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          {(['ALL', 'PENDING', 'APPROVED', 'REVISION_REQUIRED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
              style={filter === f
                ? { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }
                : { color: 'var(--text-3)' }}>
              {f === 'ALL' ? `All (${subs.length})` : f === 'PENDING' ? `Pending (${pending})` : f === 'APPROVED' ? `Approved (${approved})` : `Revision (${revision})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {subs.length === 0
              ? myStudents.length === 0 ? 'No students assigned to you yet.' : 'No submissions from your students yet.'
              : 'No submissions match this filter.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
                {['Student', 'Document', 'Stage', 'Ver.', 'Submitted', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => {
                const student = allUsers.find(u => u.id === sub.studentId);
                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>{student?.name ?? '—'}</div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px]">
                      <div className="truncate text-xs font-medium" style={{ color: 'var(--text-1)' }}>{sub.title}</div>
                      <div className="truncate text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub.fileName}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-2)' }}>
                      {STAGE_LABELS[sub.stage]}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>v{sub.version}</td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{fmtDate(sub.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={STATUS_STYLE[sub.status]}>
                        {sub.status === 'PENDING' ? 'Pending' : sub.status === 'APPROVED' ? 'Approved' : 'Revision'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/supervisor/students/${sub.studentId}`}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                        style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
