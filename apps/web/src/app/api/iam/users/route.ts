import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveActorRecordByAuth0UserId } from '@/lib/hdicr/actor-identity';

// DB-OWNER: TI

/**
 * GET /api/iam/users
 * Returns IAM user account records for admin management.
 */
export async function GET(): Promise<NextResponse> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const usersResult = await query(
      `
      SELECT
        up.id,
        up.auth0_user_id,
        up.email,
        up.role,
        up.username,
        up.legal_name,
        up.professional_name,
        up.profile_completed,
        up.is_verified,
        up.is_pro,
        up.created_at,
        up.updated_at,
        ag.id AS agent_id,
        ag.agency_name,
        ag.verification_status AS agent_verification_status,
        ag.registry_id AS agent_registry_id,
        ag.profile_completed AS agent_profile_completed
      FROM user_profiles up
      LEFT JOIN agents ag ON ag.auth0_user_id = up.auth0_user_id AND ag.deleted_at IS NULL
      ORDER BY up.created_at DESC
    `
    );

    const users = await Promise.all(
      usersResult.rows.map(async (row) => {
        const actor = await resolveActorRecordByAuth0UserId(String(row.auth0_user_id));

        return {
          ...row,
          actor_id: actor?.id ?? null,
          first_name: actor?.first_name ?? null,
          last_name: actor?.last_name ?? null,
          stage_name: actor?.stage_name ?? null,
          verification_status: actor?.verification_status ?? null,
          registry_id: actor?.registry_id ?? null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        users,
        total: users.length,
      },
    });
  } catch (error) {
    console.error('[API] /api/iam/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
