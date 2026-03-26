// Sentry Edge Runtime Configuration
// Edge runtime (middleware, edge API routes, edge functions)
// Follows official Next.js SDK pattern: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    enabled: SENTRY_ENABLED,

    // Send user context (IP addresses, user agent, etc.)
    sendDefaultPii: true,

    // Performance Monitoring: 100% in dev, 5% in production (reduced for edge performance)
    tracesSampleRate: IS_PRODUCTION ? 0.05 : 1.0,

    // Enable structured logging (Sentry Logs product)
    enableLogs: true,

    // Scrub PII before sending
    beforeSend(event) {
      // Remove sensitive user data
      if (event.user) {
        const userId = event.user.id;
        event.user = userId ? { id: userId } : {};
      }

      // Remove sensitive request data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      return event;
    },
  });
} else if (!SENTRY_DSN) {
  console.warn('[SENTRY] Not initialized: Missing NEXT_PUBLIC_SENTRY_DSN environment variable');
}
