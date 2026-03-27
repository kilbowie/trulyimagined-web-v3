/**
 * Usage Tracking API - Get Actor Usage
 *
 * GET /api/usage/actor/[actorId]
 *
 * Retrieve usage history for a specific actor
 */

import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

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
    const actorCheck = await query(
      'SELECT id, first_name, last_name, stage_name FROM actors WHERE id = $1',
      [actorId]
    );

    if (actorCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    const actor = actorCheck.rows[0];

    // 4. Get usage records
    const usageResult = await query(
      `SELECT * FROM usage_tracking 
       WHERE actor_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [actorId, limit, offset]
    );

    // 5. Get usage stats
    const statsResult = await query(
      `SELECT 
        usage_type,
        unit,
        SUM(quantity) as total_quantity,
        COUNT(*) as total_records,
        MIN(created_at) as first_usage,
        MAX(created_at) as last_usage
      FROM usage_tracking
      WHERE actor_id = $1
      GROUP BY usage_type, unit`,
      [actorId]
    );

    // 6. Get total minutes (key metric)
    const minutesResult = await query(
      `SELECT SUM(quantity) as total_minutes
       FROM usage_tracking
       WHERE actor_id = $1 AND usage_type = 'voice_minutes' AND unit = 'minutes'`,
      [actorId]
    );

    // 7. Return response
    return NextResponse.json({
      actor: {
        id: actor.id,
        name: actor.stage_name || `${actor.first_name} ${actor.last_name}`,
      },
      usage: usageResult.rows,
      stats: statsResult.rows,
      totalMinutes: parseFloat(minutesResult.rows[0]?.total_minutes || '0'),
      pagination: {
        limit,
        offset,
        count: usageResult.rows.length,
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
