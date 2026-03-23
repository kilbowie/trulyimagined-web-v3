import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/consent/check?actorId={id}&consentType={type}&projectId={id}
 * Checks if consent is currently active
 *
 * Query params:
 * - actorId: string (required)
 * - consentType: string (required)
 * - projectId: string (optional)
 *
 * Returns:
 * {
 *   isGranted: boolean
 *   consent: { ... } | null
 *   latestAction: { action, timestamp, reason }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const actorId = searchParams.get('actorId');
    const consentType = searchParams.get('consentType');
    const projectId = searchParams.get('projectId');

    // Validation
    if (!actorId || !consentType) {
      return NextResponse.json(
        { error: 'Missing required parameters: actorId, consentType' },
        { status: 400 }
      );
    }

    // Query for most recent consent action (granted or revoked)
    let sqlQuery = `
      SELECT * FROM consent_log 
      WHERE actor_id = $1 
        AND consent_type = $2
    `;
    const queryParams: (string | number)[] = [actorId, consentType];

    // Optional: filter by project ID if provided
    if (projectId) {
      sqlQuery += ` AND (consent_scope->>'projectId' = $3 OR consent_scope->>'projectId' IS NULL)`;
      queryParams.push(projectId);
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT 1`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json({
        isGranted: false,
        message: 'No consent record found for this actor and consent type',
        actorId,
        consentType,
        projectId: projectId || null,
      });
    }

    const latestConsent = result.rows[0];

    // Check if most recent action was 'granted' or 'revoked'
    const isGranted = latestConsent.action === 'granted';

    // Check expiry if consent was granted
    let isExpired = false;
    if (isGranted && latestConsent.consent_scope?.duration?.endDate) {
      const expiryDate = new Date(latestConsent.consent_scope.duration.endDate);
      isExpired = expiryDate < new Date();
    }

    console.log('[CONSENT] Consent check:', {
      actorId,
      consentType,
      projectId,
      isGranted: isGranted && !isExpired,
      action: latestConsent.action,
      isExpired,
    });

    return NextResponse.json({
      isGranted: isGranted && !isExpired,
      consent:
        isGranted && !isExpired
          ? {
              consentId: latestConsent.id,
              actorId: latestConsent.actor_id,
              consentType: latestConsent.consent_type,
              scope: latestConsent.consent_scope,
              grantedAt: latestConsent.created_at,
              projectName: latestConsent.project_name,
              expiresAt: latestConsent.consent_scope?.duration?.endDate || null,
              isExpired,
            }
          : null,
      latestAction: {
        action: latestConsent.action,
        timestamp: latestConsent.created_at,
        reason: isExpired
          ? 'Consent expired'
          : latestConsent.action === 'revoked'
            ? 'Consent revoked'
            : null,
      },
    });
  } catch (error: unknown) {
    console.error('[API] Check consent error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
