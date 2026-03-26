'use client';

/**
 * Global Error Boundary for App Router
 * Catches errors in the root layout and React render errors
 * Follows official Next.js SDK pattern: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * This component is only rendered when an error occurs at the root level.
 * For most errors, the default error boundaries will be used instead.
 */

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Capture the error in Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* This renders Next.js's default error page */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
