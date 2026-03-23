import { APIGatewayProxyEvent } from 'aws-lambda';
import { Pool } from 'pg';

/**
 * List Consents Handler
 *
 * Returns full consent history for an actor from the immutable ledger
 * Useful for actors to view their consent trail and manage permissions
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

interface ConsentRecord {
  id: string;
  actor_id: string;
  action: string;
  consent_type: string;
  consent_scope: {
    projectId?: string;
    projectName?: string;
    duration?: {
      startDate?: string;
      endDate?: string;
    };
    [key: string]: unknown;
  };
  project_name?: string;
  project_description?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface ConsentSummary {
  consentId: string;
  consentType: string;
  action: string;
  scope: Record<string, unknown>;
  projectName?: string;
  projectDescription?: string;
  grantedAt?: string;
  revokedAt?: string;
  expiredAt?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export async function listConsents(event: APIGatewayProxyEvent) {
  try {
    const actorId = event.pathParameters?.actorId;

    if (!actorId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Actor ID is required in path' }),
      };
    }

    // Pagination parameters
    const limit = parseInt(event.queryStringParameters?.limit || '100');
    const offset = parseInt(event.queryStringParameters?.offset || '0');
    const action = event.queryStringParameters?.action; // Optional filter by action

    // Build query
    let query = `
      SELECT * FROM consent_log 
      WHERE actor_id = $1
    `;
    const queryParams: (string | number)[] = [actorId];

    // Optional filter by action
    if (action) {
      query += ` AND action = $${queryParams.length + 1}`;
      queryParams.push(action);
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    // Execute query
    const result = await pool.query(query, queryParams);

    // Get total count (for pagination)
    let countQuery = `SELECT COUNT(*) FROM consent_log WHERE actor_id = $1`;
    const countParams: (string | number)[] = [actorId];

    if (action) {
      countQuery += ` AND action = $2`;
      countParams.push(action);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Group consents by current status (active/revoked/expired)
    const activeConsents: ConsentSummary[] = [];
    const revokedConsents: ConsentSummary[] = [];
    const expiredConsents: ConsentSummary[] = [];

    // Map to track latest action per consent type + project
    const latestByTypeProject = new Map<string, ConsentRecord>();

    for (const record of result.rows) {
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
        const expiryDate = record.consent_scope?.duration?.endDate
          ? new Date(record.consent_scope.duration.endDate)
          : null;

        if (expiryDate && expiryDate < new Date()) {
          expiredConsents.push({ ...consentObj, expiredAt: expiryDate });
        } else {
          activeConsents.push({ ...consentObj, expiresAt: expiryDate });
        }
      } else if (record.action === 'revoked') {
        revokedConsents.push({ ...consentObj, revokedAt: record.created_at });
      }
    }

    console.log('[CONSENT] List consents:', {
      actorId,
      totalRecords: result.rows.length,
      active: activeConsents.length,
      revoked: revokedConsents.length,
      expired: expiredConsents.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
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
        fullHistory: result.rows.map((record) => ({
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
      }),
    };
  } catch (error: unknown) {
    console.error('[CONSENT] List consents error:', error);
    const err = error as Error;

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: err.message,
      }),
    };
  }
}
