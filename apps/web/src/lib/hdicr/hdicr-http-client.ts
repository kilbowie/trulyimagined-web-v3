import { getHdicrRemoteBaseUrl } from '@/lib/hdicr/flags';

type HdicrDomain =
  | 'consent'
  | 'licensing'
  | 'identity'
  | 'credentials'
  | 'representation'
  | 'usage'
  | 'billing'
  | 'payments';

type HdicrMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type TokenCache = {
  token: string;
  expiresAt: number;
};

const tokenCacheByKey = new Map<string, TokenCache>();

export class HdicrHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HdicrHttpError';
    this.statusCode = statusCode;
  }
}

export function isHdicrHttpError(error: unknown): error is HdicrHttpError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  );
}

export function getHdicrRemoteBaseUrlOrThrow(domain: HdicrDomain, operation: string): string {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] ${capitalize(domain)} ${operation} is configured for remote mode but HDICR_API_URL is missing (legacy fallback: HDICR_REMOTE_BASE_URL).`
    );
  }

  return baseUrl;
}

function resolveAudienceForDomain(domain: HdicrDomain): string | null {
  const canonicalM2mAudience = process.env.AUTH0_M2M_AUDIENCE?.trim();
  const legacyM2mAudience = process.env.HDICR_M2M_AUDIENCE?.trim();

  if (domain === 'identity' || domain === 'consent') {
    return canonicalM2mAudience || legacyM2mAudience || process.env.AUTH0_AUDIENCE?.trim() || null;
  }

  if (domain === 'licensing') {
    return process.env.AUTH0_AUDIENCE?.trim() || null;
  }

  return process.env.AUTH0_AUDIENCE?.trim() || null;
}

function resolveClientCredentialsForDomain(domain: HdicrDomain): {
  clientId: string | null;
  clientSecret: string | null;
} {
  const canonicalClientId = process.env.AUTH0_M2M_CLIENT_ID?.trim() || null;
  const canonicalClientSecret = process.env.AUTH0_M2M_CLIENT_SECRET?.trim() || null;
  const legacyClientId = process.env.HDICR_CLIENT_ID?.trim() || null;
  const legacyClientSecret = process.env.HDICR_CLIENT_SECRET?.trim() || null;

  if (domain === 'licensing') {
    return {
      clientId: process.env.TI_M2M_CLIENT_ID?.trim() || canonicalClientId || legacyClientId,
      clientSecret:
        process.env.TI_M2M_CLIENT_SECRET?.trim() || canonicalClientSecret || legacyClientSecret,
    };
  }

  return {
    clientId: canonicalClientId || legacyClientId,
    clientSecret: canonicalClientSecret || legacyClientSecret,
  };
}

async function getHdicrToken(domain: HdicrDomain): Promise<string> {
  // Keep domain-client tests deterministic. Set HDICR_REAL_TOKEN_IN_TEST=true to
  // exercise real token acquisition within a test (e.g. transport-level tests).
  if (process.env.NODE_ENV === 'test' && process.env.HDICR_REAL_TOKEN_IN_TEST !== 'true') {
    return process.env.HDICR_TEST_M2M_TOKEN || 'test-token';
  }

  const auth0Domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = resolveAudienceForDomain(domain);
  const { clientId, clientSecret } = resolveClientCredentialsForDomain(domain);

  if (!auth0Domain || !audience || !clientId || !clientSecret) {
    throw new HdicrHttpError(
      503,
      '[HDICR] Missing Auth0 M2M configuration for token acquisition (AUTH0_DOMAIN, AUTH0_M2M_AUDIENCE/AUTH0_AUDIENCE, and AUTH0_M2M_CLIENT_ID/AUTH0_M2M_CLIENT_SECRET; legacy fallback: HDICR_CLIENT_ID/HDICR_CLIENT_SECRET).'
    );
  }

  const cacheKey = `${clientId}:${audience}`;
  const now = Date.now();
  const cachedToken = tokenCacheByKey.get(cacheKey);
  if (cachedToken && now < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience,
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    });
  } catch {
    throw new HdicrHttpError(503, '[HDICR] Failed to acquire M2M token (network failure).');
  }

  if (!tokenResponse.ok) {
    throw new HdicrHttpError(
      503,
      `[HDICR] Failed to acquire M2M token (status ${tokenResponse.status}).`
    );
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!tokenPayload.access_token || typeof tokenPayload.expires_in !== 'number') {
    throw new HdicrHttpError(503, '[HDICR] Invalid M2M token response payload.');
  }

  tokenCacheByKey.set(cacheKey, {
    token: tokenPayload.access_token,
    expiresAt: Date.now() + tokenPayload.expires_in * 1000,
  });

  return tokenPayload.access_token;
}

export async function invokeHdicrRemote<T>(params: {
  domain: HdicrDomain;
  baseUrl: string;
  path: string;
  method: HdicrMethod;
  operation: string;
  body?: unknown;
}): Promise<T> {
  const url = new URL(params.path, params.baseUrl);

  const token = await getHdicrToken(params.domain);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: params.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(params.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new HdicrHttpError(
      503,
      `[HDICR] Remote ${params.domain} ${params.operation} failed due to network error (fail-closed).`
    );
  }

  if (!response.ok) {
    throw new HdicrHttpError(
      response.status,
      `[HDICR] Remote ${params.domain} ${params.operation} failed with status ${response.status} (fail-closed).`
    );
  }

  return (await response.json()) as T;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
