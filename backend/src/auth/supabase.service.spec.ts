import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from './supabase.service';
import { AuthenticatedUser } from './types';

describe('SupabaseService', () => {
  let service: SupabaseService;
  let configService: jest.Mocked<ConfigService>;
  const jwtSecret = 'test-jwt-secret-for-testing-purposes-only';

  beforeEach(async () => {
    // Prevent real Supabase network calls when service falls back to verifyTokenWithSupabase
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as jest.Mock;
    // Mock ConfigService
    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_JWT_SECRET: jwtSecret,
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
    });

    it('should throw error if SUPABASE_URL is missing', () => {
      const invalidConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'SUPABASE_URL') return undefined;
          return 'test-value';
        }),
      } as unknown as jest.Mocked<ConfigService>;

      expect(() => {
        new SupabaseService(invalidConfigService);
      }).toThrow('SUPABASE_URL environment variable is not set');
    });

    it('should throw error if SUPABASE_ANON_KEY is missing', () => {
      const invalidConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'SUPABASE_ANON_KEY') return undefined;
          return 'test-value';
        }),
      } as unknown as jest.Mocked<ConfigService>;

      expect(() => {
        new SupabaseService(invalidConfigService);
      }).toThrow('SUPABASE_ANON_KEY environment variable is not set');
    });

    it('should throw error if SUPABASE_JWT_SECRET is missing', () => {
      const invalidConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'SUPABASE_JWT_SECRET') return undefined;
          return 'test-value';
        }),
      } as unknown as jest.Mocked<ConfigService>;

      expect(() => {
        new SupabaseService(invalidConfigService);
      }).toThrow('SUPABASE_JWT_SECRET environment variable is not set');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token and return authenticated user', async () => {
      const mockUser: AuthenticatedUser = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      // Create a valid JWT token
      const token = jwt.sign(
        {
          sub: mockUser.userId,
          email: mockUser.email,
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );

      const result = await service.verifyToken(token);

      expect(result).toEqual(mockUser);
    });

    it('should verify token without email', async () => {
      const mockUser: AuthenticatedUser = {
        userId: 'user-456',
      };

      const token = jwt.sign(
        {
          sub: mockUser.userId,
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );

      const result = await service.verifyToken(token);

      expect(result.userId).toBe(mockUser.userId);
      expect(result.email).toBeUndefined();
    });

    it('should throw error for invalid token', async () => {
      // Service may fall back to Supabase verification and normalize to this message
      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        'Token verification failed',
      );
    });

    it('should throw error for expired token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );

      // JWT verify may throw TokenExpiredError (Token has expired) or fall back to Supabase and throw Token verification failed
      await expect(service.verifyToken(expiredToken)).rejects.toThrow(
        /Token has expired|Token verification failed/,
      );
    });

    it('should throw error for token signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        {
          sub: 'user-123',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        'wrong-secret',
        { algorithm: 'HS256' },
      );

      // Service may fall back to Supabase verification and normalize to this message
      await expect(service.verifyToken(wrongSecretToken)).rejects.toThrow(
        'Token verification failed',
      );
    });

    it('should throw error when sub claim is missing', async () => {
      const tokenWithoutSub = jwt.sign(
        {
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );

      await expect(service.verifyToken(tokenWithoutSub)).rejects.toThrow(
        'User ID (sub) not found in token',
      );
    });
  });

  describe('getClient', () => {
    it('should return Supabase client instance', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });
  });
});
