import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  createRepresentationRequest,
  getActiveRepresentationForActor,
  getActorByAuth0UserId,
  getAgentByRegistryId,
  hasPendingRequest,
} from '@/lib/hdicr/representation-client';

interface RequestPayload {
  agentRegistryId?: string;
  message?: string;
}

/**
 * POST /api/representation/request
 * Actor submits a representation request to an agent by registry ID.
 */
export async function POST(request: NextRequest) {
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

    const actor = await getActorByAuth0UserId(user.sub);
    if (!actor) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const activeRelationship = await getActiveRepresentationForActor(actor.id);
    if (activeRelationship) {
      return NextResponse.json(
        {
          error: `You are already represented by ${activeRelationship.agency_name}. Remove your current representation before requesting a new one.`,
        },
        { status: 409 }
      );
    }

    const payload = (await request.json()) as RequestPayload;
    const agentRegistryId = payload.agentRegistryId?.trim();

    if (!agentRegistryId) {
      return NextResponse.json({ error: 'Agent registry ID is required' }, { status: 400 });
    }

    const agent = await getAgentByRegistryId(agentRegistryId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found for the provided registry ID' },
        { status: 404 }
      );
    }

    if (!agent.profile_completed) {
      return NextResponse.json(
        { error: 'This agent is not available yet. Their profile is not complete.' },
        { status: 409 }
      );
    }

    const duplicatePending = await hasPendingRequest(actor.id, agent.id);

    if (duplicatePending) {
      return NextResponse.json(
        { error: 'You already have a pending request with this agent.' },
        { status: 409 }
      );
    }

    const createdRequest = await createRepresentationRequest({
      actorId: actor.id,
      agentId: agent.id,
      message: payload.message,
    });

    return NextResponse.json({
      success: true,
      request: createdRequest,
      message: `Representation request sent to ${agent.agency_name}.`,
    });
  } catch (error) {
    console.error('[REPRESENTATION_REQUEST] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
