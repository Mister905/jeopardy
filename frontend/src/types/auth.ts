// Authentication types

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthenticatedUser;
}
