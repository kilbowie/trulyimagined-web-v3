import { auth0 } from '@/lib/auth0';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  if (req.nextUrl.pathname === '/api/auth/login') {
    const passthrough = new URL('/auth/login', req.url);
    req.nextUrl.searchParams.forEach((value, key) => {
      passthrough.searchParams.set(key, value);
    });

    const returnTo = passthrough.searchParams.get('returnTo');
    if (returnTo?.startsWith('/dashboard/agent/profile?invite=')) {
      const legacyInvite = returnTo.split('invite=')[1]?.trim();
      if (legacyInvite) {
        passthrough.searchParams.set('returnTo', `/dashboard/agency-invite?invite=${legacyInvite}`);
      }
    }

    const invite = passthrough.searchParams.get('invite');
    if (invite && !passthrough.searchParams.has('returnTo')) {
      passthrough.searchParams.set('returnTo', `/dashboard/agency-invite?invite=${invite}`);
    }

    return Response.redirect(passthrough.toString(), 307);
  }

  // Backward compatibility for legacy invite links where returnTo was not encoded.
  return auth0.middleware(req);
}
