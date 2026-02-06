'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from './supabase';
import type { AuthenticatedUser } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';

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

  useEffect(() => {
    if (!loading && !user) {
      // Only redirect if not already on login page to prevent loops
      if (pathname !== '/auth/login') {
        router.push('/auth/login');
      }
    }
  }, [user, loading, router, pathname]);

  return { user, loading };
}

export async function signOutAndRedirectToLogin(router: { push: (path: string) => void }): Promise<void> {
  await supabase.auth.signOut();
  router.push('/auth/login');
}

// getAccessToken moved to api/client.ts to avoid circular dependencies
