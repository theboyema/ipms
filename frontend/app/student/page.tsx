"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../components/auth/auth-context';
import {
  subscribeStudentSubmissions, subscribeNotifications,
  subscribeUnreadMsgCount, subscribeUnreadCount,
  markNotificationRead, markAllRead,
  STAGES, STAGE_LABELS, fmtDate,
  type Submission, type Notification,
} from '../../lib/store';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:           { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
  APPROVED:          { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  REVISION_REQUIRED: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', REVISION_REQUIRED: 'Revision',
};

export default function StudentDashboard() {
  const { user, getAllUsers } = useAuth();
  const [subs, setSubs]               = useState<Submission[]>([]);
  const [notifs, setNotifs]           = useState<Notification[]>([]);
  const [unreadMsg, setUnreadMsg]     = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const allUsers    = getAllUsers();
  const currentUser = allUsers.find(u => u.id === user?.id) as any;
  const supervisor  = allUsers.find(u => u.id === currentUser?.supervisorId) as any;

  useEffect(() => {
    if (!user) return;
    const unsubSubs   = subscribeStudentSubmissions(user.id, setSubs);
    const unsubNotifs = subscribeNotifications(user.id, setNotifs);
    const unsubMsg    = subscribeUnreadMsgCount(user.id, setUnreadMsg);
    const unsubUnread = subscribeUnreadCount(user.id, setUnreadNotifs);
    return () => { unsubSubs(); unsubNotifs(); unsubMsg(); unsubUnread(); };
  }, [user?.id]);

  const latestForStage = (s: typeof STAGES[number]) =>
    subs.filter(x => x.stage === s).sort((a, b) => b.version - a.version)[0];

  const approvedCount = STAGES.filter(s => latestForStage(s)?.status === 'APPROVED').length;
  const pendingCount  = subs.filter(s => s.status === 'PENDING').length;
  const revisionCount = STAGES.filter(s => latestForStage(s)?.status === 'REVISION_REQUIRED').length;
  const recent        = [...subs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Student</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Welcome back, {user?.name?.split(' ')[0] ?? 'Student'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {supervisor
              ? <>Supervisor: <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{supervisor.name}</span></>
              : <span style={{ color: 'var(--warning-text)' }}>No supervisor assigned yet — contact admin</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/student/submissions" className="btn-primary text-xs px-4 py-2">Submit Document</Link>
          <Link href="/student/messages" className="btn-secondary text-xs px-4 py-2 relative">
            Messages
            {unreadMsg > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: '#ef4444' }}>{unreadMsg}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Stages Approved',  value: `${approvedCount}/${STAGES.length}`, accent: '#10b981', href: '/student/submissions',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          { label: 'Pending Review',   value: pendingCount,         accent: '#f59e0b', href: '/student/submissions',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          { label: 'Needs Revision',   value: revisionCount,        accent: '#ef4444', href: '/student/submissions',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> },
          { label: 'Notifications',    value: unreadNotifs,         accent: '#3b82f6', href: '/student/messages',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg> },
        ].map(s => (
          <Link key={s.label} href={s.href} className="card p-3 sm:p-5 flex items-center gap-3 group transition-all duration-200 hover:scale-[1.01]"
            style={{ borderTop: `2px solid ${s.accent}22` }}>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-110"
              style={{ background: `${s.accent}14`, color: s.accent }}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{s.value}</div>
              <div className="text-[10px] sm:text-xs font-medium mt-0.5 leading-tight" style={{ color: 'var(--text-3)' }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* AI Assistant banner */}
      <Link href="/student/assistant"
        className="flex items-center gap-3 sm:gap-4 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 transition-all group"
        style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.09),rgba(124,58,237,0.09))', border: '1px solid rgba(37,99,235,0.25)' }}>
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-2xl shrink-0"
          style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>🤖</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>AI Academic Assistant</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--info-text)' }}>NEW</span>
          </div>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>Get instant guidance on stage requirements, revision reasons &amp; chapter content.</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--info-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">

          {/* Stage progress */}
          <div className="card p-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>Stage Progress</p>
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const latest = latestForStage(s);
                const status = latest?.status ?? 'NOT_STARTED';
                const circleStyle: React.CSSProperties =
                  status === 'APPROVED'          ? { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' } :
                  status === 'REVISION_REQUIRED' ? { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  } :
                  status === 'PENDING'           ? { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' } :
                                                   { background: 'var(--hover-bg)',   color: 'var(--text-3)',       border: '1px solid var(--border)' };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold" style={circleStyle}>
                      {status === 'APPROVED' ? '✓' : status === 'REVISION_REQUIRED' ? '!' : status === 'PENDING' ? '…' : i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{STAGE_LABELS[s]}</span>
                      {latest
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={STATUS_STYLE[latest.status]}>
                            {STATUS_LABEL[latest.status]}
                          </span>
                        : <span className="text-xs" style={{ color: 'var(--text-3)' }}>Not started</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/student/submissions" className="btn-secondary w-full text-center mt-5 text-sm">
              View All Submissions
            </Link>
          </div>

          {/* Recent submissions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Recent Submissions</p>
              <Link href="/student/submissions" className="text-xs font-semibold transition" style={{ color: 'var(--info-text)' }}>See all →</Link>
            </div>
            {recent.length === 0
              ? <p className="text-sm py-4 text-center" style={{ color: 'var(--text-3)' }}>No submissions yet.</p>
              : <div className="space-y-2">
                  {recent.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between gap-3 rounded-xl p-3 transition"
                      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{sub.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{STAGE_LABELS[sub.stage]} · v{sub.version} · {fmtDate(sub.createdAt)}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0" style={STATUS_STYLE[sub.status]}>
                        {STATUS_LABEL[sub.status]}
                      </span>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Notifications</p>
            {unreadNotifs > 0 && (
              <button onClick={async () => { if (user) await markAllRead(user.id); }}
                className="text-xs font-semibold transition" style={{ color: 'var(--info-text)' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0
            ? <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>No notifications yet.</p>
              </div>
            : <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-1">
                {notifs.map(n => (
                  <div key={n.id} onClick={async () => { await markNotificationRead(n.id); }}
                    className="cursor-pointer rounded-xl p-3 transition"
                    style={n.read
                      ? { background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }
                      : { background: 'rgba(37,99,235,0.06)', border: '1px solid var(--border-accent)' }
                    }>
                    <p className="text-sm font-semibold" style={{ color: n.read ? 'var(--text-2)' : 'var(--text-1)' }}>{n.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{n.message}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{fmtDate(n.createdAt)}</p>
                  </div>
                ))}
              </div>
          }
          <Link href="/student/messages" className="btn-secondary w-full text-center mt-4 text-sm">
            Open Messages
            {unreadMsg > 0 && (
              <span className="ml-2 rounded-full text-white text-xs px-1.5 py-0.5 font-bold"
                style={{ background: '#ef4444' }}>{unreadMsg}</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
