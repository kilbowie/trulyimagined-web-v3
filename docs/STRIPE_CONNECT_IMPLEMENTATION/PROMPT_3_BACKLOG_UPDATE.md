# Prompt 3 — STRIPE_BACKLOG.md Update & Stripe Dashboard Checklist
> Run after Prompt 2 (webhook handler and Identity implementation complete).

---

## Instructions for Copilot

Update `/docs/STRIPE_BACKLOG.md` to reflect the completed implementation from Prompt 2.
Do not modify any implementation files in this prompt — documentation only.

---

## Task 1 — Mark Resolved Items

For each backlog item resolved by the Prompt 2 implementation, update its status to:
`DONE — implemented in [file path] on [date]`

Items expected to be resolved by Prompt 2:
- Webhook handler creation/replacement
- Identity session creation endpoint
- Identity status endpoint
- Stripe singleton client
- HDICR M2M sync helper
- Database migrations (0004, 0005, 0006)

---

## Task 2 — Add Implementation Log Entry

Append to the `## Implementation Log` section:

```markdown
### Prompt 2 — [DATE]
- Created: `/app/api/stripe/webhooks/route.ts` (unified webhook handler)
- Created: `/app/api/stripe/identity/session/route.ts` (Identity session creation)
- Created: `/app/api/stripe/identity/status/route.ts` (Identity status check)
- Created: `/lib/stripe/index.ts` (Stripe singleton client)
- Created: `/lib/stripe/hdicrSync.ts` (Auth0 M2M token utility)
- Created: `/migrations/0004_webhook_events.sql`
- Created: `/migrations/0005_user_subscriptions.sql`
- Created: `/migrations/0006_stripe_identity_fields.sql`
- Updated: `.env.example` with all Stripe and HDICR API variables
- Superseded: HDICR Story 1.1 and 1.2 (Stripe Identity in identity-service)
```

---

## Task 3 — Add Stripe Dashboard Configuration Checklist

Add a new section `## Stripe Dashboard Configuration Checklist` with the following content.
This is the manual setup required in the Stripe dashboard that cannot be done in code.

```markdown
## Stripe Dashboard Configuration Checklist

### API Version
Confirmed version: `2026-03-25.dahlia`
Ensure all SDK calls use this version string in the Stripe client constructor.

---

### Connect Setup
- [ ] Enable Stripe Connect → Platform type: **Express**
- [ ] Set platform name: "Truly Imagined"
- [ ] Set branding: upload logo and set brand colour
- [ ] Configure redirect URLs:
  - Return URL: `https://trulyimagined.com/onboarding/connect/return`
  - Refresh URL: `https://trulyimagined.com/onboarding/connect/refresh`
- [ ] Enable **Transfers** capability for Express accounts
- [ ] Set payout schedule: **Manual** (not automatic)
  - Rationale: manual payouts give a buffer to handle disputes before funds leave platform
  - Review and switch to automatic once flow is validated in production

---

### Webhook Setup

**Single endpoint — all event types**

- [ ] Navigate to: Developers → Webhooks → Add endpoint
- [ ] Endpoint URL: `https://trulyimagined.com/api/stripe/webhooks`
- [ ] API version: `2026-03-25.dahlia`
- [ ] Enable **"Listen to events on Connected accounts"** toggle
- [ ] Select the following events:

**Platform events:**
- [ ] `customer.subscription.created`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`
- [ ] `invoice.payment_succeeded`
- [ ] `invoice.payment_failed`
- [ ] `payment_intent.succeeded`
- [ ] `payment_intent.payment_failed`
- [ ] `charge.refunded`

**Connect events** (require "Connected accounts" toggle enabled):
- [ ] `account.updated`
- [ ] `transfer.created`
- [ ] `transfer.reversed`
- [ ] `transfer.updated`

**Identity events:**
- [ ] `identity.verification_session.verified`
- [ ] `identity.verification_session.requires_input`
- [ ] `identity.verification_session.canceled`

> **Note on `transfer.failed`:** This event does not exist in Stripe.
> Use `transfer.reversed` for reversal/failure handling.
> For bank payout failures on connected accounts, `payout.failed` fires
> on the connected account — optionally add via Connect event forwarding
> when needed.

- [ ] Save endpoint
- [ ] Copy **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET` in Vercel

