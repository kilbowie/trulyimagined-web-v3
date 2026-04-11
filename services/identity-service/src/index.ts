import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DatabaseClient, queries } from '@trulyimagined/database';
import { validateAuth0TokenWithStatus, hasScope } from '@trulyimagined/middleware';
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

const BooleanQuerySchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => value === 'true' || value === 'false', {
    message: 'Expected boolean string',
  })
  .transform((value) => value === 'true');

const IdentityLinkLookupQuerySchema = z.object({
  userProfileId: NonEmptyString,
  provider: NonEmptyString,
  providerUserId: NonEmptyString,
});

const IdentityLinksListQuerySchema = z.object({
  userProfileId: NonEmptyString,
  activeOnly: z.preprocess((value) => value ?? 'true', BooleanQuerySchema),
});

const CreateIdentityLinkSchema = z.object({
  userProfileId: NonEmptyString,
  provider: NonEmptyString,
  providerUserId: NonEmptyString,
  providerType: NonEmptyString,
  verificationLevel: NonEmptyString.optional(),
  assuranceLevel: NonEmptyString.optional(),
  credentialData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().trim().optional(),
});

const ReactivateIdentityLinkSchema = z.object({
  linkId: NonEmptyString,
  verificationLevel: NonEmptyString.optional(),
  assuranceLevel: NonEmptyString.optional(),
  credentialData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().trim().optional(),
});

const UnlinkIdentityByIdSchema = z.object({
  linkId: NonEmptyString,
  userProfileId: NonEmptyString,
});

const UnlinkIdentityByProviderSchema = z.object({
  provider: NonEmptyString,
  userProfileId: NonEmptyString,
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
    typeof error === 'string' ? { formErrors: [error], fieldErrors: {} } : error.flatten();

  return {
    statusCode: 400,
    headers: corsHeaders,
      return await getIdentityLinkByProviderAndProviderUser(event, tenantId);
      error: 'Validation failed',
      details,
    }),
      return await listIdentityLinks(event, tenantId);
}

