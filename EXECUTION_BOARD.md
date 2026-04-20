# EXECUTION BOARD

_Generated: 2026-04-18_  
_Start date: 2026-04-21 (Week 1)_  
_Sprint length: 2 weeks_  
_Horizon: 14 weeks across 7 sprints_  
_Scope: TI (`trulyimagined-web-v3`) + HDICR (`hdicr`) — production readiness to go-live_

Reference documents:

- [PRODUCTION_READINESS_BACKLOG.md](PRODUCTION_READINESS_BACKLOG.md) — source of truth for all items and acceptance criteria
- [LAUNCH_SCOPE_RECOMMENDATION.md](LAUNCH_SCOPE_RECOMMENDATION.md) — public claims constraints and locked decisions

---

## Milestone Gates

| Gate | Date       | Name                           | Exit Condition                                                                                                 |
| ---- | ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| M1   | 2026-05-01 | Platform Safe                  | DB TLS fixed, webhook idempotency live, rate limiting in place, correlation IDs in logs                        |
| M2   | 2026-05-15 | Subscription Reliable          | All lifecycle events handled, full tier catalog configured, access provisioned and revoked correctly           |
| M3   | 2026-05-29 | Pricing Page Launched          | Public pricing page live, GBP/USD with Bank of England FX, UK defaulting, annual pricing, all tiers Available  |
| M4   | 2026-06-12 | Commercial Core Foundations    | Studio/project/deal data model live, deal lifecycle auditable, fee calculation correct at all thresholds       |
| M5   | 2026-06-26 | Consent-Gated Payments Live    | Deal approval requires HDICR consent check, approved deals mint licences, payment initiation wired             |
| M6   | 2026-07-10 | Payouts and Ops Ready          | Connect onboarding live, payout audit logged, env contracts and runbooks complete, monitoring production-ready |
| M7   | 2026-07-24 | Go-Live Evidence Pack Complete | Arbitration path operational, go-live checklist evidence gathered, launch/no-launch decision documentable      |

---

## Dependency Map

```
WS1-01 ──────────────────────────────────────────────────────── required by all DB-touching items
WS1-02 ──────────────────────────────────────────────────────── required by WS2-03, WS3-03, WS5-01
WS1-03 ────────────────────────────────── required by WS2-03
WS2-01 + WS9-01 ─────────────────────── required by WS9-02, WS9-03
WS2-03 ──────────────────────────────────────────────────────── required by WS6-03, WS2-04/05
WS4-01, WS4-02, WS4-05 ─────────────── required by WS5-01, WS5-02, WS4-08, WS3-02
WS4-07 ─────────────────────────────── required by WS4-08
WS5-01, WS4-08 ──────────────────────── required by WS5-02
WS3-01 ──────────────────────────────── required by WS3-02, WS3-03
WS5-02, WS3-05 ──────────────────────── required by WS8-06 (go-live evidence)
```

Hard prerequisite chains:

1. `WS1-01` → `WS1-02` → `WS1-03` → `WS2-03` → M2
2. `WS2-01` + `WS9-01` → `WS9-02` → `WS9-03` → M3
3. `WS4-01` + `WS4-02` → `WS4-05` → `WS4-06` → `WS4-07` → `WS4-08` → `WS5-01` → `WS5-02` → M5
4. `WS3-01` → `WS3-02` → `WS3-03` → `WS3-04` → `WS3-05` → M6
5. All P0s done → M1 → M2 → M3 required before public launch claim

---

## Week-by-Week Board

### Sprint 1 — Platform Safety Foundation

Dates: 2026-04-21 → 2026-05-01 | Milestone: M1

| Week | Item   | Task                                                                    | Owner Role      | Status | Depends On | Effort   |
| ---- | ------ | ----------------------------------------------------------------------- | --------------- | ------ | ---------- | -------- |
| W1   | WS1-01 | Replace `rejectUnauthorized: false` with validated RDS TLS              | Full-stack / BE | DONE   | —          | 2–3 days |
| W1   | WS7-01 | Add rate limiting to payment, billing, webhook, and verification routes | Full-stack / BE | DONE   | —          | 2–3 days |
| W1   | WS7-02 | Standardize input validation across all write routes (TI)               | Full-stack / BE | DONE   | —          | 2–3 days |
| W2   | WS1-02 | Add `stripe_webhook_events` deduplication table and processing guard    | Full-stack / BE | DONE   | WS1-01     | 2–3 days |
| W2   | WS1-04 | Verify fail-closed behavior when HDICR is unavailable                   | Full-stack / BE | DONE   | —          | 1–2 days |
| W2   | WS1-05 | Add correlation ID propagation across TI → HDICR requests (baseline)    | Platform        | DONE   | —          | 2–3 days |

