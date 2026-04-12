import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  getActiveRepresentationForActor,
  getActorByAuth0UserId,
} from '@/lib/hdicr/representation-client';
import { getPendingTerminationByRelationshipId } from '@/lib/representation-termination';

/**
 * GET /api/representation/my-agent
 * Returns the current active agent representation for the authenticated actor.
 */
export async function GET() {
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

    const actor = await getActorByAuth0UserId(user.sub);
    if (!actor) {
      return NextResponse.json({ representation: null });
    }

    const representation = await getActiveRepresentationForActor(actor.id);

    if (!representation?.id) {
      return NextResponse.json({
        representation: null,
      });
    }

    const pendingTermination = await getPendingTerminationByRelationshipId(representation.id);

    return NextResponse.json({
      representation: {
        ...representation,
        pendingTermination,
      },
    });
  } catch (error) {
    console.error('[REPRESENTATION_MY_AGENT] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
