import { APIGatewayProxyEvent } from 'aws-lambda';
import { Pool } from 'pg';

/**
 * Grant Consent Handler
 *
 * Records a consent grant in the immutable consent_log table
 * This is the primary mechanism for actors to grant permission for their digital identity usage
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

interface GrantConsentRequest {
  actorId: string;
  consentType: 'voice_synthesis' | 'image_usage' | 'full_likeness' | string;
  scope: {
    projectName?: string;
    projectId?: string;
    projectDescription?: string;
    duration?: {
      startDate?: string;
      endDate?: string;
    };
    usageTypes?: string[]; // ['advertising', 'promotional', 'editorial']
    territories?: string[]; // ['UK', 'US', 'global']
    exclusions?: string[]; // ['political', 'adult-content']
  };
  requesterId?: string;
  requesterType?: 'actor' | 'agent' | 'studio' | 'admin' | 'enterprise';
}

export async function grantConsent(event: APIGatewayProxyEvent) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body: GrantConsentRequest = JSON.parse(event.body);
    const { actorId, consentType, scope, requesterId, requesterType } = body;

    // Validation
    if (!actorId || !consentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['actorId', 'consentType'],
        }),
      };
    }

    // Get IP and User Agent from request context
    const ipAddress = event.requestContext?.identity?.sourceIp || null;
    const userAgent = event.headers?.['User-Agent'] || null;

    // Insert into consent_log (append-only)
    const result = await pool.query(
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
        requesterId || null,
        requesterType || null,
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

    return {
      statusCode: 201,
      body: JSON.stringify({
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
      }),
    };
  } catch (error: unknown) {
    console.error('[CONSENT] Grant consent error:', error);
    const err = error as Error;

    // Handle foreign key violation (actor doesn't exist)
    if ('code' in err && (err as { code?: string }).code === '23503') {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Actor not found',
          message: 'The specified actor does not exist in the registry',
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: err.message,
      }),
    };
  }
}
