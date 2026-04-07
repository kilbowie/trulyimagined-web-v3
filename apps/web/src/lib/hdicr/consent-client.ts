import type { ConsentPolicy, CreateConsentEntryParams } from '@/lib/consent-ledger';
import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

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

export type { ConsentPolicy };
