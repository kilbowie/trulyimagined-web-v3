import { pool } from '@/lib/db';
import { getStatusListCredential, updateCredentialStatus } from '@/lib/status-list-manager';
import { allocateStatusIndex } from '@/lib/status-list-manager';
import { encryptJSON } from '@trulyimagined/utils';
import {
  getHdicrAdapterMode,
  getHdicrRemoteBaseUrl,
  warnIfRemoteModeEnabled,
} from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('credentials');

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

async function listCredentialsByProfileIdLocal(options: {
  userProfileId: string;
  includeRevoked: boolean;
  includeExpired: boolean;
}) {
  let sql = `
    SELECT
      id,
      credential_type,
      credential_json,
      issuer_did,
      holder_did,
      issued_at,
      expires_at,
      is_revoked,
      revoked_at,
      revocation_reason,
      verification_method,
      proof_type
    FROM verifiable_credentials
    WHERE user_profile_id = $1
  `;

  if (!options.includeRevoked) {
    sql += ' AND is_revoked = FALSE';
  }

  if (!options.includeExpired) {
    sql += ' AND (expires_at IS NULL OR expires_at > NOW())';
  }

  sql += ' ORDER BY issued_at DESC';

  const result = await pool.query(sql, [options.userProfileId]);
  return result.rows as CredentialListRow[];
}

export async function getUserProfileByAuth0UserId(auth0UserId: string) {
  const profileResult = await pool.query(
    `SELECT id, role FROM user_profiles WHERE auth0_user_id = $1`,
    [auth0UserId]
  );

  return profileResult.rows[0] || null;
}

export async function listCredentialsByProfileId(options: {
  userProfileId: string;
  includeRevoked: boolean;
  includeExpired: boolean;
}) {
  const mode = getHdicrAdapterMode('credentials');
  const baseUrl = getHdicrRemoteBaseUrl();

  if (mode === 'remote' && baseUrl) {
    try {
      const url = new URL('/credentials/list', baseUrl);
      url.searchParams.set('userProfileId', options.userProfileId);
      url.searchParams.set('includeRevoked', String(options.includeRevoked));
      url.searchParams.set('includeExpired', String(options.includeExpired));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          rows?: CredentialListRow[];
          credentials?: Array<Record<string, unknown>>;
        };

        if (Array.isArray(payload.rows)) {
          return payload.rows;
        }

        if (Array.isArray(payload.credentials)) {
          return payload.credentials.map(mapRemoteCredentialToRow).filter(Boolean) as CredentialListRow[];
        }

        console.warn(
          '[HDICR] Remote credentials list returned an unexpected payload. Falling back to local adapter.'
        );
      } else {
        console.warn(
          `[HDICR] Remote credentials list failed with status ${response.status}. Falling back to local adapter.`
        );
      }
    } catch (error) {
      console.warn('[HDICR] Remote credentials list request failed. Falling back to local adapter.', error);
    }
  }

  return listCredentialsByProfileIdLocal(options);
}

export async function getCredentialById(credentialId: string) {
  const credentialResult = await pool.query(
    `SELECT
      id,
      user_profile_id,
      credential_type,
      credential_json,
      issuer_did,
      holder_did,
      issued_at,
      expires_at,
      is_revoked,
      revoked_at,
      revocation_reason,
      verification_method,
      proof_type
    FROM verifiable_credentials
    WHERE id = $1`,
    [credentialId]
  );

  return credentialResult.rows[0] || null;
}

