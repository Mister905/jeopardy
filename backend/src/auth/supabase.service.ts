import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from './types';

interface SupabaseJwtPayload {
  sub: string; // User ID
  email?: string;
  aud: string; // Audience (typically "authenticated")
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  iss?: string; // Issuer
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  // Supabase client kept for potential future use (e.g., user management, admin operations)
  // Currently, JWT verification is done directly using jsonwebtoken library for efficiency
  private readonly supabase: SupabaseClient;
  private readonly jwtSecret: string;
  private readonly supabaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY environment variable is not set');
    }
    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET environment variable is not set');
    }

    this.jwtSecret = jwtSecret;
    this.supabaseUrl = supabaseUrl;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.logger.log('Supabase client initialized');
  }

  /**
   * Verify a JWT token and extract user information
   * Uses JWT secret to verify token signature directly (no API call)
   * @param token - JWT token from Authorization header
   * @returns Authenticated user information
   * @throws Error if token is invalid, expired, or malformed
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      // Verify JWT token using the JWT secret
      // Supabase uses HS256 (symmetric) signing by default
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as SupabaseJwtPayload;

      // Validate required claims
      if (!decoded.sub) {
        const error = new Error('User ID (sub) not found in token');
        this.logger.warn(error.message);
        throw error;
      }

      // Verify audience claim (should be "authenticated" for authenticated users)
      if (decoded.aud !== 'authenticated') {
        this.logger.warn(
          `Unexpected audience claim: ${decoded.aud}. Expected "authenticated"`,
        );
      }

      // Extract user information from JWT payload
      const authenticatedUser: AuthenticatedUser = {
        userId: decoded.sub,
        email: decoded.email,
      };

      this.logger.debug(`Token verified for user: ${authenticatedUser.userId}`);
      return authenticatedUser;
    } catch (error) {
      // Re-throw custom errors (like missing sub claim) as-is
      if (error instanceof Error && error.message === 'User ID (sub) not found in token') {
        throw error;
      }

      if (error instanceof jwt.TokenExpiredError) {
        this.logger.warn('Token has expired');
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`Invalid token: ${error.message}`);
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.NotBeforeError) {
        this.logger.warn('Token not yet valid');
        throw new Error('Token not yet valid');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Token verification error: ${errorMessage}`);
      throw new Error('Token verification failed');
    }
  }

  /**
   * Get the Supabase client instance (if direct access is needed)
   * @returns Supabase client
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}