function parseJsonBody<T>(event: APIGatewayProxyEvent, schema: z.ZodType<T>) {
      return await createIdentityLink(event, tenantId);

  try {
    rawBody = JSON.parse(event.body ?? '{}');
      return await reactivateIdentityLink(event, tenantId);
    return { success: false as const, response: validationErrorResponse('Invalid JSON body') };
  }

      return await unlinkIdentityById(event, tenantId);
  if (!parsed.success) {
    return { success: false as const, response: validationErrorResponse(parsed.error) };
  }
      return await unlinkIdentityByProvider(event, tenantId);
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

    const authResult = await validateAuth0TokenWithStatus(event);
    if (!authResult.user) {
      return {
        statusCode: authResult.errorStatus || 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: authResult.errorStatus === 403 ? 'Token rejected' : 'Unauthorized',
        }),
      };
    }

    const user = authResult.user;

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

    if (path === '/v1/identity/link/by-provider' && httpMethod === 'GET') {
      return await getIdentityLinkByProviderAndProviderUser(event);
    }

    if (path === '/v1/identity/links' && httpMethod === 'GET') {
      return await listIdentityLinks(event);
    }

    if (path === '/v1/identity/link/create' && httpMethod === 'POST') {
      return await createIdentityLink(event);
    }

    if (path === '/v1/identity/link/reactivate' && httpMethod === 'POST') {
      return await reactivateIdentityLink(event);
    }

    if (path === '/v1/identity/link/unlink-by-id' && httpMethod === 'POST') {
      return await unlinkIdentityById(event);
    }

    if (path === '/v1/identity/link/unlink-by-provider' && httpMethod === 'POST') {
      return await unlinkIdentityByProvider(event);
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
    const result = await db.queryWithTenant(tenantId, queries.actors.create, [
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
          identitySubjectId: actor.id,
          email: actor.email,
          firstName: actor.first_name,
          lastName: actor.last_name,
          stageName: actor.stage_name,
          displayName: actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim(),
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

  const result = await db.queryWithTenant(tenantId, queries.actors.getById, [actorId, tenantId]);

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
        identitySubjectId: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        displayName: actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim(),
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

  const result = await db.queryWithTenant(tenantId, queries.actors.list, [tenantId, limit, offset]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      actors: result.rows.map((actor) => ({
        id: actor.id,
        identitySubjectId: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        displayName: actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim(),
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
  const result = await db.queryWithTenant(tenantId, queries.userProfiles.listAdminUsersWithActors, [tenantId]);

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

  const result = await db.queryWithTenant(tenantId, queries.actors.update, [
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
        identitySubjectId: actor.id,
        email: actor.email,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        displayName: actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim(),
        bio: actor.bio,
        location: actor.location,
        profileImageUrl: actor.profile_image_url,
        updatedAt: actor.updated_at,
      },
    }),
  };
}

async function getIdentityLinkByProviderAndProviderUser(
  event: APIGatewayProxyEvent,
  tenantId: string
) {
  const parsedQuery = IdentityLinkLookupQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error);
  }

  const { userProfileId, provider, providerUserId } = parsedQuery.data;

  const result = await db.queryWithTenant(tenantId, 
    `SELECT *
     FROM identity_links
     WHERE user_profile_id = $1
       AND provider = $2
       AND provider_user_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [userProfileId, provider, providerUserId]
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      link: result.rows[0] || null,
    }),
  };
}

async function listIdentityLinks(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedQuery = IdentityLinksListQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error);
  }

  const { userProfileId, activeOnly } = parsedQuery.data;

  const result = await db.queryWithTenant(tenantId, 
    `SELECT *
     FROM identity_links
     WHERE user_profile_id = $1
       AND ($2::boolean = FALSE OR is_active = TRUE)
     ORDER BY created_at DESC`,
    [userProfileId, activeOnly]
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      links: result.rows,
    }),
  };
}

async function createIdentityLink(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedBody = parseJsonBody(event, CreateIdentityLinkSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const {
    userProfileId,
    provider,
    providerUserId,
    providerType,
    verificationLevel,
    assuranceLevel,
    credentialData,
    metadata,
    expiresAt,
  } = parsedBody.data;

  const result = await db.queryWithTenant(tenantId, 
    `INSERT INTO identity_links (
      user_profile_id,
      provider,
      provider_user_id,
      provider_type,
      verification_level,
      assurance_level,
      credential_data,
      metadata,
      expires_at,
      is_active,
      last_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NULLIF($9, '')::timestamptz, TRUE, NOW())
    RETURNING *`,
    [
      userProfileId,
      provider,
      providerUserId,
      providerType,
      verificationLevel || 'low',
      assuranceLevel || 'low',
      JSON.stringify(credentialData ?? {}),
      JSON.stringify(metadata ?? {}),
      expiresAt || null,
    ]
  );

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      link: result.rows[0] || null,
      id: result.rows[0]?.id,
    }),
  };
}

async function reactivateIdentityLink(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedBody = parseJsonBody(event, ReactivateIdentityLinkSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { linkId, verificationLevel, assuranceLevel, credentialData, metadata, expiresAt } =
    parsedBody.data;

  const result = await db.queryWithTenant(tenantId, 
    `UPDATE identity_links
     SET is_active = TRUE,
         verification_level = COALESCE($2, verification_level),
         assurance_level = COALESCE($3, assurance_level),
         credential_data = CASE WHEN $4::jsonb IS NULL THEN credential_data ELSE $4::jsonb END,
         metadata = CASE WHEN $5::jsonb IS NULL THEN metadata ELSE $5::jsonb END,
         expires_at = COALESCE(NULLIF($6, '')::timestamptz, expires_at),
         verified_at = COALESCE(verified_at, NOW()),
         last_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      linkId,
      verificationLevel || null,
      assuranceLevel || null,
      credentialData !== undefined ? JSON.stringify(credentialData) : null,
      metadata !== undefined ? JSON.stringify(metadata) : null,
      expiresAt || null,
    ]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Identity link not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      link: result.rows[0],
    }),
  };
}

async function unlinkIdentityById(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedBody = parseJsonBody(event, UnlinkIdentityByIdSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { linkId, userProfileId } = parsedBody.data;

  const result = await db.queryWithTenant(tenantId, 
    `UPDATE identity_links
     SET is_active = FALSE,
         updated_at = NOW()
     WHERE id = $1 AND user_profile_id = $2
     RETURNING id, user_profile_id, provider, provider_user_id, is_active, updated_at`,
    [linkId, userProfileId]
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ rows: result.rows }),
  };
}

async function unlinkIdentityByProvider(event: APIGatewayProxyEvent, tenantId: string) {
  const parsedBody = parseJsonBody(event, UnlinkIdentityByProviderSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { provider, userProfileId } = parsedBody.data;

  const result = await db.queryWithTenant(tenantId, 
    `UPDATE identity_links
     SET is_active = FALSE,
         updated_at = NOW()
     WHERE provider = $1 AND user_profile_id = $2
     RETURNING id, user_profile_id, provider, provider_user_id, is_active, updated_at`,
    [provider, userProfileId]
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ rows: result.rows }),
  };
}

