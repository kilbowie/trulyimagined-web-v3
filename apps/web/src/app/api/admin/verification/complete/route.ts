import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { sendVerificationCompleteEmail, sendVerificationRetryEmail } from '@/lib/email';
import { encryptJSON } from '@trulyimagined/utils';
import {
  DEFAULT_TENANT_ID,
  getAdminContext,
  resolveUserProfileId,
  writeAuditLog,
} from '@/lib/manual-verification';
import {
  getActorById,
  setActorVerificationStatus,
  upsertIdentityLink,
  completeVerificationSession,
} from '@/lib/hdicr/identity-client';

// DB-OWNER: HDICR

interface CompletePayload {
  verificationRequestId?: string;
  actorId?: string;
  verified?: boolean;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const adminContext = await getAdminContext(user.sub);
    if (!adminContext) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    const payload = (await request.json()) as CompletePayload;
    const verificationRequestId = payload.verificationRequestId?.trim();
    const actorId = payload.actorId?.trim();

    if (!verificationRequestId && !actorId) {
      return NextResponse.json(
        { error: 'verificationRequestId or actorId is required' },
        { status: 400 }
      );
    }

    if (typeof payload.verified !== 'boolean') {
      return NextResponse.json({ error: 'verified must be true or false' }, { status: 400 });
    }

    const tenantId = DEFAULT_TENANT_ID;

    let resolvedSessionId: string;
    let resolvedActorId: string;

    try {
      const sessionResult = await completeVerificationSession({
        ...(verificationRequestId ? { sessionId: verificationRequestId } : { actorId }),
        verified: payload.verified,
        notes: payload.notes || undefined,
        completedByUserProfileId: adminContext.userProfileId,
      });
      resolvedSessionId = sessionResult.sessionId;
      resolvedActorId = sessionResult.actorId;
    } catch (err: unknown) {
      const status =
        err instanceof Error && err.message.includes('404')
          ? 404
          : err instanceof Error && err.message.includes('session not found')
            ? 404
            : 500;
      return NextResponse.json(
        { error: status === 404 ? 'Verification session not found' : 'Internal server error' },
        { status }
      );
    }

    const actor = (await getActorById(resolvedActorId)) as Record<string, unknown> | null;
    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    const actorAuth0UserId =
      (typeof actor.auth0_user_id === 'string' ? actor.auth0_user_id : undefined) ||
      (typeof actor.auth0UserId === 'string' ? actor.auth0UserId : undefined) ||
      null;
    const actorEmail = typeof actor.email === 'string' ? actor.email : null;
    const actorStageName =
      (typeof actor.stage_name === 'string' ? actor.stage_name : undefined) ||
      (typeof actor.stageName === 'string' ? actor.stageName : undefined) ||
      null;
    const actorFirstName =
      (typeof actor.first_name === 'string' ? actor.first_name : undefined) ||
      (typeof actor.firstName === 'string' ? actor.firstName : undefined) ||
      null;
    const actorLastName =
      (typeof actor.last_name === 'string' ? actor.last_name : undefined) ||
      (typeof actor.lastName === 'string' ? actor.lastName : undefined) ||
      null;

    await setActorVerificationStatus(resolvedActorId, {
      verified: payload.verified,
      verifiedByUserProfileId: adminContext.userProfileId,
    });

    const displayName =
      actorStageName || [actorFirstName, actorLastName].filter(Boolean).join(' ') || 'there';

    if (payload.verified) {
      if (!actorAuth0UserId) {
        return NextResponse.json({ error: 'Actor is missing auth0_user_id' }, { status: 404 });
      }

      const userProfileId = await resolveUserProfileId(actorAuth0UserId);

      if (userProfileId) {
        const credentialData = encryptJSON({
          method: 'manual_video_verification',
          verificationRequestId: resolvedSessionId,
          completionNotes: payload.notes || null,
          completedAt: new Date().toISOString(),
        });

        await upsertIdentityLink({
          userProfileId,
          provider: 'manual-video',
          providerUserId: resolvedSessionId,
          providerType: 'kyc',
          verificationLevel: 'medium',
          assuranceLevel: 'substantial',
          credentialData,
          metadata: {
            provider: 'manual-video',
            verified_by: adminContext.userProfileId,
            source: 'admin-dashboard',
            tenant_id: tenantId,
          },
        });
      }

      if (actorEmail) {
        try {
          await sendVerificationCompleteEmail(actorEmail, displayName, 'medium');
        } catch (emailError) {
          console.error(
            '[ADMIN_VERIFICATION_COMPLETE] Failed to send completion email:',
            emailError
          );
        }
      }
    } else if (actorEmail) {
      try {
        await sendVerificationRetryEmail(actorEmail, displayName);
      } catch (emailError) {
        console.error('[ADMIN_VERIFICATION_COMPLETE] Failed to send retry email:', emailError);
      }
    }

    await writeAuditLog({
      userProfileId: adminContext.userProfileId,
      action: payload.verified ? 'manual_verification.completed' : 'manual_verification.failed',
      resourceType: 'manual_verification_session',
      resourceId: resolvedSessionId,
      tenantId,
      changes: {
        actorId: resolvedActorId,
        verificationStatus: payload.verified ? 'verified' : 'rejected',
        notes: payload.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        verificationRequestId: resolvedSessionId,
        actorId: resolvedActorId,
        status: payload.verified ? 'completed' : 'failed',
        verificationStatus: payload.verified ? 'verified' : 'rejected',
      },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFICATION_COMPLETE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
