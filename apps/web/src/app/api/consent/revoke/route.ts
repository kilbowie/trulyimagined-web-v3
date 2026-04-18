import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0';
import { revokeConsent } from '@/lib/hdicr/consent-client';
import { validateBody } from '@/lib/validation';

const RevokeConsentSchema = z
  .object({
    actorId: z.string().min(1),
    consentId: z.string().optional(),
    consentType: z.string().optional(),
    projectId: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine((d) => d.consentId || d.consentType || d.projectId, {
    message: 'Must provide consentId, consentType, or projectId to revoke',
  });

/**
 * POST /api/consent/revoke
 * Revokes previously granted consent
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validation = await validateBody(request, RevokeConsentSchema);
    if (!validation.ok) return validation.response;
    const { actorId, consentId, consentType, projectId, reason } = validation.data;

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
