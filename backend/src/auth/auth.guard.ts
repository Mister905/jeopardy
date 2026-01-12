import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from './supabase.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { REQUEST_USER_KEY } from './decorators/current-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('Missing authorization token');
      throw new UnauthorizedException('Authorization token is required');
    }

    try {
      const user = await this.supabaseService.verifyToken(token);
      // Attach authenticated user to request for downstream use
      request[REQUEST_USER_KEY] = user;
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Token verification failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Extract Bearer token from Authorization header
   * Handles multiple spaces between "Bearer" and token
   * @param request - HTTP request object
   * @returns JWT token or null if not found
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      return null;
    }

    // Split on whitespace and filter out empty strings to handle multiple spaces
    const parts = authHeader.trim().split(/\s+/);

    if (parts.length < 2 || parts[0] !== 'Bearer') {
      return null;
    }

    // Join remaining parts in case token itself contains spaces (shouldn't happen for JWT, but defensive)
    const token = parts.slice(1).join(' ');

    return token || null;
  }
}
