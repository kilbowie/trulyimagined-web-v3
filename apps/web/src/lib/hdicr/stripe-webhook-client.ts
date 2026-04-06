import { query } from '@/lib/db';

export async function getStripeIdentityLinkBySessionId(sessionId: string) {
  const existingLink = await query(
    `SELECT id FROM identity_links WHERE provider_user_id = $1 AND provider = 'stripe-identity'`,
    [sessionId]
  );

  return existingLink.rows[0] || null;
}

export async function updateStripeIdentityLinkVerified(params: {
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

export async function createStripeIdentityLinkVerified(params: {
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

export async function updateStripeIdentityLinkRequiresInput(params: {
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

export async function createStripeIdentityLinkRequiresInput(params: {
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

export async function markStripeIdentityLinkCanceled(
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
