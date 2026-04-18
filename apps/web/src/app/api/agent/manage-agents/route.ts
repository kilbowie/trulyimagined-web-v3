import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';
import { sendAgencyTeamInviteEmail } from '@/lib/email';
import {
  AgencySeatCapacityError,
  assertAgencySeatCapacityForNextStatus,
  getAgencySeatAllocation,
} from '@/lib/agency-seat-limits';

// DB-OWNER: TI

interface TeamMemberPermissions {
  canManageRoster: boolean;
  canManageRequests: boolean;
  canViewConsent: boolean;
  canViewLicensing: boolean;
  canManageTeam: boolean;
}

interface CreateMemberPayload {
  email?: string;
  fullName?: string;
  memberRole?: 'Agent' | 'Assistant';
  accessPermissions?: Partial<TeamMemberPermissions>;
}

const defaultPermissions: TeamMemberPermissions = {
  canManageRoster: true,
  canManageRequests: true,
  canViewConsent: true,
  canViewLicensing: true,
  canManageTeam: false,
};

async function requireAgentContext() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const roles = await getUserRoles();
  if (!roles.includes('Agent')) {
    return {
      error: NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 }),
    };
  }

  const agent = await getAgentByAuth0Id(user.sub);
  if (!agent) {
    return { error: NextResponse.json({ error: 'Agent profile not found' }, { status: 404 }) };
  }

  return { user, agent };
}

export async function GET() {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const owner = await query(
      `SELECT up.id AS user_profile_id,
              up.email,
              up.professional_name,
              up.username
       FROM user_profiles up
       WHERE up.auth0_user_id = $1
       LIMIT 1`,
      [auth.user.sub]
    );

    const members = await query(
      `SELECT
          atm.id,
          atm.email,
          atm.full_name,
          atm.member_role,
          atm.access_permissions,
          atm.status,
          atm.invite_sent_at,
          atm.joined_at,
          atm.created_at,
          up.id AS linked_user_profile_id,
          up.auth0_user_id,
          up.professional_name,
          up.username,
           up.role AS linked_role,
           up.is_verified
       FROM agency_team_members atm
       LEFT JOIN user_profiles up ON up.id = atm.linked_user_profile_id
       WHERE atm.agency_id = $1
         AND atm.deleted_at IS NULL
       ORDER BY atm.created_at DESC`,
      [auth.agent.id]
    );

    const seatAllocation = await getAgencySeatAllocation(auth.agent.id);

    return NextResponse.json({
      success: true,
      data: {
        agency: {
          id: auth.agent.id,
          agencyName: auth.agent.agency_name,
          registryId: auth.agent.registry_id,
        },
        owner: owner.rows[0] || null,
        members: members.rows,
        seatAllocation,
      },
    });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };

    if (dbError?.code === '42P01') {
      return NextResponse.json(
        {
          error:
            'Manage Agents is not ready yet because database migration 014 has not been applied.',
          migrationRequired: true,
          migrationFile: 'infra/database/migrations/014_agency_team_members.sql',
        },
        { status: 503 }
      );
    }

    console.error('[AGENT_MANAGE_AGENTS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const body = (await request.json()) as CreateMemberPayload;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const memberRole = body.memberRole === 'Agent' ? 'Agent' : 'Assistant';
    const permissions: TeamMemberPermissions = {
      ...defaultPermissions,
      ...(body.accessPermissions || {}),
    };

    const existing = await query(
      `SELECT id
       FROM agency_team_members
       WHERE agency_id = $1
         AND lower(email) = lower($2)
         AND deleted_at IS NULL
       LIMIT 1`,
      [auth.agent.id, email]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'This email is already added to your agency team.' },
        { status: 409 }
      );
    }

    try {
      await assertAgencySeatCapacityForNextStatus({
        agencyId: auth.agent.id,
        nextStatus: 'invited',
      });
    } catch (error) {
      if (error instanceof AgencySeatCapacityError) {
        return NextResponse.json(
          {
            error: 'Your current agency subscription has no free seats for additional members.',
            code: error.code,
            seatAllocation: error.allocation,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    const userProfileResult = await query(
      `SELECT id, auth0_user_id, role, professional_name
       FROM user_profiles
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const linkedUser = userProfileResult.rows[0] || null;
    const inviteToken = crypto.randomUUID();

    const inserted = await query(
      `INSERT INTO agency_team_members (
          agency_id,
          linked_user_profile_id,
          email,
          full_name,
          member_role,
          access_permissions,
          status,
          invite_token,
          invite_sent_at,
          invited_by_auth0_id
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'invited', $7, NOW(), $8)
       RETURNING *`,
      [
        auth.agent.id,
        linkedUser?.id || null,
        email,
        body.fullName?.trim() || null,
        memberRole,
        JSON.stringify(permissions),
        inviteToken,
        auth.user.sub,
      ]
    );

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnToPath = `/dashboard/agency-invite?invite=${inviteToken}`;
    const inviteUrl = new URL('/auth/login', appBaseUrl);
    inviteUrl.searchParams.set('screen_hint', 'signup');
    inviteUrl.searchParams.set('returnTo', returnToPath);

    const inviteLink = inviteUrl.toString();

    try {
      await sendAgencyTeamInviteEmail({
        toEmail: email,
        recipientName: body.fullName?.trim() || linkedUser?.professional_name || 'there',
        agencyName: auth.agent.agency_name || 'your agency',
        memberRole,
        inviteLink,
      });
    } catch (emailError) {
      console.error('[AGENT_MANAGE_AGENTS] Invite email failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      data: inserted.rows[0],
      message: 'Team member invited successfully.',
    });
  } catch (error) {
    console.error('[AGENT_MANAGE_AGENTS] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
