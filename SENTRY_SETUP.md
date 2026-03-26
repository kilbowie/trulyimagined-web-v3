# Sentry Setup Guide

## Overview

Sentry is configured for real-time error tracking and performance monitoring across client, server, and edge runtimes.

## Prerequisites

1. Create a Sentry account at https://sentry.io
2. Create a new project (Next.js type)
3. Get your DSN from Project Settings > Client Keys (DSN)

## Environment Variables

Add these to your `.env.local` (development) and Vercel dashboard (production):

```bash
# Sentry Configuration
SENTRY_DSN=https://your_key@o1234567.ingest.sentry.io/1234567
NEXT_PUBLIC_SENTRY_DSN=https://your_key@o1234567.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=your_auth_token_here
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=trulyimagined-web

# Feature flags
SENTRY_ENABLED=true  # Set to 'false' to disable Sentry in development
```

### Getting Your Auth Token

1. Go to Sentry > Settings > Account > API > Auth Tokens
2. Create a new token with scope: `project:releases`
3. Copy the token and add it to your environment variables

## Files Created

Following the official Next.js SDK pattern (https://docs.sentry.io/platforms/javascript/guides/nextjs/):

### Core Configuration Files

- ✅ `instrumentation.ts` - Server-side registration hook (loads correct runtime config)
- ✅ `sentry.client.config.ts` - Browser runtime configuration (error tracking, tracing, session replay)
- ✅ `sentry.server.config.ts` - Node.js server runtime (API routes, server components, server actions)
- ✅ `sentry.edge.config.ts` - Edge runtime (middleware, edge functions)
- ✅ `src/app/global-error.tsx` - App Router error boundary (catches root layout errors)
- ✅ `next.config.js` - Updated with `withSentryConfig()` wrapper and source map upload
- ✅ `src/middleware.ts` - Updated to exclude Sentry tunnel route (`/monitoring`)

### Request Error Capture

The `instrumentation.ts` file exports `onRequestError` which automatically captures all unhandled server-side errors during request processing. This requires @sentry/nextjs >= 8.28.0.

### Router Transition Tracking

The `sentry.client.config.ts` file exports `onRouterTransitionStart` which hooks into Next.js App Router navigation transitions for automatic client-side route tracing.

## Features Enabled

### Error Tracking

- ✅ Automatic error capture across all runtimes (client, server, edge)
- ✅ Stack traces with source maps (uploaded during production builds)
- ✅ Root layout error boundary (`global-error.tsx`)
- ✅ Automatic unhandled request error capture (`onRequestError` hook)
- ✅ Context breadcrumbs (navigation, user actions, console logs)

### Performance Monitoring (Tracing)

- ✅ 100% of transactions sampled in development
- ✅ 10% of transactions sampled in production (server)
- ✅ 5% of transactions sampled in edge runtime (reduced for performance)
- ✅ API route performance tracking
- ✅ Client-side navigation tracing (App Router)
- ✅ Page load metrics
- ✅ Web Vitals (LCP, FID, CLS)

### Session Replay

- ✅ 10% of normal sessions recorded
- ✅ 100% of error sessions recorded
- ✅ Input masking for privacy (all input fields masked)
- ✅ Canvas and media recording enabled (configurable)

### Structured Logging

- ✅ `enableLogs: true` in all runtime configs
- ✅ Use `Sentry.logger.*` methods for log-to-trace correlation
- ✅ Console breadcrumbs in development (suppressed in production)

### Privacy Controls

- ✅ PII scrubbing (configured per runtime)
- ✅ Local variables attached to stack frames (server only)
- ✅ Session replay input masking

### Ad-Blocker Bypass

- ✅ Tunnel route configured at `/monitoring`
- ✅ Requests proxy through your domain instead of sentry.io
- ✅ Excluded from auth middleware
- All text and media masked for privacy

### Privacy Protection

- PII automatically scrubbed (emails, IPs, usernames)
- Authorization headers removed
- Cookies filtered out
- Environment variables excluded

## Usage in Code

### Manual Error Capture

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'credential-issuance',
      userId: userId,
    },
    level: 'error',
  });
  throw error;
}
```

### Add Breadcrumbs

```typescript
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info',
});
```

### Set User Context

```typescript
Sentry.setUser({
  id: userId,
  // Don't include email or username (removed by beforeSend)
});
```

### Performance Monitoring

```typescript
const transaction = Sentry.startTransaction({
  name: 'Issue Credential',
  op: 'task',
});

try {
  await issueCredential();
} finally {
  transaction.finish();
}
```

## Testing

### Verification Checklist

After setup, verify Sentry is working across all runtimes:

| Runtime            | Test Method                               | Expected Result                                         |
| ------------------ | ----------------------------------------- | ------------------------------------------------------- |
| **Client**         | Throw error in client component           | Error appears in Sentry Issues                          |
| **Server**         | Throw error in API route or server action | Error appears with server stack trace                   |
| **Edge**           | Throw error in middleware                 | Error captured from edge runtime                        |
| **Source Maps**    | Check stack trace readability             | File names and line numbers are readable (not minified) |
| **Session Replay** | Trigger error with user interactions      | Replay appears in Sentry Replays tab                    |

### Quick Test: Use Test Endpoint

The project includes a test endpoint at `/api/sentry-test`:

```bash
# 1. Start dev server
pnpm dev

# 2. Visit the test endpoint
# http://localhost:3000/api/sentry-test

