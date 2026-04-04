import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';
import { sendAgencyTeamInviteEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

interface UpdatePayload {
  memberRole?: 'Agent' | 'Assistant';
  status?: 'invited' | 'active' | 'disabled';
  accessPermissions?: Record<string, boolean>;
}

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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const { memberId } = await params;
    const body = (await request.json()) as UpdatePayload;

    const existing = await query(
      `SELECT id, access_permissions
       FROM agency_team_members
       WHERE id = $1
         AND agency_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [memberId, auth.agent.id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const current = existing.rows[0];

    const role =
      body.memberRole === 'Agent' ? 'Agent' : body.memberRole === 'Assistant' ? 'Assistant' : null;
    const status =
      body.status === 'invited' || body.status === 'active' || body.status === 'disabled'
        ? body.status
        : null;

    const mergedPermissions = body.accessPermissions
      ? {
          ...(current.access_permissions || {}),
          ...body.accessPermissions,
        }
      : current.access_permissions;

    const updated = await query(
      `UPDATE agency_team_members
       SET member_role = COALESCE($3, member_role),
           status = COALESCE($4, status),
           access_permissions = $5::jsonb,
           joined_at = CASE WHEN COALESCE($4, status) = 'active' AND joined_at IS NULL THEN NOW() ELSE joined_at END,
           updated_at = NOW()
       WHERE id = $1
         AND agency_id = $2
       RETURNING *`,
      [memberId, auth.agent.id, role, status, JSON.stringify(mergedPermissions || {})]
    );

    return NextResponse.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error('[AGENT_MANAGE_AGENTS] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const { memberId } = await params;

    const deleted = await query(
      `UPDATE agency_team_members
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND agency_id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [memberId, auth.agent.id]
    );

    if (deleted.rows.length === 0) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AGENT_MANAGE_AGENTS] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const { memberId } = await params;

    const existing = await query(
      `SELECT
          atm.id,
          atm.email,
          atm.full_name,
          atm.member_role,
          atm.status,
          a.agency_name
       FROM agency_team_members atm
       LEFT JOIN agents a ON a.id = atm.agency_id
       WHERE atm.id = $1
         AND atm.agency_id = $2
         AND atm.deleted_at IS NULL
       LIMIT 1`,
      [memberId, auth.agent.id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const member = existing.rows[0];

    if (member.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot resend invite for active members.' },
        { status: 400 }
      );
    }

    const inviteToken = crypto.randomUUID();

    const updated = await query(
      `UPDATE agency_team_members
       SET invite_token = $3,
           invite_sent_at = NOW(),
           status = 'invited',
           updated_at = NOW()
       WHERE id = $1
         AND agency_id = $2
       RETURNING *`,
      [memberId, auth.agent.id, inviteToken]
    );

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnToPath = `/dashboard/agency-invite?invite=${inviteToken}`;
    const inviteUrl = new URL('/auth/login', appBaseUrl);
    inviteUrl.searchParams.set('screen_hint', 'signup');
    inviteUrl.searchParams.set('returnTo', returnToPath);

    await sendAgencyTeamInviteEmail({
      toEmail: member.email,
      recipientName: member.full_name || 'there',
      agencyName: member.agency_name || auth.agent.agency_name || 'your agency',
      memberRole: member.member_role,
      inviteLink: inviteUrl.toString(),
    });

    return NextResponse.json({
      success: true,
      data: updated.rows[0],
      message: 'Invitation email resent successfully.',
    });
  } catch (error) {
    console.error('[AGENT_MANAGE_AGENTS] POST resend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
