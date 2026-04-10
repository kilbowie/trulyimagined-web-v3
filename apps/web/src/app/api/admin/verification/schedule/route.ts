import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { queryHdicr } from '@/lib/db';
import { sendManualVerificationScheduledEmail } from '@/lib/email';
import { encryptJSON } from '@trulyimagined/utils';
import { DEFAULT_TENANT_ID, getAdminContext, writeAuditLog } from '@/lib/manual-verification';

// DB-OWNER: HDICR

interface SchedulePayload {
  actorId?: string;
  scheduledAt?: string;
  meetingLink?: string;
  meetingPlatform?: string;
  preferredTimezone?: string;
  phoneNumber?: string;
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

    const payload = (await request.json()) as SchedulePayload;
    const actorId = payload.actorId?.trim();
    const scheduledAt = payload.scheduledAt?.trim();
    const meetingLink = payload.meetingLink?.trim();

    if (!actorId || !scheduledAt || !meetingLink) {
      return NextResponse.json(
        { error: 'actorId, scheduledAt, and meetingLink are required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'scheduledAt must be a valid ISO date' }, { status: 400 });
    }

    const tenantId = DEFAULT_TENANT_ID;

    const actorResult = await queryHdicr(
      `SELECT id, verification_status, email, first_name, last_name, stage_name
       FROM actors
       WHERE id = $1::uuid
         AND tenant_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [actorId, tenantId]
    );

    if (actorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    if (actorResult.rows[0].verification_status !== 'pending') {
      return NextResponse.json(
        { error: 'Actor is no longer pending verification' },
        { status: 409 }
      );
    }

    const encryptedMeetingLink = encryptJSON({ meetingLink });

    const openSessionResult = await queryHdicr(
      `SELECT id
       FROM manual_verification_sessions
       WHERE actor_id = $1::uuid
         AND tenant_id = $2
         AND deleted_at IS NULL
         AND status IN ('pending_scheduling', 'scheduled')
       ORDER BY created_at DESC
       LIMIT 1`,
      [actorId, tenantId]
    );

    let verificationRequestId: string;

    if (openSessionResult.rows.length > 0) {
      verificationRequestId = openSessionResult.rows[0].id;
      await queryHdicr(
        `UPDATE manual_verification_sessions
         SET status = 'scheduled',
             scheduled_at = $2::timestamptz,
             meeting_link_encrypted = $3,
             meeting_platform = COALESCE($4, meeting_platform),
             preferred_timezone = COALESCE($5, preferred_timezone),
             phone_number = COALESCE($6, phone_number),
             requested_by_user_profile_id = $7::uuid,
             tenant_id = $8,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          verificationRequestId,
          scheduledDate.toISOString(),
          encryptedMeetingLink,
          payload.meetingPlatform || 'external',
          payload.preferredTimezone || null,
          payload.phoneNumber || null,
          adminContext.userProfileId,
          tenantId,
        ]
      );
    } else {
      const insertResult = await queryHdicr(
        `INSERT INTO manual_verification_sessions (
           actor_id,
           status,
           preferred_timezone,
           phone_number,
           meeting_platform,
           meeting_link_encrypted,
           scheduled_at,
           requested_by_user_profile_id,
           tenant_id
         ) VALUES ($1::uuid, 'scheduled', $2, $3, $4, $5, $6::timestamptz, $7::uuid, $8)
         RETURNING id`,
        [
          actorId,
          payload.preferredTimezone || null,
          payload.phoneNumber || null,
          payload.meetingPlatform || 'external',
          encryptedMeetingLink,
          scheduledDate.toISOString(),
          adminContext.userProfileId,
          tenantId,
        ]
      );
      verificationRequestId = insertResult.rows[0].id;
    }

    await writeAuditLog({
      userProfileId: adminContext.userProfileId,
      action: 'manual_verification.scheduled',
      resourceType: 'manual_verification_session',
      resourceId: verificationRequestId,
      tenantId,
      changes: {
        actorId,
        scheduledAt: scheduledDate.toISOString(),
        meetingPlatform: payload.meetingPlatform || 'external',
      },
    });

    let notificationSent = false;
    const actor = actorResult.rows[0] as {
      email?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      stage_name?: string | null;
    };

    if (actor.email) {
      try {
        await sendManualVerificationScheduledEmail({
          actorEmail: actor.email,
          actorName:
            actor.stage_name || [actor.first_name, actor.last_name].filter(Boolean).join(' ') || 'there',
          meetingLink,
          meetingPlatform: payload.meetingPlatform || 'external',
          scheduledAt: scheduledDate.toISOString(),
          preferredTimezone: payload.preferredTimezone || null,
        });
        notificationSent = true;
      } catch (emailError) {
        console.error('[ADMIN_VERIFICATION_SCHEDULE] Failed to send scheduling email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        verificationRequestId,
        actorId,
        status: 'scheduled',
        scheduledAt: scheduledDate.toISOString(),
        notificationSent,
      },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFICATION_SCHEDULE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
