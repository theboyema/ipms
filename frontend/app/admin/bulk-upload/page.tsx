"use client";
import React, { useState, useRef } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import { addAudit } from '../../../lib/store';

type ParsedRow = {
  name: string; email: string; studentId: string; indexNumber: string;
  department: string; course: string; level: string; phone: string;
  password: string;
  status: 'ok' | 'error' | 'duplicate';
  error?: string;
};

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(line =>
    line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
  );
}

const EXPECTED_HEADERS = ['name', 'email', 'studentid', 'indexnumber', 'department', 'course', 'level', 'phone'];

export default function BulkUploadPage() {
  const { getAllUsers, createStudent, user: adminUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]             = useState<ParsedRow[]>([]);
  const [fileName, setFileName]     = useState('');
  const [parsed, setParsed]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [done, setDone]             = useState<{ success: number; failed: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    setParseError(null);
    setParsed(false);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const lines = parseCSV(text);
        if (lines.length < 2) { setParseError('CSV must have a header row and at least one data row.'); return; }

        const headers = lines[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
        const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          setParseError(`Missing columns: ${missing.join(', ')}. Required: name, email, studentId, indexNumber, department, course, level, phone.`);
          return;
        }

        const idx = (col: string) => headers.indexOf(col);
        const existing = getAllUsers();
        const existingEmails = new Set(existing.map(u => u.email.toLowerCase()));
        const existingIds    = new Set(existing.map(u => u.studentId).filter(Boolean));
        const seenEmails     = new Set<string>();

        const parsedRows: ParsedRow[] = lines.slice(1).filter(r => r.some(c => c)).map(r => {
          const name        = r[idx('name')] || '';
          const email       = (r[idx('email')] || '').toLowerCase();
          const studentId   = r[idx('studentid')] || '';
          const indexNumber = r[idx('indexnumber')] || '';
          const department  = r[idx('department')] || '';
          const course      = r[idx('course')] || '';
          const level       = r[idx('level')] || '';
          const phone       = r[idx('phone')] || '';
          const password    = genPassword();

          if (!name || !email) return { name, email, studentId, indexNumber, department, course, level, phone, password, status: 'error' as const, error: 'Name and email are required.' };
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { name, email, studentId, indexNumber, department, course, level, phone, password, status: 'error' as const, error: 'Invalid email address.' };
          if (existingEmails.has(email) || seenEmails.has(email)) return { name, email, studentId, indexNumber, department, course, level, phone, password, status: 'duplicate' as const, error: 'Duplicate email.' };
          if (studentId && existingIds.has(studentId)) return { name, email, studentId, indexNumber, department, course, level, phone, password, status: 'duplicate' as const, error: 'Duplicate Student ID.' };

          seenEmails.add(email);
          return { name, email, studentId, indexNumber, department, course, level, phone, password, status: 'ok' as const };
        });

        setRows(parsedRows);
        setParsed(true);
      } catch {
        setParseError('Failed to parse CSV. Ensure the file is valid comma-separated.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => r.status === 'ok');
    if (toImport.length === 0) return;
    setUploading(true);
    let success = 0; let failed = 0;
    for (const row of toImport) {
      try {
        await createStudent({ name: row.name, email: row.email, password: row.password, studentId: row.studentId, indexNumber: row.indexNumber, department: row.department, course: row.course, level: row.level, phone: row.phone, mustChangePassword: true, status: 'ACTIVE' });
        success++;
      } catch { failed++; }
    }
    await addAudit({ userId: adminUser?.id || 'admin', userName: adminUser?.name || 'Administrator', action: 'BULK_UPLOAD', details: `Bulk imported ${success} students (${failed} failed) from ${fileName}` });
    setDone({ success, failed });
    setUploading(false);
    setParsed(false);
    setRows([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const okCount  = rows.filter(r => r.status === 'ok').length;
  const errCount = rows.filter(r => r.status === 'error' || r.status === 'duplicate').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Admin</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Bulk Upload Students</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Import multiple student accounts from a CSV file. Passwords are auto-generated and students must change them on first login.</p>
      </div>

      {done && (
        <div className="rounded-2xl px-5 py-4"
          style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
          <p className="font-bold text-sm" style={{ color: 'var(--success-text)' }}>Import complete!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--success-text)' }}>{done.success} student{done.success !== 1 ? 's' : ''} created.{done.failed > 0 ? ` ${done.failed} failed.` : ''}</p>
        </div>
      )}

      {/* CSV format guide */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>CSV Format</h2>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Your file must have these columns (in any order):</p>
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
                {['name', 'email', 'studentId', 'indexNumber', 'department', 'course', 'level', 'phone'].map(h => (
                  <th key={h} className="px-3 py-2 text-left" style={{ color: 'var(--text-2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {['John Doe', 'john@uni.edu', 'STU001', '00100001', 'CS', 'BSc CS', '400', '+233...'].map((v, i) => (
                  <td key={i} className="px-3 py-2" style={{ color: 'var(--text-3)' }}>{v}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>Passwords are auto-generated. Students will be required to change their password on first login.</p>
      </div>

      {/* Upload area */}
      <div className="card p-6">
        <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all"
          style={{ borderColor: 'var(--border-2)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}>
          <div className="text-3xl">📂</div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{fileName || 'Click to choose a CSV file'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>.csv files only</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
        {parseError && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}>
            {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {parsed && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
                ✓ {okCount} ready
              </span>
              {errCount > 0 && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}>
                  ✗ {errCount} issues
                </span>
              )}
            </div>
            <button onClick={handleImport} disabled={uploading || okCount === 0} className="btn-primary text-sm px-6 py-2.5">
              {uploading ? 'Importing…' : `Import ${okCount} Student${okCount !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
                  {['Status', 'Name', 'Email', 'Student ID', 'Dept / Course', 'Gen. Password'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: r.status !== 'ok' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td className="px-4 py-2.5">
                      {r.status === 'ok'
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>Ready</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" title={r.error}
                            style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}>
                            {r.status === 'duplicate' ? 'Dup.' : 'Error'}
                          </span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--text-1)' }}>{r.name || '—'}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>{r.email || '—'}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>{r.studentId || '—'}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>
                      {[r.department, r.course, r.level ? `L${r.level}` : ''].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: r.status === 'ok' ? 'var(--text-2)' : 'var(--danger-text)' }}>
                      {r.status === 'ok' ? r.password : <em>{r.error}</em>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
            Generated passwords are shown above. Share them with students securely — they must be changed on first login.
          </p>
        </div>
      )}
    </div>
  );
}