**M1 Gate Check (2026-05-01):**

- [x] `lib/db.ts` has no `rejectUnauthorized: false` in any active code path
- [x] `stripe_webhook_events` table exists with unique event ID constraint; duplicate delivery returns `200`
- [x] Sensitive routes (webhook, billing, verification) have rate limits
- [x] Correlation ID propagates from TI outbound requests into HDICR logs
- [x] HDICR unavailability returns a safe fail-closed response to TI callers

---

### Sprint 2 — Subscription Reliability and Launch Tier Catalog

Dates: 2026-05-04 → 2026-05-15 | Milestone: M2

| Week | Item   | Task                                                                     | Owner Role      | Status | Depends On     | Effort   |
| ---- | ------ | ------------------------------------------------------------------------ | --------------- | ------ | -------------- | -------- |
| W3   | WS1-03 | Extend webhook handler: subscription + invoice lifecycle events          | Full-stack / BE | DONE   | WS1-02         | 2–3 days |
| W3   | WS2-01 | Replace `billing.ts` 3-plan model with full launch tier catalog          | Full-stack / BE | DONE   | —              | 2–3 days |
| W3   | WS2-02 | Add all `STRIPE_PRICE_*` env vars and update `.env.example`              | Full-stack / BE | DONE   | WS2-01         | 1 day    |
| W4   | WS2-03 | Implement subscription access provisioning and revocation logic          | Full-stack / BE | DONE   | WS1-03, WS2-01 | 4–6 days |
| W4   | WS9-01 | Define and document launch pricing catalog (Actor, Agency, Studio tiers) | Full-stack / BE | DONE   | WS2-01         | 2–3 days |
| W4   | WS6-05 | Make launch-scope gaps explicit in UI — remove or stub dead-end routes   | Full-stack / FE | DONE   | WS2-01         | 1–2 days |

**M2 Gate Check (2026-05-15):**

- [x] `customer.subscription.created/updated/deleted` and `invoice.payment_succeeded/failed` handled and tested
- [x] Full planned tier catalog lives in `billing.ts` — all Actor, Agency, and Studio tiers, monthly + annual
- [x] `STRIPE_PRICE_*` env keys documented and aligned with tier model
- [x] Access provisioning and revocation operates correctly on subscription lifecycle events
- [x] Launch-scope pricing catalog data model is committed and review-ready for WS9-02
- [x] UI dead ends removed or cleanly stubbed for launch scope

---

### Sprint 3 — Pricing Page and Commercial UX Baseline

Dates: 2026-05-18 → 2026-05-29 | Milestone: M3

| Week | Item   | Task                                                                                   | Owner Role      | Status | Depends On     | Effort   |
| ---- | ------ | -------------------------------------------------------------------------------------- | --------------- | ------ | -------------- | -------- |
| W5   | WS9-02 | Build `/pricing` route with profile-type tier comparison layout                        | Full-stack / FE | DONE   | WS9-01         | 3–5 days |
| W5   | WS6-01 | Add invitation code management UI for agents                                           | Full-stack / FE | DONE   | —              | 1–2 days |
| W6   | WS9-03 | Implement Bank of England FX fetch, currency detection, USD/GBP toggle, annual pricing | Full-stack / FE | DONE   | WS9-02, WS9-01 | 5–7 days |
| W6   | WS9-04 | Add pricing correctness tests — tier display, locale defaulting, FX conversion, toggle | QA / Full-stack | DONE   | WS9-03         | 2–3 days |
| W6   | WS6-02 | Add minimal admin licence dashboard                                                    | Full-stack / FE | DONE   | —              | 2–3 days |

**M3 Gate Check (2026-05-29):**

- [x] `/pricing` is publicly accessible
- [x] Actor, Agency, and Studio tiers shown side by side per profile type
- [x] UK visitors default to GBP using detection order: `x-vercel-ip-country` → `cf-ipcountry` → locale → profile country
- [x] Non-UK visitors default to USD
- [x] Manual USD/GBP toggle works and persists across session and return visits
- [x] GBP values are exact two-decimal conversions from Bank of England daily rate
- [x] Daily FX refresh operates with last-known-good fallback on provider failure
- [x] Annual pricing renders correctly in both currencies
- [x] No tier is marked Available unless it is purchasable in Stripe production
- [x] UI discloses that GBP is converted from USD where settlement is USD

