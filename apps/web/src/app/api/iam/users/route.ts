import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

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
        a.id AS actor_id,
        a.first_name,
        a.last_name,
        a.stage_name,
        a.verification_status,
        a.registry_id,
        ag.id AS agent_id,
        ag.agency_name,
        ag.verification_status AS agent_verification_status,
        ag.registry_id AS agent_registry_id,
        ag.profile_completed AS agent_profile_completed
      FROM user_profiles up
      LEFT JOIN actors a ON a.auth0_user_id = up.auth0_user_id AND a.deleted_at IS NULL
      LEFT JOIN agents ag ON ag.auth0_user_id = up.auth0_user_id AND ag.deleted_at IS NULL
      ORDER BY up.created_at DESC
    `
    );

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        total: usersResult.rows.length,
      },
    });
  } catch (error) {
    console.error('[API] /api/iam/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
