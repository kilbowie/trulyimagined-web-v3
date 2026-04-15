# Prompt 2 — Webhook Handler & Full Stripe Identity Implementation
> Run after Prompt 1 (audit complete, STRIPE_BACKLOG.md created).

---

## Instructions for Copilot

Implement the complete Stripe webhook handler and full Stripe Identity integration for TI.
This supersedes any previous webhook handler in this repo and all HDICR Stripe Identity stories.

---

## Stack Reminder

- Next.js 15, App Router, TypeScript strict
- Route Handlers under `/app/api/`
- `pg` Pool from `/lib/db.ts` (no ORM)
- Auth0 via `@auth0/nextjs-auth0`
- Stripe SDK (`stripe` npm package)
- Zod for validation
- Deployed on Vercel (serverless)

---

## Migration 1: `/migrations/0004_webhook_events.sql`

```sql
CREATE TABLE IF NOT EXISTS webhook_events (
  stripe_event_id  VARCHAR(255) PRIMARY KEY,
  event_type       VARCHAR(255) NOT NULL,
  processed_at     TIMESTAMPTZ  DEFAULT NOW(),
  status           VARCHAR(50)  DEFAULT 'processed'
);
```

---

## Migration 2: `/migrations/0005_user_subscriptions.sql`

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID         NOT NULL,
  stripe_subscription_id  VARCHAR(255) UNIQUE,
  stripe_customer_id      VARCHAR(255),
  stripe_price_id         VARCHAR(255),
  tier                    VARCHAR(50),  -- 'actor' | 'agency' | 'studio'
  plan                    VARCHAR(50),  -- 'creator' | 'independent' | 'boutique' | 'agency' | 'indie' | 'mid'
  status                  VARCHAR(50)  DEFAULT 'active',
  seat_quantity           INTEGER      DEFAULT 1,
  current_period_end      TIMESTAMPTZ,
  last_payment_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  DEFAULT NOW()
);
```

---

## Migration 3: `/migrations/0006_stripe_identity_fields.sql`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_verification_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS identity_verified               BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_status                 VARCHAR(50)  DEFAULT 'unverified';
  -- identity_status values: 'unverified' | 'pending' | 'verified' | 'requires_input' | 'canceled'
```

---

## Task A — Webhook Handler: `/app/api/stripe/webhooks/route.ts`

This is the single, definitive Stripe webhook handler. Add this comment block at the top:

```typescript
/**
 * STRIPE WEBHOOK HANDLER — Single entry point for all Stripe events.
 *
 * Handles: Platform events, Connect events, Identity events.
 *
 * Architecture:
 * - TI is the Stripe Connect platform account (Express mode)
 * - Actors/agencies are Express connected accounts (receive payouts)
 * - Studios are Stripe Customers (initiate deal payments)
 * - Application fee extracted from deal PaymentIntents automatically
 *
 * Supersedes:
 * - Any previous webhook handler in this repo
 * - HDICR Story 1.2 (identity webhook in identity-service Lambda) — HDICR
 *   has no Stripe dependency. Identity results are communicated to HDICR
 *   via TI's authenticated POST to /identity/verify-confirmed.
 *
 * Raw body requirement (App Router):
 *   Use `await request.text()` NOT `request.json()`.
 *   Stripe signature verification requires the raw unparsed body.
 *   This is different from Pages Router which used bodyParser: false.
 */
```

### Implementation Requirements

**1. Raw body & signature verification**
```typescript
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 })
  }
  // ... route event
}
```

**2. Deduplication — check `webhook_events` table before processing**
- If `stripe_event_id` exists: return `200` immediately
- Insert event ID at start of processing (not end) to prevent race on retry

**3. Event routing — check `event.account` first**
```typescript
if (event.account) {
  // Connect event — from actor/agency connected account
  setImmediate(() => handleConnectEvent(event))
} else {
  // Platform event — from TI's own Stripe account
  setImmediate(() => handlePlatformEvent(event))
}
return NextResponse.json({ received: true }) // Always 200 immediately
```

**4. Platform event handlers**

`customer.subscription.created`
- Upsert `user_subscriptions`: `stripe_subscription_id`, `stripe_customer_id`,
  `stripe_price_id`, `tier`, `plan` (derive from price metadata), `status`, `current_period_end`

