'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function GamesPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/');
  }, [router]);

  return null;
}
