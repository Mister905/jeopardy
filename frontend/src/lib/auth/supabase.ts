import { createClient } from '@supabase/supabase-js';

// Use placeholder values for build time if env vars are missing or are doc placeholders
// Runtime will require proper environment variables in production
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder';

export const SUPABASE_NOT_CONFIGURED_MESSAGE = 'SUPABASE_NOT_CONFIGURED';

// Normalize env value: trim and strip surrounding quotes (common in .env files)
function normalizeEnv(value: string): string {
  let s = (value || '').trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const rawUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const rawKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
// Treat doc-style placeholders or non-URLs as unset so build succeeds; use placeholder for SSG
const supabaseUrl =
  rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('your-')
    ? rawUrl
    : PLACEHOLDER_URL;
const supabaseAnonKey =
  rawKey && rawKey.length > 50 && !rawKey.includes('your-') ? rawKey : PLACEHOLDER_ANON_KEY;

const isPlaceholder = supabaseUrl.includes('placeholder');
const isBrowser = typeof window !== 'undefined';

// Fail production build if Supabase env vars are missing (so we never deploy a bundle that shows SUPABASE_NOT_CONFIGURED)
if (process.env.NODE_ENV === 'production' && isPlaceholder) {
  throw new Error(
    'Production build requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env. ' +
      'Use the exact names above; values must be a real Supabase URL (https://...supabase.co) and anon key (long JWT). ' +
      'No quotes needed. Run build from the frontend/ directory.',
  );
}

// In the browser, never send requests to placeholder URL (avoids CORS and gives a clear error)
const noopFetch: typeof fetch = () =>
  Promise.reject(new Error(SUPABASE_NOT_CONFIGURED_MESSAGE));

// Warn if using placeholder values (only in development)
if (process.env.NODE_ENV === 'development') {
  if (isPlaceholder) {
    console.warn(
      '⚠️ Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global:
    isBrowser && isPlaceholder
      ? { fetch: noopFetch }
      : undefined,
});
