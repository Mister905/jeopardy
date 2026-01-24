'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/hooks';
import { useAppDispatch } from '@/store/hooks';
import { signOutUser } from '@/store/authSlice';
import { Button } from '../ui/Button';

export function Header() {
  const { user, loading } = useAuth();
  const dispatch = useAppDispatch();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await dispatch(signOutUser());
      // Redirect even if there's an error (user should still be logged out locally)
      window.location.href = '/auth/login';
    } catch (err) {
      console.error('Sign out error:', err);
      // Still redirect to login page
      window.location.href = '/auth/login';
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="text-white shadow-lg" style={{ backgroundColor: '#001AA5' }}>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          Trivia Master
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
                Dashboard
              </Link>
              <Button variant="secondary" onClick={handleLogout} disabled={signingOut}>
                {signingOut ? 'Logging out...' : 'Logout'}
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
