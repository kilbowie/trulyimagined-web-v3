import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  createRepresentationRequest,
  getActiveRepresentationForActor,
  getActorByAuth0UserId,
  getAgentByRegistryId,
  hasPendingRequest,
} from '@/lib/hdicr/representation-client';
import { getInvitationCodeForRedeem, redeemInvitationCode } from '@/lib/agent-invitation-codes';
import { sendRepresentationRequestCreatedEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/manual-verification';
import { validateBody } from '@/lib/validation';

const RepresentationRequestSchema = z
  .object({
    agentRegistryId: z.string().min(1).optional(),
    invitationCode: z.string().min(1).optional(),
    message: z.string().max(1000).optional(),
  })
  .refine((d) => d.invitationCode || d.agentRegistryId, {
    message: 'Either invitationCode or agentRegistryId is required',
  });

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

    const validation = await validateBody(request, RepresentationRequestSchema);
    if (!validation.ok) return validation.response;
    const invitationCode = validation.data.invitationCode?.trim().toUpperCase();
    const agentRegistryId = validation.data.agentRegistryId?.trim();

    let agent: Record<string, any> | null = null;
    let invitationCodeRecord: { id: string } | null = null;

    if (invitationCode) {
      const codeRecord = await getInvitationCodeForRedeem(invitationCode);

      if (!codeRecord) {
        return NextResponse.json({ error: 'Invalid invitation code' }, { status: 404 });
      }

      if (codeRecord.redeemed_at) {
        return NextResponse.json({ error: 'Invitation code already redeemed' }, { status: 409 });
      }

      if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Invitation code expired' }, { status: 409 });
      }

      if (!codeRecord.agent_profile_completed) {
        return NextResponse.json(
          { error: 'This agent is not available yet. Their profile is not complete.' },
          { status: 409 }
        );
      }

      agent = {
        id: codeRecord.agent_id,
        agency_name: codeRecord.agency_name,
        profile_completed: codeRecord.agent_profile_completed,
      };
      invitationCodeRecord = { id: codeRecord.id };
    } else {
      const resolvedAgent = await getAgentByRegistryId(agentRegistryId as string);
      agent = resolvedAgent;
    }

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

    if (invitationCodeRecord) {
      const redeemed = await redeemInvitationCode({
        invitationCodeId: invitationCodeRecord.id,
        actorId: actor.id,
      });

      if (!redeemed) {
        return NextResponse.json(
          {
            error:
              'Representation request created, but invitation code could not be redeemed. Please contact support.',
          },
          { status: 409 }
        );
      }
    }

    try {
      await sendRepresentationRequestCreatedEmail({
        agentEmail: agent.contact_email || null,
        agencyName: agent.agency_name || 'Agent',
        actorName: actor.professional_name || actor.legal_name || user.name || 'Actor',
      });
    } catch (emailError) {
      console.error('[REPRESENTATION_REQUEST] Notification email send failed:', emailError);
    }

    if (createdRequest?.id && actor?.id) {
      try {
        await writeAuditLog({
          userProfileId: actor.id,
          userType: 'actor',
          action: 'representation.request.created',
          resourceType: 'representation_request',
          resourceId: createdRequest.id,
          changes: {
            actorId: actor.id,
            agentId: agent.id,
            invitationCodeUsed: Boolean(invitationCodeRecord),
            messageIncluded: Boolean(payload.message?.trim()),
          },
        });
      } catch (auditError) {
        console.error('[REPRESENTATION_REQUEST] Audit log write failed:', auditError);
      }
    }

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
