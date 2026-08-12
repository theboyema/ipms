"use client";
import React from 'react';
import Sidebar from '../../components/ui/Sidebar';
import Navbar from '../../components/ui/Navbar';
import FloatingAIButton from '../../components/ui/FloatingAIButton';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["STUDENT"]}>
      <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Navbar />
          <main className="p-4 md:p-6 pb-28 md:pb-6">{children}</main>
        </div>
        <FloatingAIButton />
      </div>
    </ProtectedRoute>
  );
}
