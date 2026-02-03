'use client';

import { useState, FormEvent, useEffect } from 'react';
import '@/styles/components/LoginPage.scss';
import Image from 'next/image';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
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
      router.push('/');
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

    if (mode === 'signUp') {
      if (!username || username.trim().length === 0) {
        setValidationError('Username is required.');
        return false;
      }

      if (username.length < 3 || username.length > 50) {
        setValidationError('Username must be between 3 and 50 characters.');
        return false;
      }

      if (password !== confirmPassword) {
        setValidationError('Passwords do not match.');
        return false;
      }
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
      const result = await dispatch(signUpUser({ email, password, username }));
      if (signUpUser.fulfilled.match(result)) {
        // Store username in localStorage for use when creating first game
        if (username) {
          localStorage.setItem('pendingUsername', username);
        }
        // Success - message is shown via signUpMessage
        // If email verification not required, user is logged in and will redirect via onAuthStateChange
      }
    } else {
      const result = await dispatch(signInUser({ email, password }));
      if (signInUser.fulfilled.match(result)) {
        // Success - redirect to games
        router.push('/');
      }
    }
  };

  const handleModeToggle = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setValidationError(null);
    dispatch(clearAllErrors());
    dispatch(clearSignUpSuccess());
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="login-card rounded-lg shadow-lg p-8 border-2">
        <div className="flex justify-center mb-8">
          <Image
            src="/trivia_master.png"
            alt="Trivia Master"
            width={200}
            height={200}
            className="max-w-[200px] w-full h-auto object-contain"
          />
        </div>
        <p className="text-white opacity-80 text-center mb-6">
          {mode === 'signIn' ? 'Sign in to start playing' : 'Create an account to start playing'}
        </p>

        {(error || validationError) && (
          <div className="mb-4">
            <ErrorDisplay error={error || validationError || ''} />
          </div>
        )}

        {signUpSuccess && signUpMessage && (
          <div className="login-success-banner mb-4 px-4 py-3 rounded border-2">
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
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="login-input bg-white text-gray-900"
                placeholder="your@email.com"
              />
            </div>

            {mode === 'signUp' && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  minLength={3}
                  maxLength={50}
                  className="login-input bg-white text-gray-900"
                  placeholder="Choose a username"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Username must be between 3 and 50 characters
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                className="login-input bg-white text-gray-900"
                placeholder={mode === 'signUp' ? 'At least 6 characters' : ''}
              />
              {mode === 'signUp' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>
              )}
            </div>

            {mode === 'signUp' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="login-input bg-white text-gray-900"
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
              className="text-sm text-white opacity-80 hover:opacity-100 transition-opacity"
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