# 3. Check Sentry dashboard
# Within 30 seconds, you should see:
# - New issue: "This is a test error from API route"
# - Info message: "Sentry API route test"
```

### Test Client Errors

Add this temporarily to any client component:

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function TestComponent() {
  useEffect(() => {
    // Trigger test error
    throw new Error('Sentry client test — delete me');
  }, []);

  return <div>Testing Sentry...</div>;
}
```

### Test Server Actions

Add this to a server component or action:

```typescript
'use server';

import * as Sentry from '@sentry/nextjs';

export async function testServerAction() {
  Sentry.captureMessage('Server action test', 'info');
  throw new Error('Sentry server action test — delete me');
}
```

## Viewing Errors

1. Go to https://sentry.io
2. Select your project
3. Click "Issues" to see all captured errors
4. Click on an issue to see:
   - Stack trace with source maps
   - Breadcrumbs leading to error
   - User context (if any)
   - Device/browser information
   - Session replay (if available)

## Alerts & Notifications

### Set Up Email Alerts

1. Project Settings > Alerts > Create Alert Rule
2. Choose trigger: "First time an issue occurs"
3. Add your email
4. Choose frequency: "Immediately"

### Set Up Slack Integration

1. Project Settings > Integrations > Slack
2. Connect workspace
3. Choose channel for alerts
4. Configure notification rules

## Production Deployment

### Vercel Environment Variables

Add these in Vercel Dashboard > Settings > Environment Variables:

```
SENTRY_DSN=production_dsn
NEXT_PUBLIC_SENTRY_DSN=production_dsn
SENTRY_AUTH_TOKEN=your_token
SENTRY_ORG=your-org
SENTRY_PROJECT=trulyimagined-web
SENTRY_ENABLED=true
```

### Automatic Source Map Upload

Source maps are automatically uploaded during `vercel build` via the Sentry webpack plugin.

### Release Tracking

Each deployment creates a new release in Sentry with:

- Git commit SHA
- Deployment timestamp
- Source maps for error stack traces

## Cost & Limits (Free Tier)

- ✅ 5,000 errors/month
- ✅ 10,000 performance transactions/month
- ✅ 50 session replays/month
- ✅ 90-day data retention

Upgrade to paid plan when you exceed these limits.

## Troubleshooting

### Events Not Appearing in Sentry

| Issue                 | Cause                          | Solution                                                                                           |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| No errors captured    | DSN misconfigured              | Set `debug: true` temporarily in Sentry.init() and check browser console for requests to sentry.io |
| Client errors missing | NEXT_PUBLIC_SENTRY_DSN not set | Ensure env variable starts with `NEXT_PUBLIC_` for client-side access                              |
| Server errors missing | SENTRY_DSN not set             | Add non-public DSN for server runtime                                                              |
| Edge errors missing   | Edge config not loaded         | Verify `instrumentation.ts` imports `sentry.edge.config.ts` when `NEXT_RUNTIME === "edge"`         |

### Stack Traces Show Minified Code

| Issue                        | Cause                     | Solution                                                                    |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| Source maps not uploading    | SENTRY_AUTH_TOKEN missing | Check token is set in build environment (Vercel dashboard or CI)            |
| Maps upload failed           | Org/project mismatch      | Verify `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry settings exactly |
| Build logs don't show upload | Plugin not running        | Ensure `withSentryConfig()` is wrapping next.config in module.exports       |

### onRequestError Hook Not Firing

**Issue**: Server-side request errors not captured automatically

**Solution**: Ensure @sentry/nextjs >= 8.28.0

```bash
pnpm add @sentry/nextjs@latest
```

### Tunnel Route Returns 404

**Issue**: `/monitoring` route not found

**Cause**: The Sentry webpack plugin creates this automatically during build

**Solution**: Run `pnpm build` locally to verify. The route is created at build time, not dev time.

### Session Replay Not Recording

**Issue**: Replays tab empty in Sentry

**Solutions**:

1. Check `replayIntegration()` is in client config integrations array
2. Verify `replaysSessionSampleRate` and `replaysOnErrorSampleRate` are > 0
3. Confirm user had interactions before error occurred

### global-error.tsx Not Catching Errors

**Issue**: Root layout errors not captured

**Solution**: Ensure "use client" directive is the first line of `src/app/global-error.tsx`

### Too Many Errors / Rate Limit

**Solutions**:

1. Add common errors to `ignoreErrors` array in config
2. Use `beforeSend` to filter noisy errors in production
3. Set up error rate alerts to catch issues early
4. Lower sample rates: `tracesSampleRate: 0.05`

## Best Practices

### ✅ DO

- Use Sentry for all unexpected errors
- Add context with tags and breadcrumbs
- Set up alerts for critical errors
- Review errors daily in production
- Fix errors before they affect many users

### ❌ DON'T

- Capture expected errors (use logging instead)
- Include PII in error messages
- Capture non-critical warnings
- Ignore error patterns (fix root causes)
- Let errors pile up unreviewed

## Next Steps

1. ✅ Install Sentry SDK - DONE
2. ✅ Create config files - DONE
3. ✅ Update next.config.js - DONE
4. ⏳ Add DSN to .env.local
5. ⏳ Test error capture
6. ⏳ Deploy to production
7. ⏳ Set up alerts

📚 Full documentation: https://docs.sentry.io/platforms/javascript/guides/nextjs/
