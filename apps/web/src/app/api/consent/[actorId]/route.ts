import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { listConsentRecords } from '@/lib/hdicr/consent-client';

interface ConsentRecord {
  id: string;
  actor_id: string;
  action: string;
  consent_type: string;
  consent_scope: Record<string, unknown> | null;
  project_name: string | null;
  project_description: string | null;
  requester_id?: string | null;
  requester_type?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface ConsentResponse {
  consentId: string;
  consentType: string;
  action: string;
  scope: Record<string, unknown> | null;
  projectName: string | null;
  projectDescription: string | null;
  grantedAt: string;
  revokedAt?: string | null;
  expiresAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ actorId: string }> }
) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actorId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');

    const { rows, totalCount } = await listConsentRecords({
      actorId,
      limit,
      offset,
      action: action || undefined,
    });

    // Group consents by current status (active/revoked/expired)
    const activeConsents: ConsentResponse[] = [];
    const revokedConsents: ConsentResponse[] = [];
    const expiredConsents: ConsentResponse[] = [];

    // Map to track latest action per consent type + project
    const latestByTypeProject = new Map<string, ConsentRecord>();

    for (const record of rows) {
      const key = `${record.consent_type}:${record.consent_scope?.projectId || 'general'}`;

      const existing = latestByTypeProject.get(key);
      if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
        latestByTypeProject.set(key, record);
      }
    }

    // Categorize consents
    for (const [, record] of latestByTypeProject) {
      const consentObj = {
        consentId: record.id,
        consentType: record.consent_type,
        action: record.action,
        scope: record.consent_scope,
        projectName: record.project_name,
        projectDescription: record.project_description,
        grantedAt: record.created_at,
        metadata: record.metadata,
      };

      if (record.action === 'granted') {
        // Check expiry
        const scope = record.consent_scope as { duration?: { endDate?: string } } | null;
        const expiryDateStr = scope?.duration?.endDate;
        const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;

        if (expiryDate && expiryDate < new Date()) {
          expiredConsents.push({ ...consentObj, expiresAt: expiryDate.toISOString() });
        } else {
          activeConsents.push({ ...consentObj, expiresAt: expiryDate?.toISOString() || null });
        }
      } else if (record.action === 'revoked') {
        revokedConsents.push({ ...consentObj, revokedAt: record.created_at });
      }
    }

    console.log('[CONSENT] List consents:', {
      actorId,
      totalRecords: rows.length,
      active: activeConsents.length,
      revoked: revokedConsents.length,
      expired: expiredConsents.length,
    });

    return NextResponse.json({
      actorId,
      summary: {
        active: activeConsents.length,
        revoked: revokedConsents.length,
        expired: expiredConsents.length,
        totalRecords: totalCount,
      },
      consents: {
        active: activeConsents,
        revoked: revokedConsents,
        expired: expiredConsents,
      },
      fullHistory: rows.map((record) => ({
        id: record.id,
        action: record.action,
        consentType: record.consent_type,
        scope: record.consent_scope,
        projectName: record.project_name,
        timestamp: record.created_at,
        metadata: record.metadata,
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
      message: 'Consent ledger is append-only and immutable',
    });
  } catch (error: unknown) {
    console.error('[API] List consents error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
