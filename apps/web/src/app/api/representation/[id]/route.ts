import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

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

    const actor = hasActorRole ? await getActorByAuth0Id(user.sub) : null;
    const agent = hasAgentRole ? await getAgentByAuth0Id(user.sub) : null;

    const { id } = await params;

    const relationshipResult = await query(
      `SELECT id, actor_id, agent_id, ended_at
       FROM actor_agent_relationships
       WHERE id = $1`,
      [id]
    );

    if (relationshipResult.rows.length === 0) {
      return NextResponse.json({ error: 'Representation relationship not found' }, { status: 404 });
    }

    const relationship = relationshipResult.rows[0];

    if (relationship.ended_at) {
      return NextResponse.json({ error: 'Representation is already ended' }, { status: 409 });
    }

    const actorCanEnd = actor && relationship.actor_id === actor.id;
    const agentCanEnd = agent && relationship.agent_id === agent.id;

    if (!actorCanEnd && !agentCanEnd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const endedBy = actorCanEnd ? 'actor' : 'agent';

    const updated = await query(
      `UPDATE actor_agent_relationships
       SET ended_at = NOW(),
           ended_by_auth0_id = $2,
           ended_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.sub, `Ended by ${endedBy}`]
    );

    return NextResponse.json({
      success: true,
      relationship: updated.rows[0],
      message: 'Representation relationship ended successfully.',
    });
  } catch (error) {
    console.error('[REPRESENTATION_ID] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