---

### Sprint 4 — Commercial Domain Foundations

Dates: 2026-06-01 → 2026-06-12 | Milestone: M4

| Week | Item   | Task                                                         | Owner Role      | Status | Depends On     | Effort   |
| ---- | ------ | ------------------------------------------------------------ | --------------- | ------ | -------------- | -------- |
| W7   | WS4-01 | Add studio profile domain model, routes, and minimal UI      | Full-stack      | DONE   | —              | 3–4 days |
| W7   | WS4-02 | Add project domain model, routes, and minimal UI             | Full-stack      | DONE   | WS4-01         | 3–4 days |
| W7   | WS4-04 | Add deal templates and commercial terms model                | Full-stack / BE | TODO   | WS4-01         | 2–3 days |
| W8   | WS4-05 | Add `deals` table and deal creation workflow                 | Full-stack / BE | TODO   | WS4-02, WS4-04 | 3–5 days |
| W8   | WS4-06 | Add deal approval and rejection workflow with audit trail    | Full-stack / BE | TODO   | WS4-05         | 2–3 days |
| W8   | WS4-07 | Implement platform fee calculation with threshold unit tests | Full-stack / BE | TODO   | WS4-05         | 2–3 days |

**Progress Update (2026-04-19):**

- WS4-01 delivered in TI repo (`ae2491e`): `studios` migration + API + dashboard UI.
- WS4-02 delivered in TI repo (`a77cab5`): `projects` migration + API + dashboard UI.
- Validation on latest implementation pass: `pnpm type-check` ✓ and `pnpm test` ✓ (191/191 tests).

**M4 Gate Check (2026-06-12):**

- [ ] `studios`, `projects`, `deal_templates`, `deals` tables exist with migrations
- [ ] Studio and project routes exist and are permission-gated
- [ ] Deals capture all required fields (template, actor, agent, studio, consent version, payment status)
- [ ] Deal status lifecycle is auditable with transition log
- [ ] Platform fee calculation is correct at all threshold boundaries: 10k, 25k, 50k, 100k
- [ ] Job board / casting-open discovery flow is accessible (WS4-03 deliverable or noted as deferred)

---

### Sprint 5 — Consent-Gated Licensing and Payments Core

Dates: 2026-06-15 → 2026-06-26 | Milestone: M5

| Week | Item   | Task                                                             | Owner Role      | Status | Depends On     | Effort   |
| ---- | ------ | ---------------------------------------------------------------- | --------------- | ------ | -------------- | -------- |
| W9   | WS5-01 | Wire TI deal approval to HDICR consent check                     | Full-stack / BE | TODO   | WS4-05, WS1-02 | 3–5 days |
| W9   | WS4-08 | Implement PaymentIntent creation for deal payments               | Full-stack / BE | TODO   | WS4-07         | 3–4 days |
| W9   | WS2-04 | Implement agency seat allocation and enforcement                 | Full-stack / BE | DONE   | WS2-03         | 2–3 days |
| W10  | WS5-02 | Implement TI-side licence minting from approved and paid deals   | Full-stack / BE | TODO   | WS5-01, WS4-08 | 3–4 days |
| W10  | WS5-03 | Verify and harden `license_usage_log` ingestion path             | Full-stack / BE | DONE   | WS5-02         | 2–3 days |
| W10  | WS7-04 | Add webhook lag and retry visibility (operational observability) | Platform        | DONE   | WS1-02         | 1–2 days |

**M5 Gate Check (2026-06-26):**

- [ ] No deal can reach final approval without a successful HDICR consent check
- [ ] Consent check failure returns a clear denial reason; TI surfaces it to the initiating party
- [ ] Consent version at signing is locked onto the resulting licence record
- [ ] Approved and paid deals produce licence records with immutable consent reference
- [x] `license_usage_log` ingestion path is hardened and observable
- [ ] Agency seat limits are enforced; team-member addition blocks at seat cap
- [ ] Dunning and billing-failure messaging is in place (WS2-05)

---

### Sprint 6 — Connect, Payouts, and Operations Hardening

Dates: 2026-06-29 → 2026-07-10 | Milestone: M6

