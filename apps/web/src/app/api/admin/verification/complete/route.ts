import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { queryHdicr, queryTi } from '@/lib/db';
import { sendVerificationCompleteEmail, sendVerificationRetryEmail } from '@/lib/email';
import { encryptJSON } from '@trulyimagined/utils';
import { DEFAULT_TENANT_ID, getAdminContext, writeAuditLog } from '@/lib/manual-verification';
import {
  getActorById,
  setActorVerificationStatus,
  upsertIdentityLink,
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

    const sessionResult = verificationRequestId
      ? await queryHdicr(
          `SELECT mvs.id, mvs.actor_id
           FROM manual_verification_sessions mvs
           WHERE mvs.id = $1::uuid
             AND mvs.tenant_id = $2
             AND mvs.deleted_at IS NULL
           LIMIT 1`,
          [verificationRequestId, tenantId]
        )
      : await queryHdicr(
          `SELECT mvs.id, mvs.actor_id
           FROM manual_verification_sessions mvs
           WHERE mvs.actor_id = $1::uuid
             AND mvs.tenant_id = $2
             AND mvs.deleted_at IS NULL
           ORDER BY mvs.created_at DESC
           LIMIT 1`,
          [actorId, tenantId]
        );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Verification session not found' }, { status: 404 });
    }

    const verificationSession = sessionResult.rows[0];
    const resolvedActorId: string = verificationSession.actor_id;
    const resolvedSessionId: string = verificationSession.id;

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

    await queryHdicr(
      `UPDATE manual_verification_sessions
       SET status = $2,
           verified = $3,
           completion_notes = $4,
           completed_at = NOW(),
           completed_by_user_profile_id = $5::uuid,
           tenant_id = $6,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        resolvedSessionId,
        payload.verified ? 'completed' : 'failed',
        payload.verified,
        payload.notes || null,
        adminContext.userProfileId,
        tenantId,
      ]
    );

    await setActorVerificationStatus(resolvedActorId, {
      verified: payload.verified,
      verifiedByUserProfileId: adminContext.userProfileId,
    });

    const displayName =
      actorStageName ||
      [actorFirstName, actorLastName].filter(Boolean).join(' ') ||
      'there';

    if (payload.verified) {
      if (!actorAuth0UserId) {
        return NextResponse.json({ error: 'Actor is missing auth0_user_id' }, { status: 404 });
      }

      const profileResult = await queryTi(
        `SELECT id
         FROM user_profiles
         WHERE auth0_user_id = $1
         LIMIT 1`,
        [actorAuth0UserId]
      );

      const userProfileId = profileResult.rows[0]?.id as string | undefined;

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
