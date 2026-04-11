/**
 * Auth0 M2M Token acquisition (simplified for common cases)
 * @deprecated Use invokeHdicrRemote and getHdicrToken from hdicr-http-client.ts instead
 * This utility may be used for non-HDICR M2M flows or as a fallback.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a fresh M2M token from Auth0.
 * Tokens are cached in memory until 5 minutes before expiry.
 * Validates required environment variables before attempting token acquisition.
 */
export async function getM2mToken(): Promise<string> {
  // Validate required environment variables
  const auth0Domain = process.env.AUTH0_DOMAIN?.trim();
  const clientId = process.env.AUTH0_M2M_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET?.trim();
  const audience = process.env.AUTH0_M2M_AUDIENCE?.trim();

  if (!auth0Domain || !clientId || !clientSecret || !audience) {
    throw new Error(
      'Missing required Auth0 M2M environment variables: AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET, AUTH0_M2M_AUDIENCE'
    );
  }

  const now = Date.now();

  // Return cached token if still valid (5 min buffer)
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  let response: Response;
  try {
    response = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience,
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(
      `Failed to acquire M2M token (network error): ${error instanceof Error ? error.message : 'unknown'}`
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to acquire M2M token: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error('Invalid M2M token response from Auth0');
  }

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}
