# Stripe Integration Backlog

_Truly Imagined · TI Repo · Last updated: 2026-04-15 (Phase C complete)_

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

| File Path                                                        | Feature                   | Status         | Notes                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/api/webhooks/stripe/route.ts`                  | Webhook handler           | `NEEDS_UPDATE` | Async model and Connect routing implemented (`event.account`, `account.updated`, `transfer.*`). Still missing `payment_intent.succeeded` |
| `apps/web/src/lib/stripe.ts`                                     | Stripe singleton          | `NEEDS_UPDATE` | API version aligned (2026-03-25.dahlia) and Connect helpers added.                                                                       |
| `apps/web/src/lib/billing.ts`                                    | Subscription plans        | `NEEDS_UPDATE` | 3 monthly prices only; target 13 prices (monthly + annual + seat addon)                                                                  |
| `apps/web/src/app/api/billing/checkout/route.ts`                 | Checkout session          | `NEEDS_UPDATE` | No Connect provisioning or deal logic                                                                                                    |
| `apps/web/src/app/api/billing/portal/route.ts`                   | Billing portal            | `CORRECT`      | Basic portal redirect working                                                                                                            |
| `apps/web/src/app/api/billing/summary/route.ts`                  | Subscription summary      | `NEEDS_UPDATE` | No annual/seat-addon awareness                                                                                                           |
| `apps/web/src/app/api/verification/start/route.ts`               | Identity session start    | `NEEDS_UPDATE` | Multi-provider pattern; target Stripe-only under `/api/stripe/identity/session`                                                          |
| `apps/web/src/app/api/verification/status/route.ts`              | Identity session status   | `NEEDS_UPDATE` | Multi-provider aggregation; target Stripe-only under `/api/stripe/identity/status`                                                       |
| `apps/web/src/lib/hdicr/stripe-webhook-client.ts`                | HDICR identity sync       | `CORRECT`      | Uses single `verify-confirmed` flow from Stripe verified webhook event                                                                   |
| `apps/web/src/lib/hdicr/identity-client.ts`                      | HDICR identity client     | `CORRECT`      | `verifyIdentityConfirmed()` implemented against `/identity/verify-confirmed`                                                             |
| `apps/web/src/middleware.ts`                                     | Webhook rate-limit bypass | `CORRECT`      | Bypasses `/api/webhooks/stripe` — correct, no change needed                                                                              |
| `infra/database/migrations/035_ti_webhook_commercial_tables.sql` | Webhook + commerce schema | `NEEDS_UPDATE` | Has `stripe_events`, `commercial_licenses`, `wallet_balances`; missing `user_subscriptions`, `deals`, Connect account fields on users    |
| `apps/web/.env.example`                                          | Environment template      | `NEEDS_UPDATE` | Connect redirect URLs + canonical 13 price env vars added. Billing code still needs STRIPE-009/016 alignment                             |
| `hdicr/infra/samconfig.toml`                                     | HDICR infra config        | `REMOVE`       | Wires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — architecture violation                                                             |
| `hdicr/infra/template.yaml`                                      | HDICR SAM template        | `REMOVE`       | Contains Stripe env params on Lambda — architecture violation                                                                            |
| `apps/web/src/app/api/stripe/connect/`                           | Connect lifecycle routes  | `CORRECT`      | `create`, `onboarding`, `return`, `refresh`, `status` implemented                                                                        |

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

- [x] **STRIPE-002 — Hybrid Async Webhook Processing Model** ✅ COMPLETE
  - **Priority:** HIGH
  - **Decision applied:** Option C (hybrid — identity/critical inline, charge/payout deferred)
  - **Depends on:** STRIPE-001 ✅
  - **Implemented:** `apps/web/src/app/api/webhooks/stripe/route.ts` — charge/payout cases consolidated into single `setImmediate` block with internal try/catch; webhook always returns 200 before async work runs; identity events remain inline

---

- [x] **STRIPE-008 — Stripe API Version Upgrade** ✅ COMPLETE
  - **Priority:** MEDIUM
  - **Depends on:** None
  - **Implemented:**
    - `apps/web/src/lib/stripe.ts` — `apiVersion` updated to `'2026-03-25.dahlia'`
    - `apps/web/package.json` — `stripe` SDK upgraded `^20.4.1` → `^21.0.1` (v21 introduces dahlia type support)
    - Type-check passes, 103 contract tests pass

---

- [x] **STRIPE-011 — Event Persistence: Keep `stripe_events`, Add Missing Columns** ✅ COMPLETE
  - **Priority:** LOW
  - **Depends on:** None
  - **Implemented:** `infra/database/migrations/036_stripe_events_connect_account.sql` — adds `connect_account_id TEXT` (nullable, indexed) to `stripe_events` for Phase B Connect event routing. Existing schema is superset of docs' `webhook_events` table; no other columns missing.

---

- [x] **STRIPE-013 — HDICR Identity Sync: Migrate to `POST /identity/verify-confirmed`** ✅ COMPLETE
  - **Priority:** HIGH
  - **Description:** Replaced the existing multi-call identity link pattern with a single TI→HDICR
    sync call to `POST /identity/verify-confirmed`.
  - **Decision applied:** `/identity/verify-confirmed` everywhere (user decision #3)
  - **Depends on:** None
  - **Implemented — TI:**
    - `apps/web/src/lib/hdicr/identity-client.ts` — added `verifyIdentityConfirmed(params)` calling `POST /identity/verify-confirmed`
    - `apps/web/src/lib/hdicr/stripe-webhook-client.ts` — now delegates to single verify-confirmed client call
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — `identity.verification_session.verified` now uses `verifyStripeIdentityConfirmed`; removed legacy link CRUD calls for `requires_input`/`canceled`
  - **Implemented — HDICR:**
    - `services/identity-service/src/index.ts` — added route and handler for `POST /identity/verify-confirmed`
    - `infra/template.yaml` — exposed API event path `/identity/verify-confirmed` on `IdentityFunction`
  - **Validation:** TI type-check + contract tests pass; HDICR identity-service type-check + tests pass

---

### Phase B — Connect Platform

_Depends on Phase A approval. Enables actor payout eligibility._

---

- [x] **STRIPE-003 — Stripe Connect Express Account Lifecycle** ✅ COMPLETE
  - **Priority:** CRITICAL
  - **Description:** Implement full actor Connect Express onboarding: account creation, account
    link generation (onboarding URL), return and refresh URL handlers, account status endpoint.
    Actors must complete Connect onboarding to be payout-eligible for deals.
  - **Depends on:** STRIPE-008
  - **Implemented:**
    - `apps/web/src/app/api/stripe/connect/create/route.ts` — creates Express account, stores `stripe_account_id`
    - `apps/web/src/app/api/stripe/connect/onboarding/route.ts` — creates AccountLink onboarding URL
    - `apps/web/src/app/api/stripe/connect/return/route.ts` — updates status and redirects back to dashboard
    - `apps/web/src/app/api/stripe/connect/refresh/route.ts` — regenerates onboarding URL
    - `apps/web/src/app/api/stripe/connect/status/route.ts` — returns onboarding/capability status
    - `apps/web/src/lib/stripe.ts` — added `createConnectExpressAccount`, `createConnectOnboardingLink`, `retrieveConnectAccount`, `mapConnectAccountStatus`
    - `apps/web/.env.example` — `STRIPE_CONNECT_RETURN_URL`, `STRIPE_CONNECT_REFRESH_URL`
    - `infra/database/migrations/037_ti_connect_account_fields.sql` — adds `stripe_account_id`, `stripe_account_status`, `stripe_onboarding_complete` to `actors`

---

- [x] **STRIPE-004 — Connect Webhook Event Routing** ✅ COMPLETE
  - **Priority:** CRITICAL
  - **Description:** Add event routing for Connect events distinguished by presence of
    `event.account`. Handle: `account.updated` (sync onboarding status), `transfer.created`
    (log successful payout), `transfer.reversed` (log reversal), `transfer.updated`.
    Platform events (no `event.account`) continue to existing handlers.
  - **Depends on:** STRIPE-002, STRIPE-003
  - **Implemented:**
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — top-level Connect branch when `event.account` exists
    - Implemented handlers: `account.updated`, `transfer.created`, `transfer.reversed`, `transfer.updated`
    - `stripe_events` persistence now stores `connect_account_id` from webhook payload for Connect deliveries

---

### Phase C — Marketplace Payments

_Depends on Phase B approval. Enables deal flow and platform revenue._

---

- [x] **STRIPE-005 — Deal Initiation: PaymentIntent with Application Fee + Transfer** ✅ COMPLETE
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
  - **Implemented:**
    - `apps/web/src/app/api/stripe/deals/initiate/route.ts` — `POST` route validates Enterprise/Admin caller, validates actor Connect readiness, calculates fee band, creates PaymentIntent with `application_fee_amount` + `transfer_data.destination`, inserts pending `deals` row, returns `clientSecret`
    - `apps/web/src/lib/stripe/platformFee.ts` — fee band utility for 17.5% / 13% / 9% / 7.5%
    - `infra/database/migrations/038_ti_deals_table.sql` — creates `deals` table (`studio_user_id`, `actor_user_id`, `deal_value_cents`, `platform_fee_cents`, `actor_payout_cents`, `stripe_payment_intent_id`, `stripe_transfer_id`, `status`, `settled_at`, timestamps)

---

- [x] **STRIPE-006 — Deal Settlement: `payment_intent.succeeded` Handler** ✅ COMPLETE
  - **Priority:** CRITICAL
  - **Description:** Add `payment_intent.succeeded` webhook handler. Marks deal as `'paid'`,
    records `settled_at`, logs Stripe transfer ID once `transfer.created` fires. Must be
    idempotent (check deal status before writing).
  - **Depends on:** STRIPE-005, STRIPE-002
  - **Implemented:**
    - `apps/web/src/app/api/webhooks/stripe/route.ts` — added `payment_intent.succeeded` in deferred payment event branch, implemented idempotent `deals` settlement (`pending|failed` -> `paid`, sets `settled_at`), and linked `transfer.created` events to `deals.stripe_transfer_id` via source charge -> payment intent resolution

---

### Phase D — Subscriptions

_Depends on Phase C approval. Completes the billing model._

---

- [ ] **STRIPE-009 — Expand Subscription Price Matrix to 13 Prices**
  - **Priority:** HIGH
  - **Description:** Current implementation has 3 monthly prices. Target is 13 price IDs:
    Actor Professional (monthly + yearly), Agency Independent/Boutique/SME (monthly + yearly each),
    Agency Seat Addon, Studio Indie/Midmarket (monthly + yearly each). All IDs stored as
    env vars referencing prices pre-created in Stripe Dashboard.
  - **Decision applied:** Option C — prices pre-created in Dashboard, referenced by env var.
  - **Required env vars (new):**
    - `STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY`
    - `STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY`
    - `STRIPE_PRICE_AGENCY_SME_MONTHLY`
    - `STRIPE_PRICE_AGENCY_SME_YEARLY`
    - `STRIPE_PRICE_AGENCY_SEAT_ADDON`
    - `STRIPE_PRICE_STUDIO_INDIE_MONTHLY`
    - `STRIPE_PRICE_STUDIO_INDIE_YEARLY`
    - `STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY`
    - `STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY`
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

- [ ] **STRIPE-016 — Canonical Stripe Price Env Var Alignment (Vercel Names)**
  - **Priority:** HIGH
  - **Description:** Update TI billing plan mapping to use the canonical Vercel env var names
    already provisioned in production/staging, and remove legacy placeholder naming from code.
  - **Depends on:** STRIPE-009
  - **Canonical env vars (provided):**
    - `STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY`
    - `STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY`
    - `STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY`
    - `STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY`
    - `STRIPE_PRICE_AGENCY_SME_MONTHLY`
    - `STRIPE_PRICE_AGENCY_SME_YEARLY`
    - `STRIPE_PRICE_AGENCY_SEAT_ADDON`
    - `STRIPE_PRICE_STUDIO_INDIE_MONTHLY`
    - `STRIPE_PRICE_STUDIO_INDIE_YEARLY`
    - `STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY`
    - `STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY`
  - **Files affected:**
    - `apps/web/src/lib/billing.ts` — replace legacy env key names in plan map
    - `apps/web/.env.example` — keep canonical names only (remove deprecated placeholders)
    - `docs/STRIPE_BACKLOG.md` — keep canonical list as source of truth

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

| Phase                        | Items                                                                     | Status       | Gate Condition                                    |
| ---------------------------- | ------------------------------------------------------------------------- | ------------ | ------------------------------------------------- |
| **A — Contract Alignment**   | STRIPE-001 ✅, STRIPE-002 ✅, STRIPE-008 ✅, STRIPE-011 ✅, STRIPE-013 ✅ | 5/5 complete | Complete — ready for Phase B review               |
| **B — Connect Platform**     | STRIPE-003 ✅, STRIPE-004 ✅                                              | 2/2 complete | Complete — ready for Phase C review               |
| **C — Marketplace Payments** | STRIPE-005 ✅, STRIPE-006 ✅                                              | 2/2 complete | Complete — ready for Phase D review               |
| **D — Subscriptions**        | STRIPE-009, STRIPE-010, STRIPE-016                                        | 0/3 complete | Phase C approved                                  |
| **E — HDICR Cleanup**        | STRIPE-007, STRIPE-012                                                    | 0/2 complete | Phase D approved + STRIPE-013 HDICR endpoint live |
| **F — Hardening**            | STRIPE-014, STRIPE-015                                                    | 0/2 complete | Phase E approved                                  |

**Total progress: 9 / 16 items complete**

---

## Quick Reference: Environment Variables Required

### Currently in `.env.example`

```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_RETURN_URL
STRIPE_CONNECT_REFRESH_URL
STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY
STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY
STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY
STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY
STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY
STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY
STRIPE_PRICE_AGENCY_SME_MONTHLY
STRIPE_PRICE_AGENCY_SME_YEARLY
STRIPE_PRICE_AGENCY_SEAT_ADDON
STRIPE_PRICE_STUDIO_INDIE_MONTHLY
STRIPE_PRICE_STUDIO_INDIE_YEARLY
STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY
STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY
```

### Canonical Price Vars (STRIPE-009 + STRIPE-016)

```
STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY
STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY
STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY
STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY
STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY
STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY
STRIPE_PRICE_AGENCY_SME_MONTHLY
STRIPE_PRICE_AGENCY_SME_YEARLY
STRIPE_PRICE_AGENCY_SEAT_ADDON
STRIPE_PRICE_STUDIO_INDIE_MONTHLY
STRIPE_PRICE_STUDIO_INDIE_YEARLY
STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY
STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY
```

---

## Notes

- **STRIPE-013 deployment order completed**: HDICR endpoint and TI client/webhook updates are both implemented and validated.
- **Pricing env var source of truth**: use the canonical Vercel variable names listed in STRIPE-016;
  do not introduce alternate aliases in billing code.
- **Middleware** (`apps/web/src/middleware.ts`): Rate-limit bypass is at `/api/webhooks/stripe`
  and must stay unchanged. No middleware changes required across all 15 items.
