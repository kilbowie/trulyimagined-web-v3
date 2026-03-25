import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

/**
 * Actor Registration Status API Route
 *
 * GET /api/identity/status
 * Returns the actor registration status for the current user
 */
export async function GET() {
  try {
    // Get user session
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query database for actor record
    const result = await query(
      `SELECT 
        id,
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
      FROM actors 
      WHERE auth0_user_id = $1`,
      [user.sub]
    );

    // If no actor found, return not registered
    if (result.rows.length === 0) {
      return NextResponse.json({
        registered: false,
        actor: null,
      });
    }

    // Return actor data
    const actor = result.rows[0];
    return NextResponse.json({
      registered: true,
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
        updatedAt: actor.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error('[IDENTITY] Status check error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
