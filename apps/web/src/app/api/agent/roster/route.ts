import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

/**
 * GET /api/agent/roster
 * Returns active actor roster for the authenticated agent or an active team member
 * with the canManageRoster permission.
 */
export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();

    // Resolve agentId: agency owner (Agent role) or team member with canManageRoster
    let agentId: string | null = null;

    if (roles.includes('Agent')) {
      const agent = await getAgentByAuth0Id(user.sub);
      agentId = agent?.id ?? null;
    } else {
      const membership = await getAgentTeamMembership();
      if (membership?.permissions.canManageRoster) {
        agentId = membership.agencyId;
      }
    }

    if (agentId === null && !roles.includes('Agent')) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    if (!agentId) {
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
        a.location,
        lc.version AS consent_version,
        lc.policy AS consent_policy,
        COALESCE((lc.policy->>'usageBlocked')::boolean, false) AS consent_usage_blocked
       FROM actor_agent_relationships r
       INNER JOIN actors a ON a.id = r.actor_id
       LEFT JOIN LATERAL (
         SELECT cl.version, cl.policy
         FROM consent_ledger cl
         WHERE cl.actor_id = a.id
         ORDER BY cl.version DESC
         LIMIT 1
       ) lc ON TRUE
       WHERE r.agent_id = $1
         AND r.ended_at IS NULL
         AND a.deleted_at IS NULL
       ORDER BY r.started_at DESC`,
      [agentId]
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
