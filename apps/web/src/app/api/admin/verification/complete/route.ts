import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendVerificationCompleteEmail } from '@/lib/email';
import { encryptJSON } from '@trulyimagined/utils';
import { DEFAULT_TENANT_ID, getAdminContext, writeAuditLog } from '@/lib/manual-verification';

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
      ? await query(
          `SELECT mvs.id, mvs.actor_id, a.auth0_user_id, a.email, a.stage_name, a.first_name, a.last_name
           FROM manual_verification_sessions mvs
           JOIN actors a ON a.id = mvs.actor_id
           WHERE mvs.id = $1::uuid
             AND mvs.tenant_id = $2
             AND mvs.deleted_at IS NULL
           LIMIT 1`,
          [verificationRequestId, tenantId]
        )
      : await query(
          `SELECT mvs.id, mvs.actor_id, a.auth0_user_id, a.email, a.stage_name, a.first_name, a.last_name
           FROM manual_verification_sessions mvs
           JOIN actors a ON a.id = mvs.actor_id
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

    await query(
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

    await query(
      `UPDATE actors
       SET verification_status = $2,
           verified_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
           verified_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1::uuid
         AND tenant_id = $5
         AND deleted_at IS NULL`,
      [
        resolvedActorId,
        payload.verified ? 'verified' : 'rejected',
        payload.verified,
        adminContext.userProfileId,
        tenantId,
      ]
    );

    if (payload.verified) {
      const profileResult = await query(
        `SELECT id
         FROM user_profiles
         WHERE auth0_user_id = $1
         LIMIT 1`,
        [verificationSession.auth0_user_id]
      );

      const userProfileId = profileResult.rows[0]?.id as string | undefined;

      if (userProfileId) {
        const credentialData = encryptJSON({
          method: 'manual_video_verification',
          verificationRequestId: resolvedSessionId,
          completionNotes: payload.notes || null,
          completedAt: new Date().toISOString(),
        });

        await query(
          `INSERT INTO identity_links (
             user_profile_id,
             provider,
             provider_user_id,
             provider_type,
             verification_level,
             assurance_level,
             verified_at,
             credential_data,
             metadata,
             is_active,
             linked_at,
             tenant_id
           ) VALUES (
             $1::uuid,
             'manual-video',
             $2,
             'kyc',
             'medium',
             'substantial',
             NOW(),
             $3::jsonb,
             $4::jsonb,
             TRUE,
             NOW(),
             $5
           )
           ON CONFLICT (user_profile_id, provider, provider_user_id)
           DO UPDATE SET
             verification_level = EXCLUDED.verification_level,
             assurance_level = EXCLUDED.assurance_level,
             verified_at = EXCLUDED.verified_at,
             credential_data = EXCLUDED.credential_data,
             metadata = EXCLUDED.metadata,
             is_active = TRUE,
             updated_at = NOW(),
             tenant_id = EXCLUDED.tenant_id`,
          [
            userProfileId,
            resolvedSessionId,
            JSON.stringify(credentialData),
            JSON.stringify({
              provider: 'manual-video',
              verified_by: adminContext.userProfileId,
              source: 'admin-dashboard',
            }),
            tenantId,
          ]
        );
      }

      if (verificationSession.email) {
        const displayName =
          verificationSession.stage_name ||
          [verificationSession.first_name, verificationSession.last_name]
            .filter(Boolean)
            .join(' ') ||
          'there';

        try {
          await sendVerificationCompleteEmail(verificationSession.email, displayName, 'medium');
        } catch (emailError) {
          console.error(
            '[ADMIN_VERIFICATION_COMPLETE] Failed to send completion email:',
            emailError
          );
        }
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
