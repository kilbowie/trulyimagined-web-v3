import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import {
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  listIncomingRequests,
  listOutgoingRequests,
} from '@/lib/hdicr/representation-client';

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
      const agent = await getAgentByAuth0UserId(user.sub);
      if (!agent) {
        return NextResponse.json({ requests: [], perspective: 'agent' });
      }

      const incoming = await listIncomingRequests(agent.id);

      return NextResponse.json({
        perspective: 'agent',
        requests: incoming,
      });
    }

    // Active team member with canManageRequests: return agency's incoming requests
    const membership = await getAgentTeamMembership();
    if (membership?.permissions.canManageRequests) {
      const incoming = await listIncomingRequests(membership.agencyId);
      return NextResponse.json({ perspective: 'agent', requests: incoming });
    }

    // Actor: return outgoing requests
    if (hasActorRole) {
      const actor = await getActorByAuth0UserId(user.sub);
      if (!actor) {
        return NextResponse.json({ requests: [], perspective: 'actor' });
      }

      const outgoing = await listOutgoingRequests(actor.id);

      return NextResponse.json({
        perspective: 'actor',
        requests: outgoing,
      });
    }

    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  } catch (error) {
    console.error('[REPRESENTATION_REQUESTS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
