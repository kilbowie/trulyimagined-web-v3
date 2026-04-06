import { query } from '@/lib/db';
import { getActorLicenses, getLicenseStats } from '@/lib/licensing';
import {
  getHdicrAdapterMode,
  getHdicrRemoteBaseUrl,
  warnIfRemoteModeEnabled,
} from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('licensing');

function isLicensingRemoteMode() {
  return getHdicrAdapterMode('licensing') === 'remote';
}

function getLicensingRemoteBaseUrlOrThrow(operation: string) {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Licensing ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

async function invokeLicensingRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  const baseUrl = getLicensingRemoteBaseUrlOrThrow(params.operation);
  const url = new URL(params.path, baseUrl);

  const response = await fetch(url.toString(), {
    method: params.method,
    headers: {
      Accept: 'application/json',
      ...(params.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `[HDICR] Remote licensing ${params.operation} failed with status ${response.status} (fail-closed).`
    );
  }

  return (await response.json()) as T;
}

export async function resolveActorIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{ actorId?: string | null }>({
      path: `/licensing/actor-id?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'actor-id-resolve',
    });

    return payload.actorId ?? null;
  }

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

  return actorResult.rows[0].id as string;
}

export async function listActorLicensingRequests(actorId: string, status?: string) {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{
      requests?: Array<Record<string, unknown>>;
      pendingCount?: number;
    }>({
      path:
        `/licensing/actor-requests?actorId=${encodeURIComponent(actorId)}` +
        `${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      method: 'GET',
      operation: 'actor-requests-list',
    });

    return {
      requests: payload.requests || [],
      pendingCount: payload.pendingCount || 0,
    };
  }

  const validStatuses = ['pending', 'approved', 'rejected', 'expired'];

  let sql: string;
  let params: unknown[];

  if (status && validStatuses.includes(status)) {
    sql = `SELECT
             id,
             requester_name,
             requester_email,
             requester_organization,
             project_name,
             project_description,
             usage_type,
             intended_use,
             duration_start,
             duration_end,
             compensation_offered,
             compensation_currency,
             status,
             approved_at,
             rejected_at,
             rejection_reason,
             created_at,
             updated_at
           FROM licensing_requests
           WHERE actor_id = $1
             AND status = $2
           ORDER BY created_at DESC
           LIMIT 100`;
    params = [actorId, status];
  } else {
    sql = `SELECT
             id,
             requester_name,
             requester_email,
             requester_organization,
             project_name,
             project_description,
             usage_type,
             intended_use,
             duration_start,
             duration_end,
             compensation_offered,
             compensation_currency,
             status,
             approved_at,
             rejected_at,
             rejection_reason,
             created_at,
             updated_at
           FROM licensing_requests
           WHERE actor_id = $1
           ORDER BY created_at DESC
           LIMIT 100`;
    params = [actorId];
  }

  const requestsResult = await query(sql, params);
  const pendingCountResult = await query(
    `SELECT COUNT(*) AS count FROM licensing_requests WHERE actor_id = $1 AND status = 'pending'`,
    [actorId]
  );

  return {
    requests: requestsResult.rows,
    pendingCount: parseInt(pendingCountResult.rows[0].count as string, 10) || 0,
  };
}

export async function getLicensingRequestById(requestId: string) {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{ request?: Record<string, unknown> | null }>({
      path: `/licensing/request?id=${encodeURIComponent(requestId)}`,
      method: 'GET',
      operation: 'request-by-id',
    });

    return payload.request ?? null;
  }

  const existing = await query(
    `SELECT id, actor_id, status, requester_name, project_name
     FROM licensing_requests
     WHERE id = $1
     LIMIT 1`,
    [requestId]
  );

  return existing.rows[0] || null;
}

async function applyLicensingDecisionLocal(
  requestId: string,
  actorId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
) {
  if (action === 'approve') {
    const result = await query(
      `UPDATE licensing_requests
       SET status = 'approved',
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND actor_id = $2
         AND status = 'pending'
       RETURNING *`,
      [requestId, actorId]
    );
    return result.rows[0] || null;
  }

  const result = await query(
    `UPDATE licensing_requests
     SET status = 'rejected',
         rejected_at = NOW(),
         rejection_reason = $3,
         updated_at = NOW()
     WHERE id = $1
       AND actor_id = $2
       AND status = 'pending'
     RETURNING *`,
    [requestId, actorId, rejectionReason?.trim() || null]
  );
  return result.rows[0] || null;
}

export async function applyLicensingDecision(
  requestId: string,
  actorId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
) {
  if (isLicensingRemoteMode()) {
    try {
      const payload = await invokeLicensingRemote<{ decision?: Record<string, unknown> | null }>({
        path: '/licensing/decision',
        method: 'POST',
        operation: 'decision',
        body: { requestId, actorId, action, rejectionReason },
      });

      if (payload.decision !== undefined) {
        return payload.decision;
      }

      return payload as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `[HDICR] Remote licensing decision request failed (fail-closed): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return applyLicensingDecisionLocal(requestId, actorId, action, rejectionReason);
}

export async function getActorLicensesAndStats(actorId: string, statusFilter?: string) {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{
      licenses?: Array<Record<string, unknown>>;
      stats?: Record<string, unknown>;
    }>({
      path:
        `/licensing/actor/licenses-and-stats?actorId=${encodeURIComponent(actorId)}` +
        `${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}`,
      method: 'GET',
      operation: 'licenses-and-stats',
    });

    return {
      licenses: payload.licenses || [],
      stats: payload.stats || {},
    };
  }

  const status = statusFilter as 'active' | 'revoked' | 'expired' | 'suspended' | undefined;
  const licenses = await getActorLicenses(actorId, status);
  const stats = await getLicenseStats(actorId);

  return { licenses, stats };
}

export async function verifyActiveRepresentation(actorId: string, agentId: string) {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{ active?: boolean }>({
      path:
        `/licensing/representation/active?actorId=${encodeURIComponent(actorId)}` +
        `&agentId=${encodeURIComponent(agentId)}`,
      method: 'GET',
      operation: 'representation-active-check',
    });

    return Boolean(payload.active);
  }

  const relationship = await query(
    `SELECT 1
     FROM actor_agent_relationships
     WHERE actor_id = $1
       AND agent_id = $2
       AND ended_at IS NULL
     LIMIT 1`,
    [actorId, agentId]
  );

  return relationship.rows.length > 0;
}

export async function getAgentActorLicensingData(actorId: string) {
  if (isLicensingRemoteMode()) {
    const payload = await invokeLicensingRemote<{
      licensingRequests?: Array<Record<string, unknown>>;
      licenses?: Array<Record<string, unknown>>;
    }>({
      path: `/licensing/agent-actor-data?actorId=${encodeURIComponent(actorId)}`,
      method: 'GET',
      operation: 'agent-actor-data',
    });

    return {
      licensingRequests: payload.licensingRequests || [],
      licenses: payload.licenses || [],
    };
  }

  const requests = await query(
    `SELECT *
     FROM licensing_requests
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [actorId]
  );

  const licenses = await query(
    `SELECT
       l.*, ac.name AS api_client_name
     FROM licenses l
     LEFT JOIN api_clients ac ON ac.id = l.api_client_id
     WHERE l.actor_id = $1
     ORDER BY l.issued_at DESC
     LIMIT 100`,
    [actorId]
  );

  return {
    licensingRequests: requests.rows,
    licenses: licenses.rows,
  };
}
