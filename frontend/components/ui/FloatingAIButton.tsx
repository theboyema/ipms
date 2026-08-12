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
      className="fixed z-40 flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
        right: '1rem',
        background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
        boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
      }}
    >
      <span className="text-lg leading-none">🤖</span>
      <span className="text-xs font-semibold text-white hidden sm:inline">AI Assistant</span>
    </Link>
  );
}
