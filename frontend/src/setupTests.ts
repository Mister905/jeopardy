import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
jest.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
  },
}));

