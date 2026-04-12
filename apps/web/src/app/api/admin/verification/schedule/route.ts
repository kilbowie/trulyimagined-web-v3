import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { sendManualVerificationScheduledEmail } from '@/lib/email';
import { encryptJSON } from '@trulyimagined/utils';
import { DEFAULT_TENANT_ID, getAdminContext, writeAuditLog } from '@/lib/manual-verification';
import { getActorById, scheduleVerificationSession } from '@/lib/hdicr/identity-client';

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

    const actor = (await getActorById(actorId)) as Record<string, unknown> | null;

    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    const actorVerificationStatus =
      (typeof actor.verification_status === 'string' ? actor.verification_status : undefined) ||
      (typeof actor.verificationStatus === 'string' ? actor.verificationStatus : undefined) ||
      null;

    if (actorVerificationStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Actor is no longer pending verification' },
        { status: 409 }
      );
    }

    const encryptedMeetingLink = encryptJSON({ meetingLink });

    const { verificationRequestId } = await scheduleVerificationSession({
      actorId,
      scheduledAt: scheduledDate.toISOString(),
      meetingLinkEncrypted: encryptedMeetingLink,
      meetingPlatform: payload.meetingPlatform || 'external',
      preferredTimezone: payload.preferredTimezone || undefined,
      phoneNumber: payload.phoneNumber || undefined,
      requestedByUserProfileId: adminContext.userProfileId,
    });

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
    const actorEmail =
      (typeof actor.email === 'string' && actor.email.length > 0 ? actor.email : null) ?? null;
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

    if (actorEmail) {
      try {
        await sendManualVerificationScheduledEmail({
          actorEmail,
          actorName:
            actorStageName || [actorFirstName, actorLastName].filter(Boolean).join(' ') || 'there',
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
