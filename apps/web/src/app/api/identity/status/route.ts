import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { ensureActorRegistryId } from '@/lib/registry-id';

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
        a.id,
        a.registry_id,
        a.first_name,
        a.last_name,
        a.stage_name,
        a.location,
        a.bio,
        a.verification_status,
        a.is_founding_member,
        a.created_at,
        a.updated_at,
        COALESCE(up.is_verified, FALSE) AS is_verified,
        COALESCE(up.is_pro, FALSE) AS is_pro
      FROM actors a
      LEFT JOIN user_profiles up ON up.auth0_user_id = a.auth0_user_id
      WHERE a.auth0_user_id = $1`,
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
    const registryId = await ensureActorRegistryId(actor.id, actor.registry_id);

    return NextResponse.json({
      registered: true,
      actor: {
        id: actor.id,
        registryId,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        location: actor.location,
        bio: actor.bio,
        verificationStatus: actor.verification_status,
        isVerified: !!actor.is_verified || actor.verification_status === 'verified',
        isPro: !!actor.is_pro,
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
