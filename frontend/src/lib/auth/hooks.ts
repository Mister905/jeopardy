'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from './supabase';
import type { AuthenticatedUser } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';

/** On full-page load to /games/:id, give session time to restore from storage before redirecting to login. */
const AUTH_GRACE_MS = 1500;

/** Call when the API returns 401 so the login page doesn't redirect back (clears Supabase session first). */
export async function signOutAndRedirectToLogin(router: { push: (path: string) => void }): Promise<void> {
  await supabase.auth.signOut();
  router.push('/auth/login');
}

export function useAuth() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({
          userId: session.user.id,
          email: session.user.email,
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({
          userId: session.user.id,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      if (pathname === '/auth/login') return;

      const isGamePath = pathname?.startsWith('/games/');
      if (isGamePath) {
        // On game URL, wait for session to restore on full page load before redirecting
        if (graceTimer.current === null) {
          graceTimer.current = setTimeout(() => {
            graceTimer.current = null;
            router.push('/auth/login');
          }, AUTH_GRACE_MS);
        }
        return;
      }

      router.push('/auth/login');
    } else {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
    }
  }, [user, loading, router, pathname]);

  useEffect(() => {
    return () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, []);

  return { user, loading };
}

// getAccessToken moved to api/client.ts to avoid circular dependencies
