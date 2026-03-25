import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isActor } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * Generate a unique Registry ID (similar to Spotlight PIN format)
 * Format: XXXX-XXXX-XXXX (12 digits separated by hyphens)
 */
function generateRegistryId(): string {
  const part1 = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const part2 = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const part3 = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `${part1}-${part2}-${part3}`;
}

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
    const existingActor = await query(
      'SELECT id FROM actors WHERE auth0_user_id = $1',
      [user.sub]
    );

    if (existingActor.rows.length > 0) {
      return NextResponse.json(
        { error: 'User already registered' },
        { status: 409 } // Conflict
      );
    }

    // Generate unique Registry ID
    let registryId = generateRegistryId();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure Registry ID is unique
    while (attempts < maxAttempts) {
      const existing = await query(
        'SELECT registry_id FROM actors WHERE registry_id = $1',
        [registryId]
      );

      if (existing.rows.length === 0) {
        break; // Unique ID found
      }

      registryId = generateRegistryId();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique Registry ID. Please try again.' },
        { status: 500 }
      );
    }

    // Insert actor into database
    const result = await query(
      `INSERT INTO actors (
        auth0_user_id,
        email,
        registry_id,
        first_name,
        last_name,
        stage_name,
        location,
        bio,
        verification_status,
        is_founding_member,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING 
        id,
        registry_id,
        first_name,
        last_name,
        stage_name,
        location,
        bio,
        verification_status,
        is_founding_member,
        created_at`,
      [
        user.sub,
        user.email,
        registryId,
        firstName,
        lastName,
        stageName || null,
        location || null,
        bio || null,
        'pending', // Default verification status
        false, // Default not founding member
      ]
    );

    const actor = result.rows[0];

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
