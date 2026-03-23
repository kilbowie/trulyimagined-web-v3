import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * GET /api/consent/[actorId]?limit={n}&offset={n}
 * Lists all consents for an actor from the immutable ledger
 *
 * Query params:
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - action: string (optional filter: 'granted' | 'revoked')
 *
 * Returns:
 * {
 *   actorId: string
 *   summary: { active, revoked, expired, totalRecords }
 *   consents: {
 *     active: [...],
 *     revoked: [...],
 *     expired: [...]
 *   }
 *   fullHistory: [...]
 *   pagination: { limit, offset, total, hasMore }
 * }
 */
export async function GET(request: NextRequest, { params }: { params: { actorId: string } }) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorId = params.actorId;
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';
    const action = searchParams.get('action');

    // Build query string
    const queryParams = new URLSearchParams({
      limit,
      offset,
      ...(action && { action }),
    });

    // Call Lambda consent service
    const lambdaUrl = process.env.CONSENT_SERVICE_URL || 'http://localhost:3001';
    const url = `${lambdaUrl}/consent/${actorId}?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error('[API] List consents error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
