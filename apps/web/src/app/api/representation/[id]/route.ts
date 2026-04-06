import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  endRelationship,
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRelationshipById,
} from '@/lib/hdicr/representation-client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/representation/:id
 * Ends an active representation relationship. Either actor or agent may end it.
 */
export async function DELETE(_req: Request, { params }: RouteParams): Promise<NextResponse> {
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
      return NextResponse.json(
        { error: 'Forbidden: Actor or Agent role required' },
        { status: 403 }
      );
    }

    const actor = hasActorRole ? await getActorByAuth0UserId(user.sub) : null;
    const agent = hasAgentRole ? await getAgentByAuth0UserId(user.sub) : null;

    const { id } = await params;

    const relationship = await getRelationshipById(id);

    if (!relationship) {
      return NextResponse.json({ error: 'Representation relationship not found' }, { status: 404 });
    }

    if (relationship.ended_at) {
      return NextResponse.json({ error: 'Representation is already ended' }, { status: 409 });
    }

    const actorCanEnd = actor && relationship.actor_id === actor.id;
    const agentCanEnd = agent && relationship.agent_id === agent.id;

    if (!actorCanEnd && !agentCanEnd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const endedBy = actorCanEnd ? 'actor' : 'agent';

    const updatedRelationship = await endRelationship({
      relationshipId: id,
      endedByAuth0UserId: user.sub,
      endedBy,
    });

    return NextResponse.json({
      success: true,
      relationship: updatedRelationship,
      message: 'Representation relationship ended successfully.',
    });
  } catch (error) {
    console.error('[REPRESENTATION_ID] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
