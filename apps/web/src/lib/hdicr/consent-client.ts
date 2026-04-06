import { query } from '@/lib/db';
import {
  createConsentEntry,
  getConsentHistory,
  getLatestConsent,
  type ConsentPolicy,
  type CreateConsentEntryParams,
} from '@/lib/consent-ledger';
import {
  getHdicrAdapterMode,
  getHdicrRemoteBaseUrl,
  warnIfRemoteModeEnabled,
} from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('consent');

export interface ConsentGrantInput {
  actorId: string;
  consentType: string;
  scope?: Record<string, unknown>;
  requesterId: string;
  requesterType: string;
  ipAddress: string;
  userAgent: string;
}

export interface ConsentRevokeInput {
  actorId: string;
  consentId?: string;
  consentType?: string;
  projectId?: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
}

export interface ConsentCheckInput {
  actorId: string;
  consentType: string;
  projectId?: string;
}

export interface ConsentListInput {
  actorId: string;
  limit?: number;
  offset?: number;
  action?: string;
}

export interface ActorContext {
  userProfileId: string;
  actorId: string;
}

export async function resolveActorContextByAuth0UserId(
  auth0UserId: string
): Promise<ActorContext | null> {
  const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
    auth0UserId,
  ]);

  if (profileResult.rows.length === 0) {
    return null;
  }

  const actorResult = await query('SELECT id FROM actors WHERE user_profile_id = $1', [
    profileResult.rows[0].id,
  ]);

  if (actorResult.rows.length === 0) {
    return null;
  }

  return {
    userProfileId: profileResult.rows[0].id as string,
    actorId: actorResult.rows[0].id as string,
  };
}

export async function resolveActorIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const context = await resolveActorContextByAuth0UserId(auth0UserId);
  return context?.actorId || null;
}

