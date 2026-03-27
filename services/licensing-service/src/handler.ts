import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DatabaseClient } from '@trulyimagined/database/src/client';
import { queries } from '@trulyimagined/database/src/queries-v3';

/**
 * Licensing Service - Lambda Handler
 * Step 10: Licensing Service MVP (Phase 2)
 * 
 * Handles licensing requests and approvals:
 * - POST /license/request - Request license from actor
 * - GET /license/actor/{actorId} - Get license requests for actor
 * - POST /license/{requestId}/approve - Approve license request
 * - POST /license/{requestId}/reject - Reject license request
 */

const db = DatabaseClient.getInstance();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('[LICENSING-SERVICE] Request received:', {
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
    if (path === '/license/request' && httpMethod === 'POST') {
      return await requestLicense(event);
    }

    if (path.startsWith('/license/actor/') && httpMethod === 'GET') {
      return await getLicenseRequests(event);
    }

    if (path.includes('/approve') && httpMethod === 'POST') {
      return await approveLicense(event);
    }

    if (path.includes('/reject') && httpMethod === 'POST') {
      return await rejectLicense(event);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error: any) {
    console.error('[LICENSING-SERVICE] Error:', error);
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
 * Request a license from an actor
 */
async function requestLicense(event: APIGatewayProxyEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      actorId,
      requesterName,
      requesterEmail,
      requesterOrganization,
      projectName,
      projectDescription,
      usageType,
      intendedUse,
      durationStart,
      durationEnd,
      compensationOffered,
      compensationCurrency = 'USD',
    } = body;

    // Validation
    if (!actorId || !requesterName || !requesterEmail || !projectName || !projectDescription || !usageType || !intendedUse) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['actorId', 'requesterName', 'requesterEmail', 'projectName', 'projectDescription', 'usageType', 'intendedUse'],
        }),
      };
    }

    const result = await db.query(queries.licensing.create, [
      actorId,
      requesterName,
      requesterEmail,
      requesterOrganization,
      projectName,
      projectDescription,
      usageType,
      intendedUse,
      durationStart,
      durationEnd,
      compensationOffered,
      compensationCurrency,
    ]);

    const request = result.rows[0];

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'License request submitted',
        request: {
          id: request.id,
          actorId: request.actor_id,
          projectName: request.project_name,
          usageType: request.usage_type,
          status: request.status,
          createdAt: request.created_at,
        },
      }),
    };
  } catch (error: any) {
    if (error.code === '23503') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Actor not found' }),
      };
    }
    throw error;
  }
}

/**
 * Get license requests for an actor
 */
async function getLicenseRequests(event: APIGatewayProxyEvent) {
  const actorId = event.pathParameters?.actorId;

  if (!actorId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor ID is required' }),
    };
  }

  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const offset = parseInt(event.queryStringParameters?.offset || '0');

  const result = await db.query(queries.licensing.getByActor, [actorId, limit, offset]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      actorId,
      requests: result.rows.map((req: Record<string, unknown>) => ({
        id: req.id,
        requesterName: req.requester_name,
        requesterEmail: req.requester_email,
        requesterOrganization: req.requester_organization,
        projectName: req.project_name,
        projectDescription: req.project_description,
        usageType: req.usage_type,
        intendedUse: req.intended_use,
        compensationOffered: req.compensation_offered,
        compensationCurrency: req.compensation_currency,
        status: req.status,
        createdAt: req.created_at,
      })),
      pagination: { limit, offset, total: result.rowCount },
    }),
  };
}

/**
 * Approve a license request
 */
async function approveLicense(event: APIGatewayProxyEvent) {
  const requestId = event.pathParameters?.requestId;

  if (!requestId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request ID is required' }),
    };
  }

  const result = await db.query(queries.licensing.approve, [requestId]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'License request not found' }),
    };
  }

  const request = result.rows[0];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: 'License approved',
      request: {
        id: request.id,
        status: request.status,
        approvedAt: request.approved_at,
      },
    }),
  };
}

/**
 * Reject a license request
 */
async function rejectLicense(event: APIGatewayProxyEvent) {
  const requestId = event.pathParameters?.requestId;

  if (!requestId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request ID is required' }),
    };
  }

  const body = JSON.parse(event.body || '{}');
  const { reason } = body;

  const result = await db.query(queries.licensing.reject, [requestId, reason]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'License request not found' }),
    };
  }

  const request = result.rows[0];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: 'License rejected',
      request: {
        id: request.id,
        status: request.status,
        rejectedAt: request.rejected_at,
        rejectionReason: request.rejection_reason,
      },
    }),
  };
}
