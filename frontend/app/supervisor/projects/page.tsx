"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../components/auth/auth-context';
import { subscribeSupervisorSubmissions, STAGES, STAGE_LABELS, fmtDate, type Submission } from '../../../lib/store';
import { computeRiskScore } from '../../../lib/analytics';

export default function SupervisorProjectsPage() {
  const { user, getAllUsers } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);

  const allUsers   = getAllUsers();
  const myStudents = allUsers.filter(u => (u as any).supervisorId === user?.id);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSupervisorSubmissions(user.id, setSubs);
    return () => unsub();
  }, [user?.id]);

  const latestForStage = (studentId: string, stage: typeof STAGES[number]) =>
    subs.filter(s => s.studentId === studentId && s.stage === stage)
      .sort((a, b) => b.version - a.version)[0];

  const projects = myStudents.map(s => {
    const mySubs       = subs.filter(x => x.studentId === s.id);
    const approvedCount = STAGES.filter(st => latestForStage(s.id, st)?.status === 'APPROVED').length;
    const pct           = Math.round((approvedCount / STAGES.length) * 100);
    const hasPending    = mySubs.some(x => x.status === 'PENDING');
    const hasRevision   = mySubs.some(x => x.status === 'REVISION_REQUIRED');
    const latestSub     = [...mySubs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const currentStage  = STAGES.find(st => {
      const l = latestForStage(s.id, st);
      return !l || l.status !== 'APPROVED';
    }) ?? STAGES[STAGES.length - 1];
    const { level: risk } = computeRiskScore(s.id, subs, user?.id);
    return { student: s as any, approvedCount, pct, hasPending, hasRevision, latestSub, currentStage, risk };
  });

  const RISK_STYLE: Record<string, React.CSSProperties> = {
    HEALTHY:  { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
    AT_RISK:  { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
    CRITICAL: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Supervisor</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Projects</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          {myStudents.length} assigned student{myStudents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>No students assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(({ student, approvedCount, pct, hasPending, hasRevision, latestSub, currentStage, risk }) => {
            return (
              <Link key={student.id} href={`/supervisor/students/${student.id}`}
                className="card p-5 flex flex-col gap-4 hover:scale-[1.01] transition-all duration-200 group">

                {/* Student info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                    {student.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{student.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                      {student.course ?? student.email}{student.level ? ` · L${student.level}` : ''}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{approvedCount}/{STAGES.length} stages</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : 'linear-gradient(90deg,#2563eb,#3b82f6)' }} />
                  </div>
                </div>

                {/* Current stage */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>Stage:</span>
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text-2)' }}>{STAGE_LABELS[currentStage]}</span>
                </div>

                {/* Status row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-1.5 flex-wrap">
                    {hasPending && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>
                        Pending
                      </span>
                    )}
                    {hasRevision && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}>
                        Revision
                      </span>
                    )}
                    {!hasPending && !hasRevision && latestSub && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
                        Up to date
                      </span>
                    )}
                    {!latestSub && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--neutral-bg)', color: 'var(--neutral-text)', border: '1px solid var(--neutral-border)' }}>
                        No submissions
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={RISK_STYLE[risk]}>
                    {risk === 'AT_RISK' ? 'At Risk' : risk === 'CRITICAL' ? 'Critical' : 'Healthy'}
                  </span>
                </div>

                {latestSub && (
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    Last activity: {fmtDate(latestSub.createdAt)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
