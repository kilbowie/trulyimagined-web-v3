import { query } from '@/lib/db';
import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';
import { getHdicrAdapterMode, warnIfRemoteModeEnabled } from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('payments');

function isPaymentsRemoteMode() {
  return getHdicrAdapterMode('payments') === 'remote';
}

async function invokePaymentsRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  const baseUrl = getHdicrRemoteBaseUrlOrThrow('payments', params.operation);
  return invokeHdicrRemote<T>({
    domain: 'payments',
    baseUrl,
    ...params,
  });
}

async function getStripeIdentityLinkBySessionIdLocal(sessionId: string) {
  const existingLink = await query(
    `SELECT id FROM identity_links WHERE provider_user_id = $1 AND provider = 'stripe-identity'`,
    [sessionId]
  );

  return existingLink.rows[0] || null;
}

export async function getStripeIdentityLinkBySessionId(sessionId: string) {
  if (isPaymentsRemoteMode()) {
    const payload = await invokePaymentsRemote<{ link?: { id?: string } | null; id?: string }>({
      path: `/payments/stripe/identity-link/by-session?sessionId=${encodeURIComponent(sessionId)}`,
      method: 'GET',
      operation: 'stripe-identity-link-by-session',
    });

    if (payload.link !== undefined) {
      return payload.link;
    }

    return payload.id ? { id: payload.id } : null;
  }

  return getStripeIdentityLinkBySessionIdLocal(sessionId);
}

async function updateStripeIdentityLinkVerifiedLocal(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
  await query(
    `UPDATE identity_links
     SET verification_level = $1,
         assurance_level = $2,
         credential_data = $3,
         metadata = $4,
         verified_at = $5,
         last_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $6`,
    [
      params.verificationLevel,
      params.assuranceLevel,
      params.encryptedCredentialData,
      JSON.stringify(params.metadata),
      params.verifiedAt,
      params.linkId,
    ]
  );
}

export async function updateStripeIdentityLinkVerified(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
  if (isPaymentsRemoteMode()) {
    await invokePaymentsRemote<{ success?: boolean }>({
      path: '/payments/stripe/identity-link/update-verified',
      method: 'POST',
      operation: 'stripe-identity-link-update-verified',
      body: params,
    });
    return;
  }

  await updateStripeIdentityLinkVerifiedLocal(params);
}

async function createStripeIdentityLinkVerifiedLocal(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
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
      last_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id`,
    [
      params.userProfileId,
      'stripe-identity',
      params.sessionId,
      'kyc',
      params.verificationLevel,
      params.assuranceLevel,
      params.encryptedCredentialData,
      JSON.stringify(params.metadata),
      params.verifiedAt,
    ]
  );

  return result.rows[0] || null;
}

export async function createStripeIdentityLinkVerified(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
  if (isPaymentsRemoteMode()) {
    return invokePaymentsRemote<{ id?: string } | null>({
      path: '/payments/stripe/identity-link/create-verified',
      method: 'POST',
      operation: 'stripe-identity-link-create-verified',
      body: params,
    });
  }

  return createStripeIdentityLinkVerifiedLocal(params);
}

async function updateStripeIdentityLinkRequiresInputLocal(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  metadata: Record<string, unknown>;
}) {
  await query(
    `UPDATE identity_links
     SET verification_level = $1,
         assurance_level = $2,
         metadata = $3,
         last_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [
      params.verificationLevel,
      params.assuranceLevel,
      JSON.stringify(params.metadata),
      params.linkId,
    ]
  );
}

export async function updateStripeIdentityLinkRequiresInput(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  metadata: Record<string, unknown>;
}) {
  if (isPaymentsRemoteMode()) {
    await invokePaymentsRemote<{ success?: boolean }>({
      path: '/payments/stripe/identity-link/update-requires-input',
      method: 'POST',
      operation: 'stripe-identity-link-update-requires-input',
      body: params,
    });
    return;
  }

  await updateStripeIdentityLinkRequiresInputLocal(params);
}

async function createStripeIdentityLinkRequiresInputLocal(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO identity_links (
      user_profile_id,
      provider,
      provider_user_id,
      provider_type,
      verification_level,
      assurance_level,
      credential_data,
      metadata,
      last_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      params.userProfileId,
      'stripe-identity',
      params.sessionId,
      'kyc',
      params.verificationLevel,
      params.assuranceLevel,
      params.encryptedCredentialData,
      JSON.stringify(params.metadata),
    ]
  );
}

export async function createStripeIdentityLinkRequiresInput(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
}) {
  if (isPaymentsRemoteMode()) {
    await invokePaymentsRemote<{ success?: boolean }>({
      path: '/payments/stripe/identity-link/create-requires-input',
      method: 'POST',
      operation: 'stripe-identity-link-create-requires-input',
      body: params,
    });
    return;
  }

  await createStripeIdentityLinkRequiresInputLocal(params);
}

async function markStripeIdentityLinkCanceledLocal(
  linkId: string,
  metadata: Record<string, unknown>
) {
  await query(
    `UPDATE identity_links
     SET is_active = FALSE,
         metadata = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(metadata), linkId]
  );
}

export async function markStripeIdentityLinkCanceled(
  linkId: string,
  metadata: Record<string, unknown>
) {
  if (isPaymentsRemoteMode()) {
    await invokePaymentsRemote<{ success?: boolean }>({
      path: '/payments/stripe/identity-link/mark-canceled',
      method: 'POST',
      operation: 'stripe-identity-link-mark-canceled',
      body: { linkId, metadata },
    });
    return;
  }

  await markStripeIdentityLinkCanceledLocal(linkId, metadata);
}
