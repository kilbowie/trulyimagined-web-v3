// Sentry Client-Side Instrumentation
// Browser runtime configuration for error monitoring, tracing, and session replay
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

    // Performance Monitoring: 100% in dev, 10% in production
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // Session Replay: 10% of all sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Enable structured logging (Sentry Logs product)
    enableLogs: true,

    integrations: [
      Sentry.replayIntegration({
        // Privacy controls for session replays
        maskAllText: false, // Allow text to be readable (adjust for compliance)
        blockAllMedia: false, // Allow media to be recorded (adjust for privacy)
        maskAllInputs: true, // Always mask input fields
      }),
      // Optional: User feedback widget
      // Sentry.feedbackIntegration({ colorScheme: "system" }),
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
  console.warn('[SENTRY] Not initialized: Missing NEXT_PUBLIC_SENTRY_DSN environment variable');
}

// Hook into App Router navigation transitions
// Automatically traces client-side route changes
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
