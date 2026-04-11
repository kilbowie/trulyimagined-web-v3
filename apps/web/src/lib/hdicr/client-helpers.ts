/**
 * High-level client helpers for common HDICR queries from TI runtime paths.
 * These replace direct SQL queries from the web tier.
 */

import { invokeHdicrRemote } from './hdicr-http-client';
import { getHdicrRemoteBaseUrl } from './flags';

export interface ActorByAuth0Response {
  actor: {
    id: string;
    auth0UserId: string;
    email: string;
    firstName: string;
    lastName: string;
    registryId: string | null;
    verificationStatus: string;
    createdAt: string;
  } | null;
}

export interface ConsentCheckResponse {
  isGranted: boolean;
  actor_id: string;
  status: string;
  grant_date: string | null;
}

export interface ManualVerificationCheckResponse {
  hasManualVerificationRequest: boolean;
}

/**
 * Get actor by auth0_user_id via representation service
 */
export async function getActorByAuth0UserId(
  auth0UserId: string,
  tenantId: string,
  correlationId?: string
): Promise<ActorByAuth0Response['actor'] | null> {
  try {
    const baseUrl = getHdicrRemoteBaseUrl();
    if (!baseUrl) {
      throw new Error('[HDICR] HDICR_API_URL is not configured');
    }

    const response = await invokeHdicrRemote<ActorByAuth0Response>({
      domain: 'representation',
      baseUrl,
      path: `/v1/representation/actor?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      method: 'GET',
      operation: 'getActorByAuth0UserId',
      correlationId,
    });

    return response.actor;
  } catch (error) {
    console.error('[HDICR-CLIENT] getActorByAuth0UserId failed:', error);
    throw error;
  }
}

/**
 * Check if actor has active consent via consent service
 */
export async function checkActiveConsent(
  actorId: string,
  correlationId?: string
): Promise<boolean> {
  try {
    const baseUrl = getHdicrRemoteBaseUrl();
    if (!baseUrl) {
      throw new Error('[HDICR] HDICR_API_URL is not configured');
    }

    const response = await invokeHdicrRemote<ConsentCheckResponse>({
      domain: 'consent',
      baseUrl,
      path: `/v1/consent/check?actorId=${encodeURIComponent(actorId)}`,
      method: 'GET',
      operation: 'checkActiveConsent',
      correlationId,
    });

    return response.isGranted;
  } catch (error) {
    console.error('[HDICR-CLIENT] checkActiveConsent failed:', error);
    throw error;
  }
}

/**
 * Check if actor has manual verification request via licensing service
 * Routes: pending_scheduling, scheduled, completed
 */
export async function checkManualVerificationRequest(
  actorId: string,
  tenantId: string,
  correlationId?: string
): Promise<boolean> {
  try {
    const baseUrl = getHdicrRemoteBaseUrl();
    if (!baseUrl) {
      throw new Error('[HDICR] HDICR_API_URL is not configured');
    }

    const response = await invokeHdicrRemote<ManualVerificationCheckResponse>({
      domain: 'licensing',
      baseUrl,
      path: `/v1/license/actor/${encodeURIComponent(actorId)}/has-pending-verification`,
      method: 'GET',
      operation: 'checkManualVerificationRequest',
      correlationId,
    });

    return response.hasManualVerificationRequest;
  } catch (error) {
    console.error('[HDICR-CLIENT] checkManualVerificationRequest failed:', error);
    throw error;
  }
}
