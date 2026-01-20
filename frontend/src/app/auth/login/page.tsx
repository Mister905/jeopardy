'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/lib/auth/hooks';
import {
  signUpUser,
  signInUser,
  clearSignInError,
  clearSignUpError,
  clearSignUpSuccess,
  clearAllErrors,
} from '@/store/authSlice';
import { Button } from '@/components/ui/Button';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAuth();

  const signInLoading = useAppSelector((state) => state.auth.signInLoading);
  const signInError = useAppSelector((state) => state.auth.signInError);
  const signUpLoading = useAppSelector((state) => state.auth.signUpLoading);
  const signUpError = useAppSelector((state) => state.auth.signUpError);
  const signUpSuccess = useAppSelector((state) => state.auth.signUpSuccess);
  const signUpMessage = useAppSelector((state) => state.auth.signUpMessage);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user && pathname === '/auth/login') {
      // Only redirect if currently on login page to prevent loops
      router.push('/games');
    }
  }, [user, router, pathname]);

  const loading = mode === 'signIn' ? signInLoading : signUpLoading;
  const error = mode === 'signIn' ? signInError : signUpError;

  const validateForm = (): boolean => {
    setValidationError(null);

    if (!email) {
      setValidationError('Email is required.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setValidationError('Password is required.');
      return false;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return false;
    }

    if (mode === 'signUp' && password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Clear previous errors
    dispatch(clearAllErrors());
    dispatch(clearSignUpSuccess());

    if (mode === 'signUp') {
      const result = await dispatch(signUpUser({ email, password }));
      if (signUpUser.fulfilled.match(result)) {
        // Success - message is shown via signUpMessage
        // If email verification not required, user is logged in and will redirect via onAuthStateChange
      }
    } else {
      const result = await dispatch(signInUser({ email, password }));
      if (signInUser.fulfilled.match(result)) {
        // Success - redirect to games
        router.push('/games');
      }
    }
  };

  const handleModeToggle = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setValidationError(null);
    dispatch(clearAllErrors());
    dispatch(clearSignUpSuccess());
  };

  // Listen for auth state changes to redirect after successful sign up (if email verification not required)
  // This is handled by useAuth hook in layout/components, but we can also check here
  // The onAuthStateChange in hooks.ts will handle the redirect

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Jeopardy Game</h1>
        <p className="text-gray-600 text-center mb-6">
          {mode === 'signIn' ? 'Sign in to start playing' : 'Create an account to start playing'}
        </p>

        {(error || validationError) && (
          <div className="mb-4">
            <ErrorDisplay error={error || validationError || ''} />
          </div>
        )}

        {signUpSuccess && signUpMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            <p>{signUpMessage}</p>
            <Button
              onClick={handleModeToggle}
              variant="secondary"
              className="mt-2"
            >
              Back to Sign In
            </Button>
          </div>
        )}

        {!signUpSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder={mode === 'signUp' ? 'At least 6 characters' : ''}
              />
              {mode === 'signUp' && (
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 6 characters
                </p>
              )}
            </div>

            {mode === 'signUp' && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {mode === 'signIn' ? 'Signing in...' : 'Signing up...'}
                </span>
              ) : (
                mode === 'signIn' ? 'Sign In' : 'Sign Up'
              )}
            </Button>
          </form>
        )}

        {!signUpSuccess && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleModeToggle}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={loading}
            >
              {mode === 'signIn'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
