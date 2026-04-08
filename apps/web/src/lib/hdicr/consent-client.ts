import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

export type PermissionLevel = 'allow' | 'require_approval' | 'deny';

export interface ConsentPolicy {
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
  territories: {
    allowed: string[];
    denied: string[];
  };
  aiControls: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number;
  };
  attributionRequired: boolean;
  usageBlocked?: boolean;
  constraints?: {
    territory?: string;
    expiryDate?: string;
  };
}

export interface CreateConsentEntryParams {
  actorId: string;
  policy: ConsentPolicy;
  reason?: string;
  updatedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

const consentRemoteBaseUrl = getHdicrRemoteBaseUrlOrThrow('consent', 'client-initialization');

async function invokeConsentRemote<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  operation: string;
  body?: unknown;
}): Promise<T> {
  return invokeHdicrRemote<T>({
    domain: 'consent',
    baseUrl: consentRemoteBaseUrl,
    ...params,
  });
}

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

export interface ConsentEnforcementCheckInput {
  actorId: string;
  requestedUsage:
    | 'film_tv'
    | 'advertising'
    | 'ai_training'
    | 'synthetic_media'
    | 'voice_replication';
  apiClientId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
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
  const payload = await invokeConsentRemote<{
    context?: { userProfileId: string; actorId: string } | null;
  }>({
    path: `/v1/consent/actor-context?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-context-resolve',
  });

  return payload.context ?? null;
}

export async function resolveActorIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const context = await resolveActorContextByAuth0UserId(auth0UserId);
  return context?.actorId || null;
}

export async function grantConsent(input: ConsentGrantInput) {
  return invokeConsentRemote<Record<string, unknown>>({
    path: '/v1/consent/grant',
    method: 'POST',
    operation: 'consent-grant',
    body: input,
  });
}

export async function revokeConsent(input: ConsentRevokeInput) {
  return invokeConsentRemote<{
    notFound: boolean;
    record: Record<string, unknown> | null;
  }>({
    path: '/v1/consent/revoke',
    method: 'POST',
    operation: 'consent-revoke',
    body: input,
  });
}

export async function checkConsent(input: ConsentCheckInput) {
  const payload = await invokeConsentRemote<{ consent?: Record<string, any> | null }>({
    path:
      `/v1/consent/check?actorId=${encodeURIComponent(input.actorId)}` +
      `&consentType=${encodeURIComponent(input.consentType)}` +
      `${input.projectId ? `&projectId=${encodeURIComponent(input.projectId)}` : ''}`,
    method: 'GET',
    operation: 'consent-check',
  });

  return payload.consent ?? null;
}

export async function checkConsentEnforcement(input: ConsentEnforcementCheckInput) {
  return invokeConsentRemote<Record<string, unknown>>({
    path: '/v1/consent/enforcement/check',
    method: 'POST',
    operation: 'consent-enforcement-check',
    body: input,
  });
}

export async function listConsentRecords(input: ConsentListInput) {
  const payload = await invokeConsentRemote<{
    rows?: Array<Record<string, any>>;
    totalCount?: number;
  }>({
    path:
      `/v1/consent/list?actorId=${encodeURIComponent(input.actorId)}` +
      `&limit=${input.limit ?? 100}` +
      `&offset=${input.offset ?? 0}` +
      `${input.action ? `&action=${encodeURIComponent(input.action)}` : ''}`,
    method: 'GET',
    operation: 'consent-list',
  });

  return {
    rows: payload.rows || [],
    totalCount: payload.totalCount || 0,
  };
}

export async function createConsentLedgerEntry(params: CreateConsentEntryParams) {
  const payload = await invokeConsentRemote<{ entry?: Record<string, any> }>({
    path: '/v1/consent-ledger/create',
    method: 'POST',
    operation: 'consent-ledger-create',
    body: params,
  });

  return payload.entry;
}

export async function getCurrentConsentLedger(actorId: string, includeHistory: boolean) {
  return invokeConsentRemote<{
    current: Record<string, any> | null;
    history: Array<Record<string, any>>;
    licensesOnCurrentVersion: number;
  }>({
    path:
      `/v1/consent-ledger/current?actorId=${encodeURIComponent(actorId)}` +
      `&includeHistory=${includeHistory ? 'true' : 'false'}`,
    method: 'GET',
    operation: 'consent-ledger-current',
  });
}
