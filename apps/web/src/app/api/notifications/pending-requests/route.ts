import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

/**
 * GET /api/notifications/pending-requests
 * Returns pending representation request counts for actor and agent dashboards.
 */
export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const hasActorRole = roles.includes('Actor');
    const hasAgentRole = roles.includes('Agent');

    if (!hasActorRole && !hasAgentRole) {
      return NextResponse.json({ success: true, count: 0 });
    }

    let count = 0;

    if (hasAgentRole) {
      const agent = await getAgentByAuth0Id(user.sub);
      if (agent) {
        const pending = await query(
          `SELECT COUNT(*) AS count
           FROM representation_requests
           WHERE agent_id = $1
             AND status = 'pending'`,
          [agent.id]
        );
        count = parseInt(pending.rows[0].count, 10) || 0;
      }
    } else if (hasActorRole) {
      const actor = await getActorByAuth0Id(user.sub);
      if (actor) {
        const pending = await query(
          `SELECT COUNT(*) AS count
           FROM representation_requests
           WHERE actor_id = $1
             AND status = 'pending'`,
          [actor.id]
        );
        count = parseInt(pending.rows[0].count, 10) || 0;
      }
    }

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('[PENDING_REQUESTS_NOTIFICATION] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
