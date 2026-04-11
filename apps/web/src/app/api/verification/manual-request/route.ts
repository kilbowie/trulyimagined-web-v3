import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isActor } from '@/lib/auth';
import { queryHdicr, queryTi } from '@/lib/db';
import { sendManualVerificationRequestAdminEmail } from '@/lib/email';
import { DEFAULT_TENANT_ID, writeAuditLog } from '@/lib/manual-verification';
import { resolveActorRecordByAuth0UserId } from '@/lib/hdicr/actor-identity';

// DB-OWNER: HDICR

interface ManualRequestPayload {
  preferredTimezone?: string;
  phoneNumber?: string;
}

function getActorDisplayName(actor: {
  stage_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return (
    actor.stage_name || [actor.first_name, actor.last_name].filter(Boolean).join(' ') || 'Actor'
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isActor())) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const payload = (await request.json()) as ManualRequestPayload;
    const preferredTimezone = payload.preferredTimezone?.trim();
    const phoneNumber = payload.phoneNumber?.trim();

    if (!preferredTimezone || !phoneNumber) {
      return NextResponse.json(
        { error: 'preferredTimezone and phoneNumber are required' },
        { status: 400 }
      );
    }

    const tenantId = DEFAULT_TENANT_ID;

    const actorRecord = await resolveActorRecordByAuth0UserId(user.sub);

    if (!actorRecord?.id) {
      return NextResponse.json(
        { error: 'Complete actor registration before requesting manual verification' },
        { status: 404 }
      );
    }

    const profileResult = await queryTi(
      `SELECT id
       FROM user_profiles
       WHERE auth0_user_id = $1
       LIMIT 1`,
      [user.sub]
    );

    const userProfileId = profileResult.rows[0]?.id as string | undefined;

    const actor = {
      id: actorRecord.id,
      email: actorRecord.email ?? null,
      registry_id: actorRecord.registry_id ?? null,
      first_name: actorRecord.first_name ?? null,
      last_name: actorRecord.last_name ?? null,
      stage_name: actorRecord.stage_name ?? null,
      verification_status: actorRecord.verification_status ?? null,
      user_profile_id: userProfileId ?? null,
    };

    if (!actor.user_profile_id) {
      return NextResponse.json({ error: 'Actor user profile not found' }, { status: 404 });
    }

    if (actor.verification_status === 'verified') {
      return NextResponse.json(
        { error: 'Identity is already verified for this actor' },
        { status: 409 }
      );
    }

    if (actor.verification_status === 'rejected') {
      return NextResponse.json(
        {
          error:
            'Manual verification has already failed. Please restart verification from the Stripe flow instead.',
        },
        { status: 409 }
      );
    }

    const openSessionResult = await queryHdicr(
      `SELECT id, status
       FROM manual_verification_sessions
       WHERE actor_id = $1::uuid
         AND tenant_id = $2
         AND deleted_at IS NULL
         AND status IN ('pending_scheduling', 'scheduled')
       ORDER BY created_at DESC
       LIMIT 1`,
      [actor.id, tenantId]
    );

    if (openSessionResult.rows.length > 0) {
      return NextResponse.json(
        {
          error: 'A manual verification request is already open for this actor',
          data: {
            verificationRequestId: openSessionResult.rows[0].id,
            status: openSessionResult.rows[0].status,
          },
        },
        { status: 409 }
      );
    }

    const insertResult = await queryHdicr(
      `INSERT INTO manual_verification_sessions (
         actor_id,
         requested_by_user_profile_id,
         status,
         preferred_timezone,
         phone_number,
         tenant_id
       ) VALUES ($1::uuid, $2::uuid, 'pending_scheduling', $3, $4, $5)
       RETURNING id, status, created_at`,
      [actor.id, actor.user_profile_id, preferredTimezone, phoneNumber, tenantId]
    );

    const verificationRequest = insertResult.rows[0] as {
      id: string;
      status: string;
      created_at: string;
    };

    await writeAuditLog({
      userProfileId: actor.user_profile_id,
      userType: 'actor',
      action: 'manual_verification.requested',
      resourceType: 'manual_verification_session',
      resourceId: verificationRequest.id,
      tenantId,
      changes: {
        actorId: actor.id,
        preferredTimezone,
        phoneNumber,
      },
    });

    let notificationSent = false;
    if (actor.email) {
      try {
        await sendManualVerificationRequestAdminEmail({
          actorEmail: actor.email,
          actorName: getActorDisplayName(actor),
          actorId: actor.id,
          registryId: actor.registry_id,
          preferredTimezone,
          phoneNumber,
          requestId: verificationRequest.id,
        });
        notificationSent = true;
      } catch (emailError) {
        console.error('[MANUAL_VERIFICATION_REQUEST] Failed to notify admin:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        verificationRequestId: verificationRequest.id,
        actorId: actor.id,
        status: verificationRequest.status,
        preferredTimezone,
        phoneNumber,
        notificationSent,
      },
    });
  } catch (error) {
    console.error('[MANUAL_VERIFICATION_REQUEST] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
