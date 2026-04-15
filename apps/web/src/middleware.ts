import { auth0 } from './lib/auth0';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Official Auth0 Next.js SDK middleware/proxy layer.
 *
 * This intercepts requests and handles the OAuth flow automatically.
 * It mounts these authentication routes:
 * - /auth/login - Redirects to Auth0 login page
 * - /auth/logout - Logs out the user
 * - /api/auth/callback - Handles the OAuth callback
 * - /auth/profile - Returns the user profile as JSON
 * - /auth/access-token - Returns the access token
 * - /auth/backchannel-logout - Receives logout_token for Back-Channel Logout
 */

// =============================================================================
// Rate Limiting
// =============================================================================
//
// Per-instance in-memory rate limiter (Edge runtime compatible).
// NOTE: State is not shared across Vercel edge instances. This protects against
// single-origin bursts. For distributed rate limiting, integrate Upstash Redis.
//
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
const RATE_LIMIT_BYPASS_PREFIXES = ['/api/webhooks/stripe'];

// Limits per route category (requests per window)
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/auth/login': { max: 10, windowMs: 60_000 }, // 10/min — brute force protection
  '/api/auth/callback': { max: 20, windowMs: 60_000 }, // 20/min — OAuth callbacks
  '/api/consent/grant': { max: 10, windowMs: 60_000 }, // 10/min — consent writes
  '/api/consent/revoke': { max: 10, windowMs: 60_000 },
  '/api/credentials/issue': { max: 10, windowMs: 60_000 },
  '/api/identity/link': { max: 15, windowMs: 60_000 },
  '/api/verification': { max: 10, windowMs: 60_000 },
  '/api': { max: 100, windowMs: 60_000 }, // 100/min — general API
  '/': { max: 300, windowMs: 60_000 }, // 300/min — page routes
};

function getRateLimitConfig(pathname: string): { max: number; windowMs: number } {
  for (const prefix of Object.keys(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return RATE_LIMITS[prefix];
  }
  return { max: 300, windowMs: 60_000 };
}

function isRateLimited(ip: string, pathname: string): boolean {
  // Periodic cleanup to prevent unbounded memory growth
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
    lastCleanup = now;
  }

  const { max, windowMs } = getRateLimitConfig(pathname);

  // Bucket key: IP + route category (not full path, to avoid unbounded keys)
  const category = pathname.startsWith('/auth')
    ? 'auth'
    : pathname.startsWith('/api')
      ? pathname.split('/').slice(0, 4).join('/') // e.g. /api/consent/grant
      : 'page';
  const key = `${ip}:${category}`;

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (existing.count >= max) return true;

  existing.count++;
  return false;
}

function shouldBypassRateLimit(pathname: string): boolean {
  return RATE_LIMIT_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Rate limiting — applied before auth to block floods early
    if (!shouldBypassRateLimit(pathname)) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';

      if (isRateLimited(ip, pathname)) {
        console.warn('[Middleware] Rate limit exceeded:', { ip, pathname });
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': '60',
            'Content-Type': 'text/plain',
          },
        });
      }
    }

    // Debug: Log environment variables (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Environment check:', {
        hasAppBaseUrl: !!process.env.APP_BASE_URL,
        hasDomain: !!process.env.AUTH0_DOMAIN,
        hasClientId: !!process.env.AUTH0_CLIENT_ID,
        hasClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
        hasSecret: !!process.env.AUTH0_SECRET,
        pathname,
      });
    }

    const authResponse = await auth0.middleware(request);

    // Always return the auth response.
    //
    // Note: The auth response forwards requests to your app routes by default.
    // If you need to block requests, do it before calling auth0.middleware() or
    // copy the authResponse headers except for x-middleware-next to your blocking response.
    return authResponse;
  } catch (error) {
    console.error('[Middleware] Error:', error);

    // If there's an error in auth middleware, let the request through
    // This prevents the entire site from breaking
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - monitoring (Sentry tunnel route)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - sitemap.xml, robots.txt (public files)
     */
    '/((?!monitoring|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
