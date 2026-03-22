import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DatabaseClient } from '@trulyimagined/database/src/client';
import { queries } from '@trulyimagined/database/src/queries-v3';

/**
 * Identity Service - Lambda Handler
 * Step 5: Identity Registry MVP
 *
 * Handles actor identity registration and management:
 * - POST /identity/register - Register new actor
 * - GET /identity/{id} - Get actor by ID
 * - GET /identity - List all actors
 * - PUT /identity/{id} - Update actor profile
 */

const db = DatabaseClient.getInstance();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('[IDENTITY-SERVICE] Request received:', {
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
    if (path === '/identity/register' && httpMethod === 'POST') {
      return await registerActor(event);
    }

    if (path.startsWith('/identity/') && httpMethod === 'GET') {
      return await getActorById(event);
    }

    if (path === '/identity' && httpMethod === 'GET') {
      return await listActors(event);
    }

    if (path.startsWith('/identity/') && httpMethod === 'PUT') {
      return await updateActor(event);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error: any) {
    console.error('[IDENTITY-SERVICE] Error:', error);
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
 * Register a new actor in the Identity Registry
 */
async function registerActor(event: APIGatewayProxyEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { auth0UserId, email, firstName, lastName, stageName, bio, location } = body;

    // Validation
    if (!auth0UserId || !email || !firstName || !lastName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['auth0UserId', 'email', 'firstName', 'lastName'],
        }),
      };
    }

    // Create actor
    const result = await db.query(queries.actors.create, [
      auth0UserId,
      email,
      firstName,
      lastName,
      stageName || null,
      bio || null,
      location || null,
    ]);

    const actor = result.rows[0];

    console.log('[IDENTITY-SERVICE] Actor registered:', actor.id);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        actor: {
          id: actor.id,
          email: actor.email,
          firstName: actor.first_name,
          lastName: actor.last_name,
          stageName: actor.stage_name,
          verificationStatus: actor.verification_status,
          createdAt: actor.created_at,
        },
      }),
    };
  } catch (error: any) {
    console.error('[IDENTITY-SERVICE] Registration error:', error);

    // Handle unique constraint violations
    if (error.code === '23505') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Actor already registered',
          message: 'An actor with this email or Auth0 ID already exists',
        }),
      };
    }

    throw error;
  }
}

/**
 * Get actor by ID
 */
async function getActorById(event: APIGatewayProxyEvent) {
  const actorId = event.pathParameters?.id;

  if (!actorId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor ID is required' }),
    };
  }

  const result = await db.query(queries.actors.getById, [actorId]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor not found' }),
    };
  }

  const actor = result.rows[0];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      actor: {
        id: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        bio: actor.bio,
        location: actor.location,
        profileImageUrl: actor.profile_image_url,
        verificationStatus: actor.verification_status,
        isFoundingMember: actor.is_founding_member,
        registryId: actor.registry_id,
        createdAt: actor.created_at,
      },
    }),
  };
}

/**
 * List all actors (with pagination)
 */
async function listActors(event: APIGatewayProxyEvent) {
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const offset = parseInt(event.queryStringParameters?.offset || '0');

  const result = await db.query(queries.actors.list, [limit, offset]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      actors: result.rows.map((actor) => ({
        id: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        verificationStatus: actor.verification_status,
        isFoundingMember: actor.is_founding_member,
        registryId: actor.registry_id,
        createdAt: actor.created_at,
      })),
      pagination: {
        limit,
        offset,
        total: result.rowCount,
      },
    }),
  };
}

/**
 * Update actor profile
 */
async function updateActor(event: APIGatewayProxyEvent) {
  const actorId = event.pathParameters?.id;

  if (!actorId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor ID is required' }),
    };
  }

  const body = JSON.parse(event.body || '{}');
  const { firstName, lastName, stageName, bio, location, profileImageUrl } = body;

  const result = await db.query(queries.actors.update, [
    actorId,
    firstName,
    lastName,
    stageName,
    bio,
    location,
    profileImageUrl,
  ]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Actor not found' }),
    };
  }

  const actor = result.rows[0];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      actor: {
        id: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        bio: actor.bio,
        location: actor.location,
        profileImageUrl: actor.profile_image_url,
        updatedAt: actor.updated_at,
      },
    }),
  };
}
