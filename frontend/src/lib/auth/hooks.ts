'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/auth/login') {
      // Use replace to force full page load and avoid client-side routing loops
      window.location.replace('/auth/login');
    }
  }, [user, loading, pathname]);

  return { user, loading };
}

/** Clear Supabase auth from localStorage (fallback when signOut fails) */
function clearSupabaseAuthStorage(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith('sb-') && key.includes('-auth-token')) {
      keys.push(key);
    }
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}

export async function signOutAndRedirectToLogin(
  router: { push: (path: string) => void },
  reason?: 'expired' | 'unauthorized',
): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
  clearSupabaseAuthStorage();
  const query = reason ? `?reason=${reason}` : '';
  window.location.href = `/auth/login${query}`;
}

// getAccessToken moved to api/client.ts to avoid circular dependencies
