import { auth0 } from '@/lib/auth0';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to assign a role to the current user
 * POST /api/user/assign-role
 * Body: { role: 'Actor' | 'Agent' | 'Enterprise' }
 */

const ALLOWED_ROLES = ['Actor', 'Agent', 'Enterprise'];

export async function POST(req: NextRequest) {
  try {
    // Get current session
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { role } = body;

    // Validate role
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user ID from session
    const userId = session.user.sub;

    // Call Auth0 Management API to assign role
    const managementApiUrl = `https://${process.env.AUTH0_DOMAIN}/api/v2`;

    // First, get an access token for the Management API
    const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get management token:', await tokenResponse.text());
      return NextResponse.json(
        { error: 'Failed to authenticate with Auth0 Management API' },
        { status: 500 }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Get all roles to find the ID of the role we want to assign
    const rolesResponse = await fetch(`${managementApiUrl}/roles`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!rolesResponse.ok) {
      console.error('Failed to get roles:', await rolesResponse.text());
      return NextResponse.json({ error: 'Failed to retrieve roles from Auth0' }, { status: 500 });
    }

    const roles = await rolesResponse.json();
    const targetRole = roles.find((r: any) => r.name === role);

    if (!targetRole) {
      return NextResponse.json(
        { error: `Role "${role}" not found in Auth0. Please create it first.` },
        { status: 404 }
      );
    }

    // Assign the role to the user
    const assignResponse = await fetch(
      `${managementApiUrl}/users/${encodeURIComponent(userId)}/roles`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roles: [targetRole.id],
        }),
      }
    );

    if (!assignResponse.ok) {
      const errorText = await assignResponse.text();
      console.error('Failed to assign role:', errorText);
      return NextResponse.json({ error: 'Failed to assign role to user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Role "${role}" assigned successfully`,
      role: targetRole.name,
    });
  } catch (error) {
    console.error('Error in assign-role API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
