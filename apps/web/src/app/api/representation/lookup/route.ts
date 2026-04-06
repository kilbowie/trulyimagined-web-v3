import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByRegistryId } from '@/lib/hdicr/representation-client';

/**
 * GET /api/representation/lookup?registryId=XXXX-XXXX-XXXX
 * Actor lookup for agent registry ID before sending request.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Actor')) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const registryId = request.nextUrl.searchParams.get('registryId')?.trim();

    if (!registryId) {
      return NextResponse.json({ error: 'registryId query parameter is required' }, { status: 400 });
    }

    const agent = await getAgentByRegistryId(registryId);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.profile_completed) {
      return NextResponse.json(
        { error: 'This agent is not available yet. Their profile is not complete.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      agent,
    });
  } catch (error) {
    console.error('[REPRESENTATION_LOOKUP] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
