import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  listActorLicensingRequests,
  resolveActorIdByAuth0UserId,
} from '@/lib/hdicr/licensing-client';

/**
 * GET /api/actor/licensing-requests
 * Returns incoming licensing requests for the authenticated actor.
 * Optional query param: ?status=pending|approved|rejected|expired
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

    const actorId = await resolveActorIdByAuth0UserId(user.sub);
    if (!actorId) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    const result = await listActorLicensingRequests(actorId, statusParam || undefined);

    return NextResponse.json({
      requests: result.requests,
      pendingCount: result.pendingCount,
    });
  } catch (error) {
    console.error('[ACTOR_LICENSING_REQUESTS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
