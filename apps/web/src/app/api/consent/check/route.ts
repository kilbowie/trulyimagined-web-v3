import { NextRequest, NextResponse } from 'next/server';
import { generateConsentProof } from '@/lib/consent-proof';
import { checkConsent } from '@/lib/hdicr/consent-client';

/**
 * GET /api/consent/check?actorId={id}&consentType={type}&projectId={id}
 * Checks if consent is currently active
 *
 * Query params:
 * - actorId: string (required)
 * - consentType: string (required)
 * - projectId: string (optional)
 * - includeProof: 'true' | 'false' (optional, default: true) - Include JWT proof
 *
 * Returns:
 * {
 *   isGranted: boolean
 *   consent: { ... } | null
 *   latestAction: { action, timestamp, reason }
 *   proof?: string (JWT - cryptographic proof of consent)
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const actorId = searchParams.get('actorId');
    const consentType = searchParams.get('consentType');
    const projectId = searchParams.get('projectId');
    const includeProof = searchParams.get('includeProof') !== 'false'; // Default true

    // Validation
    if (!actorId || !consentType) {
      return NextResponse.json(
        { error: 'Missing required parameters: actorId, consentType' },
        { status: 400 }
      );
    }

    let latestConsent: Awaited<ReturnType<typeof checkConsent>>;
    try {
      latestConsent = await checkConsent({
        actorId,
        consentType,
        projectId: projectId || undefined,
      });
    } catch (error) {
      console.warn('[CONSENT] HDICR consent service unavailable for check', error);
      return NextResponse.json({
        isGranted: false,
        serviceUnavailable: true,
        message: 'Consent service temporarily unavailable',
        actorId,
        consentType,
        projectId: projectId || null,
      });
    }

    if (!latestConsent) {
      return NextResponse.json({
        isGranted: false,
        message: 'No consent record found for this actor and consent type',
        actorId,
        consentType,
        projectId: projectId || null,
      });
    }

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
    // Generate cryptographic proof if consent is granted
    let proof: string | undefined;
    if (isGranted && !isExpired && includeProof) {
      try {
        proof = generateConsentProof({
          consentId: latestConsent.id,
          actorId: latestConsent.actor_id,
          consentType: latestConsent.consent_type,
          projectId: projectId || latestConsent.consent_scope?.projectId,
          projectName: latestConsent.project_name,
          scope: latestConsent.consent_scope,
          grantedAt: latestConsent.created_at,
          expiresAt: latestConsent.consent_scope?.duration?.endDate,
        });

        console.log('[CONSENT] JWT proof generated for consent:', latestConsent.id);
      } catch (error) {
        console.error('[CONSENT] Failed to generate JWT proof:', error);
        // Continue without proof - don't fail the request
      }
    }

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
      // Include JWT proof for cryptographic verification by external consumers
      ...(proof ? { proof } : {}),
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
