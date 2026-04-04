import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id } from '@/lib/representation';

/**
 * GET /api/actor/licensing-requests
 * Returns incoming licensing requests for the authenticated actor.
 * Optional query param: ?status=pending|approved|rejected|expired
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Actor')) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const actor = await getActorByAuth0Id(user.sub);
    if (!actor) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    const validStatuses = ['pending', 'approved', 'rejected', 'expired'];

    let sql: string;
    let params: unknown[];

    if (statusParam && validStatuses.includes(statusParam)) {
      sql = `SELECT
               id,
               requester_name,
               requester_email,
               requester_organization,
               project_name,
               project_description,
               usage_type,
               intended_use,
               duration_start,
               duration_end,
               compensation_offered,
               compensation_currency,
               status,
               approved_at,
               rejected_at,
               rejection_reason,
               created_at,
               updated_at
             FROM licensing_requests
             WHERE actor_id = $1
               AND status = $2
             ORDER BY created_at DESC
             LIMIT 100`;
      params = [actor.id, statusParam];
    } else {
      sql = `SELECT
               id,
               requester_name,
               requester_email,
               requester_organization,
               project_name,
               project_description,
               usage_type,
               intended_use,
               duration_start,
               duration_end,
               compensation_offered,
               compensation_currency,
               status,
               approved_at,
               rejected_at,
               rejection_reason,
               created_at,
               updated_at
             FROM licensing_requests
             WHERE actor_id = $1
             ORDER BY created_at DESC
             LIMIT 100`;
      params = [actor.id];
    }

    const result = await query(sql, params);

    const pendingCount = await query(
      `SELECT COUNT(*) AS count FROM licensing_requests WHERE actor_id = $1 AND status = 'pending'`,
      [actor.id]
    );

    return NextResponse.json({
      requests: result.rows,
      pendingCount: parseInt(pendingCount.rows[0].count, 10) || 0,
    });
  } catch (error) {
    console.error('[ACTOR_LICENSING_REQUESTS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
