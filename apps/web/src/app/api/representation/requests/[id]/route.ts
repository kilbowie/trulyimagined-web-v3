import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import {
  actorHasActiveRelationship,
  createActorAgentRelationship,
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRepresentationRequestById,
  updateRepresentationRequest,
} from '@/lib/hdicr/representation-client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateRequestPayload {
  action?: 'approve' | 'reject' | 'withdraw';
  responseNote?: string;
}

/**
 * PUT /api/representation/requests/:id
 * Agent (or team member with canManageRequests) approves/rejects;
 * actor can withdraw own pending requests.
 */
export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const hasAgentRole = roles.includes('Agent');
    const hasActorRole = roles.includes('Actor');

    // Resolve agent identity: owner or team member with canManageRequests
    let agentId: string | null = null;
    let agentRecord: { id: string; profile_completed?: boolean } | null = null;

    if (hasAgentRole) {
      agentRecord = (await getAgentByAuth0UserId(user.sub)) as {
        id: string;
        profile_completed?: boolean;
      } | null;
      agentId = agentRecord?.id ?? null;
    } else {
      const membership = await getAgentTeamMembership();
      if (membership?.permissions.canManageRequests) {
        agentId = membership.agencyId;
      }
    }

    const hasActorOnly = hasActorRole && !agentId;

    if (!agentId && !hasActorOnly) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const actor = hasActorRole ? await getActorByAuth0UserId(user.sub) : null;

    const { id } = await params;
    const body = (await req.json()) as UpdateRequestPayload;

    if (!body.action || !['approve', 'reject', 'withdraw'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Action must be approve, reject, or withdraw' },
        { status: 400 }
      );
    }

    const targetRequest = await getRepresentationRequestById(id);

    if (!targetRequest) {
      return NextResponse.json({ error: 'Representation request not found' }, { status: 404 });
    }

    if (targetRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request is already ${targetRequest.status}` },
        { status: 409 }
      );
    }

    if (body.action === 'withdraw') {
      if (!actor || targetRequest.actor_id !== actor.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const withdrawnRequest = await updateRepresentationRequest({
        requestId: id,
        action: 'withdraw',
        responseNote: body.responseNote,
      });

      return NextResponse.json({
        success: true,
        request: withdrawnRequest,
        message: 'Representation request withdrawn.',
      });
    }

    if (!agentId) {
      return NextResponse.json({ error: 'Forbidden: agent access required' }, { status: 403 });
    }

    if (targetRequest.agent_id !== agentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For agency owners, check profile completion; team members bypass this
    if (agentRecord && !agentRecord.profile_completed) {
      return NextResponse.json(
        {
          error: 'Complete your agent profile before responding to representation requests.',
        },
        { status: 409 }
      );
    }

    if (body.action === 'approve') {
      const existingRelationship = await actorHasActiveRelationship(targetRequest.actor_id);

      if (existingRelationship) {
        return NextResponse.json(
          {
            error:
              'This actor is already represented by another agent. The actor must end their current representation before approval.',
          },
          { status: 409 }
        );
      }

      const approvedRequest = await updateRepresentationRequest({
        requestId: id,
        action: 'approve',
        responseNote: body.responseNote,
      });

      if (!approvedRequest) {
        return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 });
      }

      await createActorAgentRelationship({
        actorId: targetRequest.actor_id,
        agentId: targetRequest.agent_id,
        representationRequestId: id,
      });

      return NextResponse.json({
        success: true,
        request: approvedRequest,
        message: 'Representation request approved and actor linked to your roster.',
      });
    }

    const rejectedRequest = await updateRepresentationRequest({
      requestId: id,
      action: 'reject',
      responseNote: body.responseNote,
    });

    return NextResponse.json({
      success: true,
      request: rejectedRequest,
      message: 'Representation request rejected.',
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return NextResponse.json(
        {
          error:
            'This actor is already represented by another agent. The actor must end their current representation before approval.',
        },
        { status: 409 }
      );
    }

    console.error('[REPRESENTATION_REQUESTS_ID] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
