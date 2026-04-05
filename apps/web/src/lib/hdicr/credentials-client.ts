import { pool } from '@/lib/db';
import { getStatusListCredential, updateCredentialStatus } from '@/lib/status-list-manager';

export async function getUserProfileByAuth0UserId(auth0UserId: string) {
  const profileResult = await pool.query(`SELECT id, role FROM user_profiles WHERE auth0_user_id = $1`, [
    auth0UserId,
  ]);

  return profileResult.rows[0] || null;
}

export async function listCredentialsByProfileId(options: {
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
  return result.rows;
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
    return { found: true as const, alreadyRevoked: true as const, hasStatusEntry: false, revokedAt: null };
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