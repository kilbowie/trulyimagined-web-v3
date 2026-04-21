import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy `/api/auth/*` route handler for backward compatibility.
 *
 * Routes `/api/auth/login` and `/api/auth/me` to new Auth0 SDK v4 endpoints at `/auth/*`
 */
export async function GET(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect legacy /api/auth/login to new /auth/login endpoint
  if (pathname === '/api/auth/login') {
    const loginUrl = new URL('/auth/login', req.url);
    // Copy all query parameters
    req.nextUrl.searchParams.forEach((value, key) => {
      loginUrl.searchParams.set(key, value);
    });
    // Handle legacy invite parameter transformation
    const returnTo = loginUrl.searchParams.get('returnTo');
    if (returnTo?.startsWith('/dashboard/agent/profile?invite=')) {
      const legacyInvite = returnTo.split('invite=')[1]?.trim();
      if (legacyInvite) {
        loginUrl.searchParams.set('returnTo', `/dashboard/agency-invite?invite=${legacyInvite}`);
      }
    }
    const invite = loginUrl.searchParams.get('invite');
    if (invite && !loginUrl.searchParams.has('returnTo')) {
      loginUrl.searchParams.set('returnTo', `/dashboard/agency-invite?invite=${invite}`);
    }
    return Response.redirect(loginUrl.toString(), 307);
  }

  // Redirect legacy /api/auth/me to new /auth/profile endpoint
  if (pathname === '/api/auth/me') {
    const profileUrl = new URL('/auth/profile', req.url);
    req.nextUrl.searchParams.forEach((value, key) => {
      profileUrl.searchParams.set(key, value);
    });
    return Response.redirect(profileUrl.toString(), 307);
  }

  // All other /api/auth/* endpoints are no longer supported
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
