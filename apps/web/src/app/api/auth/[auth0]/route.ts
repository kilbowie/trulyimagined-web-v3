import { auth0 } from '@/lib/auth0';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth0 Dynamic Route Handler
 *
 * Handles all Auth0authentication routes:
 * - GET /api/auth/login - Start login flow
 * - GET /api/auth/logout - End session
 * - GET /api/auth/callback - Handle callback from Auth0
 * - GET /api/auth/me - Get current user session
 */

export async function GET(request: NextRequest, context: { params: { auth0: string } }) {
  const { auth0: route } = context.params;

  console.log(`[AUTH] Handling route: /api/auth/${route}`);
  console.log(`[AUTH] Full URL: ${request.url}`);
  console.log(`[AUTH] Method: ${request.method}`);

  try {
    // Handle different auth routes
    switch (route) {
      case 'login':
        console.log('[AUTH] Starting login flow...');
        // Start login flow
        const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
        console.log(`[AUTH] Return URL: ${returnTo}`);

        const loginResponse = await auth0.startInteractiveLogin({
          returnTo,
        });

        console.log('[AUTH] Login initiated, redirecting to Auth0');
        return loginResponse;

      case 'logout':
        console.log('[AUTH] Handling logout...');
        // End session - create a mock response to pass to SDK
        const logoutUrl = new URL('/api/auth/logout', request.url);
        const logoutReq = new NextRequest(logoutUrl, {
          method: 'GET',
          headers: request.headers,
        });
        return await auth0.middleware(logoutReq);

      case 'callback':
        console.log('[AUTH] Handling OAuth callback...');
        // Handle OAuth callback
        const callbackUrl = new URL('/api/auth/callback', request.url);
        callbackUrl.search = request.nextUrl.search; // Preserve query params
        console.log(`[AUTH] Callback URL: ${callbackUrl.toString()}`);

        const callbackReq = new NextRequest(callbackUrl, {
          method: 'GET',
          headers: request.headers,
        });
        const callbackResponse = await auth0.middleware(callbackReq);
        console.log('[AUTH] Callback processed');
        return callbackResponse;

      case 'me':
        console.log('[AUTH] Getting current session...');
        // Return current session
        const session = await auth0.getSession();
        if (!session?.user) {
          console.log('[AUTH] No session found');
          return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.log(`[AUTH] Session found for user: ${session.user.email}`);
        return NextResponse.json(session.user);

      default:
        console.error(`[AUTH] Unknown route: ${route}`);
        return NextResponse.json({ error: `Route not found: /api/auth/${route}` }, { status: 404 });
    }
  } catch (error) {
    console.error(`[AUTH] Error handling route /api/auth/${route}:`, error);
    console.error(`[AUTH] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Authentication error',
        message: error instanceof Error ? error.message : 'Unknown error',
        route: `/api/auth/${route}`,
      },
      { status: 500 }
    );
  }
}
