# Prompt 1 — Stripe Audit & STRIPE_BACKLOG.md Creation
> Run this first in VS Code Copilot before any implementation work.

---

## Instructions for Copilot

You are conducting a Stripe integration audit for a Next.js 15 (App Router, TypeScript strict)
platform called Truly Imagined (TI), deployed on Vercel.

---

## Confirmed Architecture

- **All Stripe logic lives exclusively in TI.** No Stripe code exists or should exist in the
  HDICR repo (AWS Lambda/SAM). HDICR is payment-agnostic.
- **Stripe Connect Express** is confirmed for marketplace payments. TI is the platform account.
  Actors and agencies are Express connected accounts who receive payouts.
- **Studios are Stripe Customers** who pay deal amounts via PaymentIntent.
- **Platform collects an application fee** from each deal payment (sliding scale 7.5%–17.5%).
- **Subscriptions** (Actor Creator, Agency tiers, Studio tiers) are managed separately from
  deal payments using Stripe Products and Prices.
- **Stripe Identity** is used for full actor KYC/identity assurance. This is NOT stubbed —
  full implementation is required. Sessions are initiated from TI, webhook results are handled
  in TI, and then synced to HDICR via an authenticated API call to `POST /identity/verify-confirmed`.
- **One webhook endpoint:** `POST /api/stripe/webhooks` handles all Stripe events (platform,
  Connect, and Identity) using a single signing secret.

---

## Background: Previous Planning Conflicts to Resolve

Earlier sprint planning (Sprint 1, Stories 1.1 and 1.2) placed Stripe Identity session creation
and webhook handling inside HDICR's `identity-service` Lambda at `/api/webhooks/stripe`.

**This is now incorrect and must not be implemented.** All Stripe code lives in TI.
HDICR's `identity-service` only needs to expose `POST /identity/verify-confirmed` which TI
calls after receiving and processing the Identity webhook result.

Mark Stories 1.1 and 1.2 in any HDICR sprint backlog as **SUPERSEDED — migrated to TI**.

---

## Task

### Step 1 — Audit TI Codebase

Search the entire TI codebase for all Stripe-related code:

- Any `import` or `require` of `'stripe'`
- Any reference to `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_CONNECT_*`
- Any route handlers under `/app/api/` that reference Stripe
- Any `/lib/` utilities referencing Stripe
- Any environment variable files (`.env.example`, `.env.local`) with Stripe keys
- Any references to `stripe` in `package.json`

For each file found, document:
- File path
- What Stripe feature it implements
- Whether it is Connect-aware (uses `transfer_data`, `application_fee_amount`, or `account` params)
- Whether webhooks use `request.text()` (correct for App Router) not `request.json()` (incorrect)
- Whether it aligns with the confirmed architecture above
- Any issues or gaps

### Step 2 — Audit HDICR Codebase

Search the HDICR repo for any Stripe references that should not be there.
Document each as a removal/migration item. HDICR should have zero Stripe dependencies.

### Step 3 — Create `/docs/STRIPE_BACKLOG.md`

Use the exact structure below:

---

