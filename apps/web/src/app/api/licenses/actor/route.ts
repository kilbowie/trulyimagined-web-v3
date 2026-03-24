/**
 * GET /api/licenses/actor
 *
 * Get all licenses for authenticated actor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { getActorLicenses, getLicenseStats } from '@/lib/licensing';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    // 2. Get user profile
    const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
      auth0UserId,
    ]);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    // 3. Find actor record
    const actorResult = await query('SELECT id FROM actors WHERE user_profile_id = $1', [
      profile.id,
    ]);

    if (actorResult.rows.length === 0) {
      return NextResponse.json({
        licenses: [],
        stats: {
          total: 0,
          active: 0,
          revoked: 0,
          expired: 0,
          suspended: 0,
        },
      });
    }

    const actorId = actorResult.rows[0].id;

    // 4. Get licenses and stats
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') as
      | 'active'
      | 'revoked'
      | 'expired'
      | 'suspended'
      | null;

    const licenses = await getActorLicenses(actorId, statusFilter || undefined);
    const stats = await getLicenseStats(actorId);

    return NextResponse.json({
      licenses,
      stats,
      actorId,
    });
  } catch (error) {
    console.error('[LICENSES] Get actor licenses error:', error);
    return NextResponse.json({ error: 'Failed to fetch licenses' }, { status: 500 });
  }
}
