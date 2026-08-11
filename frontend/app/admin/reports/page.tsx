"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import {
  getSubmissions, getAuditLog, getAllReviews, getAllMeetings,
  STAGES, STAGE_LABELS, fmtDate,
  type Submission, type Review, type Meeting,
} from '../../../lib/store';

export default function AdminReportsPage() {
  const { getAllUsers } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviews, setReviews]         = useState<Review[]>([]);
  const [meetings, setMeetings]       = useState<Meeting[]>([]);
  const [auditCount, setAuditCount]   = useState(0);
  const [loading, setLoading]         = useState(true);

  const allUsers    = getAllUsers();
  const students    = allUsers.filter(u => u.role === 'STUDENT');
  const supervisors = allUsers.filter(u => u.role === 'SUPERVISOR');

  useEffect(() => {
    Promise.all([getSubmissions(), getAuditLog(), getAllReviews(), getAllMeetings()]).then(([subs, log, revs, mtgs]) => {
      setSubmissions(subs);
      setAuditCount(log.length);
      setReviews(revs);
      setMeetings(mtgs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Submission metrics
  const totalSubmissions = submissions.length;
  const approved   = submissions.filter(s => s.status === 'APPROVED').length;
  const pending    = submissions.filter(s => s.status === 'PENDING').length;
  const revision   = submissions.filter(s => s.status === 'REVISION_REQUIRED').length;

  const completedProjects = students.filter(s => {
    const subs = submissions.filter(x => x.studentId === s.id);
    return STAGES.every(st => subs.filter(x => x.stage === st).sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED');
  }).length;

  const assignedStudents   = students.filter(s => (s as any).supervisorId).length;
  const unassignedStudents = students.length - assignedStudents;

  // Stage distribution
  const stageDist = STAGES.map(st => ({
    label: STAGE_LABELS[st],
    count: submissions.filter(s => s.stage === st && s.status === 'APPROVED').length,
  }));
  const maxStageCount = Math.max(...stageDist.map(s => s.count), 1);

  // Supervision quality per supervisor
  const supQuality = supervisors.map(sv => {
    const svSubs     = submissions.filter(s => s.supervisorId === sv.id);
    const svReviews  = reviews.filter(r => r.supervisorId === sv.id);
    const svMeetings = meetings.filter(m => m.supervisorId === sv.id && m.status === 'COMPLETED');

    // Average response time: for each review, find the matching submission's createdAt
    const responseTimes: number[] = [];
    svReviews.forEach(r => {
      const sub = svSubs.find(s => s.id === r.submissionId);
      if (!sub) return;
      const diffHours = (new Date(r.reviewedAt).getTime() - new Date(sub.createdAt).getTime()) / 3_600_000;
      if (diffHours > 0) responseTimes.push(diffHours);
    });
    const avgResponseHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

    // Review rate = reviews done / submissions received
    const reviewRate = svSubs.length > 0 ? Math.round((svReviews.length / svSubs.length) * 100) : 0;

    // Quality score 0-100
    let score = 0;
    // 40 pts — response time
    if (avgResponseHours === null) score += 0;
    else if (avgResponseHours <= 24)  score += 40;
    else if (avgResponseHours <= 48)  score += 30;
    else if (avgResponseHours <= 72)  score += 20;
    else                              score += 10;
    // 30 pts — review rate
    score += Math.round(reviewRate * 0.3);
    // 30 pts — meeting engagement (capped at 5 completed meetings = full points)
    score += Math.min(svMeetings.length, 5) * 6;

    return {
      name:             sv.name,
      students:         students.filter(s => (s as any).supervisorId === sv.id).length,
      submissions:      svSubs.length,
      reviews:          svReviews.length,
      reviewRate,
      avgResponseHours,
      completedMeetings: svMeetings.length,
      score,
    };
  }).sort((a, b) => b.score - a.score);

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Students', students.length],
      ['Total Supervisors', supervisors.length],
      ['Assigned Students', assignedStudents],
      ['Unassigned Students', unassignedStudents],
      ['Total Submissions', totalSubmissions],
      ['Approved', approved],
      ['Pending Review', pending],
      ['Revision Required', revision],
      ['Completed Projects', completedProjects],
      ['Audit Log Entries', auditCount],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ipms_report.csv'; a.click();
  };

  const fmtHours = (h: number | null) => {
    if (h === null) return '—';
    if (h < 1)   return '<1h';
    if (h < 24)  return `${Math.round(h)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  const scoreColor = (s: number) => s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Admin</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Reports & Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>System-wide statistics, project health, and supervision quality.</p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary text-sm">Export CSV</button>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading data…</div>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Total Students',     value: students.length,    accent: '#3b82f6' },
              { label: 'Total Supervisors',  value: supervisors.length, accent: '#8b5cf6' },
              { label: 'Assigned Students',  value: assignedStudents,   accent: '#10b981' },
              { label: 'Unassigned',         value: unassignedStudents, accent: '#f59e0b' },
              { label: 'Completed Projects', value: completedProjects,  accent: '#10b981' },
              { label: 'Audit Log Entries',  value: auditCount,         accent: '#6b7280' },
            ].map(c => (
              <div key={c.label} className="card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl font-bold"
                  style={{ background: `${c.accent}18`, color: c.accent }}>{c.value}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Submission breakdown */}
          <div className="card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>Submission Status</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Approved',          value: approved,  bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
                { label: 'Pending Review',    value: pending,   bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)' },
                { label: 'Revision Required', value: revision,  bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  text: 'var(--danger-text)'  },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-4 text-center"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="text-3xl font-bold" style={{ color: c.text }}>{c.value}</div>
                  <div className="text-xs mt-1 font-medium" style={{ color: c.text }}>{c.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: c.text, opacity: 0.7 }}>
                    {totalSubmissions > 0 ? `${Math.round((c.value / totalSubmissions) * 100)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage approval chart */}
          <div className="card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>Approvals by Stage</h2>
            <div className="space-y-3">
              {stageDist.map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-28 text-xs shrink-0 text-right" style={{ color: 'var(--text-3)' }}>{s.label}</div>
                  <div className="flex-1 h-7 rounded-lg overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
                      style={{ width: `${(s.count / maxStageCount) * 100}%`, background: 'linear-gradient(90deg,#2563eb,#3b82f6)', minWidth: s.count > 0 ? '2rem' : '0' }}>
                      {s.count > 0 && <span className="text-xs font-semibold text-white">{s.count}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supervision Quality */}
          {supQuality.length > 0 && (
            <div className="card p-6">
              <div className="mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Supervision Quality Assessment</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)', opacity: 0.7 }}>
                  Score based on response time (40 pts), review rate (30 pts), and meeting engagement (30 pts).
                </p>
              </div>
              <div className="space-y-3">
                {supQuality.map(sv => {
                  const color = scoreColor(sv.score);
                  return (
                    <div key={sv.name} className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{sv.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {sv.students} student{sv.students !== 1 ? 's' : ''} · {sv.reviews} review{sv.reviews !== 1 ? 's' : ''} · {sv.completedMeetings} meeting{sv.completedMeetings !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Avg Response</div>
                            <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmtHours(sv.avgResponseHours)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Review Rate</div>
                            <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{sv.reviewRate}%</div>
                          </div>
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                            style={{ background: `${color}18`, color }}>
                            {sv.score}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${sv.score}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supervisor workload */}
          {supQuality.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>Supervisor Workload</h2>
              <div className="space-y-2">
                {supQuality.map(sv => (
                  <div key={sv.name} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                    style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{sv.name}</span>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <span style={{ color: 'var(--text-2)' }}>{sv.students} student{sv.students !== 1 ? 's' : ''}</span>
                      <span style={{ color: 'var(--text-2)' }}>{sv.submissions} submission{sv.submissions !== 1 ? 's' : ''}</span>
                      {sv.reviews > 0 && (
                        <span className="inline-flex px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
                          {sv.reviews} reviewed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