`customer.subscription.updated`
- Update `user_subscriptions`: `status`, `plan`, `seat_quantity`, `current_period_end`

`customer.subscription.deleted`
- Update `user_subscriptions`: `status = 'canceled'`

`invoice.payment_succeeded`
- Update `user_subscriptions`: `status = 'active'`, `last_payment_at`, `current_period_end`

`invoice.payment_failed`
- Update `user_subscriptions`: `status = 'past_due'`
- Log for dunning (do not implement dunning logic here — just status flag)

`payment_intent.succeeded`
- Extract `deal_id` from `event.data.object.metadata`
- Update `deals`: `status = 'paid'`, `settled_at = NOW()`, confirm `stripe_payment_intent_id`
- Log: deal_id, amount_cents, platform_fee_cents for audit

`payment_intent.payment_failed`
- Extract `deal_id` from metadata
- Update `deals`: `status = 'failed'`
- Log: `last_payment_error.message`

`charge.refunded`
- Extract `deal_id` from metadata
- Update `deals`: `status = 'refunded'`
- Log: refund amount, reason

**5. Connect event handlers** (`event.account` present)

`account.updated`
- Call `stripe.accounts.retrieve(event.account)`
- Update `users`: `stripe_account_status`, `stripe_onboarding_complete`
  - If `details_submitted && charges_enabled`: status = `'active'`, `onboarding_complete = true`
  - If `!details_submitted`: status = `'pending'`
  - If account restricted: status = `'restricted'`
- Log status transition

`transfer.created`
- Log: connected account id, amount, `deal_id` from metadata (if present)

`transfer.reversed`
- Extract `deal_id` from metadata if present
- If deal_id found: update `deals`: `status = 'transfer_reversed'`
- Log: reversal, amount, connected account — flag for manual review

`transfer.updated`
- Log metadata update — no DB write required unless status field indicates issue

**6. Identity event handlers** (full implementation — not stubbed)

`identity.verification_session.verified`
```typescript
async function handleVerificationVerified(event: Stripe.Event) {
  const session = event.data.object as Stripe.Identity.VerificationSession
  const tiUserId = session.metadata?.ti_user_id
  if (!tiUserId) { console.error('No ti_user_id in Identity session metadata'); return }

  // 1. Update TI users table
  await db.query(`
    UPDATE users SET
      identity_verified = true,
      identity_verified_at = NOW(),
      identity_status = 'verified',
      stripe_verification_session_id = $1
    WHERE id = $2
  `, [session.id, tiUserId])

  // 2. Sync to HDICR — fire and forget with error isolation
  try {
    const hdicrToken = await getHdicrM2MToken() // Auth0 M2M token utility
    await fetch(`${process.env.HDICR_API_URL}/identity/verify-confirmed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hdicrToken}`
      },
      body: JSON.stringify({
        ti_user_id: tiUserId,
        verification_session_id: session.id,
        verified_at: new Date().toISOString(),
        assurance_level: 'high'
      })
    })
  } catch (err) {
    // HDICR sync failure must not fail the webhook — Stripe will not retry
    console.error('HDICR identity sync failed — manual reconciliation required:', err)
    // TODO: add to a reconciliation queue when that feature is built
  }
}
```

`identity.verification_session.requires_input`
- Update `users`: `identity_status = 'requires_input'`, `identity_verified = false`
- Log: session id, failure reasons from `session.last_error`

`identity.verification_session.canceled`
- Update `users`: `identity_status = 'canceled'`
- Clear `stripe_verification_session_id` if pending

**7. Unknown events**
- `console.log(`Unhandled Stripe event: ${event.type}`)` and return 200
- Never error on unhandled events — Stripe will retry on non-200

---

## Task B — Identity Session Creation: `/app/api/stripe/identity/session/route.ts`

Full implementation (not stub). POST endpoint, authenticated via Auth0.

```typescript
/**
 * POST /api/stripe/identity/session
 *
 * Creates a Stripe Identity VerificationSession for the authenticated actor.
 * Returns a client_secret for use with Stripe.js Identity modal,
 * or a url for redirect flow.
 *
 * Called from: Actor onboarding flow (Step 3 — Verify Identity)
 * Supersedes: HDICR identity-service Story 1.1
 */
```

