import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { createCorsMiddleware } from './common/middleware/cors.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes under /api so CloudFront /api* behavior and ALB health check /api/health work
  app.setGlobalPrefix('api');

  // CORS: uses FRONTEND_URL from env (required in production; supports comma-separated list)
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = frontendUrl
    ? frontendUrl.split(',').map((u) => u.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      ];
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !frontendUrl) {
    console.warn(
      '[CORS] FRONTEND_URL not set in production; only localhost origins allowed. Add FRONTEND_URL to SSM Parameter Store and ECS task definition.',
    );
  }

  // Global CORS middleware - runs first, ensures headers on ALL responses including 204
  app.use(
    createCorsMiddleware({ allowedOrigins, isProduction }),
  );

  // NestJS CORS (backup; optionsSuccessStatus: 200 for OPTIONS preflight compatibility)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, origin);
        return;
      }
      if (
        !isProduction &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, origin);
        return;
      }
      if (isProduction && allowedOrigins.length > 0) {
        try {
          const requestHost = new URL(origin).hostname;
          for (const allowed of allowedOrigins) {
            const allowedHost = new URL(allowed).hostname;
            if (requestHost === allowedHost) {
              callback(null, origin);
              return;
            }
            if (
              allowedHost.endsWith('.cloudfront.net') &&
              requestHost.endsWith('.cloudfront.net')
            ) {
              callback(null, origin);
              return;
            }
            if (
              requestHost === allowedHost ||
              requestHost.endsWith('.' + allowedHost)
            ) {
              callback(null, origin);
              return;
            }
          }
        } catch {
          // Invalid URL
        }
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  });
  
  // Enable global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  // <-- Bind to 0.0.0.0 so ALB can reach the container
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
