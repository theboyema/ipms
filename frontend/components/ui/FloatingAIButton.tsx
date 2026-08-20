"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FloatingAIButton() {
  const pathname = usePathname();
  if (pathname === '/student/assistant') return null;

  return (
    <Link
      href="/student/assistant"
      title="AI Assistant"
      className="fixed z-40 flex items-center gap-2 rounded-2xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        bottom: '5rem',        /* sits above the 56 px mobile bottom nav */
        right: '1rem',
        padding: '0.6rem 1rem',
        background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
        boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
      }}
    >
      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🤖</span>
      <span className="text-xs font-semibold text-white hidden sm:inline">AI Assistant</span>
    </Link>
  );
}
