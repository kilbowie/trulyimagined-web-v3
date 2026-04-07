import { getHdicrRemoteBaseUrl } from '@/lib/hdicr/flags';

type RepresentationRequestAction = 'approve' | 'reject' | 'withdraw';

function getRepresentationRemoteBaseUrlOrThrow(operation: string) {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Representation ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

const representationRemoteBaseUrl = getRepresentationRemoteBaseUrlOrThrow(
  'client-initialization'
);

async function invokeRepresentationRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  const url = new URL(params.path, representationRemoteBaseUrl);

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
      `[HDICR] Remote representation ${params.operation} failed with status ${response.status} (fail-closed).`
    );
  }

  return (await response.json()) as T;
}

export async function getActorByAuth0UserId(auth0UserId: string) {
  const payload = await invokeRepresentationRemote<{ actor?: Record<string, any> | null }>({
    path: `/v1/representation/actor?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-by-auth0',
  });

  return payload.actor ?? null;
}

export async function getAgentByAuth0UserId(auth0UserId: string) {
  const payload = await invokeRepresentationRemote<{ agent?: Record<string, any> | null }>({
    path: `/v1/representation/agent?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'agent-by-auth0',
  });

  return payload.agent ?? null;
}

export async function getActiveRepresentationForActor(actorId: string) {
  const payload = await invokeRepresentationRemote<{ relationship?: Record<string, any> | null }>(
    {
      path: `/v1/representation/active?actorId=${encodeURIComponent(actorId)}`,
      method: 'GET',
      operation: 'active-representation-by-actor',
    }
  );

  return payload.relationship ?? null;
}

export async function getAgentByRegistryId(registryId: string) {
  const payload = await invokeRepresentationRemote<{ agent?: Record<string, any> | null }>({
    path: `/v1/representation/agent-by-registry?registryId=${encodeURIComponent(registryId)}`,
    method: 'GET',
    operation: 'agent-by-registry',
  });

  return payload.agent ?? null;
}

export async function hasPendingRequest(actorId: string, agentId: string) {
  const payload = await invokeRepresentationRemote<{ pending?: boolean }>({
    path:
      `/v1/representation/request/pending?actorId=${encodeURIComponent(actorId)}` +
      `&agentId=${encodeURIComponent(agentId)}`,
    method: 'GET',
    operation: 'pending-request-check',
  });

  return Boolean(payload.pending);
}

export async function createRepresentationRequest(params: {
  actorId: string;
  agentId: string;
  message?: string | null;
}) {
  const payload = await invokeRepresentationRemote<{ request?: Record<string, any> | null }>({
    path: '/v1/representation/request',
    method: 'POST',
    operation: 'request-create',
    body: {
      actorId: params.actorId,
      agentId: params.agentId,
      message: params.message?.trim() || null,
    },
  });

  return payload.request ?? null;
}

export async function listIncomingRequests(agentId: string) {
  const payload = await invokeRepresentationRemote<{ requests?: Array<Record<string, any>> }>({
    path: `/v1/representation/requests/incoming?agentId=${encodeURIComponent(agentId)}`,
    method: 'GET',
    operation: 'incoming-requests-list',
  });

  return payload.requests || [];
}

export async function listOutgoingRequests(actorId: string) {
  const payload = await invokeRepresentationRemote<{ requests?: Array<Record<string, any>> }>({
    path: `/v1/representation/requests/outgoing?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'outgoing-requests-list',
  });

  return payload.requests || [];
}

export async function getRepresentationRequestById(requestId: string) {
  const payload = await invokeRepresentationRemote<{ request?: Record<string, any> | null }>({
    path: `/v1/representation/request?id=${encodeURIComponent(requestId)}`,
    method: 'GET',
    operation: 'request-by-id',
  });

  return payload.request ?? null;
}

export async function updateRepresentationRequest(params: {
  requestId: string;
  action: RepresentationRequestAction;
  responseNote?: string | null;
}) {
  const payload = await invokeRepresentationRemote<{ request?: Record<string, any> | null }>({
    path: '/v1/representation/request/update',
    method: 'POST',
    operation: 'request-update',
    body: {
      requestId: params.requestId,
      action: params.action,
      responseNote: params.responseNote?.trim() || null,
    },
  });

  return payload.request ?? null;
}

export async function actorHasActiveRelationship(actorId: string) {
  const payload = await invokeRepresentationRemote<{ active?: boolean }>({
    path: `/v1/representation/relationship/active?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'active-relationship-check',
  });

  return Boolean(payload.active);
}

export async function createActorAgentRelationship(params: {
  actorId: string;
  agentId: string;
  representationRequestId: string;
}) {
  await invokeRepresentationRemote<{ success?: boolean }>({
    path: '/v1/representation/relationship',
    method: 'POST',
    operation: 'relationship-create',
    body: {
      actorId: params.actorId,
      agentId: params.agentId,
      representationRequestId: params.representationRequestId,
    },
  });
}

export async function getRelationshipById(relationshipId: string) {
  const payload = await invokeRepresentationRemote<{
    relationship?: Record<string, any> | null;
  }>({
    path: `/v1/representation/relationship?id=${encodeURIComponent(relationshipId)}`,
    method: 'GET',
    operation: 'relationship-by-id',
  });

  return payload.relationship ?? null;
}

export async function endRelationship(params: {
  relationshipId: string;
  endedByAuth0UserId: string;
  endedBy: 'actor' | 'agent';
}) {
  const payload = await invokeRepresentationRemote<{
    relationship?: Record<string, any> | null;
  }>({
    path: '/v1/representation/relationship/end',
    method: 'POST',
    operation: 'relationship-end',
    body: {
      relationshipId: params.relationshipId,
      endedByAuth0UserId: params.endedByAuth0UserId,
      endedBy: params.endedBy,
    },
  });

  return payload.relationship ?? null;
}
