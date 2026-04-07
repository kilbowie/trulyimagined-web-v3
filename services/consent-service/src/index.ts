import { APIGatewayProxyHandler } from 'aws-lambda';
import { validateAuth0Token, hasScope } from '@trulyimagined/middleware';
import { grantConsent } from './handlers/grant-consent';
import { revokeConsent } from './handlers/revoke-consent';
import { checkConsent } from './handlers/check-consent';
import { listConsents } from './handlers/list-consents';

/**
 * Consent Service - Lambda Handler
 * Step 6: Consent Ledger (CRITICAL)
 *
 * Routes requests to modular handlers:
 * - POST /consent/grant - Grant consent
 * - POST /consent/revoke - Revoke consent
 * - GET /consent/check - Check if consent is active
 * - GET /consent/{actorId} - List all consents for actor
 *
 * CRITICAL: This is an append-only ledger. No updates or deletes allowed.
 */

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

    const user = await validateAuth0Token(event);
    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Scope-based authorization: require appropriate scope per HTTP method.
    const requiredScope =
      httpMethod === 'GET' ? 'hdicr:consent:read' : 'hdicr:consent:write';
    if (!hasScope(user, requiredScope)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Forbidden',
          detail: `Missing required scope: ${requiredScope}`,
        }),
      };
    }

    // Route to handlers
    if (path === '/v1/consent/grant' && httpMethod === 'POST') {
      const response = await grantConsent(event);
      return { ...response, headers: corsHeaders };
    }

    if (path === '/v1/consent/revoke' && httpMethod === 'POST') {
      const response = await revokeConsent(event);
      return { ...response, headers: corsHeaders };
    }

    if (path === '/v1/consent/check' && httpMethod === 'GET') {
      const response = await checkConsent(event);
      return { ...response, headers: corsHeaders };
    }

    if (path === '/v1/consent/list' && httpMethod === 'GET') {
      const response = await listConsents(event);
      return { ...response, headers: corsHeaders };
    }

    if (path.startsWith('/v1/consent/') && httpMethod === 'GET') {
      const response = await listConsents(event);
      return { ...response, headers: corsHeaders };
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
