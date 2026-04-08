import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { resolveActorRecordByAuth0UserId } from '@/lib/hdicr/actor-identity';

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

    const actorRecord = await resolveActorRecordByAuth0UserId(user.sub);

    if (!actorRecord) {
      return NextResponse.json({
        registered: false,
        actor: null,
      });
    }

    const profileResult = await query(
      `SELECT
         COALESCE(is_verified, FALSE) AS is_verified,
         COALESCE(is_pro, FALSE) AS is_pro
       FROM user_profiles
       WHERE auth0_user_id = $1
       LIMIT 1`,
      [user.sub]
    );

    const profile = profileResult.rows[0] || { is_verified: false, is_pro: false };

    const verificationStatus =
      actorRecord.verification_status === 'verified' || actorRecord.verification_status === 'rejected'
        ? actorRecord.verification_status
        : 'pending';

    const actor = {
      id: actorRecord.id,
      registryId: actorRecord.registry_id ?? null,
      firstName: actorRecord.first_name ?? '',
      lastName: actorRecord.last_name ?? '',
      stageName: actorRecord.stage_name ?? null,
      location: actorRecord.location ?? null,
      bio: actorRecord.bio ?? null,
      verificationStatus,
      isVerified: Boolean(profile.is_verified) || verificationStatus === 'verified',
      isPro: Boolean(profile.is_pro),
      isFoundingMember: Boolean(actorRecord.is_founding_member),
      createdAt: actorRecord.created_at ?? null,
      email: actorRecord.email ?? null,
    };

    return NextResponse.json({
      registered: true,
      actor,
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
