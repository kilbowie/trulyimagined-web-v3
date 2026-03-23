import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

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

    // Get IP and User Agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Insert into consent_log (append-only)
    const result = await query(
      `INSERT INTO consent_log (
        actor_id, action, consent_type, consent_scope,
        project_name, project_description,
        requester_id, requester_type,
        ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        actorId,
        'granted',
        consentType,
        JSON.stringify(scope || {}),
        scope?.projectName || null,
        scope?.projectDescription || null,
        session.user.sub,
        session.user['https://trulyimagined.com/role'] || 'actor',
        ipAddress,
        userAgent,
        JSON.stringify({
          grantedAt: new Date().toISOString(),
          source: 'api',
        }),
      ]
    );

    const consentRecord = result.rows[0];

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
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
