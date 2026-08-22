"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SupervisorProjectDetailPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/supervisor/students/${params.projectId}`);
  }, [params.projectId, router]);
  return null;
}
