import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Protected API Route Example
 * 
 * GET /api/me
 * 
 * Returns the current user's profile and roles
 * Requires authentication
 */
export const GET = auth0.withApiAuthRequired(async function handler(): Promise<NextResponse<any>> {
  try {
    const session = await auth0.getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = session.user;
    const roles = user['https://trulyimagined.com/roles'] || [];
    
    return NextResponse.json({
      success: true,
      data: {
        id: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
        emailVerified: user.email_verified,
        roles,
      },
    });
  } catch (error) {
    console.error('[API] /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}) as any; // Type assertion needed for Auth0 wrapper compatibility with Next.js 15
