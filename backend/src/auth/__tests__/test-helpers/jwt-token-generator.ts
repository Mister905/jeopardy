import * as jwt from 'jsonwebtoken';

export interface TestJwtPayload {
  sub: string; // User ID
  email?: string;
  aud: string; // "authenticated"
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

export interface GenerateTokenOptions {
  expiresIn?: number; // Seconds until expiration (default: 3600)
  secret?: string; // JWT secret (default: from SUPABASE_JWT_SECRET env var)
}

/**
 * Generate a JWT token for testing purposes
 * @param payload - JWT payload with user information
 * @param options - Optional configuration for token generation
 * @returns JWT token string
 */
export function generateTestToken(
  payload: Partial<TestJwtPayload>,
  options: GenerateTokenOptions = {},
): string {
  const secret = options.secret || process.env.SUPABASE_JWT_SECRET || 'test-secret';
  const expiresIn = options.expiresIn ?? 3600; // Default 1 hour

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TestJwtPayload = {
    sub: payload.sub || 'test-user-123',
    email: payload.email,
    aud: payload.aud || 'authenticated',
    exp: payload.exp ?? now + expiresIn,
    iat: payload.iat ?? now,
  };

  return jwt.sign(fullPayload, secret, { algorithm: 'HS256' });
}

/**
 * Generate an expired JWT token for testing
 * @param payload - JWT payload with user information
 * @param options - Optional configuration
 * @returns Expired JWT token string
 */
export function generateExpiredToken(
  payload: Partial<TestJwtPayload> = {},
  options: Omit<GenerateTokenOptions, 'expiresIn'> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  return generateTestToken(
    {
      ...payload,
      exp: now - 3600, // Expired 1 hour ago
    },
    options,
  );
}

/**
 * Generate a token with wrong secret (invalid token)
 * @param payload - JWT payload with user information
 * @returns JWT token signed with wrong secret
 */
export function generateInvalidToken(
  payload: Partial<TestJwtPayload> = {},
): string {
  return generateTestToken(payload, {
    secret: 'wrong-secret-key',
  });
}

/**
 * Generate a token with missing sub claim
 * @param options - Optional configuration
 * @returns JWT token without sub claim
 */
export function generateTokenWithoutSub(
  options: GenerateTokenOptions = {},
): string {
  const secret = options.secret || process.env.SUPABASE_JWT_SECRET || 'test-secret';
  const expiresIn = options.expiresIn ?? 3600;

  const now = Math.floor(Date.now() / 1000);
  const payload: Omit<TestJwtPayload, 'sub'> & { sub?: string } = {
    email: 'test@example.com',
    aud: 'authenticated',
    exp: now + expiresIn,
    iat: now,
  };

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}
