import { Auth0Client } from '@auth0/nextjs-auth0/server';

/**
 * Normalizes the Auth0 domain by:
 * - Reading from AUTH0_DOMAIN or AUTH0_ISSUER_BASE_URL
 * - Removing https:// prefix
 * - Removing trailing slashes
 * Returns undefined if no domain is configured
 */
function normalizeAuth0Domain() {
  const configuredDomain =
    process.env.AUTH0_DOMAIN?.trim() || process.env.AUTH0_ISSUER_BASE_URL?.trim() || '';

  return configuredDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '') || undefined;
}

/**
 * Resolves the app base URL from multiple sources in order of priority:
 * 1. APP_BASE_URL environment variable
 * 2. AUTH0_BASE_URL environment variable
 * 3. NEXT_PUBLIC_APP_URL environment variable
 * Returns undefined if none are configured
 */
function resolveAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.AUTH0_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    undefined
  );
}

/**
 * Auth0 client instance for server-side session management.
 * Automatically reads configuration from environment variables:
 * - APP_BASE_URL
 * - AUTH0_DOMAIN (or AUTH0_ISSUER_BASE_URL as fallback)
 * - AUTH0_CLIENT_ID
 * - AUTH0_CLIENT_SECRET
 * - AUTH0_SECRET
 * - AUTH0_AUDIENCE (optional, for API access)
 * - AUTH0_POST_LOGIN_REDIRECT (default: /dashboard)
 *
 * After successful login, users are automatically redirected to /dashboard
 */
export const auth0 = new Auth0Client({
  domain: normalizeAuth0Domain(),
  appBaseUrl: resolveAppBaseUrl(),
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE?.trim() || undefined,
    scope: 'openid profile email',
  },
  routes: {
    callback: '/auth/callback',
  },
  signInReturnToPath: process.env.AUTH0_POST_LOGIN_REDIRECT || '/dashboard',
});