| Week | Item   | Task                                                                        | Owner Role      | Status | Depends On     | Effort   |
| ---- | ------ | --------------------------------------------------------------------------- | --------------- | ------ | -------------- | -------- |
| W11  | WS3-01 | Design and implement `stripe_accounts` storage model                        | Full-stack / BE | DONE   | WS4-05         | 1–2 days |
| W11  | WS3-02 | Create Express connected account onboarding flow                            | Full-stack      | DONE   | WS3-01         | 4–5 days |
| W11  | WS7-03 | Replace ad hoc console logging with structured logs (TI + HDICR)            | Platform        | TODO   | —              | 2–3 days |
| W12  | WS3-03 | Handle Connect webhook events and onboarding state transitions              | Full-stack / BE | DONE   | WS3-02, WS1-02 | 3–4 days |
| W12  | WS3-04 | Implement payout and transfer audit logging                                 | Full-stack / BE | DONE   | WS3-03         | 2–3 days |
| W12  | WS3-05 | Add manual intervention flow for payout failures and reversed transfers     | Full-stack      | TODO   | WS3-04         | 2–3 days |
| W12  | WS8-01 | Normalize TI env template — add `RESEND_API_KEY`, Sentry DSN, Connect URLs  | Platform        | TODO   | WS3-02         | 1 day    |
| W12  | WS8-02 | Review HDICR template envs; remove unused Stripe webhook secret if not used | Platform        | DONE   | —              | 0.5 days |
| W12  | WS8-03 | Finalize canonical domain and env key names across repos and docs           | Platform        | TODO   | WS8-01, WS8-02 | 1 day    |
| W12  | WS7-05 | Verify Sentry coverage for handled and unhandled failures                   | Platform        | TODO   | —              | 1 day    |
| W12  | WS7-07 | Confirm no secrets or secret-like values leak in logs or error bodies       | Platform        | TODO   | WS7-03         | 1 day    |

**M6 Gate Check (2026-07-10):**

- [x] Actor and agency payout recipients can initiate Stripe Connect onboarding end to end
- [x] Onboarding state persists in `stripe_accounts`; return and refresh URLs are correct
- [x] `account.updated`, `transfer.*`, and `payout.failed` webhook events handled and state-transitioned
- [x] Payout audit log exists and is complete
- [ ] Manual intervention flow for payout failures is operable
- [ ] `.env.example` and HDICR env template are accurate and complete
- [ ] Structured logging is operational in both TI and HDICR; no raw `console.log` in critical paths
- [ ] No secrets leak in logs or error response bodies
- [ ] Sentry is configured and capturing both handled and unhandled failures

---

### Sprint 7 — Arbitration, Final Hardening, and Go-Live Validation

Dates: 2026-07-13 → 2026-07-24 | Milestone: M7

| Week | Item   | Task                                                                      | Owner Role      | Status | Depends On | Effort   |
| ---- | ------ | ------------------------------------------------------------------------- | --------------- | ------ | ---------- | -------- |
| W13  | WS5-04 | Add arbitration data model, workflow states, and admin UI                 | Full-stack      | TODO   | WS5-02     | 4–6 days |
| W13  | WS6-03 | Add payouts / earnings dashboard for actor and agency roles               | Full-stack / FE | TODO   | WS3-04     | 3–4 days |
| W13  | WS8-04 | Verify Vercel preview and production configuration parity                 | Platform        | TODO   | WS8-01     | 1 day    |
| W14  | WS5-05 | Implement consent-revocation conflict handling for active licences        | Full-stack / BE | TODO   | WS5-04     | 3–4 days |
| W14  | WS6-04 | Add refund processing UI (if refunds are in launch scope)                 | Full-stack / FE | TODO   | WS5-04     | 1–2 days |
| W14  | WS7-06 | Document rollback strategy and incident runbooks                          | Platform        | TODO   | WS8-03     | 1–2 days |
| W14  | WS8-05 | Verify SAM template, ACM, API Gateway, IAM, alarms, and log groups in AWS | Platform        | TODO   | WS7-06     | 1–2 days |
| W14  | WS8-06 | Produce go-live checklist with evidence links and pass/fail for each gate | Platform / Lead | TODO   | All M1–M6  | 2–3 days |

**M7 Gate Check (2026-07-24):**

- [ ] `arbitration_requests` table exists with states: `open`, `under_review`, `negotiation`, `resolved`, `expired`
- [ ] Active-licence consent revocations can open arbitration records
- [ ] Admin arbitration review and resolution UI is operational
- [ ] Consent-revocation conflict handling for active licences is implemented and tested
- [ ] Actor and agency earnings dashboard is usable
- [ ] Rollback strategy and incident runbooks are documented
- [ ] AWS infrastructure resources are verified against SAM template (HDICR)
- [ ] Vercel preview and production environments are configuration-parity verified
- [ ] Go-live evidence pack is complete with linked proof for every gate criterion
- [ ] Launch / no-launch decision can be made from objective, documented evidence

