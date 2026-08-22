"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import {
  subscribeMeetings, addMeeting, updateMeeting, pushNotification,
  fmtDate, fmtDateTime,
  type Meeting, type MeetingStatus,
} from '../../../lib/store';

type Filter = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

const STATUS_STYLE: Record<MeetingStatus, React.CSSProperties> = {
  SCHEDULED:  { background: 'var(--info-bg)',    color: 'var(--info-text)',    border: '1px solid var(--info-border)'    },
  COMPLETED:  { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  CANCELLED:  { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)'  },
};

export default function SupervisorMeetingsPage() {
  const { user, getAllUsers } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter]     = useState<Filter>('ALL');
  const [showSchedule, setShowSchedule] = useState(false);
  const [outcomeFor, setOutcomeFor]     = useState<Meeting | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);

  const allUsers   = getAllUsers();
  const myStudents = allUsers.filter(u => (u as any).supervisorId === user?.id);

  const [form, setForm] = useState({
    studentId: '',
    title: '',
    date: '',
    time: '',
    location: '',
    agenda: '',
  });
  const [outcomeText, setOutcomeText] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeMeetings(user.id, 'supervisor', setMeetings);
  }, [user?.id]);

  const upcoming  = meetings.filter(m => m.status === 'SCHEDULED');
  const completed = meetings.filter(m => m.status === 'COMPLETED');
  const cancelled = meetings.filter(m => m.status === 'CANCELLED');
  const filtered  = filter === 'ALL' ? meetings : meetings.filter(m => m.status === filter);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.studentId || !form.title || !form.date || !form.time) return;
    const student = allUsers.find(u => u.id === form.studentId);
    if (!student) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      await addMeeting({
        supervisorId:   user.id,
        studentId:      form.studentId,
        supervisorName: user.name,
        studentName:    student.name,
        title:          form.title,
        scheduledAt,
        location:       form.location,
        agenda:         form.agenda,
        status:         'SCHEDULED',
        outcome:        '',
      });
      await pushNotification({
        userId: form.studentId,
        type:   'ASSIGNMENT',
        title:  'Meeting Scheduled',
        message: `${user.name} scheduled a meeting: "${form.title}" on ${fmtDateTime(new Date(`${form.date}T${form.time}`).toISOString())}`,
        link: '/student/meetings',
      });
      setForm({ studentId: '', title: '', date: '', time: '', location: '', agenda: '' });
      setShowSchedule(false);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeFor) return;
    setSaving(true);
    try {
      await updateMeeting(outcomeFor.id, { status: 'COMPLETED', outcome: outcomeText });
      await pushNotification({
        userId: outcomeFor.studentId,
        type:   'REVIEW',
        title:  'Meeting Completed',
        message: `Your meeting "${outcomeFor.title}" has been marked complete.`,
        link: '/student/meetings',
      });
      setOutcomeFor(null);
      setOutcomeText('');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (meeting: Meeting) => {
    if (!confirm(`Cancel the meeting "${meeting.title}"?`)) return;
    await updateMeeting(meeting.id, { status: 'CANCELLED' });
    await pushNotification({
      userId: meeting.studentId,
      type:   'REVIEW',
      title:  'Meeting Cancelled',
      message: `The meeting "${meeting.title}" has been cancelled by your supervisor.`,
      link: '/student/meetings',
    });
  };

  const isPast = (iso: string) => new Date(iso) < new Date();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Supervisor</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Meetings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Schedule and track meetings with your students.</p>
        </div>
        <button onClick={() => setShowSchedule(true)} className="btn-primary text-sm px-4 py-2">
          + Schedule Meeting
        </button>
      </div>

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

      {/* Meeting list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--hover-bg)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" style={{ color: 'var(--text-3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {meetings.length === 0 ? 'No meetings yet. Schedule one with a student.' : 'No meetings match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const open = expanded === m.id;
            const past = isPast(m.scheduledAt);
            return (
              <div key={m.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(open ? null : m.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                      {m.studentName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{m.title}</p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                        {m.studentName}
                      </p>
                      <p className="text-xs leading-snug" style={{ color: 'var(--text-3)' }}>
                        {fmtDateTime(m.scheduledAt)}{m.location && ` · ${m.location}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={STATUS_STYLE[m.status]}>
                      {m.status === 'SCHEDULED' ? (past ? 'Awaiting Outcome' : 'Upcoming') : m.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
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
                        <p className="text-sm" style={{ color: 'var(--text-2)' }}>{m.outcome}</p>
                      </div>
                    )}
                    {m.status === 'SCHEDULED' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setOutcomeFor(m); setOutcomeText(''); }}
                          className="btn-primary text-xs px-3 py-1.5">
                          Mark Complete
                        </button>
                        <button
                          onClick={() => handleCancel(m)}
                          className="btn-secondary text-xs px-3 py-1.5"
                          style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}>
                          Cancel Meeting
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="card p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Schedule Meeting</h2>
              <button onClick={() => setShowSchedule(false)} style={{ color: 'var(--text-3)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="label">Student <span className="text-red-400">*</span></label>
                <select className="input" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} required>
                  <option value="">Select a student…</option>
                  {myStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Meeting Title <span className="text-red-400">*</span></label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 1 Review" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date <span className="text-red-400">*</span></label>
                  <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Time <span className="text-red-400">*</span></label>
                  <input type="time" className="input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Office, Zoom, etc." />
              </div>
              <div>
                <label className="label">Agenda</label>
                <textarea className="input resize-none" rows={3} value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} placeholder="Topics to discuss…" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Scheduling…' : 'Schedule Meeting'}
                </button>
                <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark complete modal */}
      {outcomeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="card p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Mark Meeting Complete</h2>
              <button onClick={() => setOutcomeFor(null)} style={{ color: 'var(--text-3)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Recording outcome for: <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{outcomeFor.title}</span>
            </p>
            <form onSubmit={handleComplete} className="space-y-4">
              <div>
                <label className="label">Outcome / Meeting Notes</label>
                <textarea className="input resize-none" rows={4}
                  value={outcomeText}
                  onChange={e => setOutcomeText(e.target.value)}
                  placeholder="Summarise what was discussed and agreed…" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : 'Confirm Complete'}
                </button>
                <button type="button" onClick={() => setOutcomeFor(null)} className="btn-secondary flex-1">Back</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
