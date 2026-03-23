import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect routes that require authentication
 * 
 * Protected routes:
 * - /dashboard/*
 * - /identity/*
 * - /consent/*
 * - /licenses/*
 * 
 * Note: For edge runtime compatibility, we redirect to login instead of using Auth0 middleware
 */

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Define protected routes
  const protectedPaths = ['/dashboard', '/identity', '/consent', '/licenses'];

  // Check if current path requires authentication
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    // Check for Auth0 session cookie
    const sessionCookie = req.cookies.get('appSession');
    
    if (!sessionCookie) {
      // Redirect to login
      const loginUrl = new URL('/api/auth/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (Auth0 routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)',
  ],
};
