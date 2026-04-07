import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DatabaseClient, queries } from '@trulyimagined/database';
import { validateAuth0Token, hasScope } from '@trulyimagined/middleware';
import { z } from 'zod';

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

const NonEmptyString = z.string().trim().min(1);

const ActorIdPathSchema = z.object({
  id: NonEmptyString,
});

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(0).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const RegisterActorSchema = z.object({
  auth0UserId: NonEmptyString,
  email: z.string().trim().email(),
  firstName: NonEmptyString,
  lastName: NonEmptyString,
  stageName: NonEmptyString.optional(),
  bio: NonEmptyString.optional(),
  location: NonEmptyString.optional(),
});

const UpdateActorSchema = z
  .object({
    firstName: NonEmptyString.optional(),
    lastName: NonEmptyString.optional(),
    stageName: NonEmptyString.optional(),
    bio: NonEmptyString.optional(),
    location: NonEmptyString.optional(),
    profileImageUrl: z.string().trim().url().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one updatable field is required',
  });

function validationErrorResponse(error: z.ZodError | string) {
  const details =
    typeof error === 'string'
      ? { formErrors: [error], fieldErrors: {} }
      : error.flatten();

  return {
    statusCode: 400,
    headers: corsHeaders,
    body: JSON.stringify({
      error: 'Validation failed',
      details,
    }),
  };
}

function parseJsonBody<T>(event: APIGatewayProxyEvent, schema: z.ZodType<T>) {
  let rawBody: unknown = {};

  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return { success: false as const, response: validationErrorResponse('Invalid JSON body') };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return { success: false as const, response: validationErrorResponse(parsed.error) };
  }

  return { success: true as const, data: parsed.data };
}

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

    const user = await validateAuth0Token(event);
    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Scope-based authorization: require appropriate scope per HTTP method.
    const requiredScope = httpMethod === 'GET' ? 'hdicr:identity:read' : 'hdicr:identity:write';
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

    const tenantId = user.tenantId ?? process.env.HDICR_DEFAULT_TENANT_ID ?? 'trulyimagined';

    // Route based on path and method
    if (path === '/v1/identity/register' && httpMethod === 'POST') {
      return await registerActor(event, tenantId);
    }

    if (path === '/v1/identity/admin/users' && httpMethod === 'GET') {
      return await listAdminUsers(tenantId);
    }

    if (path.startsWith('/v1/identity/') && httpMethod === 'GET') {
      return await getActorById(event, tenantId);
    }

    if (path === '/v1/identity' && httpMethod === 'GET') {
      return await listActors(event, tenantId);
    }

    if (path.startsWith('/v1/identity/') && httpMethod === 'PUT') {
      return await updateActor(event, tenantId);
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
async function registerActor(event: APIGatewayProxyEvent, tenantId: string) {
  try {
    const parsedBody = parseJsonBody(event, RegisterActorSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { auth0UserId, email, firstName, lastName, stageName, bio, location } = parsedBody.data;

    // Create actor
    const result = await db.query(queries.actors.create, [
      tenantId,
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
async function getActorById(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedPath = ActorIdPathSchema.safeParse(event.pathParameters ?? {});
  if (!parsedPath.success) {
    return validationErrorResponse(parsedPath.error);
  }

  const { id: actorId } = parsedPath.data;

  const result = await db.query(queries.actors.getById, [actorId, tenantId]);

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
async function listActors(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedQuery = PaginationQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error);
  }

  const { limit, offset } = parsedQuery.data;

  const result = await db.query(queries.actors.list, [tenantId, limit, offset]);

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

async function listAdminUsers(tenantId: string) {
  const result = await db.query(queries.userProfiles.listAdminUsersWithActors, [tenantId]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      users: result.rows,
      total: result.rows.length,
    }),
  };
}

/**
 * Update actor profile
 */
async function updateActor(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedPath = ActorIdPathSchema.safeParse(event.pathParameters ?? {});
  if (!parsedPath.success) {
    return validationErrorResponse(parsedPath.error);
  }

  const parsedBody = parseJsonBody(event, UpdateActorSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { id: actorId } = parsedPath.data;

  const { firstName, lastName, stageName, bio, location, profileImageUrl } = parsedBody.data;

  const result = await db.query(queries.actors.update, [
    actorId,
    firstName,
    lastName,
    stageName,
    bio,
    location,
    profileImageUrl,
    tenantId,
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
