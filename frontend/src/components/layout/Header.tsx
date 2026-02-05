'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/hooks';
import { useAppDispatch } from '@/store/hooks';
import { signOutUser } from '@/store/authSlice';
import { Button } from '../ui/Button';
import '@/styles/components/Header.scss';

export function Header() {
  const { user, loading } = useAuth();
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await dispatch(signOutUser());
      window.location.href = '/auth/login';
    } catch (err) {
      console.error('Sign out error:', err);
      window.location.href = '/auth/login';
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="header">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/trivia_master_header.png"
            alt="Trivia Master"
            width={180}
            height={48}
            className="header__logo object-contain"
          />
        </Link>
        <nav className="flex items-center gap-4">
          {loading ? (
            <span>Loading...</span>
          ) : user ? (
            <>
              {pathname !== '/' && (
                <Link
                  href="/"
                  className="header__nav-link transition-colors flex items-center gap-2 px-3 py-2 rounded border-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                    />
                  </svg>
                  Home
                </Link>
              )}
              {pathname !== '/dashboard' && (
                <Link
                  href="/dashboard"
                  className="header__nav-link transition-colors flex items-center gap-2 px-3 py-2 rounded border-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                  Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="header__logout-btn px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 text-white flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3H8.25"
                  />
                </svg>
                {signingOut ? 'Logging out...' : 'Logout'}
              </button>
            </>
          ) : (
            pathname !== '/auth/login' && (
              <Link href="/auth/login">
                <Button variant="secondary" className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    />
                  </svg>
                  Login
                </Button>
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
