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
- ✅ `sentry.client.config.ts` - Browser error tracking
- ✅ `sentry.server.config.ts` - Server-side error tracking
- ✅ `sentry.edge.config.ts` - Edge runtime error tracking
- ✅ `next.config.js` - Updated with Sentry webpack plugin

## Features Enabled

### Error Tracking
- Automatic error capture in client, server, and edge runtimes
- Stack traces with source maps (uploaded during build)
- Context breadcrumbs (navigation, user actions, console logs)

### Performance Monitoring
- 10% of transactions sampled in production
- API route performance tracking
- Page load metrics
- Web Vitals (LCP, FID, CLS)

### Session Replay
- 10% of normal sessions recorded
- 100% of error sessions recorded
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

### Test Sentry in Development
```bash
# 1. Enable Sentry
echo "SENTRY_ENABLED=true" >> apps/web/.env.local

# 2. Add your DSN
echo "NEXT_PUBLIC_SENTRY_DSN=your_dsn_here" >> apps/web/.env.local

# 3. Start dev server
pnpm dev

# 4. Trigger a test error
# Visit: http://localhost:3000/api/sentry-test
```

### Create Test Error Endpoint
```typescript
// apps/web/src/app/api/sentry-test/route.ts
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  Sentry.captureMessage('Sentry test triggered successfully', 'info');
  
  // Trigger test error
  throw new Error('This is a test error for Sentry');
  
  return NextResponse.json({ success: true });
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

### Sentry Not Capturing Errors
1. Check `SENTRY_ENABLED` is not set to 'false'
2. Verify DSN is correct
3. Check browser console for Sentry initialization logs
4. Ensure you're not in ad-blocker/privacy mode (blocks Sentry)

### Source Maps Not Working
1. Verify `SENTRY_AUTH_TOKEN` is set in Vercel
2. Check `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry settings
3. Look for webpack errors during build

### Too Many Errors
1. Add common errors to `ignoreErrors` in Sentry configs
2. Use `beforeSend` to filter noisy errors
3. Set up error rate alerts to catch issues early

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
