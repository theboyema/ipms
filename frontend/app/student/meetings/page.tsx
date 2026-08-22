"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import { subscribeMeetings, fmtDateTime, type Meeting, type MeetingStatus } from '../../../lib/store';

type Filter = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

const STATUS_STYLE: Record<MeetingStatus, React.CSSProperties> = {
  SCHEDULED: { background: 'var(--info-bg)',    color: 'var(--info-text)',    border: '1px solid var(--info-border)'    },
  COMPLETED: { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  CANCELLED: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
};

export default function StudentMeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter]     = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeMeetings(user.id, 'student', setMeetings);
  }, [user?.id]);

  const upcoming  = meetings.filter(m => m.status === 'SCHEDULED');
  const completed = meetings.filter(m => m.status === 'COMPLETED');
  const cancelled = meetings.filter(m => m.status === 'CANCELLED');
  const filtered  = filter === 'ALL' ? meetings : meetings.filter(m => m.status === filter);

  const isUpcoming = (iso: string) => new Date(iso) >= new Date();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Student</p>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>My Meetings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Meetings scheduled by your supervisor.</p>
      </div>

      {/* Next upcoming callout */}
      {(() => {
        const next = meetings
          .filter(m => m.status === 'SCHEDULED' && isUpcoming(m.scheduledAt))
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
        if (!next) return null;
        return (
          <div className="rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid var(--info-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(37,99,235,0.15)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--info-text)' }}>Next Meeting</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-1)' }}>{next.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {fmtDateTime(next.scheduledAt)}{next.location ? ` · ${next.location}` : ''}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: 'Upcoming',  value: upcoming.length,  accent: '#3b82f6' },
          { label: 'Completed', value: completed.length, accent: '#10b981' },
          { label: 'Cancelled', value: cancelled.length, accent: '#ef4444' },
        ].map(c => (
          <div key={c.label} className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl font-bold shrink-0"
              style={{ background: `${c.accent}18`, color: c.accent }}>{c.value}</div>
            <div className="text-[11px] sm:text-xs font-medium leading-tight" style={{ color: 'var(--text-3)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filter — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 p-1 rounded-xl w-fit min-w-max" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          {(['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
              style={filter === f
                ? { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }
                : { color: 'var(--text-3)' }}>
              {f === 'ALL' ? `All (${meetings.length})` : f === 'SCHEDULED' ? `Upcoming (${upcoming.length})` : f === 'COMPLETED' ? `Completed (${completed.length})` : `Cancelled (${cancelled.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--hover-bg)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {meetings.length === 0 ? 'No meetings scheduled yet. Your supervisor will arrange one.' : 'No meetings match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const open = expanded === m.id;
            return (
              <div key={m.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(open ? null : m.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                      {m.supervisorName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{m.title}</p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                        {m.supervisorName}
                      </p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                        {fmtDateTime(m.scheduledAt)}{m.location && ` · ${m.location}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={STATUS_STYLE[m.status]}>
                      {m.status === 'SCHEDULED' ? (isUpcoming(m.scheduledAt) ? 'Upcoming' : 'Past') : m.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                {open && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {m.agenda && (
                      <div className="pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Agenda</p>
                        <p className="text-sm" style={{ color: 'var(--text-2)' }}>{m.agenda}</p>
                      </div>
                    )}
                    {m.outcome && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Outcome / Notes</p>
                        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }}>
                          {m.outcome}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
