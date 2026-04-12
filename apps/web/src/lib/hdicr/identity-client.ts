import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

function getIdentityRemoteBaseUrl() {
  return getHdicrRemoteBaseUrlOrThrow('identity', 'client-initialization');
}

async function invokeIdentityRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST' | 'PUT';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'identity',
    baseUrl: getIdentityRemoteBaseUrl(),
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

export async function listActors(params?: { limit?: number; offset?: number }) {
  const limit = params?.limit ?? 500;
  const offset = params?.offset ?? 0;

  const payload = await invokeIdentityRemote<{
    actors?: Array<Record<string, unknown>>;
    pagination?: { total?: number; limit?: number; offset?: number };
  }>({
    path: `/v1/identity?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
    method: 'GET',
    operation: 'actors-list',
  });

  return {
    actors: payload.actors ?? [],
    pagination: payload.pagination ?? { total: payload.actors?.length ?? 0, limit, offset },
  };
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

// ==================== MANUAL VERIFICATION SESSION CLIENTS ====================

export interface VerificationSession {
  id: string;
  status: string;
  preferred_timezone: string | null;
  phone_number: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOpenVerificationSession(
  actorId: string
): Promise<VerificationSession | null> {
  const payload = await invokeIdentityRemote<{ session: VerificationSession | null }>({
    path: `/v1/identity/verification-sessions?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'verification-session-get-open',
  });
  return payload.session ?? null;
}

export async function createVerificationSession(params: {
  actorId: string;
  requestedByUserProfileId: string;
  preferredTimezone: string;
  phoneNumber: string;
}): Promise<{ id: string; status: string; createdAt: string }> {
  const payload = await invokeIdentityRemote<{
    success: boolean;
    session: { id: string; status: string; createdAt: string };
  }>({
    path: '/v1/identity/verification-sessions',
    method: 'POST',
    operation: 'verification-session-create',
    body: params,
  });
  return payload.session;
}

export async function scheduleVerificationSession(params: {
  actorId: string;
  sessionId?: string;
  scheduledAt: string;
  meetingLinkEncrypted: string;
  meetingPlatform?: string;
  preferredTimezone?: string;
  phoneNumber?: string;
  requestedByUserProfileId: string;
}): Promise<{ verificationRequestId: string }> {
  const payload = await invokeIdentityRemote<{
    success: boolean;
    verificationRequestId: string;
  }>({
    path: '/v1/identity/verification-sessions/schedule',
    method: 'POST',
    operation: 'verification-session-schedule',
    body: params,
  });
  return { verificationRequestId: payload.verificationRequestId };
}

export async function batchGetLatestVerificationSessions(
  actorIds: string[]
): Promise<Record<string, VerificationSession | null>> {
  if (actorIds.length === 0) return {};
  const payload = await invokeIdentityRemote<{
    sessions: Record<string, VerificationSession | null>;
  }>({
    path: '/v1/identity/verification-sessions/batch-latest',
    method: 'POST',
    operation: 'verification-sessions-batch-latest',
    body: { actorIds },
  });
  return payload.sessions;
}

export async function completeVerificationSession(params: {
  sessionId?: string;
  actorId?: string;
  verified: boolean;
  notes?: string;
  completedByUserProfileId: string;
}): Promise<{ sessionId: string; actorId: string }> {
  const payload = await invokeIdentityRemote<{
    success: boolean;
    sessionId: string;
    actorId: string;
  }>({
    path: '/v1/identity/verification-sessions/complete',
    method: 'POST',
    operation: 'verification-session-complete',
    body: params,
  });
  return { sessionId: payload.sessionId, actorId: payload.actorId };
}

export async function upsertIdentityLink(params: {
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
  return invokeIdentityRemote<{ link?: Record<string, unknown> | null; id?: string }>({
    path: '/v1/identity/link/upsert',
    method: 'POST',
    operation: 'identity-link-upsert',
    body: params,
  });
}

export async function setActorVerificationStatus(
  actorId: string,
  params: { verified: boolean; verifiedByUserProfileId: string }
) {
  return invokeIdentityRemote<{
    success: boolean;
    actorId: string;
    verificationStatus: string;
    verifiedAt: string | null;
  }>({
    path: `/v1/identity/${encodeURIComponent(actorId)}/verify`,
    method: 'POST',
    operation: 'actor-verify',
    body: params,
  });
}
