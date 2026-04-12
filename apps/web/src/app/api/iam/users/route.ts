import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { listIamUsersWithAgentData } from '@/lib/iam-users';
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

    const userRows = await listIamUsersWithAgentData();

    const users = await Promise.all(
      userRows.map(async (row) => {
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
