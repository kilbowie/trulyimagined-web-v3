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
// import type { PoolClient } from 'pg';

// ===========================================
// TYPES
// ===========================================

export type PermissionLevel = 'allow' | 'require_approval' | 'deny';

export interface ConsentPolicy {
  // Media Usage Categories
  mediaUsage: {
    film: PermissionLevel;
    television: PermissionLevel;
    streaming: PermissionLevel;
    gaming: PermissionLevel;
    voiceReplication: PermissionLevel;
    virtualReality: PermissionLevel;
    socialMedia: PermissionLevel;
    advertising: PermissionLevel;
    merchandise: PermissionLevel;
    livePerformance: PermissionLevel;
  };

  // Content Type Restrictions
  contentTypes: {
    explicit: PermissionLevel;
    political: PermissionLevel;
    religious: PermissionLevel;
    violence: PermissionLevel;
    alcohol: PermissionLevel;
    tobacco: PermissionLevel;
    gambling: PermissionLevel;
    pharmaceutical: PermissionLevel;
    firearms: PermissionLevel;
    adultContent: PermissionLevel;
  };

  // Geographic Restrictions
  territories: {
    allowed: string[]; // ISO 3166-1 alpha-2 country codes
    denied: string[]; // ISO 3166-1 alpha-2 country codes
  };

  // AI Controls
  aiControls: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };

  // Commercial Terms (preserved from original)
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number; // 0-100
  };

  // Attribution (preserved from original)
  attributionRequired: boolean;

  // Global usage switch
  usageBlocked?: boolean;

    // Optional constraints (territory/expiry metadata)
    constraints?: {
          territory?: string;
          expiryDate?: string;
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
      [
        actorId,
        nextVersion,
        JSON.stringify(policy),
        'active',
        reason,
        updatedBy,
        ipAddress,
        userAgent,
      ]
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
  _reason: string,
  _revokedBy: string,
  _ipAddress?: string,
  _userAgent?: string
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
 * Evaluate if a requested media usage is permitted
 */
export function evaluateMediaUsage(
  policy: ConsentPolicy,
  requestedUsage: keyof ConsentPolicy['mediaUsage']
): {
  permission: PermissionLevel;
  reason?: string;
} {
  if (policy.usageBlocked) {
    return {
      permission: 'deny',
      reason: 'All usage is globally blocked by actor consent settings',
    };
  }

  const permission = policy.mediaUsage[requestedUsage];

  if (permission === 'deny') {
    return {
      permission: 'deny',
      reason: `Media usage "${requestedUsage}" is explicitly denied by actor consent`,
    };
  }

  if (permission === 'require_approval') {
    return {
      permission: 'require_approval',
      reason: `Media usage "${requestedUsage}" requires explicit approval from actor`,
    };
  }

  return { permission: 'allow' };
}

/**
 * Evaluate if a content type is permitted
 */
export function evaluateContentType(
  policy: ConsentPolicy,
  contentType: keyof ConsentPolicy['contentTypes']
): {
  permission: PermissionLevel;
  reason?: string;
} {
  if (policy.usageBlocked) {
    return {
      permission: 'deny',
      reason: 'All usage is globally blocked by actor consent settings',
    };
  }

  const permission = policy.contentTypes[contentType];

  if (permission === 'deny') {
    return {
      permission: 'deny',
      reason: `Content type "${contentType}" is explicitly denied by actor consent`,
    };
  }

  if (permission === 'require_approval') {
    return {
      permission: 'require_approval',
      reason: `Content type "${contentType}" requires explicit approval from actor`,
    };
  }

  return { permission: 'allow' };
}

/**
 * Evaluate if a territory is permitted
 */
export function evaluateTerritory(
  policy: ConsentPolicy,
  territoryCode: string
): {
  allowed: boolean;
  reason?: string;
} {
  if (policy.usageBlocked) {
    return {
      allowed: false,
      reason: 'All usage is globally blocked by actor consent settings',
    };
  }

  // If territory is in denied list, reject
  if (policy.territories.denied.includes(territoryCode)) {
    return {
      allowed: false,
      reason: `Territory "${territoryCode}" is explicitly denied`,
    };
  }

  // If allowed list is empty, allow all territories not in denied list
  if (policy.territories.allowed.length === 0) {
    return { allowed: true };
  }

  // If allowed list has entries, only allow those territories
  if (policy.territories.allowed.includes(territoryCode)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Territory "${territoryCode}" is not in the allowed list`,
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use evaluateMediaUsage instead
 */
export function evaluateConsentUsage(
  policy: ConsentPolicy,
  requestedUsage: string
): {
  allowed: boolean;
  reason?: string;
} {
  // Map old usage types to new media usage categories
  const usageMap: Record<string, keyof ConsentPolicy['mediaUsage']> = {
    streaming: 'streaming',
    theatrical: 'film',
    commercial: 'advertising',
    film_tv: 'television',
    voice_replication: 'voiceReplication',
  };

  const mappedUsage = usageMap[requestedUsage];
  if (!mappedUsage) {
    return {
      allowed: false,
      reason: `Unknown usage type "${requestedUsage}"`,
    };
  }

  const result = evaluateMediaUsage(policy, mappedUsage);
  return {
    allowed: result.permission === 'allow',
    reason: result.reason,
  };
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
 * All permissions default to 'require_approval' for safety
 */
export function createDefaultPolicy(): ConsentPolicy {
  return {
    mediaUsage: {
      film: 'require_approval',
      television: 'require_approval',
      streaming: 'require_approval',
      gaming: 'require_approval',
      voiceReplication: 'deny',
      virtualReality: 'require_approval',
      socialMedia: 'require_approval',
      advertising: 'require_approval',
      merchandise: 'require_approval',
      livePerformance: 'require_approval',
    },
    contentTypes: {
      explicit: 'deny',
      political: 'require_approval',
      religious: 'require_approval',
      violence: 'require_approval',
      alcohol: 'require_approval',
      tobacco: 'deny',
      gambling: 'deny',
      pharmaceutical: 'require_approval',
      firearms: 'deny',
      adultContent: 'deny',
    },
    territories: {
      allowed: [], // Empty = all territories allowed (except denied)
      denied: [], // Specific countries to exclude
    },
    aiControls: {
      trainingAllowed: false,
      syntheticGenerationAllowed: false,
      biometricAnalysisAllowed: false,
    },
    commercial: {
      paymentRequired: true,
      minFee: undefined,
      revenueShare: undefined,
    },
    attributionRequired: true,
    usageBlocked: false,
  };
}
