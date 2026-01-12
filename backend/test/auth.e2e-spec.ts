import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/auth/auth.module';
import { TestController } from '../src/auth/__tests__/test-helpers/test-controller';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  generateTokenWithoutSub,
} from '../src/auth/__tests__/test-helpers/jwt-token-generator';

describe('Auth E2E', () => {
  let app: INestApplication<App>;
  const jwtSecret = 'test-jwt-secret-for-e2e-testing-only';

  beforeAll(async () => {
    // Set test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_JWT_SECRET = jwtSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        AuthModule,
      ],
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Protected Routes', () => {
    it('should return 401 when accessing protected route without token', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Authorization token is required');
        });
    });

    it('should return 401 when accessing protected route with invalid token', () => {
      const invalidToken = generateInvalidToken({ sub: 'user-123' });

      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired token');
        });
    });

    it('should return 401 when accessing protected route with expired token', () => {
      const expiredToken = generateExpiredToken({ sub: 'user-123' });

      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired token');
        });
    });

    it('should return 200 when accessing protected route with valid token', () => {
      const validToken = generateTestToken({
        sub: 'user-123',
        email: 'test@example.com',
      });

      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Protected route accessed successfully');
          expect(res.body.authenticated).toBe(true);
        });
    });

    it('should return 401 when token has missing sub claim', () => {
      const tokenWithoutSub = generateTokenWithoutSub();

      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${tokenWithoutSub}`)
        .expect(401);
    });
  });

  describe('Public Routes', () => {
    it('should return 200 when accessing public route without token', () => {
      return request(app.getHttpServer())
        .get('/test/public')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Public route accessed successfully');
          expect(res.body.authenticated).toBe(false);
        });
    });

    it('should return 200 when accessing public route with token (bypasses auth)', () => {
      const validToken = generateTestToken({ sub: 'user-123' });

      return request(app.getHttpServer())
        .get('/test/public')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Public route accessed successfully');
          expect(res.body.authenticated).toBe(false);
        });
    });
  });

  describe('CurrentUser Decorator', () => {
    it('should extract userId correctly from valid token', () => {
      const userId = 'test-user-456';
      const email = 'testuser@example.com';
      const validToken = generateTestToken({
        sub: userId,
        email: email,
      });

      return request(app.getHttpServer())
        .get('/test/current-user')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Current user extracted successfully');
          expect(res.body.user.userId).toBe(userId);
          expect(res.body.user.email).toBe(email);
        });
    });

    it('should extract userId when email is not present in token', () => {
      const userId = 'test-user-789';
      const validToken = generateTestToken({
        sub: userId,
      });

      return request(app.getHttpServer())
        .get('/test/current-user')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.user.userId).toBe(userId);
          expect(res.body.user.email).toBeUndefined();
        });
    });

    it('should verify userId matches token sub claim', () => {
      const expectedUserId = 'specific-user-id-123';
      const validToken = generateTestToken({
        sub: expectedUserId,
        email: 'specific@example.com',
      });

      return request(app.getHttpServer())
        .get('/test/current-user')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          // Verify the userId extracted matches the token's sub claim
          expect(res.body.user.userId).toBe(expectedUserId);
        });
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent 401 error format for missing token', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toBe('Authorization token is required');
        });
    });

    it('should return consistent 401 error format for invalid token', () => {
      const invalidToken = generateInvalidToken({ sub: 'user-123' });

      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toBe('Invalid or expired token');
        });
    });

    it('should not expose sensitive information in error messages', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .expect(401)
        .expect((res) => {
          const errorString = JSON.stringify(res.body);
          // Should not contain JWT secret
          expect(errorString).not.toContain(jwtSecret);
          // Should not contain full tokens
          expect(errorString).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/);
        });
    });
  });

  describe('Malformed Authorization Header', () => {
    it('should return 401 for malformed Authorization header', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should return 401 for Authorization header without Bearer', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', 'token-without-bearer')
        .expect(401);
    });

    it('should return 401 for empty Authorization header', () => {
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', '')
        .expect(401);
    });
  });
});
