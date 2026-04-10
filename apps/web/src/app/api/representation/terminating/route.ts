import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getActorByAuth0UserId, getAgentByAuth0UserId } from '@/lib/hdicr/representation-client';
import { listPendingTerminations } from '@/lib/representation-termination';

/**
 * GET /api/representation/terminating
 * Lists active 30-day representation notices for the caller.
 */
export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const hasActorRole = roles.includes('Actor');
    const hasAgentRole = roles.includes('Agent');

    if (!hasActorRole && !hasAgentRole) {
      return NextResponse.json(
        { error: 'Forbidden: Actor or Agent role required' },
        { status: 403 }
      );
    }

    const [actor, agent] = await Promise.all([
      hasActorRole ? getActorByAuth0UserId(user.sub) : Promise.resolve(null),
      hasAgentRole ? getAgentByAuth0UserId(user.sub) : Promise.resolve(null),
    ]);

    const terminations = await listPendingTerminations({
      actorId: actor?.id,
      agentId: agent?.id,
    });

    return NextResponse.json({
      success: true,
      terminations,
      total: terminations.length,
    });
  } catch (error) {
    console.error('[REPRESENTATION_TERMINATING] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
