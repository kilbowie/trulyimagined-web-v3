import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DatabaseClient } from '@trulyimagined/database/src/client';
import { queries } from '@trulyimagined/database/src/queries-v3';

/**
 * Consent Service - Lambda Handler
 * Step 6: Consent Ledger (CRITICAL)
 * 
 * Handles immutable consent recording:
 * - POST /consent/log - Log consent action (append-only)
 * - GET /consent/{actorId} - Get consent history
 * 
 * CRITICAL: This is an append-only ledger. No updates or deletes allowed.
 */

const db = DatabaseClient.getInstance();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('[CONSENT-SERVICE] Request received:', {
    path: event.path,
    method: event.httpMethod,
    pathParameters: event.pathParameters,
  });

  const { httpMethod, path } = event;

  try {
    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // Route based on path and method
    if (path === '/consent/log' && httpMethod === 'POST') {
      return await logConsent(event);
    }

    if (path.startsWith('/consent/') && httpMethod === 'GET') {
      return await getConsentHistory(event);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error: any) {
    console.error('[CONSENT-SERVICE] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

/**
 * Log a consent action to the immutable ledger
 * CRITICAL: Append-only. No modifications allowed after creation.
 */
async function logConsent(event: APIGatewayProxyEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      actorId,
      action, // 'granted', 'revoked', 'updated', 'requested'
      consentType, // 'voice_synthesis', 'image_usage', 'full_likeness'
      consentScope = {},
      projectName,
      projectDescription,
      requesterId,
      requesterType,
      metadata = {},
    } = body;

    // Validation
    if (!actorId || !action || !consentType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['actorId', 'action', 'consentType'],
        }),
      };
    }

    // Validate action
    const validActions = ['granted', 'revoked', 'updated', 'requested'];
    if (!validActions.includes(action)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid action',
          validActions,
        }),
      };
    }

    // Get IP and User Agent from request context
    const ipAddress = event.requestContext?.identity?.sourceIp || null;
    const userAgent = event.headers?.['User-Agent'] || null;

    // Log to consent ledger (immutable)
    const result = await db.query(queries.consent.log, [
      actorId,
      action,
      consentType,
      JSON.stringify(consentScope),
      projectName,
      projectDescription,
      requesterId,
      requesterType,
      ipAddress,
      userAgent,
      JSON.stringify(metadata),
    ]);

    const consentRecord = result.rows[0];

    console.log('[CONSENT-SERVICE] Consent logged:', {
      id: consentRecord.id,
      actorId,
      action,
      consentType,
    });

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Consent logged to immutable ledger',
        consent: {
          id: consentRecord.id,
          actorId: consentRecord.actor_id,
          action: consentRecord.action,
          consentType: consentRecord.consent_type,
          createdAt: consentRecord.created_at,
        },
      }),
    };
  } catch (error: any) {
    console.error('[CONSENT-SERVICE] Log consent error:', error);

    // Handle foreign key violations (actor doesn't exist)
    if (error.code === '23503') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Actor not found',
          message: 'The specified actor does not exist in the registry',
        }),
      };
    }

    throw error;
  }
}

/**
 * Get consent history for an actor
 * Returns full audit trail from the immutable ledger
 */
async function getConsentHistory(event: APIGatewayProxyEvent) {
  const actorId = event.pathParameters?.actorId;

  if (!actorId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor ID is required' }),
    };
  }

  const limit = parseInt(event.queryStringParameters?.limit || '100');
  const offset = parseInt(event.queryStringParameters?.offset || '0');

  const result = await db.query(queries.consent.getHistory, [actorId, limit, offset]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      actorId,
      consentHistory: result.rows.map((record) => ({
        id: record.id,
        action: record.action,
        consentType: record.consent_type,
        consentScope: record.consent_scope,
        projectName: record.project_name,
        projectDescription: record.project_description,
        requesterId: record.requester_id,
        requesterType: record.requester_type,
        createdAt: record.created_at,
        metadata: record.metadata,
      })),
      pagination: {
        limit,
        offset,
        total: result.rowCount,
      },
      message: 'Consent ledger is append-only and immutable',
    }),
  };
}
  // TODO: Implement consent retrieval logic
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Consent service - get endpoint ready' }),
  };
}

async function updateConsent(_event: any) {
  // TODO: Implement consent update logic with versioning
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Consent service - update endpoint ready' }),
  };
}
