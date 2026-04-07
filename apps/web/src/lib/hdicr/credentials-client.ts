import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

type CredentialListRow = {
  id: string;
  credential_type: string;
  credential_json: unknown;
  issuer_did: string | null;
  holder_did: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  revoked_at: string | null;
  revocation_reason: string | null;
  verification_method: string | null;
  proof_type: string | null;
};

const credentialsRemoteBaseUrl = getHdicrRemoteBaseUrlOrThrow(
  'credentials',
  'client-initialization'
);

async function invokeCredentialsRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'credentials',
    baseUrl: credentialsRemoteBaseUrl,
    ...params,
  });
}

function mapRemoteCredentialToRow(item: Record<string, unknown>): CredentialListRow | null {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;

  if (typeof metadata.id !== 'string' || typeof metadata.credentialType !== 'string') {
    return null;
  }

  return {
    id: metadata.id,
    credential_type: metadata.credentialType,
    credential_json: item.credential,
    issuer_did: (metadata.issuerDid as string | null) ?? null,
    holder_did: (metadata.holderDid as string | null) ?? null,
    issued_at: (metadata.issuedAt as string | null) ?? null,
    expires_at: (metadata.expiresAt as string | null) ?? null,
    is_revoked: Boolean(metadata.isRevoked),
    revoked_at: (metadata.revokedAt as string | null) ?? null,
    revocation_reason: (metadata.revocationReason as string | null) ?? null,
    verification_method: (metadata.verificationMethod as string | null) ?? null,
    proof_type: (metadata.proofType as string | null) ?? null,
  };
}

export async function getUserProfileByAuth0UserId(auth0UserId: string) {
  const payload = await invokeCredentialsRemote<{ profile?: Record<string, any> | null }>({
    path: `/v1/credentials/profile?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'profile-by-auth0',
  });

  return payload.profile ?? null;
}

export async function listCredentialsByProfileId(options: {
  userProfileId: string;
  includeRevoked: boolean;
  includeExpired: boolean;
}) {
  const payload = await invokeCredentialsRemote<{
    rows?: CredentialListRow[];
    credentials?: Array<Record<string, unknown>>;
  }>({
    path:
      `/v1/credentials/list?userProfileId=${encodeURIComponent(options.userProfileId)}` +
      `&includeRevoked=${String(options.includeRevoked)}` +
      `&includeExpired=${String(options.includeExpired)}`,
    method: 'GET',
    operation: 'credentials-list',
  });

  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload.credentials)) {
    return payload.credentials.map(mapRemoteCredentialToRow).filter(Boolean) as CredentialListRow[];
  }

  throw new Error('[HDICR] Remote credentials list returned an unexpected payload (fail-closed).');
}

export async function getCredentialById(credentialId: string) {
  const payload = await invokeCredentialsRemote<{ credential?: Record<string, any> | null }>({
    path: `/v1/credentials/by-id?id=${encodeURIComponent(credentialId)}`,
    method: 'GET',
    operation: 'credential-by-id',
  });

  return payload.credential ?? null;
}

export async function revokeCredentialById(credentialId: string, reason?: string) {
  const payload = await invokeCredentialsRemote<{
    found?: boolean;
    alreadyRevoked?: boolean;
    hasStatusEntry?: boolean;
    revokedAt?: string | null;
    ownerUserProfileId?: string;
  }>({
    path: '/v1/credentials/revoke',
    method: 'POST',
    operation: 'revoke',
    body: { credentialId, reason },
  });

  return {
    found: Boolean(payload.found),
    alreadyRevoked: Boolean(payload.alreadyRevoked),
    hasStatusEntry: Boolean(payload.hasStatusEntry),
    revokedAt: payload.revokedAt ?? null,
    ownerUserProfileId: payload.ownerUserProfileId,
  };
}

export async function getStatusListById(listId: string) {
  const payload = await invokeCredentialsRemote<{ statusList?: Record<string, any> | null }>({
    path: `/v1/credentials/status-list?id=${encodeURIComponent(listId)}`,
    method: 'GET',
    operation: 'status-list-by-id',
  });

  return payload.statusList ?? null;
}

export async function getIssuanceProfileByAuth0UserId(auth0UserId: string) {
  const payload = await invokeCredentialsRemote<{
    issuanceProfile?: Record<string, any> | null;
  }>({
    path: `/v1/credentials/issuance-profile?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'issuance-profile-by-auth0',
  });

  return payload.issuanceProfile ?? null;
}

export async function listActiveIdentityLinksByUserProfileId(userProfileId: string) {
  const payload = await invokeCredentialsRemote<{ links?: Array<Record<string, any>> }>({
    path: `/v1/credentials/identity-links?userProfileId=${encodeURIComponent(userProfileId)}`,
    method: 'GET',
    operation: 'identity-links-by-profile',
  });

  return payload.links || [];
}

export async function createCredentialPlaceholderRecord(params: {
  userProfileId: string;
  credentialType: string;
  holderDid: string;
}) {
  const payload = await invokeCredentialsRemote<{ id?: string }>({
    path: '/v1/credentials/create-placeholder',
    method: 'POST',
    operation: 'create-placeholder',
    body: params,
  });

  if (typeof payload.id !== 'string') {
    throw new Error(
      '[HDICR] Remote create placeholder returned an unexpected payload (fail-closed).'
    );
  }

  return payload.id;
}

export async function allocateRevocationStatusForCredential(credentialId: string): Promise<any> {
  const payload = await invokeCredentialsRemote<{ statusEntry?: Record<string, any> }>({
    path: '/v1/credentials/allocate-revocation-status',
    method: 'POST',
    operation: 'allocate-revocation-status',
    body: { credentialId },
  });

  return payload.statusEntry;
}

export async function finalizeIssuedCredentialRecord(params: {
  credentialDbId: string;
  credential: { id: string; validUntil?: string | null };
}) {
  await invokeCredentialsRemote<{ success?: boolean }>({
    path: '/v1/credentials/finalize',
    method: 'POST',
    operation: 'finalize',
    body: params,
  });
}
