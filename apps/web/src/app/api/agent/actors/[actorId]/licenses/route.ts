import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByAuth0Id } from '@/lib/representation';
import {
  getAgentActorLicensingData,
  verifyActiveRepresentation,
} from '@/lib/hdicr/licensing-client';

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

    const hasRelationship = await verifyActiveRepresentation(actorId, agent.id);

    if (!hasRelationship) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { licensingRequests, licenses } = await getAgentActorLicensingData(actorId);

    return NextResponse.json({
      licensingRequests,
      licenses,
    });
  } catch (error) {
    console.error('[AGENT_ACTOR_LICENSES] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
