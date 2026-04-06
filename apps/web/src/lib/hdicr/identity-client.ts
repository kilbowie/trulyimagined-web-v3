import { query } from '@/lib/db';
import { encryptJSON } from '@trulyimagined/utils';
import { resolveIdentity } from '@/lib/identity-resolution';
import { createUniqueRegistryId } from '@/lib/registry-id';
import { ensureActorRegistryId } from '@/lib/registry-id';
import {
  getHdicrAdapterMode,
  getHdicrRemoteBaseUrl,
  warnIfRemoteModeEnabled,
} from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('identity');

function isIdentityRemoteMode() {
  return getHdicrAdapterMode('identity') === 'remote';
}

function getIdentityRemoteBaseUrlOrThrow(operation: string): string {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Identity ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

async function invokeIdentityRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  const baseUrl = getIdentityRemoteBaseUrlOrThrow(params.operation);
  const url = new URL(params.path, baseUrl);

  const response = await fetch(url.toString(), {
    method: params.method,
    headers: {
      Accept: 'application/json',
      ...(params.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `[HDICR] Remote identity ${params.operation} failed with status ${response.status} (fail-closed).`
    );
  }

  return (await response.json()) as T;
}

async function actorExistsByAuth0UserIdLocal(auth0UserId: string): Promise<boolean> {
  const result = await query('SELECT id FROM actors WHERE auth0_user_id = $1', [auth0UserId]);
  return result.rows.length > 0;
}

export async function actorExistsByAuth0UserId(auth0UserId: string): Promise<boolean> {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{ exists?: boolean }>({
      path: `/identity/actors/exists?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'actor-exists-check',
    });

    return Boolean(payload.exists);
  }

  return actorExistsByAuth0UserIdLocal(auth0UserId);
}

async function createActorRegistrationLocal(params: {
  auth0UserId: string;
  email: string | undefined;
  firstName: string;
  lastName: string;
  stageName?: string;
  location?: string;
  bio?: string;
}) {
  const registryId = await createUniqueRegistryId();

  const result = await query(
    `INSERT INTO actors (
      auth0_user_id,
      email,
      registry_id,
      first_name,
      last_name,
      stage_name,
      location,
      bio,
      verification_status,
      is_founding_member,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING
      id,
      registry_id,
      first_name,
      last_name,
      stage_name,
      location,
      bio,
      verification_status,
      is_founding_member,
      created_at`,
    [
      params.auth0UserId,
      params.email,
      registryId,
      params.firstName,
      params.lastName,
      params.stageName || null,
      params.location || null,
      params.bio || null,
      'pending',
      false,
    ]
  );

  return result.rows[0] || null;
}

export async function createActorRegistration(params: {
  auth0UserId: string;
  email: string | undefined;
  firstName: string;
  lastName: string;
  stageName?: string;
  location?: string;
  bio?: string;
}) {
  if (isIdentityRemoteMode()) {
    return invokeIdentityRemote<Record<string, unknown>>({
      path: '/identity/register',
      method: 'POST',
      operation: 'actor-registration-create',
      body: params,
    });
  }

  return createActorRegistrationLocal(params);
}

async function getUserProfileIdByAuth0UserIdLocal(auth0UserId: string): Promise<string | null> {
  const userResult = await query(`SELECT id FROM user_profiles WHERE auth0_user_id = $1`, [
    auth0UserId,
  ]);

  if (userResult.rows.length === 0) {
    return null;
  }

  return userResult.rows[0].id as string;
}

export async function getUserProfileIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{ userProfileId?: string | null }>({
      path: `/identity/user-profile-id?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'user-profile-id-resolve',
    });

    return payload.userProfileId ?? null;
  }

  return getUserProfileIdByAuth0UserIdLocal(auth0UserId);
}

async function getIdentityLinkByProviderAndProviderUserLocal(
  userProfileId: string,
  provider: string,
  providerUserId: string
) {
  const existingLink = await query(
    `SELECT id, is_active
     FROM identity_links
     WHERE user_profile_id = $1 AND provider = $2 AND provider_user_id = $3`,
    [userProfileId, provider, providerUserId]
  );

  return existingLink.rows[0] || null;
}

export async function getIdentityLinkByProviderAndProviderUser(
  userProfileId: string,
  provider: string,
  providerUserId: string
) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{
      link?: Record<string, unknown> | null;
      id?: string;
      is_active?: boolean;
    }>({
      path:
        `/identity/link/by-provider?userProfileId=${encodeURIComponent(userProfileId)}` +
        `&provider=${encodeURIComponent(provider)}` +
        `&providerUserId=${encodeURIComponent(providerUserId)}`,
      method: 'GET',
      operation: 'identity-link-lookup',
    });

    if (payload.link !== undefined) {
      return payload.link;
    }

    if (payload.id) {
      return { id: payload.id, is_active: payload.is_active ?? true };
    }

    return null;
  }

  return getIdentityLinkByProviderAndProviderUserLocal(userProfileId, provider, providerUserId);
}

