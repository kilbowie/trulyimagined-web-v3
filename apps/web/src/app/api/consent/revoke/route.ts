import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { revokeConsent } from '@/lib/hdicr/consent-client';

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
      return NextResponse.json({ error: 'Missing required field: actorId' }, { status: 400 });
    }

    if (!consentId && !consentType && !projectId) {
      return NextResponse.json(
        { error: 'Must provide consentId, consentType, or projectId to revoke' },
        { status: 400 }
      );
    }

    // Get IP and User Agent
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const revokeResult = await revokeConsent({
      actorId,
      consentId: consentId || undefined,
      consentType: consentType || undefined,
      projectId: projectId || undefined,
      reason: reason || undefined,
      ipAddress,
      userAgent,
    });

    if (revokeResult.notFound) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    if (!revokeResult.record) {
      return NextResponse.json({ error: 'Failed to create revocation record' }, { status: 500 });
    }

    const revocationRecord = revokeResult.record;

    console.log('[CONSENT] Consent revoked:', {
      id: revocationRecord.id,
      actorId,
      consentType: revocationRecord.consent_type,
      reason,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Consent revoked and logged to immutable ledger',
        revocation: {
          revocationId: revocationRecord.id,
          actorId: revocationRecord.actor_id,
          action: revocationRecord.action,
          consentType: revocationRecord.consent_type,
          revokedAt: revocationRecord.created_at,
          reason: reason || 'Not specified',
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[API] Revoke consent error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
