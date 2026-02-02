import { Suspense } from 'react';
import { GameDetailPageClient } from './GameDetailPageClient';

// One placeholder path for static export; CloudFront should serve this file for all /games/:id (404 → /games/new)
export function generateStaticParams() {
  return [{ id: 'new' }];
}

export default function GameDetailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-white">Loading...</div>}>
      <GameDetailPageClient />
    </Suspense>
  );
}
