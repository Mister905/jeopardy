'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth, signOutAndRedirectToLogin } from '@/lib/auth/hooks';
import { getUserDashboard } from '@/lib/api/user';
import { ApiClientError } from '@/lib/api/client';
import type { UserDashboardResponse } from '@/lib/api/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { SummarySection } from '@/components/dashboard/SummarySection';
import { AccuracySection } from '@/components/dashboard/AccuracySection';
import { StreaksSection } from '@/components/dashboard/StreaksSection';
import { WagersSection } from '@/components/dashboard/WagersSection';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const [dashboardData, setDashboardData] = useState<UserDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Refresh dashboard when page becomes visible (e.g., user navigates back from a game)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !authLoading && user) {
        fetchDashboard();
      }
    };

    const handleFocus = () => {
      if (!authLoading && user) {
        fetchDashboard();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authLoading, user]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          await signOutAndRedirectToLogin(router);
          return;
        }
        setError(err.message);
      } else {
        setError('Failed to load dashboard. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't show spinner when no user (e.g. after logout); useRequireAuth will redirect
  if (!user) {
    return null;
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { username, stats } = dashboardData;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-white">
          {username}&apos;s Dashboard
        </h1>

        <SummarySection stats={stats} />
        <AccuracySection stats={stats} />
        <StreaksSection stats={stats} />
        <WagersSection stats={stats} />
      </div>
    </div>
  );
}
