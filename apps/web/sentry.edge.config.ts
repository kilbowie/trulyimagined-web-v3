// Sentry Edge Runtime Configuration
// This runs on Vercel Edge Runtime (middleware, edge functions)

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    enabled: SENTRY_ENABLED,

    // Reduced sample rate for edge runtime (to minimize overhead)
    tracesSampleRate: IS_PRODUCTION ? 0.05 : 0,

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
  console.warn(
    '[SENTRY] Not initialized: Missing NEXT_PUBLIC_SENTRY_DSN environment variable'
  );
}