async function reactivateIdentityLinkLocal(params: {
  linkId: string;
  verificationLevel?: string;
  assuranceLevel?: string;
  credentialData?: unknown;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  const encryptedCredentialData = params.credentialData ? encryptJSON(params.credentialData) : null;

  await query(
    `UPDATE identity_links
     SET is_active = TRUE,
         linked_at = NOW(),
         verification_level = COALESCE($1, verification_level),
         assurance_level = COALESCE($2, assurance_level),
         credential_data = COALESCE($3, credential_data),
         metadata = COALESCE($4, metadata),
         expires_at = $5,
         last_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $6`,
    [
      params.verificationLevel || null,
      params.assuranceLevel || null,
      encryptedCredentialData,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.expiresAt || null,
      params.linkId,
    ]
  );
}

export async function reactivateIdentityLink(params: {
  linkId: string;
  verificationLevel?: string;
  assuranceLevel?: string;
  credentialData?: unknown;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  if (isIdentityRemoteMode()) {
    await invokeIdentityRemote<{ success?: boolean }>({
      path: '/identity/link/reactivate',
      method: 'POST',
      operation: 'identity-link-reactivate',
      body: params,
    });
    return;
  }

  await reactivateIdentityLinkLocal(params);
}

async function createIdentityLinkLocal(params: {
  userProfileId: string;
  provider: string;
  providerUserId: string;
  providerType: string;
  verificationLevel?: string;
  assuranceLevel?: string;
  credentialData?: unknown;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  const encryptedCredentialData = params.credentialData ? encryptJSON(params.credentialData) : null;

  const result = await query(
    `INSERT INTO identity_links (
      user_profile_id,
      provider,
      provider_user_id,
      provider_type,
      verification_level,
      assurance_level,
      credential_data,
      metadata,
      verified_at,
      expires_at,
      last_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NOW())
    RETURNING id, provider, verification_level, assurance_level`,
    [
      params.userProfileId,
      params.provider,
      params.providerUserId,
      params.providerType,
      params.verificationLevel || 'medium',
      params.assuranceLevel || null,
      encryptedCredentialData,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.expiresAt || null,
    ]
  );

  return result.rows[0] || null;
}

export async function createIdentityLink(params: {
  userProfileId: string;
  provider: string;
  providerUserId: string;
  providerType: string;
  verificationLevel?: string;
  assuranceLevel?: string;
  credentialData?: unknown;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  if (isIdentityRemoteMode()) {
    return invokeIdentityRemote<Record<string, unknown>>({
      path: '/identity/link/create',
      method: 'POST',
      operation: 'identity-link-create',
      body: params,
    });
  }

  return createIdentityLinkLocal(params);
}

async function unlinkIdentityByIdLocal(linkId: string, userProfileId: string) {
  const result = await query(
    `UPDATE identity_links
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND user_profile_id = $2
     RETURNING provider`,
    [linkId, userProfileId]
  );

  return result.rows;
}

export async function unlinkIdentityById(linkId: string, userProfileId: string) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, unknown>> }>({
      path: '/identity/link/unlink-by-id',
      method: 'POST',
      operation: 'identity-link-unlink-by-id',
      body: { linkId, userProfileId },
    });

    return payload.rows || [];
  }

  return unlinkIdentityByIdLocal(linkId, userProfileId);
}

async function unlinkIdentityByProviderLocal(provider: string, userProfileId: string) {
  const result = await query(
    `UPDATE identity_links
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_profile_id = $1 AND provider = $2 AND is_active = TRUE
     RETURNING id`,
    [userProfileId, provider]
  );

  return result.rows;
}

export async function unlinkIdentityByProvider(provider: string, userProfileId: string) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, unknown>> }>({
      path: '/identity/link/unlink-by-provider',
      method: 'POST',
      operation: 'identity-link-unlink-by-provider',
      body: { provider, userProfileId },
    });

    return payload.rows || [];
  }

  return unlinkIdentityByProviderLocal(provider, userProfileId);
}