export async function revokeCredentialById(credentialId: string, reason?: string) {
  const credential = await pool.query(
    `SELECT user_profile_id, is_revoked, credential_type
     FROM verifiable_credentials
     WHERE id = $1`,
    [credentialId]
  );

  if (credential.rows.length === 0) {
    return { found: false as const, alreadyRevoked: false, hasStatusEntry: false, revokedAt: null };
  }

  const credentialRow = credential.rows[0];

  if (credentialRow.is_revoked) {
    return {
      found: true as const,
      alreadyRevoked: true as const,
      hasStatusEntry: false,
      revokedAt: null,
    };
  }

  const statusEntryResult = await pool.query(
    `SELECT id FROM credential_status_entries WHERE credential_id = $1 AND status_purpose = 'revocation'`,
    [credentialId]
  );

  const hasStatusEntry = statusEntryResult.rows.length > 0;

  if (hasStatusEntry) {
    await updateCredentialStatus(pool, {
      credentialId,
      statusPurpose: 'revocation',
      statusValue: 1,
    });
  } else {
    await pool.query(
      `UPDATE verifiable_credentials
       SET is_revoked = true, revoked_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [credentialId]
    );
  }

  if (reason) {
    await pool.query(
      `UPDATE verifiable_credentials
       SET revocation_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [reason, credentialId]
    );
  }

  const updatedResult = await pool.query(
    `SELECT revoked_at, user_profile_id FROM verifiable_credentials WHERE id = $1`,
    [credentialId]
  );

  return {
    found: true as const,
    alreadyRevoked: false,
    hasStatusEntry,
    revokedAt: updatedResult.rows[0]?.revoked_at || null,
    ownerUserProfileId: updatedResult.rows[0]?.user_profile_id as string,
  };
}

export async function getStatusListById(listId: string) {
  return getStatusListCredential(pool, listId);
}

export async function getIssuanceProfileByAuth0UserId(auth0UserId: string) {
  const profileResult = await pool.query(
    `SELECT
      up.id,
      up.auth0_user_id,
      up.email,
      up.username,
      up.legal_name,
      up.professional_name,
      up.role,
      up.profile_completed,
      COALESCE(up.is_verified, FALSE) AS is_verified,
      a.id AS actor_id,
      a.verification_status AS actor_verification_status,
      a.verified_at AS actor_verified_at
    FROM user_profiles up
    LEFT JOIN actors a ON a.auth0_user_id = up.auth0_user_id
    WHERE up.auth0_user_id = $1`,
    [auth0UserId]
  );

  return profileResult.rows[0] || null;
}

export async function listActiveIdentityLinksByUserProfileId(userProfileId: string) {
  const linksResult = await pool.query(
    `SELECT
      provider,
      verification_level,
      assurance_level,
      verified_at,
      is_active
    FROM identity_links
    WHERE user_profile_id = $1
      AND is_active = TRUE
    ORDER BY verified_at DESC`,
    [userProfileId]
  );

  return linksResult.rows;
}

export async function createCredentialPlaceholderRecord(params: {
  userProfileId: string;
  credentialType: string;
  holderDid: string;
}) {
  const preInsertResult = await pool.query(
    `INSERT INTO verifiable_credentials (
      user_profile_id,
      credential_type,
      credential_json,
      issuer_did,
      holder_did,
      issued_at,
      verification_method,
      proof_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      params.userProfileId,
      params.credentialType,
      {},
      'did:web:trulyimagined.com',
      params.holderDid,
      new Date().toISOString(),
      'did:web:trulyimagined.com#key-1',
      'Ed25519Signature2020',
    ]
  );

  return preInsertResult.rows[0]?.id as string;
}

export async function allocateRevocationStatusForCredential(credentialId: string) {
  return allocateStatusIndex(pool, {
    credentialId,
    statusPurpose: 'revocation',
    statusSize: 1,
  });
}

export async function finalizeIssuedCredentialRecord(params: {
  credentialDbId: string;
  credential: { id: string; validUntil?: string | null };
}) {
  const encryptedCredential = encryptJSON(params.credential);
  const encryptedCredentialJson = JSON.stringify(encryptedCredential);

  await pool.query(
    `UPDATE verifiable_credentials
     SET credential_json = $1,
         credential_id = $2,
         expires_at = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [
      encryptedCredentialJson,
      params.credential.id,
      params.credential.validUntil || null,
      params.credentialDbId,
    ]
  );
}
