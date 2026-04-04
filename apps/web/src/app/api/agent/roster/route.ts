import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

/**
 * GET /api/agent/roster
 * Returns active actor roster for the authenticated agent.
 */
export async function GET() {
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
      return NextResponse.json({ roster: [], total: 0 });
    }

    const roster = await query(
      `SELECT
        r.id AS relationship_id,
        r.started_at,
        a.id,
        a.registry_id,
        a.stage_name,
        a.first_name,
        a.last_name,
        a.verification_status,
        a.profile_image_url,
        a.location
       FROM actor_agent_relationships r
       INNER JOIN actors a ON a.id = r.actor_id
       WHERE r.agent_id = $1
         AND r.ended_at IS NULL
         AND a.deleted_at IS NULL
       ORDER BY r.started_at DESC`,
      [agent.id]
    );

    return NextResponse.json({
      roster: roster.rows,
      total: roster.rows.length,
    });
  } catch (error) {
    console.error('[AGENT_ROSTER] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
