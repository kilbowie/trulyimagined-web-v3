import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getActorRegistrationStatusByAuth0UserId } from '@/lib/identity-status';

/**
 * Actor Registration Status API Route
 *
 * GET /api/identity/status
 * Returns the actor registration status for the current user
 */
export async function GET() {
  try {
    // Get user session
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getActorRegistrationStatusByAuth0UserId(user.sub);

    return NextResponse.json({
      registered: status.registered,
      actor: status.actor,
    });
  } catch (error: unknown) {
    console.error('[IDENTITY] Status check error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
