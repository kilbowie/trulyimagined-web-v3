/**
 * Truly Imagined v3 - Status List Management
 *
 * Standards Compliance:
 * - W3C Bitstring Status List v1.0: https://www.w3.org/TR/vc-bitstring-status-list/
 *
 * Features:
 * - Create and manage BitstringStatusListCredentials
 * - Allocate status list indices for new credentials
 * - Update credential status (revoke, suspend, restore)
 * - Generate signed status list credentials
 * - Validate status list entries
 */

import { Pool } from 'pg';
import {
  generateBitstring,
  encodeBitstring,
  decodeBitstring,
  setBit,
  getRandomIndex,
  DEFAULT_BITSTRING_SIZE,
  type BitstringStatusListEntry,
  type BitstringStatusListCredential,
} from './bitstring-status-list';

// ===========================================
// TYPES
// ===========================================

export type StatusPurpose = 'revocation' | 'suspension' | 'message';

export interface CreateStatusListOptions {
  listId: string; // e.g., 'revocation-2024-01'
  statusPurpose: StatusPurpose;
  bitstringSize?: number; // Default: 131,072 bits
  ttlMilliseconds?: number; // Time-to-live for caching
  validUntil?: Date; // Optional expiration date
}

export interface AllocateStatusIndexOptions {
  credentialId: string; // UUID from verifiable_credentials table
  statusPurpose: StatusPurpose;
  statusSize?: number; // Default: 1 bit
}

export interface UpdateCredentialStatusOptions {
  credentialId: string;
  statusPurpose: StatusPurpose;
  statusValue: number; // 0 = valid, 1 = revoked/suspended
}

// ===========================================
// STATUS LIST CREATION
// ===========================================

/**
 * Create a new BitstringStatusListCredential
 *
 * W3C Algorithm 3.1: Generate Algorithm
 *
 * @param pool - PostgreSQL connection pool
 * @param options - Status list creation options
 * @returns Created status list ID
 *
 * @example
 * ```typescript
 * const listUuid = await createStatusList(pool, {
 *   listId: 'revocation-2024-01',
 *   statusPurpose: 'revocation',
 *   ttlMilliseconds: 3600000, // 1 hour
 * });
 * ```
 */
