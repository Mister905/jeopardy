import { apiGet } from './client';
import type { UserDashboardResponse } from './types';

/**
 * Get the current user's dashboard with statistics
 */
export async function getUserDashboard(): Promise<UserDashboardResponse> {
  return apiGet<UserDashboardResponse>('/me/dashboard');
}
