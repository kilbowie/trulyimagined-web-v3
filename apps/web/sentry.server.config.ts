// Sentry Server Configuration
// This runs on the Next.js server

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    enabled: SENTRY_ENABLED,

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 0,

    // Integrations
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],

    // Ignore common errors
    ignoreErrors: [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
    ],

    // Scrub PII before sending
    beforeSend(event, hint) {
      // Remove sensitive user data
      if (event.user) {
        // Keep user ID for tracking, but remove PII
        const userId = event.user.id;
        event.user = userId ? { id: userId } : {};
      }

      // Remove sensitive request data
      if (event.request) {
        delete event.request.cookies;
        
        // Scrub authorization headers
        if (event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
        }
      }

      // Remove sensitive context data
      if (event.contexts?.runtime?.env) {
        // Remove all env vars from error reports
        delete event.contexts.runtime.env;
      }

      return event;
    },
  });
} else if (!SENTRY_DSN) {
  console.warn(
    '[SENTRY] Not initialized: Missing SENTRY_DSN environment variable'
  );
}
