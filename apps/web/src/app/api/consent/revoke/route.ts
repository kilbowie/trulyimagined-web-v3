import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * POST /api/consent/revoke
 * Revokes previously granted consent
 * 
 * Body:
 * {
 *   actorId: string
 *   consentId?: string    // Revoke specific consent
 *   consentType?: string  // Revoke all consents of this type
 *   projectId?: string    // Revoke consents for specific project
 *   reason?: string
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
    const { actorId, consentId, consentType, projectId, reason } = body;

    // Validation
    if (!actorId) {
      return NextResponse.json(
        { error: 'Missing required field: actorId' },
        { status: 400 }
      );
    }

    if (!consentId && !consentType && !projectId) {
      return NextResponse.json(
        { error: 'Must provide consentId, consentType, or projectId to revoke' },
        { status: 400 }
      );
    }

    // Call Lambda consent service
    const lambdaUrl = process.env.CONSENT_SERVICE_URL || 'http://localhost:3001/consent/revoke';
    
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actorId,
        consentId,
        consentType,
        projectId,
        reason: reason || 'User requested revocation',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error('[API] Revoke consent error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
