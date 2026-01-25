'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

function CallbackContent() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error: callbackError } = await supabase.auth.getSession();

        if (callbackError) {
          throw callbackError;
        }

        if (data.session) {
          // Successfully authenticated (email verification or other auth flow), redirect to games
          router.push('/');
        } else {
          // No session, redirect to login
          router.push('/auth/login');
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Authentication failed. Please try again.',
        );
        setLoading(false);
      }
    };

    handleCallback();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <ErrorDisplay error={error} />
        <button
          onClick={() => router.push('/auth/login')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