---

## Summary Timeline

```
April 2026
  W1  21 Apr ─── DB TLS, rate limiting, input validation
  W2  28 Apr ─── Webhook idempotency, HDICR fail-closed, correlation IDs
                 ★ M1: Platform Safe (01 May)

May 2026
  W3  05 May ─── Subscription lifecycle webhook, full tier catalog, env vars
  W4  12 May ─── Access provisioning, pricing catalog data model, UI dead ends
                 ★ M2: Subscription Reliable (15 May)
  W5  19 May ─── Pricing page layout, invitation code UI
  W6  26 May ─── Bank of England FX, USD/GBP toggle, pricing tests, admin licence dashboard
                 ★ M3: Pricing Page Launched (29 May)

June 2026
  W7  02 Jun ─── Studio/project models and routes, deal templates
  W8  09 Jun ─── Deals, deal lifecycle, platform fee logic
                 ★ M4: Commercial Core Foundations (12 Jun)
  W9  16 Jun ─── Consent gate, PaymentIntent, agency seat limits
  W10 23 Jun ─── Licence minting, usage log, webhook observability
                 ★ M5: Consent-Gated Payments Live (26 Jun)

July 2026
  W11 30 Jun ─── Connect onboarding model, structured logging
  W12 07 Jul ─── Connect webhooks, payout audit, env contracts, Sentry, secrets hygiene
                 ★ M6: Payouts and Ops Ready (10 Jul)
  W13 14 Jul ─── Arbitration workflow, earnings dashboard, Vercel parity check
  W14 21 Jul ─── Consent-revocation conflicts, refund UI, runbooks, AWS infra verify, go-live pack
                 ★ M7: Go-Live Evidence Pack Complete (24 Jul)
```

---

## Critical Path

Items on the critical path where slippage delays a milestone gate:

| Item   | Why Critical                                                        | Milestone At Risk |
| ------ | ------------------------------------------------------------------- | ----------------- |
| WS1-01 | Every DB-dependent workstream requires production-safe connections  | M1                |
| WS1-02 | Webhook idempotency required by WS2-03, WS3-03, WS5-01              | M1, M5            |
| WS1-03 | Subscription lifecycle events required by provisioning (WS2-03)     | M2                |
| WS2-01 | Full tier catalog required by WS9-01 → WS9-02 → WS9-03 chain        | M2, M3            |
| WS4-05 | Deal entity required by WS5-01, WS4-08, WS5-02, WS3-01              | M4, M5            |
| WS5-01 | Consent gate required for licence minting and any public deal claim | M5                |
| WS3-01 | `stripe_accounts` model required before any Connect work can land   | M6                |
| WS8-06 | Go-live evidence pack cannot be produced until all prior gates pass | M7                |

---

## Risk Register

| Risk                                            | Likelihood | Impact | Mitigation                                                                           |
| ----------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------ |
| RDS TLS migration requires AWS cert bundle work | Medium     | High   | Spike WS1-01 on Day 1; do not unblock other infra items until resolved               |
| Bank of England API rate limits or downtime     | Low        | Medium | Implement daily cache with last-known-good fallback from day one of WS9-03           |
| Stripe Connect review delay (KYC/compliance)    | Medium     | Medium | Begin Connect merchant-of-record review process in parallel with Sprint 4 build      |
| HDICR consent service contract drift            | Low        | High   | Run WS5-01 contract test before Sprint 5 begins; do not assume API shape is stable   |
| Sprint 4 deal model scope creep                 | High       | Medium | Implement minimal required fields only; defer casting/job board to post-M4 if needed |
| Go-live date slip from M5/M6 blockers           | Medium     | High   | Treat M1 and M2 as non-negotiable; defer WS6/WS7 P2s to post-launch if needed        |

---

## Owner Roles Reference

| Role            | Responsibility Scope                                            |
| --------------- | --------------------------------------------------------------- |
| Full-stack / BE | API routes, DB migrations, service integrations, webhook logic  |
| Full-stack / FE | React components, page layouts, UI state management, forms      |
| Full-stack      | Items spanning UI and backend without clear boundary separation |
| Platform        | Infra config, env management, CI/CD, logging, observability     |
| QA / Full-stack | Test coverage, integration tests, regression validation         |
| Lead            | Cross-cutting decisions, evidence review, go/no-go sign-off     |
