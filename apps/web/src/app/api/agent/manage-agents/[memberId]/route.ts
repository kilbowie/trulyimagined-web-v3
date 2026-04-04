import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

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

    const role = body.memberRole === 'Agent' ? 'Agent' : body.memberRole === 'Assistant' ? 'Assistant' : null;
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
