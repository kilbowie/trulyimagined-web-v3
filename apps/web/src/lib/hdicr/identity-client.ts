import { getHdicrRemoteBaseUrl } from '@/lib/hdicr/flags';

function getIdentityRemoteBaseUrlOrThrow(operation: string): string {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Identity ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

const identityRemoteBaseUrl = getIdentityRemoteBaseUrlOrThrow('client-initialization');

async function invokeIdentityRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  const url = new URL(params.path, identityRemoteBaseUrl);

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
    link?: Record<string, unknown> | null;
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
  const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, unknown>> }>({
    path: '/v1/identity/link/unlink-by-id',
    method: 'POST',
    operation: 'identity-link-unlink-by-id',
    body: { linkId, userProfileId },
  });

  return payload.rows || [];
}

export async function unlinkIdentityByProvider(provider: string, userProfileId: string) {
  const payload = await invokeIdentityRemote<{ rows?: Array<Record<string, unknown>> }>({
    path: '/v1/identity/link/unlink-by-provider',
    method: 'POST',
    operation: 'identity-link-unlink-by-provider',
    body: { provider, userProfileId },
  });

  return payload.rows || [];
}

export async function listIdentityLinks(userProfileId: string, activeOnly: boolean) {
  const payload = await invokeIdentityRemote<{
    rows?: Array<Record<string, unknown>>;
    links?: Array<Record<string, unknown>>;
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
