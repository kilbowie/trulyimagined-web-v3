import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

// DB-OWNER: TI

interface RouteParams {
  params: Promise<{ userProfileId: string }>;
}

/**
 * PATCH /api/iam/users/:userProfileId
 * Updates IAM status flags (is_verified, is_pro).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const { userProfileId } = await params;
    const body = await req.json();

    const isVerified = body.isVerified === undefined ? undefined : Boolean(body.isVerified);
    const isPro = body.isPro === undefined ? undefined : Boolean(body.isPro);

    if (isVerified === undefined && isPro === undefined) {
      return NextResponse.json(
        { error: 'At least one of isVerified or isPro is required' },
        { status: 400 }
      );
    }

    const updateResult = await query(
      `
      UPDATE user_profiles
      SET
        is_verified = COALESCE($2, is_verified),
        is_pro = COALESCE($3, is_pro),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, auth0_user_id, email, role, is_verified, is_pro, updated_at
    `,
      [userProfileId, isVerified, isPro]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const updatedUser = updateResult.rows[0];

    if (isVerified !== undefined && String(updatedUser.role).toLowerCase() === 'agent') {
      await query(
        `UPDATE agents
         SET verification_status = $2,
             updated_at = NOW()
         WHERE (user_profile_id = $1 OR auth0_user_id = $3)
           AND deleted_at IS NULL`,
        [updatedUser.id, isVerified ? 'verified' : 'pending', updatedUser.auth0_user_id]
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[API] /api/iam/users/[userProfileId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
