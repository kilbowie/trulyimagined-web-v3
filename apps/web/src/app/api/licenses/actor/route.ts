/**
 * GET /api/licenses/actor
 *
 * Get all licenses for authenticated actor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  getActorLicensesAndStats,
  resolveActorIdByAuth0UserId,
} from '@/lib/hdicr/licensing-client';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    const actorId = await resolveActorIdByAuth0UserId(auth0UserId);

    if (!actorId) {
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

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') as
      | 'active'
      | 'revoked'
      | 'expired'
      | 'suspended'
      | null;
    const { licenses, stats } = await getActorLicensesAndStats(actorId, statusFilter || undefined);

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
