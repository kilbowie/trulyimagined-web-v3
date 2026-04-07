import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

const identityRemoteBaseUrl = getHdicrRemoteBaseUrlOrThrow('identity', 'client-initialization');

async function invokeIdentityRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST' | 'PUT';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'identity',
    baseUrl: identityRemoteBaseUrl,
    ...params,
  });
}

export async function actorExistsByAuth0UserId(auth0UserId: string): Promise<boolean> {
  const payload = await invokeIdentityRemote<{ exists?: boolean }>({
    path: `/v1/identity/actors/exists?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-exists-check',
  });

  return Boolean(payload.exists);
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
  return invokeIdentityRemote<Record<string, unknown>>({
    path: '/v1/identity/register',
    method: 'POST',
    operation: 'actor-registration-create',
    body: params,
  });
}

export async function listAdminUsers() {
  const payload = await invokeIdentityRemote<{
    users?: Array<Record<string, any>>;
    total?: number;
  }>({
    path: '/v1/identity/admin/users',
    method: 'GET',
    operation: 'admin-users-list',
  });

  return {
    users: payload.users || [],
    total: payload.total ?? (payload.users?.length || 0),
  };
}

export async function getUserProfileIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const payload = await invokeIdentityRemote<{ userProfileId?: string | null }>({
    path: `/v1/identity/user-profile-id?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'user-profile-id-resolve',
  });

  return payload.userProfileId ?? null;
}

export async function getIdentityLinkByProviderAndProviderUser(
  userProfileId: string,
  provider: string,
  providerUserId: string
) {
  const payload = await invokeIdentityRemote<{
    link?: Record<string, any> | null;
    id?: string;
    is_active?: boolean;
  }>({
    path:
      `/v1/identity/link/by-provider?userProfileId=${encodeURIComponent(userProfileId)}` +
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

export async function reactivateIdentityLink(params: {
  linkId: string;
  verificationLevel?: string;
  assuranceLevel?: string;
  credentialData?: unknown;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  await invokeIdentityRemote<{ success?: boolean }>({
    path: '/v1/identity/link/reactivate',
    method: 'POST',
    operation: 'identity-link-reactivate',
    body: params,
  });

  return;
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
  return invokeIdentityRemote<Record<string, unknown>>({
    path: '/v1/identity/link/create',
    method: 'POST',
    operation: 'identity-link-create',
    body: params,
  });
}

export async function unlinkIdentityById(linkId: string, userProfileId: string) {
  const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, any>> }>({
    path: '/v1/identity/link/unlink-by-id',
    method: 'POST',
    operation: 'identity-link-unlink-by-id',
    body: { linkId, userProfileId },
  });

  return payload.rows || [];
}

export async function unlinkIdentityByProvider(provider: string, userProfileId: string) {
  const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, any>> }>({
    path: '/v1/identity/link/unlink-by-provider',
    method: 'POST',
    operation: 'identity-link-unlink-by-provider',
    body: { provider, userProfileId },
  });

  return payload.rows || [];
}

export async function listIdentityLinks(userProfileId: string, activeOnly: boolean) {
  const payload = await invokeIdentityRemote<{
    rows?: Array<Record<string, any>>;
    links?: Array<Record<string, any>>;
  }>({
    path:
      `/v1/identity/links?userProfileId=${encodeURIComponent(userProfileId)}` +
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

export async function getActorRegistrationStatus(auth0UserId: string) {
  const payload = await invokeIdentityRemote<{ status?: Record<string, unknown> | null }>({
    path: `/v1/identity/registration-status?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-registration-status',
  });

  return payload.status ?? null;
}

export async function getIdentityResolution(auth0UserId: string) {
  const payload = await invokeIdentityRemote<{
    userProfileId?: string;
    resolution?: Record<string, unknown>;
  }>({
    path: `/v1/identity/resolution?auth0UserId=${encodeURIComponent(auth0UserId)}`,
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

export async function getVerificationLinksSummary(auth0UserId: string) {
  const payload = await invokeIdentityRemote<{
    userProfileId?: string;
    links?: Array<Record<string, unknown>>;
  }>({
    path: `/v1/identity/verification-links-summary?auth0UserId=${encodeURIComponent(auth0UserId)}`,
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

export async function getActorById(actorId: string) {
  const payload = await invokeIdentityRemote<{ actor?: Record<string, unknown> | null }>({
    path: `/v1/identity/${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'actor-by-id',
  });

  return payload.actor ?? null;
}

export async function updateActorProfile(
  actorId: string,
  params: {
    firstName?: string | null;
    lastName?: string | null;
    stageName?: string | null;
    bio?: string | null;
    location?: string | null;
    profileImageUrl?: string | null;
  }
) {
  const payload = await invokeIdentityRemote<{ actor?: Record<string, unknown> | null }>({
    path: `/v1/identity/${encodeURIComponent(actorId)}`,
    method: 'PUT',
    operation: 'actor-update',
    body: {
      ...params,
      actorId,
    },
  });

  return payload.actor ?? null;
}
