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
 * - /auth/callback - Handles the OAuth callback
 * - /auth/profile - Returns the user profile as JSON
 * - /auth/access-token - Returns the access token
 * - /auth/backchannel-logout - Receives logout_token for Back-Channel Logout
 */

export async function middleware(request: NextRequest) {
  try {
    // Debug: Log environment variables (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Environment check:', {
        hasAppBaseUrl: !!process.env.APP_BASE_URL,
        hasDomain: !!process.env.AUTH0_DOMAIN,
        hasClientId: !!process.env.AUTH0_CLIENT_ID,
        hasClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
        hasSecret: !!process.env.AUTH0_SECRET,
        pathname: request.nextUrl.pathname,
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
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - sitemap.xml, robots.txt (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
