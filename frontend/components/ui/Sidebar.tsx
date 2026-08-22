"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/auth-context';
import { useSidebar } from './SidebarContext';

type NavItem = { href: string; label: string; icon: string };

const navItems: Record<string, NavItem[]> = {
  ADMIN: [
    { href: '/admin',             label: 'Dashboard',       icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/admin/students',    label: 'Students',        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { href: '/admin/supervisors', label: 'Supervisors',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { href: '/admin/assignments', label: 'Assignments',     icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { href: '/admin/projects',    label: 'Projects',        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/admin/reports',     label: 'Reports',         icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/admin/bulk-upload', label: 'Bulk Upload',     icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { href: '/admin/approvals',   label: 'Approvals',       icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/admin/audit',       label: 'Activity Log',    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { href: '/admin/settings',    label: 'Settings',        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ],
  SUPERVISOR: [
    { href: '/supervisor',           label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/supervisor/students',  label: 'My Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { href: '/supervisor/projects',  label: 'Projects',    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/supervisor/reviews',   label: 'Reviews',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { href: '/supervisor/meetings',  label: 'Meetings',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/supervisor/messages',  label: 'Messages',    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { href: '/supervisor/settings',  label: 'Settings',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ],
  STUDENT: [
    { href: '/student',             label: 'Dashboard',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/student/submissions', label: 'Submissions',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/student/meetings',    label: 'Meetings',     icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/student/assistant',   label: 'AI Assistant', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { href: '/student/messages',    label: 'Messages',     icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { href: '/student/settings',    label: 'Settings',     icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ],
};

function getPendingAdminCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const users = JSON.parse(localStorage.getItem('ipms_users_registered') || '[]');
    return users.filter((u: any) => u.role === 'ADMIN' && !u.verified).length;
  } catch { return 0; }
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {d.split(' M').map((seg, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { open, close, toggle } = useSidebar();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    setPendingCount(getPendingAdminCount());
    const refresh = () => setPendingCount(getPendingAdminCount());
    window.addEventListener('storage', refresh);
    window.addEventListener('ipms_data', refresh);
    const t = setInterval(refresh, 10000);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('ipms_data', refresh); clearInterval(t); };
  }, [user?.role]);

  if (!user) return null;
  const role  = user.role as keyof typeof navItems;
  const items = navItems[role] ?? navItems.STUDENT;

  const isActive = (href: string) =>
    href === '/admin' || href === '/student' || href === '/supervisor'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  const roleLabel: Record<string, string> = { ADMIN: 'Administrator', SUPERVISOR: 'Supervisor', STUDENT: 'Student' };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={close} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Header */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--sidebar-section-sep)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>🎓</div>
              <div>
                <div className="text-sm font-bold leading-none" style={{ color: 'var(--text-1)' }}>IPMS</div>
                <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'var(--text-3)' }}>Monitoring System</div>
              </div>
            </div>
            <button onClick={close} className="flex h-7 w-7 items-center justify-center rounded-lg transition"
              style={{ color: 'var(--sidebar-text)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* User card */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--sidebar-section-sep)' }}>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--sidebar-user-bg)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--text-1)' }}>{user.name}</div>
              <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--info-text)' }}>{roleLabel[role] ?? role}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map(item => {
            const active = isActive(item.href);
            const badge  = item.href === '/admin/approvals' ? pendingCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150"
                style={active ? {
                  background: 'var(--sidebar-active-bg)',
                  color: 'var(--sidebar-text-active)',
                  borderLeft: '2px solid var(--sidebar-active-border)',
                  paddingLeft: '10px',
                } : {
                  color: 'var(--sidebar-text)',
                  borderLeft: '2px solid transparent',
                }}
              >
                <span style={{ color: active ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon)' }}>
                  <NavIcon d={item.icon} />
                </span>
                <span className="flex-1 font-medium text-[13px]">{item.label}</span>
                {badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: '#2563eb' }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-5">
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sidebar-user-bg)', border: '1px solid var(--sidebar-section-sep)' }}>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>Intelligent Project<br />Monitoring System <span style={{ color: 'var(--text-3)' }}>v1.0</span></p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation — hidden on md+ screens */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
        style={{
          background: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around px-1 py-1.5">
          {items.slice(0, 4).map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
                style={{ color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-icon)', minWidth: 52 }}
              >
                <span style={{ color: active ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon)' }}>
                  <NavIcon d={item.icon} />
                </span>
                <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1.2 }}>{item.label}</span>
              </Link>
            );
          })}
          {/* More button opens the drawer for remaining items */}
          <button
            onClick={toggle}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
            style={{ color: open ? 'var(--sidebar-text-active)' : 'var(--sidebar-icon)', minWidth: 52 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1.2 }}>Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}
