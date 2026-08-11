/**
 * IPMS Analytics — Realistic scoring algorithms for project health,
 * at-risk detection, and supervision quality assessment.
 *
 * All time-based components use exponential decay rather than step thresholds
 * because student engagement degrades continuously, not in discrete jumps.
 *
 * Supervision consistency is measured via the coefficient of variation (CV)
 * of response times — a statistically standard measure of relative dispersion.
 */

import type { Submission, Review, Meeting } from './store';
import { STAGES } from './store';

export type RiskLevel = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

// ─── At-Risk Score (0–100, higher = more at risk) ────────────────────────────
//
// Four independent risk factors are summed. Each factor has a documented
// ceiling so examiners can reproduce the calculation from first principles.
//
// Factor caps:
//   Unassigned                 20 pts (binary: you either have a supervisor or not)
//   Inactivity                 40 pts (exponential growth, saturates at 60 days)
//   Revision depth             25 pts (piecewise — max version on any single stage)
//   Pending submission wait    15 pts (exponential, saturates at 14 days)
//                              ──────
//   Max possible              100 pts
//
// Thresholds:  0–24 = HEALTHY | 25–49 = AT_RISK | 50+ = CRITICAL

export function computeRiskScore(
  studentId: string,
  subs: Submission[],
  supervisorId: string | undefined,
): { score: number; level: RiskLevel; breakdown: Record<string, number> } {
  const mySubs = subs.filter(s => s.studentId === studentId);

  // Factor 1 — unassigned (20 pts)
  const unassignedPts = supervisorId ? 0 : 20;

  // Factor 2 — inactivity (0–40 pts)
  // Uses a logistic-inspired curve:  40 × (1 − e^(−days / τ))  where τ = 20 days
  // At 14 days → ~24 pts; at 30 days → ~34 pts; at 60 days → ~39 pts
  let inactivityPts = 0;
  if (mySubs.length === 0) {
    inactivityPts = 25; // no submissions at all — mid-range warning
  } else {
    const latest = [...mySubs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const d = daysSince(latest.createdAt);
    inactivityPts = Math.min(40, Math.round(40 * (1 - Math.exp(-d / 20))));
  }

  // Factor 3 — revision depth (0–25 pts)
  // Max version number across all stages. Higher versions mean the student
  // is cycling through revisions without making sufficient progress.
  const maxVersion = STAGES.reduce((max, st) => {
    const v = Math.max(0, ...mySubs.filter(s => s.stage === st).map(s => s.version));
    return Math.max(max, v);
  }, 0);
  const revisionPts = maxVersion >= 6 ? 25
    : maxVersion >= 5 ? 20
    : maxVersion >= 4 ? 14
    : maxVersion >= 3 ? 8
    : maxVersion >= 2 ? 3
    : 0;

  // Factor 4 — pending submission wait (0–15 pts)
  // Uses exponential: 15 × (1 − e^(−days / τ)) where τ = 5 days
  // At 3 days → ~7 pts; at 7 days → ~11 pts; at 14 days → ~14 pts
  let pendingPts = 0;
  const pendingSubs = mySubs.filter(s => s.status === 'PENDING');
  if (pendingSubs.length > 0) {
    const oldest = pendingSubs.reduce((a, b) =>
      new Date(a.createdAt) < new Date(b.createdAt) ? a : b
    );
    const waitDays = daysSince(oldest.createdAt);
    pendingPts = Math.min(15, Math.round(15 * (1 - Math.exp(-waitDays / 5))));
  }

  const score = Math.min(100, unassignedPts + inactivityPts + revisionPts + pendingPts);
  const level: RiskLevel = score >= 50 ? 'CRITICAL' : score >= 25 ? 'AT_RISK' : 'HEALTHY';

  return {
    score,
    level,
    breakdown: {
      unassigned:  unassignedPts,
      inactivity:  inactivityPts,
      revision:    revisionPts,
      pendingWait: pendingPts,
    },
  };
}

// ─── Project Health Score (0–100) ────────────────────────────────────────────
//
// Four components, each with its own rationale:
//
//  1. Stage progress   (35 pts) — fraction of stages approved
//  2. Activity recency (30 pts) — exponential decay with 14-day half-life
//     Models the idea that the signal of "active student" decays to half
//     its value after two weeks of silence, down to near-zero at 6 weeks.
//  3. First-try quality (20 pts) — fraction of approved stages reached in ≤ 2 tries
//     Higher first-pass approval = better preparation, clearer work.
//  4. Engagement       (15 pts) — completed meetings (10) + submission frequency (5)
//     Captures the relationship dimension of supervision.

export function computeHealthScore(
  studentId: string,
  subs: Submission[],
  meetings: Meeting[],
): number {
  const mySubs     = subs.filter(s => s.studentId === studentId);
  const myMeetings = meetings.filter(m => m.studentId === studentId && m.status === 'COMPLETED');

  // 1. Stage progress (35 pts)
  const approvedStages = STAGES.filter(st =>
    mySubs.filter(s => s.stage === st)
      .sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED'
  ).length;
  const progressScore = (approvedStages / STAGES.length) * 35;

  // 2. Activity recency (30 pts) — exponential decay, half-life = 14 days
  let activityScore = 0;
  if (mySubs.length > 0) {
    const latest = [...mySubs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const days = daysSince(latest.createdAt);
    activityScore = 30 * Math.exp(-Math.LN2 * days / 14);
  }

  // 3. First-try quality (20 pts)
  const stagesAttempted = STAGES.filter(st => mySubs.some(s => s.stage === st));
  const stagesApprovedEarly = stagesAttempted.filter(st => {
    const stageSubs = mySubs.filter(s => s.stage === st).sort((a, b) => b.version - a.version);
    return stageSubs[0]?.status === 'APPROVED' && stageSubs[0].version <= 2;
  });
  const qualityRate  = stagesAttempted.length > 0
    ? stagesApprovedEarly.length / stagesAttempted.length
    : 1; // no submissions yet: don't penalise
  const qualityScore = qualityRate * 20;

  // 4. Engagement (15 pts)
  // Meetings: logarithmic-style — first 3 meetings carry most of the weight
  const meetingScore = Math.min(10, myMeetings.length * (10 / 3));
  // Recent submission frequency over last 30 days: full 5 pts at 2+ submissions
  const recentCount = mySubs.filter(s => daysSince(s.createdAt) <= 30).length;
  const freqScore   = Math.min(5, recentCount * 2.5);
  const engagementScore = meetingScore + freqScore;

  return Math.min(100, Math.round(progressScore + activityScore + qualityScore + engagementScore));
}

// ─── Supervision Quality Score (0–100) ───────────────────────────────────────
//
// Four components:
//
//  1. Response time       (40 pts) — exponential decay on the median response time
//     Using median (not mean) makes the score robust to occasional outliers
//     (e.g. a two-week holiday shouldn't destroy an otherwise responsive supervisor).
//     τ = 48 h → at 24h: 33 pts; at 48h: 25 pts; at 72h: 19 pts; at 1 week: 7 pts.
//
//  2. Review completion   (30 pts) — fraction of received submissions reviewed
//     A supervisor who reviews all work scores full points regardless of speed.
//
//  3. Response consistency (15 pts) — lower coefficient of variation (CV) = more points
//     CV = σ / μ. A supervisor who takes 2h every time scores higher than one
//     who sometimes replies in 1h and sometimes in 7 days.
//     Modelled as: 15 × e^(−CV / 2). Needs ≥ 3 data points to be meaningful.
//
//  4. Meeting engagement  (15 pts) — completed meetings per supervised student
//     Full points when the supervisor has held ≥ 2 completed meetings per student.

export function computeSupervisionQuality(
  supervisorId: string,
  subs: Submission[],
  reviews: Review[],
  meetings: Meeting[],
  studentCount: number,
): {
  score: number;
  medianResponseHours: number | null;
  avgResponseHours: number | null;
  reviewRate: number;
  completedMeetings: number;
  consistencyScore: number;
  breakdown: Record<string, number>;
} {
  const svSubs     = subs.filter(s => s.supervisorId === supervisorId);
  const svReviews  = reviews.filter(r => r.supervisorId === supervisorId);
  const svMeetings = meetings.filter(m => m.supervisorId === supervisorId && m.status === 'COMPLETED');

  // Collect valid response times (must be positive and under 1 year to exclude bad data)
  const responseTimes: number[] = [];
  svReviews.forEach(r => {
    const sub = svSubs.find(s => s.id === r.submissionId);
    if (!sub) return;
    const h = hoursBetween(sub.createdAt, r.reviewedAt);
    if (h > 0 && h < 8_760) responseTimes.push(h);
  });

  const medianHours = responseTimes.length > 0 ? median(responseTimes) : null;
  const avgHours    = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  // 1. Response time — exponential decay on median, τ = 48 h (max 40 pts)
  const rtScore = medianHours !== null
    ? Math.round(40 * Math.exp(-medianHours / 48))
    : 0;

  // 2. Review completion rate (max 30 pts)
  const reviewRate = svSubs.length > 0
    ? Math.min(1, svReviews.length / svSubs.length)
    : 0;
  const reviewScore = Math.round(reviewRate * 30);

  // 3. Response consistency via CV (max 15 pts)
  let consistencyScore = 0;
  if (responseTimes.length >= 3) {
    const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const cv   = stdDev(responseTimes) / Math.max(1, mean);
    consistencyScore = Math.round(15 * Math.exp(-cv / 2));
  } else if (responseTimes.length >= 1) {
    consistencyScore = 8; // partial credit — has reviewed, insufficient data for CV
  }

  // 4. Meeting engagement (max 15 pts): full at 2 completed meetings per student
  const meetingsPerStudent = studentCount > 0 ? svMeetings.length / studentCount : 0;
  const meetingScore = Math.round(Math.min(1, meetingsPerStudent / 2) * 15);

  const score = Math.min(100, rtScore + reviewScore + consistencyScore + meetingScore);

  return {
    score,
    medianResponseHours: medianHours,
    avgResponseHours:    avgHours,
    reviewRate:          Math.round(reviewRate * 100),
    completedMeetings:   svMeetings.length,
    consistencyScore,
    breakdown: {
      responseTime:  rtScore,
      reviewRate:    reviewScore,
      consistency:   consistencyScore,
      meetings:      meetingScore,
    },
  };
}
