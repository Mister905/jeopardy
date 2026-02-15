import { Request, Response, NextFunction } from 'express';

const CORS_DEBUG = process.env.CORS_DEBUG === 'true';

/** Default allowed origins when FRONTEND_URL is not set (dev) */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

/**
 * Check if an origin is allowed. Returns the origin to use for Access-Control-Allow-Origin.
 * With credentials: true, we must return the specific origin (not *).
 */
function getAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: string[],
  isProduction: boolean,
): string | undefined {
  // When Origin is missing (e.g. CloudFront not forwarding it), use first allowed origin as fallback
  if (!requestOrigin) {
    return allowedOrigins.length > 0 ? allowedOrigins[0] : undefined;
  }
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  // In dev, allow localhost/127.0.0.1 on any port for flexibility
  if (!isProduction) {
    try {
      const url = new URL(requestOrigin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return requestOrigin;
      }
    } catch {
      // Invalid URL
    }
  }
  // In production, allow CloudFront and custom domains (with subdomains)
  if (isProduction && allowedOrigins.length > 0) {
    try {
      const requestUrl = new URL(requestOrigin);
      const requestHost = requestUrl.hostname;

      for (const allowed of allowedOrigins) {
        const allowedUrl = new URL(allowed);
        const allowedHost = allowedUrl.hostname;

        // Exact match
        if (requestHost === allowedHost) return requestOrigin;

        // *.cloudfront.net when FRONTEND_URL includes a CloudFront URL
        if (
          allowedHost.endsWith('.cloudfront.net') &&
          requestHost.endsWith('.cloudfront.net')
        ) {
          return requestOrigin;
        }

        // Custom domain: allow apex and subdomains (e.g. triviamaster.dev, www.triviamaster.dev)
        if (requestHost === allowedHost || requestHost.endsWith('.' + allowedHost)) {
          return requestOrigin;
        }
      }
    } catch {
      // Invalid URL
    }
  }
  return undefined;
}

export interface CorsMiddlewareOptions {
  allowedOrigins: string[];
  isProduction: boolean;
}

/**
 * Global CORS middleware that ensures Access-Control-* headers on ALL responses,
 * including 204 No Content. Runs before NestJS pipeline so headers are set for
 * every response, including error responses and empty bodies.
 */
export function createCorsMiddleware(options: CorsMiddlewareOptions) {
  const { allowedOrigins, isProduction } = options;
  const origins =
    allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ORIGINS;

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.headers.origin as string | undefined;
    const allowedOrigin = getAllowedOrigin(
      requestOrigin,
      origins,
      isProduction,
    );

    const setCorsHeaders = (): void => {
      if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    };

    // Handle OPTIONS preflight - respond immediately with 200 (not 204) for compatibility
    if (req.method === 'OPTIONS') {
      setCorsHeaders();
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(200).end();
      return;
    }

    // Optional: log CORS headers on response finish (for debugging 204, etc.)
    if (CORS_DEBUG) {
      res.on('finish', () => {
        const originHeader = res.getHeader('Access-Control-Allow-Origin');
        console.log(
          `[CORS] ${req.method} ${req.path} -> ${res.statusCode} | Access-Control-Allow-Origin: ${originHeader ?? '(not set)'}`,
        );
      });
    }

    // For all other requests, set CORS headers and continue
    setCorsHeaders();
    next();
  };
}
