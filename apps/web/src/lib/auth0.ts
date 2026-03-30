import { Auth0Client } from '@auth0/nextjs-auth0/server';

/**
 * Auth0 client instance for server-side session management.
 * Automatically reads configuration from environment variables:
 * - APP_BASE_URL
 * - AUTH0_DOMAIN
 * - AUTH0_CLIENT_ID
 * - AUTH0_CLIENT_SECRET
 * - AUTH0_SECRET
 * - AUTH0_AUDIENCE (optional, for API access)
 * - AUTH0_POST_LOGIN_REDIRECT (default: /dashboard)
 * 
 * After successful login, users are automatically redirected to /dashboard
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: 'openid profile email',
  },
  routes: {
    callback: '/api/auth/callback',
    postLoginRedirect: process.env.AUTH0_POST_LOGIN_REDIRECT || '/dashboard',
  },
});