async function grantConsentLocal(input: ConsentGrantInput) {
  const scope = (input.scope || {}) as {
    projectName?: string;
    projectDescription?: string;
  };

  const result = await query(
    `INSERT INTO consent_log (
      actor_id, action, consent_type, consent_scope,
      project_name, project_description,
      requester_id, requester_type,
      ip_address, user_agent, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.actorId,
      'granted',
      input.consentType,
      JSON.stringify(input.scope || {}),
      scope.projectName || null,
      scope.projectDescription || null,
      input.requesterId,
      input.requesterType,
      input.ipAddress,
      input.userAgent,
      JSON.stringify({
        grantedAt: new Date().toISOString(),
        source: 'api',
      }),
    ]
  );

  return result.rows[0];
}

export async function grantConsent(input: ConsentGrantInput) {
  const mode = getHdicrAdapterMode('consent');
  const baseUrl = getHdicrRemoteBaseUrl();

  if (mode === 'remote') {
    if (!baseUrl) {
      throw new Error(
        '[HDICR] Consent grant is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).'
      );
    }
    try {
      const url = new URL('/consent/grant', baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
        cache: 'no-store',
      });
      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }
      throw new Error(
        `[HDICR] Remote consent grant failed with status ${response.status} (fail-closed).`
      );
    } catch (error) {
      throw new Error(
        `[HDICR] Remote consent grant request failed (fail-closed): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return grantConsentLocal(input);
}

async function revokeConsentLocal(input: ConsentRevokeInput) {
  let result;

  if (input.consentId) {
    const original = await query(
      `SELECT * FROM consent_log WHERE id = $1 AND actor_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [input.consentId, input.actorId]
    );

    if (original.rows.length === 0) {
      return { notFound: true as const, record: null };
    }

    const originalConsent = original.rows[0];

    result = await query(
      `INSERT INTO consent_log (
        actor_id, action, consent_type, consent_scope,
        project_name, project_description,
        ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.actorId,
        'revoked',
        originalConsent.consent_type,
        originalConsent.consent_scope,
        originalConsent.project_name,
        originalConsent.project_description,
        input.ipAddress,
        input.userAgent,
        JSON.stringify({
          originalConsentId: input.consentId,
          reason: input.reason || 'User requested revocation',
          revokedAt: new Date().toISOString(),
        }),
      ]
    );
  } else if (input.consentType) {
    result = await query(
      `INSERT INTO consent_log (
        actor_id, action, consent_type, consent_scope,
        ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.actorId,
        'revoked',
        input.consentType,
        JSON.stringify({ projectId: input.projectId || null }),
        input.ipAddress,
        input.userAgent,
        JSON.stringify({
          reason: input.reason || 'User revoked all consents of this type',
          revokedAt: new Date().toISOString(),
        }),
      ]
    );
  }

  if (!result || result.rows.length === 0) {
    return { notFound: false as const, record: null };
  }

  return { notFound: false as const, record: result.rows[0] };
}

export async function revokeConsent(input: ConsentRevokeInput) {
  const mode = getHdicrAdapterMode('consent');
  const baseUrl = getHdicrRemoteBaseUrl();

  if (mode === 'remote') {
    if (!baseUrl) {
      throw new Error(
        '[HDICR] Consent revoke is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).'
      );
    }
    try {
      const url = new URL('/consent/revoke', baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
        cache: 'no-store',
      });
      if (response.ok) {
        return (await response.json()) as { notFound: boolean; record: Record<string, unknown> | null };
      }
      throw new Error(
        `[HDICR] Remote consent revoke failed with status ${response.status} (fail-closed).`
      );
    } catch (error) {
      throw new Error(
        `[HDICR] Remote consent revoke request failed (fail-closed): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return revokeConsentLocal(input);
}

export async function checkConsent(input: ConsentCheckInput) {
  let sqlQuery = `
    SELECT * FROM consent_log 
    WHERE actor_id = $1 
      AND consent_type = $2
  `;
  const queryParams: (string | number)[] = [input.actorId, input.consentType];

  if (input.projectId) {
    sqlQuery += ` AND (consent_scope->>'projectId' = $3 OR consent_scope->>'projectId' IS NULL)`;
    queryParams.push(input.projectId);
  }

  sqlQuery += ` ORDER BY created_at DESC LIMIT 1`;
  const result = await query(sqlQuery, queryParams);

  return result.rows[0] || null;
}

export async function listConsentRecords(input: ConsentListInput) {
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;

  let sqlQuery = `
    SELECT * FROM consent_log 
    WHERE actor_id = $1
  `;
  const queryParams: (string | number)[] = [input.actorId];

  if (input.action) {
    sqlQuery += ` AND action = $${queryParams.length + 1}`;
    queryParams.push(input.action);
  }

  sqlQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${
    queryParams.length + 2
  }`;
  queryParams.push(limit, offset);

  const result = await query(sqlQuery, queryParams);

  let countQuery = `SELECT COUNT(*) FROM consent_log WHERE actor_id = $1`;
  const countParams: (string | number)[] = [input.actorId];

  if (input.action) {
    countQuery += ` AND action = $2`;
    countParams.push(input.action);
  }

  const countResult = await query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count as string, 10);

  return { rows: result.rows, totalCount };
}

export async function createConsentLedgerEntry(params: CreateConsentEntryParams) {
  return createConsentEntry(params);
}

export async function getCurrentConsentLedger(actorId: string, includeHistory: boolean) {
  const current = await getLatestConsent(actorId);
  const history = includeHistory ? await getConsentHistory(actorId, 20) : [];

  let licensesOnCurrentVersion = 0;
  if (current) {
    const licenseCountResult = await query(
      'SELECT COUNT(*) as count FROM licenses WHERE consent_ledger_id = $1',
      [current.id]
    );
    licensesOnCurrentVersion = parseInt(licenseCountResult.rows[0].count as string, 10);
  }

  return {
    current,
    history,
    licensesOnCurrentVersion,
  };
}

export type { ConsentPolicy };
