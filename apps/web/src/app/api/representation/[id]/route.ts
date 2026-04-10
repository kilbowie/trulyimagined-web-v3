import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRelationshipById,
} from '@/lib/hdicr/representation-client';
import {
  getTerminationNotificationContext,
  scheduleRepresentationTermination,
  TerminationHttpError,
} from '@/lib/representation-termination';
import { sendRepresentationTerminationNoticeEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/representation/:id
 * Legacy endpoint kept for backward compatibility.
 * Converts removal intent into a 30-day legal notice termination.
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

    const result = await scheduleRepresentationTermination({
      relationshipId: id,
      initiatedByAuth0UserId: user.sub,
      roles,
      reason: 'Termination requested from legacy remove action',
    });

    if (!result.alreadyPending) {
      try {
        const context = await getTerminationNotificationContext(id);
        if (context) {
          await sendRepresentationTerminationNoticeEmail({
            actorEmail: context.actorEmail,
            actorName: context.actorName,
            actorRegistryId: context.actorRegistryId,
            agentEmail: context.agentEmail,
            agencyName: context.agencyName,
            agentRegistryId: context.agentRegistryId,
            effectiveDate: String(result.termination.effective_date),
            initiatedBy: result.termination.initiated_by,
            reason: result.termination.reason || null,
          });
        }
      } catch (emailError) {
        console.error('[REPRESENTATION_ID] Notice email send failed:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyPending: result.alreadyPending,
      termination: result.termination,
      message: result.alreadyPending
        ? 'A 30-day termination notice is already active for this relationship.'
        : '30-day termination notice created successfully.',
    });
  } catch (error) {
    if (error instanceof TerminationHttpError) {
      return NextResponse.json(error.payload, { status: error.status });
    }

    console.error('[REPRESENTATION_ID] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
