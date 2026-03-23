import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * POST /api/consent/grant
 * Grants consent for identity usage
 * 
 * Body:
 * {
 *   actorId: string
 *   consentType: 'voice_synthesis' | 'image_usage' | 'full_likeness'
 *   scope: {
 *     projectName?: string
 *     projectId?: string
 *     duration?: { startDate, endDate }
 *     usageTypes?: string[]
 *     territories?: string[]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { actorId, consentType, scope } = body;

    // Validation
    if (!actorId || !consentType) {
      return NextResponse.json(
        { error: 'Missing required fields: actorId, consentType' },
        { status: 400 }
      );
    }

    // Call Lambda consent service
    const lambdaUrl = process.env.CONSENT_SERVICE_URL || 'http://localhost:3001/consent/grant';
    
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actorId,
        consentType,
        scope,
        requesterId: session.user.sub,
        requesterType: session.user['https://trulyimagined.com/role'] || 'actor',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('[API] Grant consent error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