```markdown
# Stripe Integration Backlog
_Truly Imagined · TI Repo · Last updated: [DATE]_

## Confirmed Architecture Summary

TI is a Stripe Connect platform (Express mode). All Stripe logic lives exclusively in TI
(Next.js 15, App Router, Vercel). HDICR has no Stripe dependency.

Studios pay deal amounts as Stripe Customers via PaymentIntent. Actors and agencies are
Express connected accounts who receive payouts net of the platform application fee.
Subscriptions are managed via Stripe Products and Prices. Stripe Identity provides full
KYC/identity assurance for actors; results are synced to HDICR via authenticated API call.
One webhook endpoint handles all platform, Connect, and Identity events.

## Current State

| File Path | Feature | Status | Issues |
|-----------|---------|--------|--------|
| [populate from audit] | | CORRECT / NEEDS_UPDATE / MISSING / REMOVE | |

## Backlog Items

[Numbered list — each item:]
- **ID:** STRIPE-001
- **Title:**
- **Description:**
- **Priority:** HIGH / MEDIUM / LOW
- **Depends on:** [other IDs if applicable]
- **Files affected:**

## Webhook Configuration

### Endpoint
Single endpoint: `POST /api/stripe/webhooks`
One Stripe webhook registered in dashboard with Connect events enabled.

### Platform Events (no `event.account`)

| Event | Purpose |
|-------|---------|
| `customer.subscription.created` | Provision tier access on signup |
| `customer.subscription.updated` | Handle plan/seat changes |
| `customer.subscription.deleted` | Revoke access on cancellation |
| `invoice.payment_succeeded` | Confirm payment, activate annual plans |
| `invoice.payment_failed` | Flag for dunning |
| `payment_intent.succeeded` | Confirm deal payment, log audit entry |
| `payment_intent.payment_failed` | Mark deal failed, notify studio |
| `charge.refunded` | Handle deal refund |

### Connect Events (`event.account` present — actor/agency connected accounts)

| Event | Purpose |
|-------|---------|
| `account.updated` | Onboarding status changed — update `stripe_account_status` |
| `transfer.created` | Payout initiated — log for audit trail |
| `transfer.reversed` | Transfer reversed — flag for manual intervention |
| `transfer.updated` | Metadata/status update on transfer |

> Note: `transfer.failed` does not exist as a Stripe event. Use `transfer.reversed`
> for reversal/failure handling. For connected account bank payout failures specifically,
> `payout.failed` fires on the connected account — optionally add via Connect event forwarding.

### Identity Events (full implementation — not stubbed)

| Event | Purpose |
|-------|---------|
| `identity.verification_session.verified` | Update actor identity status, sync to HDICR |
| `identity.verification_session.requires_input` | Prompt actor to retry |
| `identity.verification_session.canceled` | Clean up pending session |

### Local Development
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```
> Use the `whsec_` secret output by the Stripe CLI, NOT the dashboard webhook secret.
> These are different secrets. Update `STRIPE_WEBHOOK_SECRET` in `.env.local` to the CLI value
> during local development only.

## Environment Variables Required

| Variable | Where Set | Required For |
|----------|-----------|-------------|
| `STRIPE_SECRET_KEY` | Vercel env (secret) | All Stripe API calls |
| `STRIPE_PUBLISHABLE_KEY` | Vercel env (non-secret) | Client-side Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | Vercel env (secret) | Webhook signature verification |
| `STRIPE_CONNECT_RETURN_URL` | Vercel env | Express onboarding return redirect |
| `STRIPE_CONNECT_REFRESH_URL` | Vercel env | Express onboarding refresh redirect |
| `STRIPE_PRICE_ACTOR_CREATOR_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_ACTOR_CREATOR_ANNUAL` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_INDEPENDENT_ANNUAL` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_BOUTIQUE_ANNUAL` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_AGENCY_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_AGENCY_ANNUAL` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_AGENCY_SEAT_ADDON` | Vercel env | Seat add-on |
| `STRIPE_PRICE_STUDIO_INDIE_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_STUDIO_INDIE_ANNUAL` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_STUDIO_MID_MONTHLY` | Vercel env | Subscription checkout |
| `STRIPE_PRICE_STUDIO_MID_ANNUAL` | Vercel env | Subscription checkout |

## HDICR Stripe References to Remove

| File | Reference Found | Action |
|------|----------------|--------|
| [populate from HDICR audit] | | REMOVE / MIGRATE TO TI |

Replacement pattern: TI handles all Stripe events → TI calls `POST /identity/verify-confirmed`
on HDICR API with Auth0 M2M token. HDICR updates identity record. No Stripe SDK in HDICR.

## Known Superseded Items

| Sprint Story | Original Location | Status | Replacement |
|-------------|-------------------|--------|-------------|
| Story 1.1: Stripe Identity Session Creation | HDICR identity-service | SUPERSEDED | TI: `/app/api/stripe/identity/session/route.ts` |
| Story 1.2: Stripe Identity Webhook Handling | HDICR identity-service | SUPERSEDED | TI: `/app/api/stripe/webhooks/route.ts` |

## Implementation Log

[Entries added as prompts are completed]
```

---

Do not create any implementation files in this prompt. Audit and document only.
