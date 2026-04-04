import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

interface RouteParams {
  params: Promise<{ actorId: string }>;
}

/**
 * GET /api/agent/actors/:actorId/licenses
 * Returns licensing history for actors represented by the authenticated agent.
 */
export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Agent')) {
      return NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 });
    }

    const agent = await getAgentByAuth0Id(user.sub);
    if (!agent) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    const { actorId } = await params;

    const relationship = await query(
      `SELECT 1
       FROM actor_agent_relationships
       WHERE actor_id = $1
         AND agent_id = $2
         AND ended_at IS NULL
       LIMIT 1`,
      [actorId, agent.id]
    );

    if (relationship.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requests = await query(
      `SELECT *
       FROM licensing_requests
       WHERE actor_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [actorId]
    );

    const licenses = await query(
      `SELECT
         l.*, ac.name AS api_client_name
       FROM licenses l
       LEFT JOIN api_clients ac ON ac.id = l.api_client_id
       WHERE l.actor_id = $1
       ORDER BY l.issued_at DESC
       LIMIT 100`,
      [actorId]
    );

    return NextResponse.json({
      licensingRequests: requests.rows,
      licenses: licenses.rows,
    });
  } catch (error) {
    console.error('[AGENT_ACTOR_LICENSES] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
