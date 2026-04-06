/**
 * Usage Tracking API - Get Actor Usage
 *
 * GET /api/usage/actor/[actorId]
 *
 * Retrieve usage history for a specific actor
 */

import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  getActorUsageRecords,
  getActorUsageStats,
  getUsageActorById,
} from '@/lib/hdicr/usage-client';

export async function GET(req: Request, { params }: { params: Promise<{ actorId: string }> }) {
  try {
    // 1. Authenticate
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actorId } = await params;

    // 2. Parse query parameters
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 3. Verify actor exists
    const actor = await getUsageActorById(actorId);

    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    // 4. Get usage records
    const usage = await getActorUsageRecords(actorId, limit, offset);

    // 5. Get usage stats
    const usageStats = await getActorUsageStats(actorId);

    // 7. Return response
    return NextResponse.json({
      actor: {
        id: actor.id,
        name: actor.stage_name || `${actor.first_name} ${actor.last_name}`,
      },
      usage,
      stats: usageStats.stats,
      totalMinutes: usageStats.totalMinutes,
      pagination: {
        limit,
        offset,
        count: usage.length,
      },
    });
  } catch (error) {
    console.error('[Usage Get Error]', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve usage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
