import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

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
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let result;

    // Scenario 1: Revoke specific consent by ID
    if (consentId) {
      // Fetch the original consent to copy its details
      const original = await query(
        `SELECT * FROM consent_log WHERE id = $1 AND actor_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [consentId, actorId]
      );

      if (original.rows.length === 0) {
        return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
      }

      const originalConsent = original.rows[0];

      // Insert revocation record
      result = await query(
        `INSERT INTO consent_log (
          actor_id, action, consent_type, consent_scope,
          project_name, project_description,
          ip_address, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          actorId,
          'revoked',
          originalConsent.consent_type,
          originalConsent.consent_scope,
          originalConsent.project_name,
          originalConsent.project_description,
          ipAddress,
          userAgent,
          JSON.stringify({
            originalConsentId: consentId,
            reason: reason || 'User requested revocation',
            revokedAt: new Date().toISOString(),
          }),
        ]
      );
    }
    // Scenario 2: Revoke all consents of specific type
    else if (consentType) {
      result = await query(
        `INSERT INTO consent_log (
          actor_id, action, consent_type, consent_scope,
          ip_address, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          actorId,
          'revoked',
          consentType,
          JSON.stringify({ projectId: projectId || null }),
          ipAddress,
          userAgent,
          JSON.stringify({
            reason: reason || 'User revoked all consents of this type',
            revokedAt: new Date().toISOString(),
          }),
        ]
      );
    }

    if (!result || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create revocation record' },
        { status: 500 }
      );
    }

    const revocationRecord = result.rows[0];

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
