'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/hooks';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && pathname === '/') {
      // Only redirect from home page to prevent loops
      if (user) {
        router.push('/games');
      } else {
        router.push('/auth/login');
      }
    }
  }, [user, loading, router, pathname]);

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
