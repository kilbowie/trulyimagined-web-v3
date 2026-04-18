import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import {
  AgencySeatCapacityError,
  assertAgencySeatCapacityForNextStatus,
} from '@/lib/agency-seat-limits';

// DB-OWNER: TI

interface AcceptInvitePayload {
  token?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AcceptInvitePayload;
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }

    const inviteResult = await query(
      `SELECT
          atm.id,
          atm.agency_id,
          atm.email,
          atm.full_name,
          atm.member_role,
          atm.status,
          a.agency_name
       FROM agency_team_members atm
       LEFT JOIN agents a ON a.id = atm.agency_id
       WHERE atm.invite_token = $1
         AND atm.deleted_at IS NULL
       LIMIT 1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired invitation link' }, { status: 404 });
    }

    const invite = inviteResult.rows[0] as {
      id: string;
      agency_id: string;
      email: string;
      full_name: string | null;
      member_role: 'Agent' | 'Assistant';
      status: 'invited' | 'active' | 'disabled';
      agency_name: string | null;
    };

    if (invite.status === 'active') {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        message: 'Invitation already accepted.',
      });
    }

    if (!user.email || user.email.toLowerCase() !== String(invite.email).toLowerCase()) {
      return NextResponse.json(
        {
          error:
            'This invite is for a different email address. Please sign in with the invited account.',
          invitedEmail: invite.email,
        },
        { status: 403 }
      );
    }

    try {
      await assertAgencySeatCapacityForNextStatus({
        agencyId: invite.agency_id,
        memberId: invite.id,
        nextStatus: 'active',
      });
    } catch (error) {
      if (error instanceof AgencySeatCapacityError) {
        return NextResponse.json(
          {
            error:
              'This agency has reached its seat limit. Ask your agency admin to upgrade the subscription.',
            code: error.code,
            seatAllocation: error.allocation,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    const profileResult = await query(
      `SELECT id
       FROM user_profiles
       WHERE auth0_user_id = $1
       LIMIT 1`,
      [user.sub]
    );

    const linkedUserProfileId = profileResult.rows[0]?.id || null;

    await query(
      `UPDATE agency_team_members
       SET status = 'active',
           linked_user_profile_id = COALESCE($2, linked_user_profile_id),
           joined_at = COALESCE(joined_at, NOW()),
           invite_token = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [invite.id, linkedUserProfileId]
    );

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully.',
      data: {
        agencyName: invite.agency_name || 'Agency',
        memberRole: invite.member_role,
      },
    });
  } catch (error) {
    console.error('[AGENCY_INVITE_ACCEPT] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
