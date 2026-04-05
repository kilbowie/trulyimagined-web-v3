import { query } from '@/lib/db';
import { encryptJSON } from '@trulyimagined/utils';
import { resolveIdentity } from '@/lib/identity-resolution';
import { ensureActorRegistryId } from '@/lib/registry-id';
import { warnIfRemoteModeEnabled } from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('identity');

export async function getUserProfileIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const userResult = await query(`SELECT id FROM user_profiles WHERE auth0_user_id = $1`, [
    auth0UserId,
  ]);

  if (userResult.rows.length === 0) {
    return null;
  }

  return userResult.rows[0].id as string;
}

export async function getIdentityLinkByProviderAndProviderUser(
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

export async function reactivateIdentityLink(params: {
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

export async function unlinkIdentityById(linkId: string, userProfileId: string) {
  const result = await query(
    `UPDATE identity_links
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND user_profile_id = $2
     RETURNING provider`,
    [linkId, userProfileId]
  );

  return result.rows;
}

export async function unlinkIdentityByProvider(provider: string, userProfileId: string) {
  const result = await query(
    `UPDATE identity_links
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_profile_id = $1 AND provider = $2 AND is_active = TRUE
     RETURNING id`,
    [userProfileId, provider]
  );

  return result.rows;
}

export async function listIdentityLinks(userProfileId: string, activeOnly: boolean) {
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

export async function getActorRegistrationStatus(auth0UserId: string) {
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

export async function getIdentityResolution(auth0UserId: string) {
  const userProfileId = await getUserProfileIdByAuth0UserId(auth0UserId);
  if (!userProfileId) {
    return null;
  }

  const resolution = await resolveIdentity(userProfileId);
  return {
    userProfileId,
    resolution,
  };
}

export async function getVerificationLinksSummary(auth0UserId: string) {
  const userProfileId = await getUserProfileIdByAuth0UserId(auth0UserId);
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
