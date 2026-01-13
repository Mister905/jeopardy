'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/hooks';
import { supabase } from '@/lib/auth/supabase';
import { Button } from '../ui/Button';

export function Header() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          Jeopardy
        </Link>
        <nav className="flex items-center gap-4">
          {loading ? (
            <span>Loading...</span>
          ) : user ? (
            <>
              <Link
                href="/games"
                className="hover:text-gray-300 transition-colors"
              >
                My Games
              </Link>
              <span className="text-gray-400">{user.email}</span>
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Link href="/auth/login">
              <Button variant="secondary">Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
