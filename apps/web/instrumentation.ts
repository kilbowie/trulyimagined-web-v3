// Sentry Server-Side Instrumentation
// Registers Sentry for Node.js and Edge runtimes
// Follows official Next.js SDK pattern: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

/**
 * Server-side registration hook
 * Called once when the Next.js server starts
 * Loads the appropriate Sentry config based on runtime
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js server runtime (API routes, server components, server actions)
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime (edge API routes, middleware)
    await import('./sentry.edge.config');
  }
}

/**
 * Automatically captures all unhandled server-side request errors
 * Requires @sentry/nextjs >= 8.28.0
 *
 * This hook is called by Next.js whenever an unhandled error occurs
 * during request processing (API routes, server components, server actions)
 */
export const onRequestError = Sentry.captureRequestError;
