/**
 * Authenticated user context extracted from Supabase JWT token
 */
export interface AuthenticatedUser {
  userId: string; // From JWT 'sub' claim
  email?: string; // From JWT if available
}
