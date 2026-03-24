/**
 * Licensing Library
 *
 * Server-side actions for managing actor licenses to API clients.
 *
 * Core Principles:
 * - Licenses capture a snapshot of consent policy at issuance time
 * - Even if actor updates consent, existing licenses retain original terms
 * - Licenses can be revoked by actor or admin
 * - Licenses can expire based on time or usage limits
 */

import { pool } from '@/lib/db';
import type { ConsentPolicy } from './consent-ledger';

// ===========================================
// TYPES
// ===========================================

export interface License {
  id: string;
  actor_id: string;
  api_client_id: string;
  consent_ledger_id: string;
  license_type: string;
  granted_permissions_snapshot: ConsentPolicy;
  status: 'active' | 'revoked' | 'expired' | 'suspended';
  revocation_reason?: string;
  revoked_at?: Date;
  revoked_by?: string;
  issued_at: Date;
  expires_at?: Date;
  first_used_at?: Date;
  last_used_at?: Date;
  usage_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLicenseParams {
  actorId: string;
  apiClientId: string;
  consentLedgerId: string;
  licenseType: string;
  grantedPermissionsSnapshot: ConsentPolicy;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface APIClient {
  id: string;
  name: string;
  description?: string;
  website_url?: string;
  public_key: string;
  api_key_hash: string;
  credential_status: 'unverified' | 'pending' | 'verified' | 'suspended' | 'revoked';
  verified_at?: Date;
  verified_by?: string;
  contact_email: string;
  contact_name?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ===========================================
// LICENSE OPERATIONS
// ===========================================

/**
 * Create a new license
 *
 * This captures the current consent policy as a snapshot.
 */
export async function createLicense(params: CreateLicenseParams): Promise<License> {
  const {
    actorId,
    apiClientId,
    consentLedgerId,
    licenseType,
    grantedPermissionsSnapshot,
    expiresAt,
    metadata = {},
  } = params;

  const result = await pool.query<License>(
    `INSERT INTO licenses (
      actor_id,
      api_client_id,
      consent_ledger_id,
      license_type,
      granted_permissions_snapshot,
      expires_at,
      metadata,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      actorId,
      apiClientId,
      consentLedgerId,
      licenseType,
      JSON.stringify(grantedPermissionsSnapshot),
      expiresAt,
      JSON.stringify(metadata),
      'active',
    ]
  );

  return result.rows[0];
}

/**
 * Revoke a license
 */
export async function revokeLicense(
  licenseId: string,
  reason: string,
  revokedBy: string
): Promise<void> {
  await pool.query(
    `UPDATE licenses
     SET status = 'revoked',
         revocation_reason = $1,
         revoked_at = NOW(),
         revoked_by = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [reason, revokedBy, licenseId]
  );
}

/**
 * Get active license for actor + API client
 */
export async function getActiveLicense(
  actorId: string,
  apiClientId: string
): Promise<License | null> {
  const result = await pool.query<License>(
    `SELECT * FROM licenses
     WHERE actor_id = $1
       AND api_client_id = $2
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY issued_at DESC
     LIMIT 1`,
    [actorId, apiClientId]
  );

  return result.rows[0] || null;
}

/**
 * Get all licenses for an actor
 */
export async function getActorLicenses(
  actorId: string,
  statusFilter?: License['status']
): Promise<License[]> {
  let query = `
    SELECT l.*, ac.name as api_client_name, ac.credential_status
    FROM licenses l
    JOIN api_clients ac ON l.api_client_id = ac.id
    WHERE l.actor_id = $1
  `;
  const params: unknown[] = [actorId];

  if (statusFilter) {
    query += ' AND l.status = $2';
    params.push(statusFilter);
  }

  query += ' ORDER BY l.issued_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Record license usage
 */
export async function recordLicenseUsage(licenseId: string): Promise<void> {
  await pool.query(
    `UPDATE licenses
     SET usage_count = usage_count + 1,
         last_used_at = NOW(),
         first_used_at = COALESCE(first_used_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [licenseId]
  );
}

/**
 * Check if license is expired
 */
export function isLicenseExpired(license: License): boolean {
  if (!license.expires_at) return false;
  return new Date(license.expires_at) < new Date();
}

/**
 * Get license statistics for an actor
 */
export async function getLicenseStats(actorId: string): Promise<{
  total: number;
  active: number;
  revoked: number;
  expired: number;
  suspended: number;
}> {
  const result = await pool.query<{
    status: string;
    count: string;
  }>(
    `SELECT status, COUNT(*) as count
     FROM licenses
     WHERE actor_id = $1
     GROUP BY status`,
    [actorId]
  );

  const stats = {
    total: 0,
    active: 0,
    revoked: 0,
    expired: 0,
    suspended: 0,
  };

  result.rows.forEach((row) => {
    const count = parseInt(row.count, 10);
    stats.total += count;
    if (row.status === 'active') stats.active = count;
    else if (row.status === 'revoked') stats.revoked = count;
    else if (row.status === 'expired') stats.expired = count;
    else if (row.status === 'suspended') stats.suspended = count;
  });

  return stats;
}

// ===========================================
// API CLIENT OPERATIONS
// ===========================================

/**
 * Get API client by ID
 */
export async function getAPIClient(clientId: string): Promise<APIClient | null> {
  const result = await pool.query<APIClient>(
    'SELECT * FROM api_clients WHERE id = $1 AND deleted_at IS NULL',
    [clientId]
  );

  return result.rows[0] || null;
}

/**
 * Verify API client is in good standing
 */
export async function isAPIClientVerified(clientId: string): Promise<boolean> {
  const client = await getAPIClient(clientId);
  return client?.credential_status === 'verified';
}

/**
 * Get all verified API clients
 */
export async function getVerifiedAPIClients(): Promise<APIClient[]> {
  const result = await pool.query<APIClient>(
    `SELECT * FROM api_clients
     WHERE credential_status = 'verified'
       AND deleted_at IS NULL
     ORDER BY name ASC`
  );

  return result.rows;
}

// ===========================================
// LICENSE USAGE LOG
// ===========================================

export interface LicenseUsageLogEntry {
  id: string;
  license_id: string;
  api_client_id: string;
  actor_id: string;
  endpoint?: string;
  method?: string;
  requested_usage_type?: string;
  decision: 'allow' | 'deny' | 'conditional';
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  request_metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Log license usage decision
 */
export async function logLicenseUsage(
  licenseId: string,
  apiClientId: string,
  actorId: string,
  decision: 'allow' | 'deny' | 'conditional',
  options: {
    endpoint?: string;
    method?: string;
    requestedUsageType?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    requestMetadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO license_usage_log (
      license_id,
      api_client_id,
      actor_id,
      endpoint,
      method,
      requested_usage_type,
      decision,
      reason,
      ip_address,
      user_agent,
      request_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      licenseId,
      apiClientId,
      actorId,
      options.endpoint,
      options.method,
      options.requestedUsageType,
      decision,
      options.reason,
      options.ipAddress,
      options.userAgent,
      JSON.stringify(options.requestMetadata || {}),
    ]
  );
}

/**
 * Get usage log for a license
 */
export async function getLicenseUsageLog(
  licenseId: string,
  limit: number = 100
): Promise<LicenseUsageLogEntry[]> {
  const result = await pool.query<LicenseUsageLogEntry>(
    `SELECT * FROM license_usage_log
     WHERE license_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [licenseId, limit]
  );

  return result.rows;
}