async function listIdentityLinksLocal(userProfileId: string, activeOnly: boolean) {
  let sql = `
    SELECT
      id,
      provider,
      provider_type,
      verification_level,
      assurance_level,
      verified_at,
      linked_at,
      last_verified_at,
      expires_at,
      is_active,
      metadata
    FROM identity_links
    WHERE user_profile_id = $1
  `;

  if (activeOnly) {
    sql += ` AND is_active = TRUE`;
  }

  sql += ` ORDER BY
    CASE verification_level
      WHEN 'very-high' THEN 4
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
      ELSE 0
    END DESC,
    linked_at DESC`;

  const result = await query(sql, [userProfileId]);
  return result.rows;
}

export async function listIdentityLinks(userProfileId: string, activeOnly: boolean) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{
      rows?: Array<Record<string, unknown>>;
      links?: Array<Record<string, unknown>>;
    }>({
      path:
        `/identity/links?userProfileId=${encodeURIComponent(userProfileId)}` +
        `&activeOnly=${activeOnly ? 'true' : 'false'}`,
      method: 'GET',
      operation: 'identity-links-list',
    });

    if (Array.isArray(payload.rows)) {
      return payload.rows;
    }

    if (Array.isArray(payload.links)) {
      return payload.links;
    }

    throw new Error('[HDICR] Remote identity links list returned an unexpected payload.');
  }

  return listIdentityLinksLocal(userProfileId, activeOnly);
}

async function getActorRegistrationStatusLocal(auth0UserId: string) {
  const result = await query(
    `SELECT
      a.id,
      a.registry_id,
      a.first_name,
      a.last_name,
      a.stage_name,
      a.location,
      a.bio,
      a.verification_status,
      a.is_founding_member,
      a.created_at,
      a.updated_at,
      COALESCE(up.is_verified, FALSE) AS is_verified,
      COALESCE(up.is_pro, FALSE) AS is_pro
    FROM actors a
    LEFT JOIN user_profiles up ON up.auth0_user_id = a.auth0_user_id
    WHERE a.auth0_user_id = $1`,
    [auth0UserId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const actor = result.rows[0];
  const registryId = await ensureActorRegistryId(actor.id as string, actor.registry_id as string);

  return {
    id: actor.id,
    registryId,
    firstName: actor.first_name,
    lastName: actor.last_name,
    stageName: actor.stage_name,
    location: actor.location,
    bio: actor.bio,
    verificationStatus: actor.verification_status,
    isVerified: !!actor.is_verified || actor.verification_status === 'verified',
    isPro: !!actor.is_pro,
    isFoundingMember: actor.is_founding_member,
    createdAt: actor.created_at,
    updatedAt: actor.updated_at,
  };
}

export async function getActorRegistrationStatus(auth0UserId: string) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{ status?: Record<string, unknown> | null }>({
      path: `/identity/registration-status?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'actor-registration-status',
    });

    return payload.status ?? null;
  }

  return getActorRegistrationStatusLocal(auth0UserId);
}

async function getIdentityResolutionLocal(auth0UserId: string) {
  const userProfileId = await getUserProfileIdByAuth0UserIdLocal(auth0UserId);
  if (!userProfileId) {
    return null;
  }

  const resolution = await resolveIdentity(userProfileId);
  return {
    userProfileId,
    resolution,
  };
}

export async function getIdentityResolution(auth0UserId: string) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{
      userProfileId?: string;
      resolution?: Record<string, unknown>;
    }>({
      path: `/identity/resolution?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'identity-resolution',
    });

    if (!payload.userProfileId) {
      return null;
    }

    return {
      userProfileId: payload.userProfileId,
      resolution: payload.resolution,
    };
  }

  return getIdentityResolutionLocal(auth0UserId);
}

async function getVerificationLinksSummaryLocal(auth0UserId: string) {
  const userProfileId = await getUserProfileIdByAuth0UserIdLocal(auth0UserId);
  if (!userProfileId) {
    return null;
  }

  const linksResult = await query(
    `SELECT
      provider,
      provider_type,
      verification_level,
      assurance_level,
      verified_at,
      linked_at,
      last_verified_at
    FROM identity_links
    WHERE user_profile_id = $1 AND is_active = TRUE
    ORDER BY
      CASE verification_level
        WHEN 'very-high' THEN 4
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC`,
    [userProfileId]
  );

  return {
    userProfileId,
    links: linksResult.rows,
  };
}

export async function getVerificationLinksSummary(auth0UserId: string) {
  if (isIdentityRemoteMode()) {
    const payload = await invokeIdentityRemote<{
      userProfileId?: string;
      links?: Array<Record<string, unknown>>;
    }>({
      path: `/identity/verification-links-summary?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'identity-verification-links-summary',
    });

    if (!payload.userProfileId) {
      return null;
    }

    return {
      userProfileId: payload.userProfileId,
      links: payload.links || [],
    };
  }

  return getVerificationLinksSummaryLocal(auth0UserId);
}
