import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SupabaseService } from './supabase.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { REQUEST_USER_KEY } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let supabaseService: jest.Mocked<SupabaseService>;
  let reflector: jest.Mocked<Reflector>;

  const mockUser: AuthenticatedUser = {
    userId: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    supabaseService = {
      verifyToken: jest.fn(),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: SupabaseService,
          useValue: supabaseService,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
    isPublic = false,
  ): ExecutionContext => {
    const request = {
      headers,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValue(isPublic);

    return context;
  };

  describe('canActivate', () => {
    it('should allow access to public routes without token', async () => {
      const context = createMockExecutionContext({}, true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(supabaseService.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authorization token is required',
      );
      expect(supabaseService.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when Authorization header is missing', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when Bearer token is missing', async () => {
      const context = createMockExecutionContext({
        authorization: 'InvalidFormat',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify token and attach user to request', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      supabaseService.verifyToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(supabaseService.verifyToken).toHaveBeenCalledWith('valid-token');

      const request = context.switchToHttp().getRequest();
      expect(request[REQUEST_USER_KEY]).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });

      supabaseService.verifyToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should extract token correctly from Bearer format', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer token-123',
      });

      supabaseService.verifyToken.mockResolvedValue(mockUser);

      await guard.canActivate(context);

      expect(supabaseService.verifyToken).toHaveBeenCalledWith('token-123');
    });

    it('should handle token with extra spaces', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer  token-with-spaces  ',
      });

      supabaseService.verifyToken.mockResolvedValue(mockUser);

      await guard.canActivate(context);

      expect(supabaseService.verifyToken).toHaveBeenCalledWith(
        'token-with-spaces',
      );
    });
  });
});
