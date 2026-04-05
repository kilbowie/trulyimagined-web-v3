import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getActorRegistrationStatus } from '@/lib/hdicr/identity-client';

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

    const actor = await getActorRegistrationStatus(user.sub);

    if (!actor) {
      return NextResponse.json({
        registered: false,
        actor: null,
      });
    }

    return NextResponse.json({
      registered: true,
      actor,
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
