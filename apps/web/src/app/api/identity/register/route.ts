import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isActor } from '@/lib/auth';
import { actorExistsByAuth0UserId, createActorRegistration } from '@/lib/hdicr/identity-client';

/**
 * Actor Registration API Route (Development)
 *
 * In production, this would call the Lambda function.
 * For local development, this creates the actor record in the database.
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
    const { firstName, lastName, stageName, location, bio } = body;

    // Validation
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 }
      );
    }

    // Check if user is already registered
    const existingActor = await actorExistsByAuth0UserId(user.sub);

    if (existingActor) {
      return NextResponse.json(
        { error: 'User already registered' },
        { status: 409 } // Conflict
      );
    }

    const actor = await createActorRegistration({
      auth0UserId: user.sub,
      email: user.email,
      firstName,
      lastName,
      stageName,
      location,
      bio,
    });

    console.log('[IDENTITY] Registration successful:', {
      actorId: actor.actor_id,
      registryId: actor.registry_id,
      email: user.email,
    });

    // Return success response with actor data
    return NextResponse.json({
      success: true,
      actor: {
        id: actor.id,
        registryId: actor.registry_id,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        location: actor.location,
        bio: actor.bio,
        verificationStatus: actor.verification_status,
        isFoundingMember: actor.is_founding_member,
        createdAt: actor.created_at,
      },
      message: 'Registration successful',
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
