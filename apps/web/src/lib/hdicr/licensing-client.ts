import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

const licensingRemoteBaseUrl = getHdicrRemoteBaseUrlOrThrow('licensing', 'client-initialization');

async function invokeLicensingRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'licensing',
    baseUrl: licensingRemoteBaseUrl,
    ...params,
  });
}

export async function resolveActorIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const payload = await invokeLicensingRemote<{ actorId?: string | null }>({
    path: `/v1/licensing/actor-id?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-id-resolve',
  });

  return payload.actorId ?? null;
}

export async function listActorLicensingRequests(actorId: string, status?: string) {
  const payload = await invokeLicensingRemote<{
    requests?: Array<Record<string, unknown>>;
    pendingCount?: number;
  }>({
    path:
      `/v1/licensing/actor-requests?actorId=${encodeURIComponent(actorId)}` +
      `${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    method: 'GET',
    operation: 'actor-requests-list',
  });

  return {
    requests: payload.requests || [],
    pendingCount: payload.pendingCount || 0,
  };
}

export async function getLicensingRequestById(requestId: string) {
  const payload = await invokeLicensingRemote<{ request?: Record<string, unknown> | null }>({
    path: `/v1/licensing/request?id=${encodeURIComponent(requestId)}`,
    method: 'GET',
    operation: 'request-by-id',
  });

  return payload.request ?? null;
}

export async function applyLicensingDecision(
  requestId: string,
  actorId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
) {
  const payload = await invokeLicensingRemote<{ decision?: Record<string, unknown> | null }>({
    path: '/v1/licensing/decision',
    method: 'POST',
    operation: 'decision',
    body: { requestId, actorId, action, rejectionReason },
  });

  if (payload.decision !== undefined) {
    return payload.decision;
  }

  return payload as Record<string, unknown>;
}

export async function getActorLicensesAndStats(actorId: string, statusFilter?: string) {
  const payload = await invokeLicensingRemote<{
    licenses?: Array<Record<string, unknown>>;
    stats?: Record<string, unknown>;
  }>({
    path:
      `/v1/licensing/actor/licenses-and-stats?actorId=${encodeURIComponent(actorId)}` +
      `${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}`,
    method: 'GET',
    operation: 'licenses-and-stats',
  });

  return {
    licenses: payload.licenses || [],
    stats: payload.stats || {},
  };
}

export async function verifyActiveRepresentation(actorId: string, agentId: string) {
  const payload = await invokeLicensingRemote<{ active?: boolean }>({
    path:
      `/v1/licensing/representation/active?actorId=${encodeURIComponent(actorId)}` +
      `&agentId=${encodeURIComponent(agentId)}`,
    method: 'GET',
    operation: 'representation-active-check',
  });

  return Boolean(payload.active);
}

export async function getAgentActorLicensingData(actorId: string) {
  const payload = await invokeLicensingRemote<{
    licensingRequests?: Array<Record<string, unknown>>;
    licenses?: Array<Record<string, unknown>>;
  }>({
    path: `/v1/licensing/agent-actor-data?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'agent-actor-data',
  });

  return {
    licensingRequests: payload.licensingRequests || [],
    licenses: payload.licenses || [],
  };
}
