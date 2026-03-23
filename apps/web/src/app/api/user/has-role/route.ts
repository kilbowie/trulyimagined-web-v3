import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Check if user has roles assigned in Auth0
 * 
 * This is used to prevent redirect loops when a role has been assigned
 * but the JWT hasn't been refreshed yet.
 * 
 * GET /api/user/has-role
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { hasRole: false, needsLogin: true },
        { status: 200 }
      );
    }

    // Check roles in JWT token
    const roles = (user['https://trulyimagined.com/roles'] as string[]) || [];
    
    // If roles exist in token, return true
    if (roles.length > 0) {
      return NextResponse.json({
        hasRole: true,
        roles,
      });
    }

    // If no roles in token, check Auth0 directly via Management API
    // This prevents redirect loops when role was just assigned but JWT not refreshed
    try {
      const domain = process.env.AUTH0_DOMAIN;
      const clientId = process.env.AUTH0_CLIENT_ID;
      const clientSecret = process.env.AUTH0_CLIENT_SECRET;

      if (!domain || !clientId || !clientSecret) {
        console.error('[HAS-ROLE] Missing Auth0 credentials');
        return NextResponse.json({ hasRole: false });
      }

      // Get Management API token
      const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          audience: `https://${domain}/api/v2/`,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[HAS-ROLE] Failed to get Management API token');
        return NextResponse.json({ hasRole: false });
      }

      const { access_token } = await tokenResponse.json();

      // Get user's roles from Auth0
      const rolesResponse = await fetch(
        `https://${domain}/api/v2/users/${encodeURIComponent(user.sub)}/roles`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      if (!rolesResponse.ok) {
        console.error('[HAS-ROLE] Failed to fetch user roles from Auth0');
        return NextResponse.json({ hasRole: false });
      }

      const auth0Roles = await rolesResponse.json();
      
      // If user has roles in Auth0, they just need to refresh their token
      if (auth0Roles && auth0Roles.length > 0) {
        return NextResponse.json({
          hasRole: true,
          needsRefresh: true,
          message: 'Roles found in Auth0, but not in current token. Please log out and back in.',
        });
      }

      return NextResponse.json({ hasRole: false });
    } catch (error) {
      console.error('[HAS-ROLE] Error checking Auth0 roles:', error);
      return NextResponse.json({ hasRole: false });
    }
  } catch (error: any) {
    console.error('[HAS-ROLE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
