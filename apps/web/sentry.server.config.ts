// Sentry Server Configuration
// Node.js server runtime (API routes, server components, server actions)
// Follows official Next.js SDK pattern: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    enabled: SENTRY_ENABLED,

    // Send user context (IP addresses, user agent, etc.)
    sendDefaultPii: true,

    // Performance Monitoring: 100% in dev, 10% in production
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // Attach local variable values to stack frames for better debugging
    includeLocalVariables: true,

    // Enable structured logging (Sentry Logs product)
    enableLogs: true,

    // Ignore common errors
    ignoreErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'],

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
  console.warn('[SENTRY] Not initialized: Missing SENTRY_DSN environment variable');
}
