import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

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

/**
 * GET /api/agent/codes/list
 * Lists invitation codes for the authenticated agent and derives a status label.
 */
export async function GET() {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const result = await query(
      `SELECT
         id,
         code,
         created_at,
         expires_at,
         used_by_actor_id,
         redeemed_at
       FROM agent_invitation_codes
       WHERE agent_id = $1
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [auth.agent.id]
    );

    const now = Date.now();
    const codes = result.rows.map((row) => {
      const expiresAtMs = new Date(String(row.expires_at)).getTime();
      const isRedeemed = Boolean(row.redeemed_at);
      const isExpired = !isRedeemed && expiresAtMs < now;

      return {
        ...row,
        status: isRedeemed ? 'redeemed' : isExpired ? 'expired' : 'pending',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        codes,
        total: codes.length,
      },
    });
  } catch (error) {
    console.error('[AGENT_CODES_LIST] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
