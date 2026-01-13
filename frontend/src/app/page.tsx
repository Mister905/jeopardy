'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/hooks';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/games');
      } else {
        router.push('/auth/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
