import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

function getUsageRemoteBaseUrl() {
  return getHdicrRemoteBaseUrlOrThrow('usage', 'client-initialization');
}

async function invokeUsageRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'usage',
    baseUrl: getUsageRemoteBaseUrl(),
    ...params,
  });
}

export async function actorExistsById(actorId: string): Promise<boolean> {
  const payload = await invokeUsageRemote<{ exists?: boolean }>({
    path: `/v1/usage/actor/exists?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'actor-exists-check',
  });

  return Boolean(payload.exists);
}

export async function getLicensingRequestStatusById(licensingRequestId: string) {
  const payload = await invokeUsageRemote<{ request?: Record<string, any> | null }>({
    path: `/v1/usage/licensing-request-status?id=${encodeURIComponent(licensingRequestId)}`,
    method: 'GET',
    operation: 'licensing-request-status',
  });

  return payload.request ?? null;
}

export async function createUsageTrackingRecord(params: {
  actorId: string;
  licensingRequestId?: string;
  usageType: 'voice_minutes' | 'image_generation' | 'video_seconds';
  quantity: number;
  unit: 'minutes' | 'images' | 'seconds';
  projectName?: string;
  generatedBy: string;
  metadata: Record<string, unknown>;
}) {
  const payload = await invokeUsageRemote<{ usage?: Record<string, any> | null }>({
    path: '/v1/usage/track',
    method: 'POST',
    operation: 'usage-track-create',
    body: params,
  });

  return payload.usage ?? null;
}

export async function createUsageAuditLog(params: {
  actorId: string;
  resourceId: string;
  usageType: 'voice_minutes' | 'image_generation' | 'video_seconds';
  quantity: number;
  unit: 'minutes' | 'images' | 'seconds';
}) {
  await invokeUsageRemote<{ success?: boolean }>({
    path: '/v1/usage/audit-log',
    method: 'POST',
    operation: 'usage-audit-log-create',
    body: params,
  });

  return;
}

export async function getUsageActorById(actorId: string) {
  const payload = await invokeUsageRemote<{ actor?: Record<string, any> | null }>({
    path: `/v1/usage/actor?id=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'usage-actor-lookup',
  });

  return payload.actor ?? null;
}

export async function getActorUsageRecords(actorId: string, limit: number, offset: number) {
  const payload = await invokeUsageRemote<{ rows?: Array<Record<string, any>> }>({
    path:
      `/v1/usage/actor/records?actorId=${encodeURIComponent(actorId)}` +
      `&limit=${limit}&offset=${offset}`,
    method: 'GET',
    operation: 'usage-records-list',
  });

  return payload.rows || [];
}

export async function getActorUsageStats(actorId: string) {
  const payload = await invokeUsageRemote<{
    stats?: Array<Record<string, any>>;
    totalMinutes?: number;
  }>({
    path: `/v1/usage/actor/stats?actorId=${encodeURIComponent(actorId)}`,
    method: 'GET',
    operation: 'usage-stats-by-actor',
  });

  return {
    stats: payload.stats || [],
    totalMinutes: payload.totalMinutes || 0,
  };
}

export async function getGlobalUsageStats() {
  return invokeUsageRemote<{
    stats: Array<Record<string, any>>;
    recentActivity: Array<Record<string, any>>;
    topActors: Array<Record<string, any>>;
    totals: Record<string, any> | null;
  }>({
    path: '/v1/usage/stats/global',
    method: 'GET',
    operation: 'usage-global-stats',
  });
}
