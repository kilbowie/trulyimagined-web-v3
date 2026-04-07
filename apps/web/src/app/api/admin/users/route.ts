import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { listAdminUsers } from '@/lib/hdicr/identity-client';

// DB-OWNER: HDICR

/**
 * Role-Protected API Route Example
 *
 * GET /api/admin/users
 *
 * Returns all users (admin only)
 * Requires Admin role
 */
export async function GET(): Promise<NextResponse<any>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const usersResult = await listAdminUsers();

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.users,
        total: usersResult.total,
      },
    });
  } catch (error) {
    console.error('[API] /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
