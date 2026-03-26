// Sentry Client Configuration
// This runs in the browser

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    enabled: SENTRY_ENABLED,

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 0, // 10% in production, 0% in development
    
    // Session Replay for debugging
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
    
    integrations: [
      new Sentry.BrowserTracing({
        // Trace navigation and interactions
        tracePropagationTargets: ['localhost', /^https:\/\/trulyimagined\.com/],
      }),
      new Sentry.Replay({
        // Mask sensitive data in session replays
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser extensions
      /chrome-extension:/,
      /moz-extension:/,
      // React hydration errors (will be caught server-side)
      'Hydration failed',
      // Common browser errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Network errors
      'NetworkError',
      'Failed to fetch',
    ],

    // Filter out noisy breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Don't log console messages in production (too noisy)
      if (breadcrumb.category === 'console' && IS_PRODUCTION) {
        return null;
      }
      return breadcrumb;
    },

    // Scrub PII before sending
    beforeSend(event, hint) {
      // Remove sensitive user data
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
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
