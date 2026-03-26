import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * GET /api/sentry-test
 * Test endpoint to verify Sentry error tracking is working
 *
 * Usage:
 * 1. Ensure SENTRY_ENABLED=true in .env.local
 * 2. Visit http://localhost:3000/api/sentry-test
 * 3. Check Sentry dashboard for the error
 */
export async function GET() {
  // Add some context
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Sentry test endpoint called',
    level: 'info',
  });

  // Capture a test message
  Sentry.captureMessage('Sentry test triggered successfully ✅', 'info');

  // Trigger a test error
  try {
    throw new Error(
      '[TEST ERROR] This is a test error from Sentry test endpoint. If you see this in Sentry, error tracking is working correctly! 🎉'
    );
  } catch (error) {
    // Capture the error with additional context
    Sentry.captureException(error, {
      tags: {
        test: true,
        endpoint: '/api/sentry-test',
        feature: 'error-tracking',
      },
      level: 'error',
      user: {
        id: 'test-user',
      },
    });

    // Also throw it so Next.js reports it
    throw error;
  }
}
