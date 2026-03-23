import { Auth0Client } from '@auth0/nextjs-auth0/server';

/**
 * Auth0 SDK Client Instance
 *
 * Use this instance throughout your app to access Auth0 authentication methods
 */

// Log configuration for debugging (remove in production)
console.log('[AUTH0] Initializing with config:', {
  domain: process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID ? '***' + process.env.AUTH0_CLIENT_ID.slice(-4) : 'MISSING',
  audience: process.env.AUTH0_AUDIENCE,
  baseUrl: process.env.AUTH0_BASE_URL,
  secret: process.env.AUTH0_SECRET
    ? 'SET (length: ' + process.env.AUTH0_SECRET.length + ')'
    : 'MISSING',
});

export const auth0 = new Auth0Client({
  routes: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    callback: '/api/auth/callback',
    postLogoutRedirect: '/',
  },
});
