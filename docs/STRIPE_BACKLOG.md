# Stripe Integration Backlog

_Truly Imagined · TI Repo · Last updated: 2026-04-15 (Phase A in progress)_

---

## Confirmed Architecture Summary

TI is a Stripe Connect platform (Express mode). All Stripe logic lives exclusively in TI
(Next.js 15, App Router, Vercel). HDICR has no Stripe dependency.

Studios pay deal amounts as Stripe Customers via PaymentIntent with `application_fee_amount` +
`transfer_data.destination`. Actors and agencies are Express connected accounts who receive
payouts net of the platform application fee. Subscriptions are managed via Stripe Products and
Prices (13 price IDs, all env vars). Stripe Identity provides full KYC/identity assurance for
actors; results are synced to HDICR via a single authenticated API call to
`POST /identity/verify-confirmed`. One webhook endpoint handles all platform, Connect, and
Identity events.

---

## Architectural Decisions Log

| #   | Decision                     | Chosen                                           | Notes                                                                                                                                                         |
| --- | ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Webhook endpoint path        | **Keep `/api/webhooks/stripe`**                  | Live, verified, middleware bypass correct. Docs superseded by live implementation.                                                                            |
| 2   | Webhook async model          | **Option C — hybrid**                            | identity/critical events inline; charge and payout handlers deferred via `setImmediate`.                                                                      |
| 3   | HDICR identity sync contract | **`POST /identity/verify-confirmed` everywhere** | Replace all `identity/link/create`, `identity/link/reactivate`, `identity/link/unlink-by-id` calls after webhook. Requires new HDICR endpoint implementation. |
| 4   | Subscription price seeding   | **Option C — env vars, Stripe Dashboard**        | All 13 price IDs pre-created in Dashboard; stored as env vars in Vercel. No seed script required.                                                             |
| 5   | Phasing                      | **Phase-gate model**                             | Review and approve at end of each phase before proceeding to next.                                                                                            |

---

## Current State Audit

