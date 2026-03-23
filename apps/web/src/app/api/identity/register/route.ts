import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isActor } from '@/lib/auth';

/**
 * Actor Registration API Route (Development)
 *
 * In production, this would call the Lambda function.
 * For local development, this is a placeholder that validates the
 * registration data.
 *
 * POST /api/identity/register
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Actor role (from PostgreSQL database)
    const hasActorRole = await isActor();
    if (!hasActorRole) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { firstName, lastName, stageName, industryRole, region, bio } = body;

    // Validation
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 }
      );
    }

    // In development, return mock success response
    // In production, this would call the Lambda function
    console.log('[IDENTITY] Registration request:', {
      auth0UserId: user.sub,
      email: user.email,
      firstName,
      lastName,
      stageName,
      industryRole,
      region,
      bio,
    });

    // TODO: When Lambda is deployed, call it here:
    // const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
    // const response = await fetch(`${API_BASE_URL}/identity/register`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    //   },
    //   body: JSON.stringify({
    //     auth0UserId: user.sub,
    //     email: user.email,
    //     firstName,
    //     lastName,
    //     stageName,
    //     bio,
    //     location: region,
    //   }),
    // });

    // Mock response for development
    return NextResponse.json({
      success: true,
      actor: {
        id: `mock-${Date.now()}`,
        email: user.email,
        firstName,
        lastName,
        stageName: stageName || null,
        verificationStatus: 'pending',
        createdAt: new Date().toISOString(),
      },
      message: 'Registration successful (development mode)',
    });
  } catch (error: unknown) {
    console.error('[IDENTITY] Registration error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
