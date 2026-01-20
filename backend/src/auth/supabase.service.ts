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
      // First, decode the token header to determine the algorithm
      const decodedHeader = jwt.decode(token, { complete: true });
      
      if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new Error('Invalid token format');
      }

      const algorithm = decodedHeader.header.alg as string;
      this.logger.debug(`Token algorithm: ${algorithm}, kid: ${decodedHeader.header.kid || 'none'}`);

      // Try to verify with the detected algorithm
      // Supabase can use HS256 (symmetric) or RS256 (asymmetric)
      let decoded: SupabaseJwtPayload;
      
      try {
        // Try with the algorithm from the token header
        if (algorithm === 'HS256') {
          // HS256 uses symmetric key (JWT secret)
          decoded = jwt.verify(token, this.jwtSecret, {
            algorithms: ['HS256'],
          }) as SupabaseJwtPayload;
          this.logger.debug('Token verified using HS256 with JWT secret');
        } else if (algorithm === 'RS256' || algorithm === 'ES256') {
          // RS256/ES256 requires public key from JWKS endpoint
          // Use Supabase client verification which handles this automatically
          this.logger.debug(`Token uses ${algorithm}, using Supabase client verification`);
          return await this.verifyTokenWithSupabase(token);
        } else {
          // Try with the detected algorithm (might work if it's still symmetric)
          this.logger.debug(`Attempting verification with algorithm: ${algorithm}`);
          decoded = jwt.verify(token, this.jwtSecret, {
            algorithms: [algorithm as jwt.Algorithm],
          }) as SupabaseJwtPayload;
        }
      } catch (verifyError) {
        // Log the specific error for debugging
        if (verifyError instanceof jwt.JsonWebTokenError) {
          this.logger.warn(`JWT verification error: ${verifyError.message}`);
          
          // If it's an algorithm mismatch, try Supabase client verification
          if (verifyError.message.includes('algorithm') || 
              verifyError.message.includes('invalid algorithm')) {
            this.logger.debug('Algorithm mismatch detected, using Supabase client verification');
            return await this.verifyTokenWithSupabase(token);
          }
        }
        
        // For other errors, try Supabase client as fallback
        this.logger.debug('Direct JWT verification failed, trying Supabase client verification');
        return await this.verifyTokenWithSupabase(token);
      }

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
   * Verify token using Supabase client (fallback for RS256 tokens or when JWT secret doesn't match)
   * Uses Supabase's getUser method which handles both HS256 and RS256 tokens automatically
   * @param token - JWT token from Authorization header
   * @returns Authenticated user information
   */
  private async verifyTokenWithSupabase(token: string): Promise<AuthenticatedUser> {
    try {
      // Use Supabase's built-in getUser method which handles token verification
      // This works for both HS256 and RS256 tokens
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error) {
        this.logger.warn(`Supabase getUser failed: ${error.message}`);
        throw new Error(`Token verification failed: ${error.message}`);
      }

      if (!user) {
        throw new Error('User not found in token');
      }

      this.logger.debug(`Token verified via Supabase client for user: ${user.id}`);

      return {
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Supabase verification error: ${errorMessage}`);
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