| File Path                                                        | Feature                   | Status         | Notes                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/api/webhooks/stripe/route.ts`                  | Webhook handler           | `NEEDS_UPDATE` | Has identity + charge + payout handlers. Missing `payment_intent.succeeded`, Connect events, async model                              |
| `apps/web/src/lib/stripe.ts`                                     | Stripe singleton          | `NEEDS_UPDATE` | API version 2026-02-25.clover (target: 2026-03-25.dahlia). No Connect account methods                                                 |
| `apps/web/src/lib/billing.ts`                                    | Subscription plans        | `NEEDS_UPDATE` | 3 monthly prices only; target 13 prices (monthly + annual + seat addon)                                                               |
| `apps/web/src/app/api/billing/checkout/route.ts`                 | Checkout session          | `NEEDS_UPDATE` | No Connect provisioning or deal logic                                                                                                 |
| `apps/web/src/app/api/billing/portal/route.ts`                   | Billing portal            | `CORRECT`      | Basic portal redirect working                                                                                                         |
| `apps/web/src/app/api/billing/summary/route.ts`                  | Subscription summary      | `NEEDS_UPDATE` | No annual/seat-addon awareness                                                                                                        |
| `apps/web/src/app/api/verification/start/route.ts`               | Identity session start    | `NEEDS_UPDATE` | Multi-provider pattern; target Stripe-only under `/api/stripe/identity/session`                                                       |
| `apps/web/src/app/api/verification/status/route.ts`              | Identity session status   | `NEEDS_UPDATE` | Multi-provider aggregation; target Stripe-only under `/api/stripe/identity/status`                                                    |
| `apps/web/src/lib/hdicr/stripe-webhook-client.ts`                | HDICR identity sync       | `NEEDS_UPDATE` | Calls old link CRUD endpoints; replace with single `verify-confirmed` call                                                            |
| `apps/web/src/lib/hdicr/identity-client.ts`                      | HDICR identity client     | `NEEDS_UPDATE` | Add `verifyIdentityConfirmed()` function targeting `/identity/verify-confirmed`                                                       |
| `apps/web/src/middleware.ts`                                     | Webhook rate-limit bypass | `CORRECT`      | Bypasses `/api/webhooks/stripe` — correct, no change needed                                                                           |
| `infra/database/migrations/035_ti_webhook_commercial_tables.sql` | Webhook + commerce schema | `NEEDS_UPDATE` | Has `stripe_events`, `commercial_licenses`, `wallet_balances`; missing `user_subscriptions`, `deals`, Connect account fields on users |
| `apps/web/.env.example`                                          | Environment template      | `NEEDS_UPDATE` | Has 3 monthly prices; missing 10 price IDs and Connect redirect URLs                                                                  |
| `hdicr/infra/samconfig.toml`                                     | HDICR infra config        | `REMOVE`       | Wires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — architecture violation                                                          |
| `hdicr/infra/template.yaml`                                      | HDICR SAM template        | `REMOVE`       | Contains Stripe env params on Lambda — architecture violation                                                                         |
| `apps/web/src/app/api/stripe/`                                   | Connect + deal routes     | `MISSING`      | Entire directory does not exist; 5+ routes required                                                                                   |

---

## Backlog Items

### Phase A — Contract Alignment

_Foundational decisions that all other phases depend on. Must be approved before Phase B._

---

- [x] **STRIPE-001 — Canonical Webhook Path** ✅ RESOLVED
  - **Status:** Complete
  - **Decision:** Keep `/api/webhooks/stripe`. Docs updated to reflect live implementation.
  - **Files affected:** None — live and correct.

---

- [ ] **STRIPE-002 — Hybrid Async Webhook Processing Model**
- [x] **STRIPE-002 — Hybrid Async Webhook Processing Model** ✅ COMPLETE
  - **Priority:** HIGH
  - **Decision applied:** Option C (hybrid — identity/critical inline, charge/payout deferred)
  - **Depends on:** STRIPE-001 ✅
  - **Implemented:** `apps/web/src/app/api/webhooks/stripe/route.ts` — charge/payout cases consolidated into single `setImmediate` block with internal try/catch; webhook always returns 200 before async work runs; identity events remain inline

---

- [ ] **STRIPE-008 — Stripe API Version Upgrade**
- [x] **STRIPE-008 — Stripe API Version Upgrade** ✅ COMPLETE
  - **Priority:** MEDIUM
  - **Depends on:** None
  - **Implemented:**
    - `apps/web/src/lib/stripe.ts` — `apiVersion` updated to `'2026-03-25.dahlia'`
    - `apps/web/package.json` — `stripe` SDK upgraded `^20.4.1` → `^21.0.1` (v21 introduces dahlia type support)
    - Type-check passes, 103 contract tests pass

---

- [ ] **STRIPE-011 — Event Persistence: Keep `stripe_events`, Add Missing Columns**
- [x] **STRIPE-011 — Event Persistence: Keep `stripe_events`, Add Missing Columns** ✅ COMPLETE
  - **Priority:** LOW
  - **Depends on:** None
  - **Implemented:** `infra/database/migrations/036_stripe_events_connect_account.sql` — adds `connect_account_id TEXT` (nullable, indexed) to `stripe_events` for Phase B Connect event routing. Existing schema is superset of docs' `webhook_events` table; no other columns missing.

---

- [ ] **STRIPE-013 — HDICR Identity Sync: Migrate to `POST /identity/verify-confirmed`**
  - **Priority:** HIGH
  - **Description:** Replace the existing multi-call identity link pattern
    (`/v1/identity/link/create`, `/v1/identity/link/reactivate`) with a single call to
    `POST /identity/verify-confirmed`. This endpoint does not yet exist in HDICR and must be
    implemented there. Two-part item spanning both repos.
  - **Decision applied:** `/identity/verify-confirmed` everywhere (user decision #3)
  - **Depends on:** None (but HDICR endpoint must be available before TI side goes to production)
  - **Files affected — TI:**
    - `apps/web/src/lib/hdicr/identity-client.ts` — add `verifyIdentityConfirmed(params)` function calling `POST /identity/verify-confirmed` with `{ ti_user_id, verification_session_id, verified_at, assurance_level }`
    - `apps/web/src/lib/hdicr/stripe-webhook-client.ts` — replace `createStripeIdentityLinkVerified` / `updateStripeIdentityLinkVerified` / `createStripeIdentityLinkRequiresInput` with single `verifyIdentityConfirmed()` call for the `verified` event; update or remove `requires_input` and `canceled` handlers accordingly
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — update `identity.verification_session.verified` handler to use new client function
  - **Files affected — HDICR (separate repo):**
    - New route handler: `POST /identity/verify-confirmed` in HDICR `identity-service`
    - Accepts: `{ ti_user_id, verification_session_id, verified_at, assurance_level }`
    - Updates actor's identity record in consent registry; returns 200 on success
    - Must be protected by Auth0 M2M token validation (same pattern as existing HDICR routes)
  - **⚠️ Note:** TI and HDICR implementations must be coordinated. Deploy HDICR endpoint first or use feature flag to avoid breaking production sync during rollout.

---

### Phase B — Connect Platform

_Depends on Phase A approval. Enables actor payout eligibility._

---

- [ ] **STRIPE-003 — Stripe Connect Express Account Lifecycle**
  - **Priority:** CRITICAL
  - **Description:** Implement full actor Connect Express onboarding: account creation, account
    link generation (onboarding URL), return and refresh URL handlers, account status endpoint.
    Actors must complete Connect onboarding to be payout-eligible for deals.
  - **Depends on:** STRIPE-008
  - **Files affected:**
    - `apps/web/src/app/api/stripe/connect/create/route.ts` — NEW: `POST`, creates Stripe Connect Express account for actor, stores `stripe_account_id` on user record
    - `apps/web/src/app/api/stripe/connect/onboarding/route.ts` — NEW: `POST`, creates AccountLink for hosted onboarding, returns URL
    - `apps/web/src/app/api/stripe/connect/return/route.ts` — NEW: `GET`, return URL after actor completes onboarding (check status + redirect)
    - `apps/web/src/app/api/stripe/connect/refresh/route.ts` — NEW: `GET`, refresh URL if onboarding link expires (generate new link + redirect)
    - `apps/web/src/app/api/stripe/connect/status/route.ts` — NEW: `GET`, returns `{ onboarding_complete, payouts_enabled, charges_enabled, account_id }`
    - `apps/web/src/lib/stripe.ts` — add `createConnectAccount()`, `createAccountLink()`, `retrieveConnectAccount()` helpers
    - `apps/web/.env.example` — add `STRIPE_CONNECT_RETURN_URL`, `STRIPE_CONNECT_REFRESH_URL`
    - New migration: add `stripe_account_id VARCHAR`, `stripe_account_status VARCHAR`, `stripe_onboarding_complete BOOLEAN DEFAULT false` to `users` table

---

- [ ] **STRIPE-004 — Connect Webhook Event Routing**
  - **Priority:** CRITICAL
  - **Description:** Add event routing for Connect events distinguished by presence of
    `event.account`. Handle: `account.updated` (sync onboarding status), `transfer.created`
    (log successful payout), `transfer.reversed` (log reversal), `transfer.updated`.
    Platform events (no `event.account`) continue to existing handlers.
  - **Depends on:** STRIPE-002, STRIPE-003
  - **Files affected:**
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — add top-level `if (event.account)` branch before existing event.type routing; implement `account.updated`, `transfer.created`, `transfer.reversed`, `transfer.updated` handlers

---

### Phase C — Marketplace Payments

_Depends on Phase B approval. Enables deal flow and platform revenue._

---

- [ ] **STRIPE-005 — Deal Initiation: PaymentIntent with Application Fee + Transfer**
  - **Priority:** CRITICAL
  - **Description:** Implement deal payment flow. Studio calls endpoint to initiate a deal;
    TI calculates platform fee using band logic, creates PaymentIntent with
    `application_fee_amount` and `transfer_data.destination` set to actor's connected account.
    TI inserts `deals` row with full audit trail before returning `clientSecret`.
  - **Platform fee bands:**
    | Deal Value | Fee |
    |---|---|
    | ≤ $5,000 | 17.5% |
    | $5,001 – $50,000 | 13% |
    | $50,001 – $100,000 | 9% |
    | > $100,000 | 7.5% |
  - **Depends on:** STRIPE-003 (actor must have Connect account), STRIPE-008
  - **Files affected:**
    - `apps/web/src/app/api/stripe/deals/initiate/route.ts` — NEW: `POST`, validates actor has `stripe_account_id`, calculates fee, creates PaymentIntent, inserts `deals` row
    - `apps/web/src/lib/stripe/platformFee.ts` — NEW: fee band calculation utility
    - New migration: create `deals` table with columns `id`, `studio_user_id`, `actor_user_id`, `deal_value_cents`, `platform_fee_cents`, `actor_payout_cents`, `stripe_payment_intent_id`, `stripe_transfer_id`, `status` (pending/paid/failed/reversed), `settled_at`, `created_at`

---

- [ ] **STRIPE-006 — Deal Settlement: `payment_intent.succeeded` Handler**
  - **Priority:** CRITICAL
  - **Description:** Add `payment_intent.succeeded` webhook handler. Marks deal as `'paid'`,
    records `settled_at`, logs Stripe transfer ID once `transfer.created` fires. Must be
    idempotent (check deal status before writing).
  - **Depends on:** STRIPE-005, STRIPE-002
  - **Files affected:**
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — add `payment_intent.succeeded` case in platform event handler; update `deals` row status to `'paid'`

---

### Phase D — Subscriptions

_Depends on Phase C approval. Completes the billing model._

---

- [ ] **STRIPE-009 — Expand Subscription Price Matrix to 13 Prices**
  - **Priority:** HIGH
  - **Description:** Current implementation has 3 monthly prices. Target is 13 price IDs:
    Actor Creator (monthly + annual), Agency Independent/Boutique/Agency (monthly + annual each),
    Agency Seat Addon (monthly), Studio Indie/Mid (monthly + annual each). All IDs stored as
    env vars referencing prices pre-created in Stripe Dashboard.
  - **Decision applied:** Option C — prices pre-created in Dashboard, referenced by env var.
  - **Required env vars (new):**
    - `STRIPE_PRICE_ACTOR_CREATOR_MONTHLY` (rename from `STRIPE_PRICE_ACTOR_MONTHLY`)
    - `STRIPE_PRICE_ACTOR_CREATOR_ANNUAL`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_ANNUAL`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_ANNUAL`
    - `STRIPE_PRICE_AGENCY_AGENCY_MONTHLY`
    - `STRIPE_PRICE_AGENCY_AGENCY_ANNUAL`
    - `STRIPE_PRICE_AGENCY_SEAT_ADDON_MONTHLY`
    - `STRIPE_PRICE_STUDIO_INDIE_MONTHLY`
    - `STRIPE_PRICE_STUDIO_INDIE_ANNUAL`
    - `STRIPE_PRICE_STUDIO_MID_MONTHLY`
    - `STRIPE_PRICE_STUDIO_MID_ANNUAL`
  - **Depends on:** STRIPE-008
  - **Files affected:**
    - `apps/web/src/lib/billing.ts` — redefine plan map with all 13 prices; add `interval` (monthly/annual) to plan selection logic; add seat-addon support
    - `apps/web/src/app/api/billing/checkout/route.ts` — accept `interval` param; pass correct price ID
    - `apps/web/src/app/api/billing/summary/route.ts` — handle annual/seat-addon awareness
    - `apps/web/.env.example` — add all 13 price var declarations
    - New migration: create `user_subscriptions` table with `id`, `user_id`, `stripe_subscription_id`, `stripe_customer_id`, `plan_key`, `interval`, `status`, `current_period_end`, `seat_count`, `created_at`, `updated_at`

---

- [ ] **STRIPE-010 — Subscription Webhook Handlers**
  - **Priority:** HIGH
  - **Description:** Add subscription lifecycle webhook handlers:
    `customer.subscription.created` (provision tier access, insert `user_subscriptions`),
    `customer.subscription.updated` (handle plan/seat changes, update `user_subscriptions`),
    `customer.subscription.deleted` (revoke access, mark status `'canceled'`).
  - **Decision applied:** Env vars only, prices pre-created in Dashboard (no seed script).
  - **Depends on:** STRIPE-009, STRIPE-002
  - **Files affected:**
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — add `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` handlers with `user_subscriptions` DB writes

---

### Phase E — HDICR Cleanup

_Depends on Phase D approval. Removes architectural violations and aligns identity routes._

---

- [ ] **STRIPE-007 — Identity Route Namespace Alignment**
  - **Priority:** MEDIUM
  - **Description:** Current identity routes (`/api/verification/start`, `/api/verification/status`)
    still have multi-provider logic (mock, Onfido, Yoti, Stripe). Target is Stripe-only under
    `/api/stripe/identity/session` and `/api/stripe/identity/status`. Legacy routes should either
    redirect or be removed once Stripe-only is confirmed working.
  - **Depends on:** STRIPE-013
  - **Files affected:**
    - `apps/web/src/app/api/stripe/identity/session/route.ts` — NEW: `POST`, Stripe-only identity session creation (replaces `/api/verification/start`)
    - `apps/web/src/app/api/stripe/identity/status/route.ts` — NEW: `GET`, Stripe-only verification status (replaces `/api/verification/status`)
    - `apps/web/src/app/api/verification/start/route.ts` — deprecate or redirect to new route
    - `apps/web/src/app/api/verification/status/route.ts` — deprecate or redirect to new route

---

- [ ] **STRIPE-012 — Remove Stripe Config from HDICR Infra**
  - **Priority:** HIGH
  - **Description:** HDICR infra currently wires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
    as Lambda environment parameters — an architecture violation. HDICR should have zero Stripe
    dependency. Remove from both SAM template and samconfig.
  - **Depends on:** STRIPE-013 HDICR implementation (ensure `verify-confirmed` endpoint is live
    before removing any Stripe coupling, in case there's a transitive dependency)
  - **Files affected — HDICR repo:**
    - `hdicr/infra/samconfig.toml` — remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` parameter entries
    - `hdicr/infra/template.yaml` — remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` from Lambda env block
    - Verify no HDICR service code references either variable (grep confirms zero service-side Stripe code)

---

### Phase F — Hardening

_Depends on Phase E approval. Validates complete implementation and prepares for production._

---

- [ ] **STRIPE-014 — Integration Contract Tests: Connect + Payments**
  - **Priority:** HIGH
  - **Description:** Extend contract test suite to cover new Stripe Connect and payment flows.
    Current 103 tests cover identity webhook scenarios. Add tests for: Connect account creation
    response shape, deal initiation response (clientSecret present), subscription webhook handler
    response, `payment_intent.succeeded` idempotency, Connect event routing by `event.account`.
  - **Depends on:** STRIPE-003, STRIPE-004, STRIPE-005, STRIPE-006, STRIPE-009, STRIPE-010
  - **Files affected:**
    - `apps/web/src/app/api/stripe/connect/` — test files for Connect routes
    - `apps/web/src/app/api/stripe/deals/` — test file for deal initiation
    - `apps/web/src/app/api/webhooks/stripe/` — extend existing webhook contract tests

---

- [ ] **STRIPE-015 — Production Validation**
  - **Priority:** HIGH
  - **Description:** End-to-end validation with live Stripe test mode keys. Verify:
    (1) webhook endpoint liveness (`pnpm check:webhook-endpoint`),
    (2) Connect account creation and onboarding URL generation,
    (3) test deal PaymentIntent with fee calculation,
    (4) subscription checkout for each of the 13 prices,
    (5) Identity session creation and webhook delivery,
    (6) HDICR `verify-confirmed` sync (requires TI_DATABASE_URL and HDICR test environment).
    Resolve any env var gaps between `.env.example` and Vercel project settings.
  - **Depends on:** All prior items complete
  - **Files affected:**
    - `scripts/` — new production validation script covering Connect + deals + subscriptions

---

## Phase Gate Checklist

| Phase                        | Items                                                                  | Status       | Gate Condition                                        |
| ---------------------------- | ---------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| **A — Contract Alignment**   | STRIPE-001 ✅, STRIPE-002 ✅, STRIPE-008 ✅, STRIPE-011 ✅, STRIPE-013 | 4/5 complete | STRIPE-013 spans HDICR repo — awaiting HDICR endpoint |
| **B — Connect Platform**     | STRIPE-003, STRIPE-004                                                 | 0/2 complete | Phase A approved                                      |
| **C — Marketplace Payments** | STRIPE-005, STRIPE-006                                                 | 0/2 complete | Phase B approved                                      |
| **D — Subscriptions**        | STRIPE-009, STRIPE-010                                                 | 0/2 complete | Phase C approved                                      |
| **E — HDICR Cleanup**        | STRIPE-007, STRIPE-012                                                 | 0/2 complete | Phase D approved + STRIPE-013 HDICR endpoint live     |
| **F — Hardening**            | STRIPE-014, STRIPE-015                                                 | 0/2 complete | Phase E approved                                      |

**Total progress: 4 / 15 items complete**

---

## Quick Reference: Environment Variables Required

### Currently in `.env.example`

```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ACTOR_MONTHLY       ← rename to STRIPE_PRICE_ACTOR_CREATOR_MONTHLY
STRIPE_PRICE_AGENT_MONTHLY       ← replace with agency tier vars (see STRIPE-009)
STRIPE_PRICE_STUDIO_MONTHLY      ← replace with studio tier vars (see STRIPE-009)
```

### To Add (STRIPE-003)

```
STRIPE_CONNECT_RETURN_URL
STRIPE_CONNECT_REFRESH_URL
```

### To Add (STRIPE-009) — 13 price IDs total

```
STRIPE_PRICE_ACTOR_CREATOR_MONTHLY
STRIPE_PRICE_ACTOR_CREATOR_ANNUAL
STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY
STRIPE_PRICE_AGENCY_INDEPENDENT_ANNUAL
STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY
STRIPE_PRICE_AGENCY_BOUTIQUE_ANNUAL
STRIPE_PRICE_AGENCY_AGENCY_MONTHLY
STRIPE_PRICE_AGENCY_AGENCY_ANNUAL
STRIPE_PRICE_AGENCY_SEAT_ADDON_MONTHLY
STRIPE_PRICE_STUDIO_INDIE_MONTHLY
STRIPE_PRICE_STUDIO_INDIE_ANNUAL
STRIPE_PRICE_STUDIO_MID_MONTHLY
STRIPE_PRICE_STUDIO_MID_ANNUAL
```

---

## Notes

- **STRIPE-013 cross-repo dependency**: TI's `verify-confirmed` client can be written immediately,
  but production deploy must be coordinated with HDICR endpoint availability. Deploy HDICR first
  or use a feature flag / graceful fallback on the TI side during rollout.
- **STRIPE-009 renaming**: `STRIPE_PRICE_ACTOR_MONTHLY` → `STRIPE_PRICE_ACTOR_CREATOR_MONTHLY`
  is a rename, not just an addition. Existing Vercel env var must be updated and old key removed.
- **Middleware** (`apps/web/src/middleware.ts`): Rate-limit bypass is at `/api/webhooks/stripe`
  and must stay unchanged. No middleware changes required across all 15 items.