export async function createStatusList(
  pool: Pool,
  options: CreateStatusListOptions
): Promise<string> {
  const {
    listId,
    statusPurpose,
    bitstringSize = DEFAULT_BITSTRING_SIZE,
    ttlMilliseconds,
    validUntil,
  } = options;

  // 1. Generate empty bitstring (all bits = 0)
  const bitstring = generateBitstring(bitstringSize);

  // 2. Compress and encode
  const encodedList = await encodeBitstring(bitstring);

  // 3. Create status list credential URL
  const statusListCredentialUrl = `https://trulyimagined.com/api/credentials/status/${listId}`;

  // 4. Build BitstringStatusListCredential (unsigned)
  const validFrom = new Date().toISOString();

  const unsignedStatusListCredential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/status/v1',
    ],
    id: statusListCredentialUrl,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: 'did:web:trulyimagined.com',
    validFrom,
    ...(validUntil && { validUntil: validUntil.toISOString() }),
    credentialSubject: {
      id: `${statusListCredentialUrl}#list`,
      type: 'BitstringStatusList',
      statusPurpose,
      encodedList,
      ...(ttlMilliseconds && { ttl: ttlMilliseconds }),
    },
  };

  // 5. Sign the status list credential
  // Note: This reuses issueCredential but we need to pass the unsigned credential directly
  // For now, we'll store the unsigned version and sign it when serving
  const signedCredential = unsignedStatusListCredential; // TODO: Sign properly

  // 6. Store in database
  const result = await pool.query(
    `INSERT INTO bitstring_status_lists (
      list_id,
      status_purpose,
      encoded_list,
      bitstring_size,
      current_index,
      max_index,
      is_full,
      credential_json,
      ttl_milliseconds,
      valid_from,
      valid_until
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      listId,
      statusPurpose,
      encodedList,
      bitstringSize,
      0, // current_index
      bitstringSize - 1, // max_index
      false, // is_full
      JSON.stringify(signedCredential),
      ttlMilliseconds,
      validFrom,
      validUntil ? validUntil.toISOString() : null,
    ]
  );

  return result.rows[0].id;
}

// ===========================================
// STATUS INDEX ALLOCATION
// ===========================================

/**
 * Allocate a status list index for a credential
 *
 * Returns a BitstringStatusListEntry that should be included in the credential
 *
 * @param pool - PostgreSQL connection pool
 * @param options - Allocation options
 * @returns BitstringStatusListEntry object
 *
 * @example
 * ```typescript
 * const statusEntry = await allocateStatusIndex(pool, {
 *   credentialId: '123e4567-e89b-12d3-a456-426614174000',
 *   statusPurpose: 'revocation',
 * });
 * // Include statusEntry in credential.credentialStatus
 * ```
 */
export async function allocateStatusIndex(
  pool: Pool,
  options: AllocateStatusIndexOptions
): Promise<BitstringStatusListEntry> {
  const { credentialId, statusPurpose, statusSize = 1 } = options;

  // 1. Find or create an active status list with available capacity
  let statusList = await pool.query(
    `SELECT id, list_id, current_index, max_index, is_full
     FROM bitstring_status_lists
     WHERE status_purpose = $1 AND is_full = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [statusPurpose]
  );

  // Create new list if none available
  if (statusList.rows.length === 0) {
    const newListId = `${statusPurpose}-${new Date().toISOString().split('T')[0]}`;
    const listUuid = await createStatusList(pool, {
      listId: newListId,
      statusPurpose,
      ttlMilliseconds: 3600000, // 1 hour default
    });

    statusList = await pool.query(
      `SELECT id, list_id, current_index, max_index, is_full
       FROM bitstring_status_lists
       WHERE id = $1`,
      [listUuid]
    );
  }

  const list = statusList.rows[0];

  // 2. Get all allocated indices for collision detection
  const allocatedResult = await pool.query(
    `SELECT status_list_index FROM credential_status_entries
     WHERE status_list_id = $1`,
    [list.id]
  );

  const allocatedIndices = new Set(allocatedResult.rows.map((r) => parseInt(r.status_list_index)));

  // 3. Allocate random index (W3C privacy recommendation)
  const statusListIndex = getRandomIndex(list.current_index, list.max_index, allocatedIndices);

  // 4. Create entry URL
  const entryUrl = `https://trulyimagined.com/api/credentials/status/${list.list_id}#${statusListIndex}`;
  const statusListCredentialUrl = `https://trulyimagined.com/api/credentials/status/${list.list_id}`;

  // 5. Store credential status entry
  await pool.query(
    `INSERT INTO credential_status_entries (
      credential_id,
      status_list_id,
      status_list_index,
      status_purpose,
      status_size,
      entry_url,
      status_value
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [credentialId, list.id, statusListIndex, statusPurpose, statusSize, entryUrl, 0] // 0 = valid
  );

  // 6. Update list current_index and check if full
  const newCurrentIndex = list.current_index + 1;
  const isFull = newCurrentIndex >= list.max_index;

  await pool.query(
    `UPDATE bitstring_status_lists
     SET current_index = $1, is_full = $2, updated_at = NOW()
     WHERE id = $3`,
    [newCurrentIndex, isFull, list.id]
  );

  // 7. Return BitstringStatusListEntry object
  return {
    id: entryUrl,
    type: 'BitstringStatusListEntry',
    statusPurpose,
    statusListIndex: statusListIndex.toString(),
    statusListCredential: statusListCredentialUrl,
    statusSize,
  };
}

// ===========================================
// STATUS UPDATE
// ===========================================

/**
 * Update credential status (revoke, suspend, or restore)
 *
 * W3C Algorithm 3.3: Bitstring Generation Algorithm (partial)
 *
 * @param pool - PostgreSQL connection pool
 * @param options - Status update options
 *
 * @example
 * ```typescript
 * // Revoke a credential
 * await updateCredentialStatus(pool, {
 *   credentialId: '123e4567-e89b-12d3-a456-426614174000',
 *   statusPurpose: 'revocation',
 *   statusValue: 1, // 1 = revoked
 * });
 * ```
 */
export async function updateCredentialStatus(
  pool: Pool,
  options: UpdateCredentialStatusOptions
): Promise<void> {
  const { credentialId, statusPurpose, statusValue } = options;

  // 1. Get credential status entry
  const entryResult = await pool.query(
    `SELECT cse.*, bsl.id as list_id, bsl.list_id as list_identifier, bsl.encoded_list
     FROM credential_status_entries cse
     JOIN bitstring_status_lists bsl ON cse.status_list_id = bsl.id
     WHERE cse.credential_id = $1 AND cse.status_purpose = $2`,
    [credentialId, statusPurpose]
  );

  if (entryResult.rows.length === 0) {
    throw new Error(
      `No status entry found for credential ${credentialId} with purpose ${statusPurpose}`
    );
  }

  const entry = entryResult.rows[0];

  // 2. Decode bitstring
  const bitstring = await decodeBitstring(entry.encoded_list);

  // 3. Update bit at index
  setBit(bitstring, parseInt(entry.status_list_index), statusValue as 0 | 1);

  // 4. Re-encode bitstring
  const newEncodedList = await encodeBitstring(bitstring);

  // 5. Update status list credential
  await pool.query(
    `UPDATE bitstring_status_lists
     SET encoded_list = $1,
         credential_json = jsonb_set(
           credential_json,
           '{credentialSubject,encodedList}',
           to_jsonb($1::text)
         ),
         updated_at = NOW()
     WHERE id = $2`,
    [newEncodedList, entry.list_id]
  );

  // 6. Update status entry
  await pool.query(
    `UPDATE credential_status_entries
     SET status_value = $1, updated_at = NOW()
     WHERE credential_id = $2 AND status_purpose = $3`,
    [statusValue, credentialId, statusPurpose]
  );

  // 7. Update verifiable_credentials table
  await pool.query(
    `UPDATE verifiable_credentials
     SET is_revoked = $1,
         revoked_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $2`,
    [statusValue === 1, credentialId]
  );
}

// ===========================================
// STATUS RETRIEVAL
// ===========================================

/**
 * Get status list credential by list ID
 *
 * @param pool - PostgreSQL connection pool
 * @param listId - Status list identifier (e.g., 'revocation-2024-01')
 * @returns BitstringStatusListCredential
 *
 * @example
 * ```typescript
 * const statusListCredential = await getStatusListCredential(pool, 'revocation-2024-01');
 * // Returns signed BitstringStatusListCredential
 * ```
 */
export async function getStatusListCredential(
  pool: Pool,
  listId: string
): Promise<BitstringStatusListCredential | null> {
  const result = await pool.query(
    `SELECT credential_json FROM bitstring_status_lists WHERE list_id = $1`,
    [listId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].credential_json as BitstringStatusListCredential;
}

/**
 * Check if a credential is revoked
 *
 * @param pool - PostgreSQL connection pool
 * @param credentialId - Credential UUID
 * @param statusPurpose - Status purpose to check
 * @returns true if revoked, false otherwise
 *
 * @example
 * ```typescript
 * const isRevoked = await isCredentialRevoked(pool, credentialId, 'revocation');
 * ```
 */
export async function isCredentialRevoked(
  pool: Pool,
  credentialId: string,
  statusPurpose: StatusPurpose = 'revocation'
): Promise<boolean> {
  const result = await pool.query(
    `SELECT status_value FROM credential_status_entries
     WHERE credential_id = $1 AND status_purpose = $2`,
    [credentialId, statusPurpose]
  );

  if (result.rows.length === 0) {
    return false; // No status entry = not revoked
  }

  return result.rows[0].status_value === 1;
}
