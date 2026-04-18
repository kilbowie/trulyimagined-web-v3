import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0';
import { grantConsent } from '@/lib/hdicr/consent-client';
import { validateBody, routeErrorResponse } from '@/lib/validation';

const GrantConsentSchema = z.object({
  actorId: z.string().min(1),
  consentType: z.enum(['voice_synthesis', 'image_usage', 'full_likeness']),
  scope: z
    .object({
      projectName: z.string().optional(),
      projectId: z.string().optional(),
      duration: z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional(),
      usageTypes: z.array(z.string()).optional(),
      territories: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * POST /api/consent/grant
 * Grants consent for identity usage
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validation = await validateBody(request, GrantConsentSchema);
    if (!validation.ok) return validation.response;
    const { actorId, consentType, scope } = validation.data;

    // Get IP and User Agent from request
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const consentRecord = await grantConsent({
      actorId,
      consentType,
      scope,
      requesterId: session.user.sub,
      requesterType: session.user['https://trulyimagined.com/role'] || 'actor',
      ipAddress,
      userAgent,
    });

    console.log('[CONSENT] Consent granted:', {
      id: consentRecord.id,
      actorId,
      consentType,
      projectName: scope?.projectName,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Consent granted and logged to immutable ledger',
        consent: {
          consentId: consentRecord.id,
          actorId: consentRecord.actor_id,
          action: consentRecord.action,
          consentType: consentRecord.consent_type,
          scope: consentRecord.consent_scope,
          grantedAt: consentRecord.created_at,
          projectName: consentRecord.project_name,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[API] Grant consent error:', error);
    return routeErrorResponse(error);
  }
}
