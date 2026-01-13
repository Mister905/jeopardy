'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { Button } from '@/components/ui/Button';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try email/password first, fallback to OAuth if needed
      // For now, use email/password with magic link
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        // Fallback: try email/password if OAuth fails
        // This is a placeholder - actual implementation depends on Supabase config
        throw signInError;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to sign in. Please try again.',
      );
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Jeopardy Game</h1>
        <p className="text-gray-600 text-center mb-6">
          Sign in to start playing
        </p>

        {error && <ErrorDisplay error={error} />}

        <Button
          onClick={handleLogin}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Signing in...
            </span>
          ) : (
            'Sign in with GitHub'
          )}
        </Button>

        <p className="text-sm text-gray-500 text-center mt-4">
          Note: This app uses Supabase Auth. You can also use email/password if
          configured.
        </p>
      </div>
    </div>
  );
}
