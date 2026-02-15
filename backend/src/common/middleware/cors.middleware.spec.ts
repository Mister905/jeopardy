import { createCorsMiddleware } from './cors.middleware';

describe('createCorsMiddleware', () => {
  const createMockReq = (method: string, origin?: string) =>
    ({
      method,
      path: '/api/test',
      headers: { origin },
    }) as any;

  const createMockRes = () => {
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn(),
      getHeader: jest.fn(),
    };
    return res;
  };

  const createNext = () => jest.fn();

  it('sets CORS headers on GET request for allowed origin', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:3000'],
      isProduction: false,
    });
    const req = createMockReq('GET', 'http://localhost:3000');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3000',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    expect(next).toHaveBeenCalled();
  });

  it('responds to OPTIONS preflight with 200 and CORS headers', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:3000'],
      isProduction: false,
    });
    const req = createMockReq('OPTIONS', 'http://localhost:3000');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3000',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Max-Age',
      '86400',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('allows localhost on any port in dev', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:3000'],
      isProduction: false,
    });
    const req = createMockReq('GET', 'http://localhost:3005');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3005',
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows 127.0.0.1 on any port in dev', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:3000'],
      isProduction: false,
    });
    const req = createMockReq('GET', 'http://127.0.0.1:3001');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://127.0.0.1:3001',
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows custom domain apex and subdomains (triviamaster.dev, www)', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['https://triviamaster.dev'],
      isProduction: true,
    });
    const reqApex = createMockReq('GET', 'https://triviamaster.dev');
    const reqWww = createMockReq('GET', 'https://www.triviamaster.dev');
    const res = createMockRes();
    const next = createNext();

    middleware(reqApex, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://triviamaster.dev',
    );

    res.setHeader.mockClear();
    middleware(reqWww, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://www.triviamaster.dev',
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows *.cloudfront.net when FRONTEND_URL is a CloudFront URL', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['https://dusbh2m7p52nb.cloudfront.net'],
      isProduction: true,
    });
    const req = createMockReq('GET', 'https://dusbh2m7p52nb.cloudfront.net');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://dusbh2m7p52nb.cloudfront.net',
    );
    expect(next).toHaveBeenCalled();
  });

  it('does not set Allow-Origin for disallowed origin in production', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['https://app.example.com'],
      isProduction: true,
    });
    const req = createMockReq('GET', 'http://localhost:3000');
    const res = createMockRes();
    const next = createNext();

    middleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true',
    );
    expect(next).toHaveBeenCalled();
  });
});
