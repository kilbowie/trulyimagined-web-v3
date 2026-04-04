import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

const INCOMING_REQUESTS_QUERY = `
  SELECT
    rr.id,
    rr.actor_id,
    rr.agent_id,
    rr.status,
    rr.message,
    rr.response_note,
    rr.requested_at,
    rr.responded_at,
    rr.created_at,
    rr.updated_at,
    a.stage_name,
    a.first_name,
    a.last_name,
    a.registry_id AS actor_registry_id
   FROM representation_requests rr
   INNER JOIN actors a ON a.id = rr.actor_id
   WHERE rr.agent_id = $1
   ORDER BY rr.requested_at DESC`;

/**
 * GET /api/representation/requests
 * Actor gets outgoing requests; Agent (or active team member with canManageRequests)
 * gets incoming requests for their agency.
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

    // Agency owner: return incoming requests
    if (hasAgentRole) {
      const agent = await getAgentByAuth0Id(user.sub);
      if (!agent) {
        return NextResponse.json({ requests: [], perspective: 'agent' });
      }

      const incoming = await query(INCOMING_REQUESTS_QUERY, [agent.id]);

      return NextResponse.json({
        perspective: 'agent',
        requests: incoming.rows,
      });
    }

    // Active team member with canManageRequests: return agency's incoming requests
    const membership = await getAgentTeamMembership();
    if (membership?.permissions.canManageRequests) {
      const incoming = await query(INCOMING_REQUESTS_QUERY, [membership.agencyId]);
      return NextResponse.json({ perspective: 'agent', requests: incoming.rows });
    }

    // Actor: return outgoing requests
    if (hasActorRole) {
      const actor = await getActorByAuth0Id(user.sub);
      if (!actor) {
        return NextResponse.json({ requests: [], perspective: 'actor' });
      }

      const outgoing = await query(
        `SELECT
          rr.id,
          rr.actor_id,
          rr.agent_id,
          rr.status,
          rr.message,
          rr.response_note,
          rr.requested_at,
          rr.responded_at,
          rr.created_at,
          rr.updated_at,
          ag.agency_name,
          ag.registry_id AS agent_registry_id,
          ag.verification_status,
          ag.profile_image_url
         FROM representation_requests rr
         INNER JOIN agents ag ON ag.id = rr.agent_id
         WHERE rr.actor_id = $1
           AND ag.deleted_at IS NULL
         ORDER BY rr.requested_at DESC`,
        [actor.id]
      );

      return NextResponse.json({
        perspective: 'actor',
        requests: outgoing.rows,
      });
    }

    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 }
    );
  } catch (error) {
    console.error('[REPRESENTATION_REQUESTS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