---

### Stripe Identity Setup

- [ ] Enable Stripe Identity in dashboard (Products → Identity)
- [ ] Set verification type: **Document + Selfie** (`require_matching_selfie: true`)
- [ ] Confirm Identity events are received on the same webhook endpoint
  (no separate endpoint required — Identity events share the platform webhook)
- [ ] Review Stripe Identity data retention settings:
  - Recommend: retain verification data for 7 years (regulatory default)
  - Confirm this aligns with your privacy policy / GDPR obligations

---

### Product & Price Seeding

- [ ] Run seed script: `tsx scripts/stripe-seed-products.ts`
- [ ] Confirm all 13 products created successfully (check console output)
- [ ] Copy all price IDs to Vercel environment variables:
  - `STRIPE_PRICE_ACTOR_CREATOR_MONTHLY`
  - `STRIPE_PRICE_ACTOR_CREATOR_ANNUAL`
  - `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY`
  - `STRIPE_PRICE_AGENCY_INDEPENDENT_ANNUAL`
  - `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY`
  - `STRIPE_PRICE_AGENCY_BOUTIQUE_ANNUAL`
  - `STRIPE_PRICE_AGENCY_AGENCY_MONTHLY`
  - `STRIPE_PRICE_AGENCY_AGENCY_ANNUAL`
  - `STRIPE_PRICE_AGENCY_SEAT_ADDON`
  - `STRIPE_PRICE_STUDIO_INDIE_MONTHLY`
  - `STRIPE_PRICE_STUDIO_INDIE_ANNUAL`
  - `STRIPE_PRICE_STUDIO_MID_MONTHLY`
  - `STRIPE_PRICE_STUDIO_MID_ANNUAL`

---

### Local Development Webhook Forwarding

```bash
# Install Stripe CLI if not already installed
brew install stripe/stripe-cli/stripe

# Log in
stripe login

# Forward to local Next.js dev server
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

**Important:** The Stripe CLI outputs a `whsec_` signing secret.
Use THIS value for `STRIPE_WEBHOOK_SECRET` in `.env.local` during local development.
It is different from the dashboard webhook secret.
Do not commit either to version control.

---

### Vercel Environment Variables — Final Checklist

Before production deployment, confirm all of the following are set in Vercel
(Settings → Environment Variables), not in any committed file:

**Stripe:**
- [ ] `STRIPE_SECRET_KEY` (live key for production, test key for preview)
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_CONNECT_RETURN_URL`
- [ ] `STRIPE_CONNECT_REFRESH_URL`
- [ ] All 13 `STRIPE_PRICE_*` variables

**HDICR API:**
- [ ] `HDICR_API_URL`
- [ ] `HDICR_API_AUDIENCE`
- [ ] `AUTH0_M2M_CLIENT_ID`
- [ ] `AUTH0_M2M_CLIENT_SECRET`

**App:**
- [ ] `NEXT_PUBLIC_BASE_URL` (production URL, not localhost)
```

---

## Task 4 — Add HDICR Stripe References Removal Tracker

Add a section `## HDICR Stripe Removal Status` if it doesn't exist,
and update each item found during the audit (Prompt 1) with:
- [ ] Removed / [ ] Pending removal
- Replacement approach confirmed (TI webhook → HDICR API call pattern)
- Date removed

---

## Task 5 — Flag Any Outstanding Items

If any items from the original backlog were NOT addressed by Prompt 2,
re-prioritise them and flag for the next implementation prompt.
