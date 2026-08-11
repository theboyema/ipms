"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import { getSubmissions, getAllMeetings, STAGES, STAGE_LABELS, fmtDate, type Submission, type Meeting } from '../../../lib/store';

type RiskLevel = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

function computeRisk(
  studentId: string,
  subs: Submission[],
  meetings: Meeting[],
  supervisorId: string | undefined,
): RiskLevel {
  if (!supervisorId) return 'CRITICAL';

  const mySubs = subs.filter(s => s.studentId === studentId);
  if (mySubs.length === 0) return 'AT_RISK';

  const latest = [...mySubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const daysSince = (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000;

  // Count stages stuck on revision
  const stagesStuck = STAGES.filter(st => {
    const stageSubs = mySubs.filter(s => s.stage === st).sort((a, b) => b.version - a.version);
    return stageSubs.length >= 3 && stageSubs[0]?.status === 'REVISION_REQUIRED';
  }).length;

  const approvedStages = STAGES.filter(st =>
    mySubs.filter(s => s.stage === st).sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED'
  ).length;
  const pct = approvedStages / STAGES.length;

  if (daysSince > 30 && pct < 0.5) return 'CRITICAL';
  if (stagesStuck > 0) return 'CRITICAL';
  if (daysSince > 14 && pct < 0.8) return 'AT_RISK';
  return 'HEALTHY';
}

function computeHealthScore(
  studentId: string,
  subs: Submission[],
  meetings: Meeting[],
): number {
  const mySubs     = subs.filter(s => s.studentId === studentId);
  const myMeetings = meetings.filter(m => m.studentId === studentId && m.status === 'COMPLETED');

  const approvedStages = STAGES.filter(st =>
    mySubs.filter(s => s.stage === st).sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED'
  ).length;

  // 40 pts — progress
  const progressScore = (approvedStages / STAGES.length) * 40;

  // 30 pts — recent activity (0 if no submissions, scales with recency up to 30 days)
  let activityScore = 0;
  if (mySubs.length > 0) {
    const latest = [...mySubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const daysSince = (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000;
    activityScore = Math.max(0, (30 - daysSince) / 30) * 30;
  }

  // 20 pts — low revision rate (more revisions = lower score)
  const revisions = mySubs.filter(s => s.status === 'REVISION_REQUIRED').length;
  const total     = mySubs.length;
  const revisionScore = total > 0 ? Math.max(0, 1 - revisions / total) * 20 : 0;

  // 10 pts — meeting engagement
  const meetingScore = myMeetings.length > 0 ? 10 : 0;

  return Math.round(progressScore + activityScore + revisionScore + meetingScore);
}

const RISK_STYLE: Record<RiskLevel, React.CSSProperties> = {
  HEALTHY:  { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  AT_RISK:  { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
  CRITICAL: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
};

export default function AdminProjectsPage() {
  const { getAllUsers } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [meetings, setMeetings]       = useState<Meeting[]>([]);
  const [loading, setLoading]         = useState(true);
  const [riskFilter, setRiskFilter]   = useState<'ALL' | RiskLevel>('ALL');

  const allUsers    = getAllUsers();
  const students    = allUsers.filter(u => u.role === 'STUDENT');
  const supervisors = allUsers.filter(u => u.role === 'SUPERVISOR');

  useEffect(() => {
    Promise.all([getSubmissions(), getAllMeetings()]).then(([subs, mtgs]) => {
      setSubmissions(subs);
      setMeetings(mtgs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const studentProgress = students.map(s => {
    const supervisorId = (s as any).supervisorId as string | undefined;
    const mySubs       = submissions.filter(x => x.studentId === s.id);

    const approvedStages = STAGES.filter(st =>
      mySubs.filter(x => x.stage === st).sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED'
    );
    const latestSub   = [...mySubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const hasPending  = mySubs.some(x => x.status === 'PENDING');
    const hasRevision = mySubs.some(x => x.status === 'REVISION_REQUIRED');
    const supervisor  = supervisors.find(sv => sv.id === supervisorId);
    const risk        = computeRisk(s.id, submissions, meetings, supervisorId);
    const health      = computeHealthScore(s.id, submissions, meetings);
    const currentStage = STAGES.find(st => {
      const latest = mySubs.filter(x => x.stage === st).sort((a, b) => b.version - a.version)[0];
      return !latest || latest.status !== 'APPROVED';
    }) ?? STAGES[STAGES.length - 1];

    return { student: s, approvedStages, latestSub, hasPending, hasRevision, supervisor, totalSubs: mySubs.length, risk, health, currentStage };
  });

  const total     = studentProgress.length;
  const completed = studentProgress.filter(p => p.approvedStages.length === STAGES.length).length;
  const active    = studentProgress.filter(p => p.totalSubs > 0 && p.approvedStages.length < STAGES.length).length;
  const critical  = studentProgress.filter(p => p.risk === 'CRITICAL').length;
  const atRisk    = studentProgress.filter(p => p.risk === 'AT_RISK').length;

  const filtered = riskFilter === 'ALL' ? studentProgress : studentProgress.filter(p => p.risk === riskFilter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Admin</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Project Overview</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Monitor all projects, health scores, and risk levels.</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total Projects', value: total,     accent: '#3b82f6' },
          { label: 'Active',         value: active,    accent: '#f59e0b' },
          { label: 'Completed',      value: completed, accent: '#10b981' },
          { label: 'At Risk',        value: atRisk,    accent: '#f59e0b' },
          { label: 'Critical',       value: critical,  accent: '#ef4444' },
        ].map(c => (
          <div key={c.label} className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl font-bold"
              style={{ background: `${c.accent}18`, color: c.accent }}>{c.value}</div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Critical alert banner */}
      {critical > 0 && (
        <div className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger-text)' }}>
              {critical} project{critical !== 1 ? 's' : ''} at critical risk
            </p>
            <p className="text-xs mt-0.5 text-slate-400">These students are inactive, stuck, or unassigned. Immediate intervention recommended.</p>
          </div>
        </div>
      )}

      {/* Risk filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
        {(['ALL', 'HEALTHY', 'AT_RISK', 'CRITICAL'] as const).map(f => (
          <button key={f} onClick={() => setRiskFilter(f)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={riskFilter === f
              ? { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }
              : { color: 'var(--text-3)' }}>
            {f === 'ALL' ? `All (${total})` : f === 'HEALTHY' ? `Healthy (${studentProgress.filter(p=>p.risk==='HEALTHY').length})` : f === 'AT_RISK' ? `At Risk (${atRisk})` : `Critical (${critical})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>No students yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
                {['Student', 'Supervisor', 'Progress', 'Health', 'Stage', 'Last Activity', 'Risk'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ student, approvedStages, latestSub, supervisor, risk, health, currentStage }) => {
                const pct = Math.round((approvedStages.length / STAGES.length) * 100);
                const healthColor = health >= 70 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{student.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{(student as any).studentId || student.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: supervisor ? 'var(--text-2)' : 'var(--warning-text)' }}>
                      {supervisor ? supervisor.name : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3.5 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : 'linear-gradient(90deg,#2563eb,#3b82f6)' }} />
                        </div>
                        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-2)' }}>{pct}%</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{approvedStages.length}/{STAGES.length} stages</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${healthColor}18`, color: healthColor }}>
                          {health}
                        </div>
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${health}%`, background: healthColor }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-2)' }}>
                      {STAGE_LABELS[currentStage]}
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-3)' }}>
                      {latestSub ? fmtDate(latestSub.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={RISK_STYLE[risk]}>
                        {risk === 'AT_RISK' ? 'At Risk' : risk === 'CRITICAL' ? 'Critical' : 'Healthy'}
                      </span>
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
