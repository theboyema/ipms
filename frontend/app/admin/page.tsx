"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../components/auth/auth-context';
import { getSubmissions, getAuditLog, fmtDateTime, type Submission } from '../../lib/store';
import { computeRiskScore } from '../../lib/analytics';

const stats = (students: any[], supervisors: any[], assigned: number, unassigned: number, active: number, pending: number, atRisk: number) => [
  { label: 'Total Students',     value: students.length,   href: '/admin/students',    accent: '#3b82f6', icon: <StudentIcon /> },
  { label: 'Supervisors',        value: supervisors.length,href: '/admin/supervisors', accent: '#10b981', icon: <SupervisorIcon /> },
  { label: 'Assigned Projects',  value: assigned,          href: '/admin/assignments', accent: '#8b5cf6', icon: <LinkIcon /> },
  { label: 'Unassigned',         value: unassigned,        href: '/admin/assignments', accent: unassigned > 0 ? '#f59e0b' : '#10b981', icon: <WarnIcon /> },
  { label: 'Pending Reviews',    value: pending,           href: '/admin/audit',       accent: pending > 0 ? '#f59e0b' : '#475569', icon: <ClipIcon /> },
  { label: 'At-Risk Projects',   value: atRisk,            href: '/admin/projects',    accent: atRisk > 0 ? '#ef4444' : '#10b981', icon: <CheckIcon /> },
];

function StudentIcon()   { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>; }
function SupervisorIcon() { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>; }
function LinkIcon()       { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>; }
function WarnIcon()       { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>; }
function CheckIcon()      { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>; }
function ClipIcon()       { return <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>; }

const quickActions = [
  { label: 'Manage Students',    href: '/admin/students',    desc: 'Create, edit, activate or deactivate student accounts' },
  { label: 'Manage Supervisors', href: '/admin/supervisors', desc: 'Create and manage supervisor accounts' },
  { label: 'Assign Supervisors', href: '/admin/assignments', desc: 'Link students to supervisors and set project titles' },
  { label: 'Bulk Upload',        href: '/admin/bulk-upload', desc: 'Import multiple students from a CSV file' },
  { label: 'Admin Approvals',    href: '/admin/approvals',   desc: 'Review pending administrator account applications' },
  { label: 'Activity Logs',      href: '/admin/audit',       desc: 'Full audit trail of all system actions' },
];

export default function AdminDashboard() {
  const { getAllUsers, getPendingAdmins } = useAuth();
  const [users, setUsers]               = useState<any[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [recentAudit, setRecentAudit]   = useState<any[]>([]);
  const [allSubs, setAllSubs]           = useState<Submission[]>([]);

  useEffect(() => {
    const all = getAllUsers();
    setUsers(all);
    setPendingAdmins(getPendingAdmins());
    (async () => {
      const [subs, audit] = await Promise.all([getSubmissions(), getAuditLog()]);
      setAllSubs(subs);
      setPendingReviews(subs.filter(s => s.status === 'PENDING').length);
      setRecentAudit(audit.slice(0, 8));
    })();
  }, [getAllUsers, getPendingAdmins]);

  const students    = users.filter(u => u.role === 'STUDENT');
  const supervisors = users.filter(u => u.role === 'SUPERVISOR');
  const unassigned  = students.filter(u => !u.supervisorId).length;
  const assigned    = students.filter(u => !!u.supervisorId).length;
  const active      = users.filter(u => u.status === 'ACTIVE' || !u.status).length;
  const atRisk      = students.filter(s => {
    const { level } = computeRiskScore(s.id, allSubs, (s as any).supervisorId);
    return level === 'AT_RISK' || level === 'CRITICAL';
  }).length;

  const statCards = stats(students, supervisors, assigned, unassigned, active, pendingReviews, atRisk);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Overview</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">System overview — users, submissions, approvals.</p>
        </div>
        {pendingAdmins.length > 0 && (
          <Link href="/admin/approvals" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-slate-900" style={{ background: '#f59e0b' }}>
              {pendingAdmins.length}
            </span>
            Admin approval{pendingAdmins.length !== 1 ? 's' : ''} pending →
          </Link>
        )}
      </div>

      {/* Alerts */}
      {unassigned > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl px-5 py-4"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>{unassigned} student{unassigned !== 1 ? 's' : ''} without a supervisor</p>
              <p className="text-xs text-slate-500 mt-0.5">These students cannot submit documents until assigned.</p>
            </div>
          </div>
          <Link href="/admin/assignments" className="btn-primary text-xs px-4 py-2 whitespace-nowrap">Assign Now →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {statCards.map(s => (
          <Link key={s.label} href={s.href} className="card p-3 sm:p-5 flex items-center gap-3 group transition-all duration-200 hover:scale-[1.01]"
            style={{ borderTop: `2px solid ${s.accent}22` }}
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-110"
              style={{ background: `${s.accent}14`, color: s.accent }}
            >
              {s.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{s.value}</div>
              <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 font-medium leading-tight">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">

        {/* Quick actions */}
        <div className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>Quick Actions</p>
          <div className="space-y-1.5">
            {quickActions.map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-150 group"
                style={{ border: '1px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
              >
                <div>
                  <p className="text-sm font-semibold transition-colors" style={{ color: 'var(--text-1)' }}>{a.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{a.desc}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-colors shrink-0 group-hover:text-blue-400" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Recent Activity</p>
            <Link href="/admin/audit" className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition">View all →</Link>
          </div>
          {recentAudit.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--hover-bg)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No activity yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)', opacity: 0.7 }}>Actions taken in the system will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {recentAudit.map(e => (
                <div key={e.id} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-1)' }}>{e.action.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] whitespace-nowrap shrink-0" style={{ color: 'var(--text-3)' }}>{fmtDateTime(e.timestamp)}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{e.details}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>by {e.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
