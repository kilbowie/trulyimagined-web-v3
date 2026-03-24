/**
 * Consent Ledger Library
 * 
 * Server-side actions for managing immutable consent policies.
 * 
 * Core Principles:
 * - consent_ledger is append-only (never UPDATE existing entries)
 * - Each actor has versioned consent entries (1, 2, 3, ...)
 * - Only one "active" entry per actor at any time
 * - Previous entries are marked "superseded"
 * - Revocation creates a new "revoked" entry
 */

import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// ===========================================
// TYPES
// ===========================================

export interface ConsentPolicy {
  usage: {
    film_tv: boolean;
    advertising: boolean;
    ai_training: boolean;
    synthetic_media: boolean;
    voice_replication: boolean;
  };
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number; // 0-100
  };
  constraints: {
    duration?: number; // days
    expiryDate?: string; // ISO 8601
    territory?: string[]; // country codes
  };
  attributionRequired: boolean;
  aiControls: {
    trainingAllowed: boolean;
    likenessGenerationAllowed: boolean;
    voiceCloningAllowed: boolean;
  };
}

export interface ConsentLedgerEntry {
  id: string;
  actor_id: string;
  version: number;
  policy: ConsentPolicy;
  status: 'active' | 'superseded' | 'revoked';
  reason?: string;
  updated_by?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateConsentEntryParams {
  actorId: string;
  policy: ConsentPolicy;
  reason?: string;
  updatedBy: string; // user_profile_id
  ipAddress?: string;
  userAgent?: string;
}

// ===========================================
// CONSENT LEDGER OPERATIONS
// ===========================================

/**
 * Create a new consent entry
 * 
 * This function:
 * 1. Gets the next version number
 * 2. Marks the previous "active" entry as "superseded"
 * 3. Inserts the new entry as "active"
 * 
 * All operations are transactional.
 */
export async function createConsentEntry(
  params: CreateConsentEntryParams
): Promise<ConsentLedgerEntry> {
  const { actorId, policy, reason, updatedBy, ipAddress, userAgent } = params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get next version number
    const versionResult = await client.query<{ get_next_consent_version: number }>(
      'SELECT get_next_consent_version($1) as get_next_consent_version',
      [actorId]
    );
    const nextVersion = versionResult.rows[0].get_next_consent_version;

    // 2. Mark previous active entry as superseded
    await client.query(
      `UPDATE consent_ledger 
       SET status = 'superseded' 
       WHERE actor_id = $1 AND status = 'active'`,
      [actorId]
    );

    // 3. Insert new active entry
    const insertResult = await client.query<ConsentLedgerEntry>(
      `INSERT INTO consent_ledger (
        actor_id,
        version,
        policy,
        status,
        reason,
        updated_by,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [actorId, nextVersion, JSON.stringify(policy), 'active', reason, updatedBy, ipAddress, userAgent]
    );

    await client.query('COMMIT');

    return insertResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revoke current active consent
 * 
 * This marks the current "active" entry as "revoked".
 * No new entry is created - the actor has no active consent.
 */
export async function revokeConsentEntry(
  actorId: string,
  reason: string,
  revokedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Mark current active as revoked
    await client.query(
      `UPDATE consent_ledger 
       SET status = 'revoked'
       WHERE actor_id = $1 AND status = 'active'`,
      [actorId]
    );

    // Optional: Create a new version with revoked status if you want explicit versioning
    // Uncomment if you prefer explicit revocation entries:
    /*
    const versionResult = await client.query<{ get_next_consent_version: number }>(
      'SELECT get_next_consent_version($1) as get_next_consent_version',
      [actorId]
    );
    const nextVersion = versionResult.rows[0].get_next_consent_version;

    await client.query(
      `INSERT INTO consent_ledger (
        actor_id,
        version,
        policy,
        status,
        reason,
        updated_by,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [actorId, nextVersion, '{}', 'revoked', reason, revokedBy, ipAddress, userAgent]
    );
    */

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get latest active consent for an actor
 */
export async function getLatestConsent(actorId: string): Promise<ConsentLedgerEntry | null> {
  const result = await pool.query<ConsentLedgerEntry>(
    `SELECT * FROM consent_ledger
     WHERE actor_id = $1 AND status = 'active'
     ORDER BY version DESC
     LIMIT 1`,
    [actorId]
  );

  return result.rows[0] || null;
}

/**
 * Get consent history for an actor
 */
export async function getConsentHistory(
  actorId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ConsentLedgerEntry[]> {
  const result = await pool.query<ConsentLedgerEntry>(
    `SELECT * FROM consent_ledger
     WHERE actor_id = $1
     ORDER BY version DESC
     LIMIT $2 OFFSET $3`,
    [actorId, limit, offset]
  );

  return result.rows;
}

/**
 * Get specific consent version
 */
export async function getConsentVersion(
  actorId: string,
  version: number
): Promise<ConsentLedgerEntry | null> {
  const result = await pool.query<ConsentLedgerEntry>(
    `SELECT * FROM consent_ledger
     WHERE actor_id = $1 AND version = $2
     LIMIT 1`,
    [actorId, version]
  );

  return result.rows[0] || null;
}

// ===========================================
// CONSENT EVALUATION
// ===========================================

/**
 * Evaluate if a requested usage is allowed by current consent
 */
export function evaluateConsentUsage(
  policy: ConsentPolicy,
  requestedUsage: keyof ConsentPolicy['usage']
): {
  allowed: boolean;
  reason?: string;
} {
  if (!policy.usage[requestedUsage]) {
    return {
      allowed: false,
      reason: `Usage type "${requestedUsage}" is not permitted by actor consent`,
    };
  }

  // Check expiry if present
  if (policy.constraints.expiryDate) {
    const expiryDate = new Date(policy.constraints.expiryDate);
    if (expiryDate < new Date()) {
      return {
        allowed: false,
        reason: 'Consent has expired',
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if payment is required for a usage type
 */
export function isPaymentRequired(policy: ConsentPolicy): boolean {
  return policy.commercial?.paymentRequired || false;
}

/**
 * Get minimum fee from policy
 */
export function getMinimumFee(policy: ConsentPolicy): number | undefined {
  return policy.commercial?.minFee;
}

// ===========================================
// DEFAULT POLICY
// ===========================================

/**
 * Create a default restrictive policy
 */
export function createDefaultPolicy(): ConsentPolicy {
  return {
    usage: {
      film_tv: false,
      advertising: false,
      ai_training: false,
      synthetic_media: false,
      voice_replication: false,
    },
    commercial: {
      paymentRequired: true,
      minFee: undefined,
      revenueShare: undefined,
    },
    constraints: {
      duration: undefined,
      expiryDate: undefined,
      territory: [],
    },
    attributionRequired: true,
    aiControls: {
      trainingAllowed: false,
      likenessGenerationAllowed: false,
      voiceCloningAllowed: false,
    },
  };
}