Requirements:
1. Verify Auth0 session — actor role only
2. Check if actor already has `identity_status = 'verified'` — return 409 if so
3. Check for existing `pending` session on Stripe — retrieve and return if still valid
   (avoids duplicate sessions for same user)
4. Create VerificationSession:
   ```typescript
   await stripe.identity.verificationSessions.create({
     type: 'document',
     options: {
       document: {
         require_matching_selfie: true,
         require_live_capture: true,
       }
     },
     metadata: {
       ti_user_id: user.id,
       ti_user_email: session.user.email
     },
     return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboarding/identity/return`
   })
   ```
5. Store `stripe_verification_session_id` and `identity_status = 'pending'` in users table
6. Return `{ clientSecret: session.client_secret, sessionId: session.id }`

---

## Task C — Identity Status Check: `/app/api/stripe/identity/status/route.ts`

GET endpoint, authenticated via Auth0.

Returns current identity status for the authenticated user:
```typescript
{
  status: user.identity_status,         // 'unverified' | 'pending' | 'verified' | 'requires_input' | 'canceled'
  verifiedAt: user.identity_verified_at, // ISO string or null
  sessionId: user.stripe_verification_session_id // for client reference
}
```

If status is `pending`, also call `stripe.identity.verificationSessions.retrieve(sessionId)`
to get the latest status from Stripe directly — update DB if it has changed since last webhook.

---

## Task D — Helper: `/lib/stripe/index.ts`

Singleton Stripe client for use across all route handlers:

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia', // Match the API version shown in Stripe dashboard
  typescript: true,
})
```

> Note: API version `2026-03-25.dahlia` is confirmed from the Stripe dashboard screenshot.
> Do not use a different version string.

---

## Task E — Helper: `/lib/stripe/hdicrSync.ts`

Auth0 M2M token utility for HDICR API calls:

```typescript
/**
 * Gets a short-lived Auth0 M2M access token for calling HDICR APIs.
 * Tokens are cached in memory for their TTL to avoid unnecessary Auth0 requests.
 */

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getHdicrM2MToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token
  }

  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: process.env.HDICR_API_AUDIENCE,
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) throw new Error('Failed to obtain HDICR M2M token')

  const data = await response.json() as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000
  }
  return cachedToken.token
}
```

Add to environment variables (Vercel + `.env.example`):
- `AUTH0_M2M_CLIENT_ID` — Auth0 M2M app client ID for HDICR API access
- `AUTH0_M2M_CLIENT_SECRET` — Auth0 M2M app client secret
- `HDICR_API_AUDIENCE` — Auth0 API identifier for HDICR
- `HDICR_API_URL` — Base URL of HDICR API Gateway

---

## Additional Environment Variables to Add to `.env.example`

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_RETURN_URL=http://localhost:3000/onboarding/connect/return
STRIPE_CONNECT_REFRESH_URL=http://localhost:3000/onboarding/connect/refresh

# Stripe Price IDs (populate after running stripe-seed-products.ts)
STRIPE_PRICE_ACTOR_CREATOR_MONTHLY=price_...
STRIPE_PRICE_ACTOR_CREATOR_ANNUAL=price_...
STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY=price_...
STRIPE_PRICE_AGENCY_INDEPENDENT_ANNUAL=price_...
STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY=price_...
STRIPE_PRICE_AGENCY_BOUTIQUE_ANNUAL=price_...
STRIPE_PRICE_AGENCY_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_AGENCY_ANNUAL=price_...
STRIPE_PRICE_AGENCY_SEAT_ADDON=price_...
STRIPE_PRICE_STUDIO_INDIE_MONTHLY=price_...
STRIPE_PRICE_STUDIO_INDIE_ANNUAL=price_...
STRIPE_PRICE_STUDIO_MID_MONTHLY=price_...
STRIPE_PRICE_STUDIO_MID_ANNUAL=price_...

# HDICR API (for TI → HDICR authenticated calls)
HDICR_API_URL=https://api.hdicr.trulyimagined.com
HDICR_API_AUDIENCE=https://api.hdicr.trulyimagined.com
AUTH0_M2M_CLIENT_ID=...
AUTH0_M2M_CLIENT_SECRET=...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
