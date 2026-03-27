import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Role-Protected API Route Example
 * 
 * GET /api/admin/users
 * 
 * Returns all users (admin only)
 * Requires Admin role
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
    
    // Check if user has Admin role
    if (!roles.includes('Admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }
    
    // TODO: Fetch users from database
    // This is just an example response
    return NextResponse.json({
      success: true,
      data: {
        users: [
          { id: '1', email: 'actor@example.com', role: 'Actor' },
          { id: '2', email: 'agent@example.com', role: 'Agent' },
        ],
        total: 2,
      },
    });
  } catch (error) {
    console.error('[API] /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );  }
}) as any; // Type assertion needed for Auth0 wrapper compatibility with Next.js 15
