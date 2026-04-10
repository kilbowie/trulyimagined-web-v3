import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  getTerminationNotificationContext,
  scheduleRepresentationTermination,
  TerminationHttpError,
} from '@/lib/representation-termination';
import { sendRepresentationTerminationNoticeEmail } from '@/lib/email';

interface TerminatePayload {
  relationshipId?: string;
  reason?: string;
}

/**
 * POST /api/representation/terminate
 * Creates a 30-day notice to end an actor-agent representation relationship.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TerminatePayload;
    const relationshipId = body.relationshipId?.trim();

    if (!relationshipId) {
      return NextResponse.json({ error: 'relationshipId is required' }, { status: 400 });
    }

    const roles = await getUserRoles();
    const result = await scheduleRepresentationTermination({
      relationshipId,
      initiatedByAuth0UserId: user.sub,
      roles,
      reason: body.reason?.trim() || null,
    });

    if (!result.alreadyPending) {
      try {
        const context = await getTerminationNotificationContext(relationshipId);
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
        console.error('[REPRESENTATION_TERMINATE] Notice email send failed:', emailError);
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

    console.error('[REPRESENTATION_TERMINATE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
