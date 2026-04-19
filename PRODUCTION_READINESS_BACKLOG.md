# PRODUCTION_READINESS_BACKLOG

_Generated: 2026-04-16_
_Source inputs: audit findings across TI (`trulyimagined`) and HDICR (`hdicr`), plus existing [PRODUCTION_READINESS_PLAN.md](PRODUCTION_READINESS_PLAN.md)_

## Purpose

This backlog converts the final audit into an implementation tracker for reaching production readiness.

It is intended to work alongside [PRODUCTION_READINESS_PLAN.md](PRODUCTION_READINESS_PLAN.md):

- [PRODUCTION_READINESS_PLAN.md](PRODUCTION_READINESS_PLAN.md) remains the higher-level delivery/runbook plan.
- This file is the execution backlog for closing audit findings and shipping a production-safe commercial platform.

## Scope

This backlog covers both repositories:

- TI application: Vercel / Next.js / App Router / Stripe / Auth0
- HDICR services: AWS Lambda / SAM / API Gateway / Auth0 / consent + identity truth layer

## Status Legend

- `TODO` — not started
- `IN PROGRESS` — actively being implemented
- `BLOCKED` — cannot proceed until dependency is closed
- `DONE` — implemented and verified
- `DEFERRED` — intentionally out of current release scope

## Priority Legend

- `P0` — production blocker, must close before live traffic
- `P1` — required for monetization and contractual workflow
- `P2` — important hardening / operational readiness
- `P3` — polish or post-launch improvement

## Release Gate

Production readiness is only achieved when all of the following are true:

1. All `P0` items are `DONE`.
2. All monetization-critical `P1` items required for the intended launch scope are `DONE`.
3. TI and HDICR pass independent type-check, test, and build gates.
4. TI reaches HDICR only through authenticated HTTP with traceability.
5. Stripe subscriptions, webhook processing, and access provisioning are safe and idempotent.
6. Database connectivity, secrets handling, monitoring, and rollback are production-safe.

## Delivery Principles

- No legacy path should remain active if a new path supersedes it.
- Production safety takes precedence over feature breadth.
- Favor shipping a smaller correct commercial scope over a broader partially implemented one.
- No payment or licence workflow should go live without idempotency, auditability, and failure handling.

## Locked Product Decisions (2026-04-18)

These decisions are fixed and should be treated as non-negotiable implementation constraints:

1. First release includes the full planned pricing tier catalog.
2. All published tiers should be live at first release.
3. Pricing currency default order is:

- edge/platform geolocation header,
- browser locale/language,
- signed-in account profile country.

4. GBP is dynamically FX-converted from USD.
5. Annual pricing is included at first release.

## Locked Technical Decisions (2026-04-18)

1. FX source for USD to GBP display conversion: Bank of England daily exchange rates.
2. Country detection order for GBP default:

- primary: `x-vercel-ip-country` (recommended canonical edge header for Vercel deployment)
- secondary fallback: `cf-ipcountry` when present
- then browser locale/language
- then signed-in account profile country

3. GBP display value uses exact two-decimal conversion from USD (no price psychology repricing).
4. Checkout/charge currency remains USD where product configuration requires USD settlement.

## Current Readiness Summary

### Confirmed strong areas

- TI / HDICR separation is implemented correctly.
- M2M auth, token caching, and HDICR JWKS validation are in place.
- HDICR identity and consent services are materially implemented.
- TI actor, representation, invitation-code, consent, billing portal, and verification surfaces exist.
- No hardcoded Stripe/Auth0 secrets were found in source.

### Confirmed weak areas

- TI database TLS validation is not production-safe.
- Stripe webhook is identity-only and lacks deduplication.
- Subscription provisioning is incomplete.
- Stripe Connect / payouts are not implemented.
- Studio, project, deal, refund, arbitration, and earnings workflows are missing.
- Full subscription tier model is not implemented.

## Workstreams

### WS1. Production Safety Blockers

| ID     | Priority | Status | Item                                                                           | Repo       |
| ------ | -------- | ------ | ------------------------------------------------------------------------------ | ---------- |
| WS1-01 | P0       | DONE   | Replace `rejectUnauthorized: false` with validated RDS TLS configuration       | TI         |
| WS1-02 | P0       | DONE   | Add Stripe webhook event deduplication store and processing guard              | TI         |
| WS1-03 | P0       | DONE   | Extend webhook to handle subscription lifecycle events                         | TI         |
| WS1-04 | P0       | DONE   | Verify fail-closed behavior when HDICR is unavailable                          | TI         |
| WS1-05 | P0       | DONE   | Add correlation ID propagation across TI -> HDICR requests and error responses | TI + HDICR |

#### WS1-01 Acceptance Criteria

- TI DB connections validate server certificates in production.
- RDS CA bundle or equivalent trusted-cert strategy is documented.
- No code path leaves certificate validation disabled in production.
- Build, tests, and runtime connection checks pass in production-like env.

#### WS1-02 Acceptance Criteria

- A persistent webhook-events table exists with unique Stripe event ID constraint.
- Duplicate deliveries are no-op and return `200` safely.
- Webhook processing is idempotent for both success and retry scenarios.
- Tests cover duplicate delivery of the same Stripe event.

#### WS1-03 Acceptance Criteria

- The webhook handles at minimum:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Provisioning side effects are persisted and test-covered.
- Identity events continue to work without regression.

### WS2. Stripe Subscription Completion

| ID     | Priority | Status | Item                                                                 | Repo |
| ------ | -------- | ------ | -------------------------------------------------------------------- | ---- |
| WS2-01 | P1       | DONE   | Replace simplified 3-plan billing model with launch tier model       | TI   |
| WS2-02 | P1       | DONE   | Add all required `STRIPE_PRICE_*` environment variables and env docs | TI   |
| WS2-03 | P1       | DONE   | Implement subscription access provisioning and revocation model      | TI   |
| WS2-04 | P1       | DONE   | Implement agency seat allocation and enforcement                     | TI   |
| WS2-05 | P2       | TODO   | Add dunning and billing-failure user messaging                       | TI   |

#### WS2 Launch Scope Decision

Launch scope is fixed to the full planned tier model for first release.

Implementation implication:

- No tier in the published catalog should ship as placeholder-only.
- Pricing data, checkout behavior, and entitlement logic must be complete for all planned tiers.

#### WS2-01 Acceptance Criteria

- `billing.ts` reflects the chosen launch tier structure.
- The chosen launch tier structure is the full planned catalog for Actor, Agency, and Studio.
- Monthly and annual prices are modeled where applicable.
- Tier names, labels, and env keys match product decisions exactly.
- Checkout and billing summary routes understand the same tier model.

#### WS2-04 Acceptance Criteria

- Agency tiers enforce seat limits at the application level.
- Team-member addition blocks cleanly when seat cap is reached.
- Billing plan changes correctly increase or reduce allowable seats.
- Tests cover the seat boundary cases.

### WS3. Stripe Connect And Payouts

| ID     | Priority | Status | Item                                                                  | Repo |
| ------ | -------- | ------ | --------------------------------------------------------------------- | ---- |
| WS3-01 | P1       | DONE   | Design and implement `stripe_accounts` storage model                  | TI   |
| WS3-02 | P1       | DONE   | Create Express connected account onboarding flow                      | TI   |
| WS3-03 | P1       | DONE   | Handle Connect webhook events and onboarding state transitions        | TI   |
| WS3-04 | P1       | DONE   | Implement payout and transfer audit logging                           | TI   |
| WS3-05 | P1       | TODO   | Add manual intervention flow for payout failures / reversed transfers | TI   |

#### WS3 Dependencies

- Depends on WS1-02 for webhook idempotency.
- Depends on commercial domain design in WS4 for who gets paid and when.

#### WS3-02 Acceptance Criteria

- Actor and agency payout recipients can initiate Stripe Connect onboarding.
- Account onboarding links use correct return and refresh URLs.
- Account state persists in TI database.
- UI clearly communicates incomplete / pending / active payout state.

#### WS3-03 Acceptance Criteria

- Webhook distinguishes platform events from Connect events using `event.account`.
- At minimum handles:
  - `account.updated`
  - `transfer.created`
  - `transfer.reversed`
  - `transfer.updated`
  - `payout.failed`
- State transitions are test-covered.

### WS4. Commercial Domain Buildout

| ID     | Priority | Status | Item                                              | Repo |
| ------ | -------- | ------ | ------------------------------------------------- | ---- |
| WS4-01 | P1       | TODO   | Add studio profile domain model, routes, and UI   | TI   |
| WS4-02 | P1       | TODO   | Add project domain model, routes, and UI          | TI   |
| WS4-03 | P1       | TODO   | Add job board / casting-open discovery flow       | TI   |
| WS4-04 | P1       | TODO   | Add deal templates and commercial terms model     | TI   |
| WS4-05 | P1       | TODO   | Add deals table and deal creation workflow        | TI   |
| WS4-06 | P1       | TODO   | Add deal approval / rejection workflow            | TI   |
| WS4-07 | P1       | TODO   | Add platform fee calculation logic and unit tests | TI   |
| WS4-08 | P1       | TODO   | Add PaymentIntent creation for deal payments      | TI   |

#### WS4 Required Data Model Additions

- `studios`
- `projects`
- `deal_templates`
- `deals`
- `stripe_accounts`
- supporting indexes and status enums

#### WS4-05 Acceptance Criteria

- Deals persist at minimum these fields:
  - `template_id`
  - `actor_id`
  - `agent_id`
  - `studio_user_id`
  - `status`
  - `commercial_terms`
  - `consent_version_id`
  - `payment_status`
  - `payment_intent_id`
- Deal creation is permission-gated and validated.
- Audit trail exists for major state transitions.

#### WS4-07 Acceptance Criteria

- Sliding-scale platform fee matches confirmed bands exactly.
- Unit tests cover every threshold edge:
  - 10,000
  - 10,001
  - 25,000
  - 25,001
  - 50,000
  - 50,001
  - 100,000
  - 100,001
- Rounding behavior is explicit and documented.

### WS5. Consent, Licensing, And Arbitration Completion

| ID     | Priority | Status | Item                                                                 | Repo       |
| ------ | -------- | ------ | -------------------------------------------------------------------- | ---------- |
| WS5-01 | P1       | TODO   | Wire TI deal approval to HDICR consent check                         | TI + HDICR |
| WS5-02 | P1       | TODO   | Implement TI-side licence minting triggered from approved paid deals | TI         |
| WS5-03 | P1       | TODO   | Verify and harden `license_usage_log` ingestion path                 | TI         |
| WS5-04 | P1       | TODO   | Add arbitration data model and workflow                              | TI + HDICR |
| WS5-05 | P2       | TODO   | Implement consent-revocation conflict handling for active licences   | TI + HDICR |

#### WS5-01 Acceptance Criteria

- A deal cannot move to final approval without HDICR consent validation.
- Consent check failure returns a clear denial reason to TI.
- Consent version at signing is locked onto the resulting licence.

#### WS5-04 Acceptance Criteria

- `arbitration_requests` table exists.
- Workflow supports at minimum:
  - open
  - under_review
  - negotiation
  - resolved
  - expired
- Active-licence consent revocations can open arbitration records.
- Admin UI exists for review and resolution.

### WS6. Frontend Completion For Existing Backend Surfaces

| ID     | Priority | Status | Item                                                               | Repo |
| ------ | -------- | ------ | ------------------------------------------------------------------ | ---- |
| WS6-01 | P2       | DONE   | Add invitation code management UI for agents                               | TI   |
| WS6-02 | P2       | DONE   | Add admin licence dashboard                                        | TI   |
| WS6-03 | P2       | TODO   | Add payouts / earnings dashboard for actor and agency roles        | TI   |
| WS6-04 | P2       | TODO   | Add refund processing UI if refunds are in launch scope            | TI   |
| WS6-05 | P2       | DONE   | Make launch-scope gaps explicit in UI instead of leaving dead ends | TI   |

#### WS6 Guidance

- If a backend surface is intentionally launch-internal, hide it cleanly.
- If a feature is backend-complete but user-facing, give it a minimal usable UI before launch.

### WS7. Security, Observability, And Ops Hardening

| ID     | Priority | Status | Item                                                                       | Repo       |
| ------ | -------- | ------ | -------------------------------------------------------------------------- | ---------- |
| WS7-01 | P1       | DONE   | Add rate limiting to payment, billing, webhook, and verification endpoints | TI         |
| WS7-02 | P1       | DONE   | Standardize input validation across all state-changing routes              | TI + HDICR |
| WS7-03 | P2       | TODO   | Replace ad hoc console logging with structured logs                        | TI + HDICR |
| WS7-04 | P2       | TODO   | Add webhook lag and retry visibility                                       | TI         |
| WS7-05 | P2       | TODO   | Verify Sentry coverage for both handled and unhandled failures             | TI         |
| WS7-06 | P2       | TODO   | Document rollback strategy and incident runbooks                           | TI + HDICR |
| WS7-07 | P2       | TODO   | Confirm no secrets or secret-like values leak in logs or error bodies      | TI + HDICR |

#### WS7-01 Acceptance Criteria

- Sensitive routes are protected by rate limits appropriate to user vs machine callers.
- Webhook route is protected without breaking Stripe delivery semantics.
- Limits are documented and testable.

#### WS7-02 Acceptance Criteria

- All write routes validate payloads consistently.
- Validation errors return predictable machine-readable responses.
- No route depends on implicit untyped request shapes for critical operations.

### WS8. Environment, Deployment, And Go-Live Controls

| ID     | Priority | Status | Item                                                                              | Repo       |
| ------ | -------- | ------ | --------------------------------------------------------------------------------- | ---------- |
| WS8-01 | P1       | TODO   | Normalize TI env template to actual required runtime variables                    | TI         |
| WS8-02 | P1       | DONE   | Review HDICR template envs and remove unnecessary Stripe webhook secret if unused | HDICR      |
| WS8-03 | P1       | TODO   | Finalize canonical domain and env key names across repos and docs                 | TI + HDICR |
| WS8-04 | P2       | TODO   | Verify Vercel preview and production configuration parity                         | TI         |
| WS8-05 | P2       | TODO   | Verify SAM template, ACM, API Gateway, IAM, alarms, and log groups in AWS         | HDICR      |
| WS8-06 | P2       | TODO   | Produce final launch checklist and go/no-go criteria with evidence links          | TI + HDICR |

#### WS8-01 Specific Gaps To Close

- Add missing `RESEND_API_KEY` to env template.
- Add missing Sentry DSN env documentation.
- Decide canonical naming for base URL env vars and align code/docs.
- Add any required Stripe Connect return/refresh URLs when WS3 lands.

### WS9. Pricing Experience And Packaging Transparency

| ID     | Priority | Status | Item                                                                                                | Repo |
| ------ | -------- | ------ | --------------------------------------------------------------------------------------------------- | ---- |
| WS9-01 | P1       | DONE   | Define launch pricing catalog for Actor, Agency, and Studio profile types and tier metadata         | TI   |
| WS9-02 | P1       | DONE   | Build public Pricing page with side-by-side tier comparison by profile type                         | TI   |
| WS9-03 | P1       | DONE   | Implement currency behavior: default USD, default GBP for UK users, and explicit USD/GBP toggle     | TI   |
| WS9-04 | P2       | DONE   | Add pricing correctness tests, locale tests, and content-governance checks for publicly shown plans | TI   |

#### WS9-01 Acceptance Criteria

- Pricing catalog includes Actor, Agency, and Studio profile types.
- Each profile type lists its tiers in a structured and extensible data model.
- Catalog supports monthly and annual labels where applicable.
- All tiers in the first-release catalog are marked Available.

#### WS9-02 Acceptance Criteria

- Public route exists for a Pricing page.
- UI presents profile-type sections for Actor, Agency, and Studio.
- Within each profile type, tiers are displayed side by side for easy comparison.
- Comparison includes tier name, price, billing period, and key feature bullets.
- Mobile behavior remains readable and usable.

#### WS9-03 Acceptance Criteria

- Default currency is USD for non-UK users.
- UK users default to GBP based on this order:
  - edge/platform geolocation header
  - browser locale/language
  - signed-in account profile country
- Users can toggle between USD and GBP manually.
- User toggle preference persists for the session and subsequent visits.
- Currency label and symbols update consistently across all visible pricing cards.
- Dynamic FX conversion from USD to GBP is applied with explicit refresh cadence and rounding rules.
- Annual pricing supports both USD and GBP display at first release.

#### WS9-03 Implementation Notes (Locked)

- FX source: Bank of England daily exchange rates.
- Refresh strategy: daily refresh with cached last-known-good fallback on provider failure.
- Country detection for GBP default is resolved in strict order:
  - `x-vercel-ip-country`
  - `cf-ipcountry` (fallback if available)
  - browser locale/language
  - signed-in profile country
- Rounding/display strategy: exact two-decimal GBP conversion from USD.
- UI disclosure: indicate displayed GBP is converted from USD where final charge settlement is USD.

#### WS9-04 Acceptance Criteria

- Unit tests validate displayed pricing by profile type and currency.
- Integration tests validate UK defaulting behavior and manual toggle override.
- Public Pricing page never displays a tier as Available unless it is actually purchasable.
- Tests validate the detection-order fallback path (geolocation -> locale -> profile country).
- Tests validate dynamic FX conversion boundaries and rounding behavior.

## Phase-By-Phase Implementation Schedule

Assumptions for planning:

- Sprint length: 2 weeks
- Team baseline: 2 full-stack engineers, 1 platform engineer (shared), 1 QA (shared)
- Estimates are effort ranges and include implementation plus validation, excluding unplanned incident time

### Sprint 1. Platform Safety Foundation

| Focus                                                           | Backlog Items                          | Effort Estimate    |
| --------------------------------------------------------------- | -------------------------------------- | ------------------ |
| Remove production blockers in core runtime and payments ingress | WS1-01, WS1-02, WS1-04, WS7-01, WS7-02 | 8-12 engineer-days |
| Start cross-service traceability baseline                       | WS1-05 (partial)                       | 2-3 engineer-days  |

#### Sprint 1 Exit Criteria

- DB TLS is production-safe.
- Stripe webhook idempotency storage and duplicate guard are live.
- Sensitive API routes have baseline rate limiting and validation standards.
- Initial correlation ID propagation path is demonstrated in logs.

### Sprint 2. Subscription Reliability And Launch Messaging

| Focus                                                         | Backlog Items                       | Effort Estimate    |
| ------------------------------------------------------------- | ----------------------------------- | ------------------ |
| Complete subscription lifecycle handling and provisioning     | WS1-03, WS2-03, WS2-05              | 8-11 engineer-days |
| Finalize and implement full launch pricing package definition | WS2-01, WS2-02, WS9-01              | 7-10 engineer-days |
| Complete public claims constraints and launch copy readiness  | Launch scope doc alignment + WS6-05 | 2-3 engineer-days  |

#### Sprint 2 Exit Criteria

- Subscription events are processed safely and provision access correctly.
- Full planned tier catalog is configured and test-validated.
- Public claims and pricing labels are aligned with live capabilities.

### Sprint 3. Pricing Page And Commercial UX Baseline

| Focus                                                                           | Backlog Items                   | Effort Estimate   |
| ------------------------------------------------------------------------------- | ------------------------------- | ----------------- |
| Deliver public Pricing page with profile-type comparison layout                 | WS9-02                          | 4-6 engineer-days |
| Implement USD/GBP defaults, detection fallback, dynamic FX, and toggle behavior | WS9-03                          | 5-7 engineer-days |
| Add pricing and locale correctness test coverage                                | WS9-04                          | 2-3 engineer-days |
| Close backend-only UI gaps that affect launch trust                             | WS6-01, WS6-02 (minimal viable) | 3-5 engineer-days |

#### Sprint 3 Exit Criteria

- Pricing page is public, accurate, and mobile-usable.
- Actor, Agency, and Studio tiers are shown side by side by profile type.
- UK users default to GBP using the locked fallback order, others default to USD, and manual toggle works.
- Dynamic FX conversion and annual pricing render correctly in both currencies.
- Only truly purchasable tiers are marked Available.

### Sprint 4. Commercial Domain Foundations

| Focus                                                        | Backlog Items                  | Effort Estimate     |
| ------------------------------------------------------------ | ------------------------------ | ------------------- |
| Build foundational studio/project/deal data model and routes | WS4-01, WS4-02, WS4-04, WS4-05 | 10-14 engineer-days |
| Add core deal state transitions and approval/rejection       | WS4-06                         | 3-5 engineer-days   |
| Add fee logic with boundary test coverage                    | WS4-07                         | 2-4 engineer-days   |

#### Sprint 4 Exit Criteria

- Studio/project/deal foundations exist with tested APIs.
- Deal lifecycle states are valid and auditable.
- Platform fee calculation is correct at all threshold boundaries.

### Sprint 5. Consent-Gated Licensing And Payments Core

| Focus                                                       | Backlog Items  | Effort Estimate   |
| ----------------------------------------------------------- | -------------- | ----------------- |
| Wire consent gate into deal approval and licence creation   | WS5-01, WS5-02 | 6-9 engineer-days |
| Implement deal payment initiation and payment status wiring | WS4-08         | 4-6 engineer-days |
| Harden license usage tracking and observability             | WS5-03, WS7-04 | 3-5 engineer-days |

#### Sprint 5 Exit Criteria

- No deal can finalize without consent validation.
- Approved and paid deals produce licence records with locked consent version.
- Payment and licence events are observable and traceable.

### Sprint 6. Connect, Payouts, And Operations Hardening

| Focus                                                           | Backlog Items                                          | Effort Estimate    |
| --------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| Deliver Connect onboarding and webhook-driven state transitions | WS3-01, WS3-02, WS3-03                                 | 8-12 engineer-days |
| Implement payout audit and intervention flow                    | WS3-04, WS3-05                                         | 4-6 engineer-days  |
| Finish platform operations, rollback, and environment controls  | WS7-03, WS7-05, WS7-06, WS7-07, WS8-01, WS8-02, WS8-03 | 7-10 engineer-days |

#### Sprint 6 Exit Criteria

- Connect onboarding and payout telemetry are production-operable.
- Environment contracts and runbooks are complete.
- Monitoring and incident-response coverage is ready for public scale-up.

### Sprint 7. Arbitration And Go-Live Validation

| Focus                                                        | Backlog Items                          | Effort Estimate    |
| ------------------------------------------------------------ | -------------------------------------- | ------------------ |
| Implement arbitration workflow and consent-conflict handling | WS5-04, WS5-05                         | 7-10 engineer-days |
| Complete remaining user-facing gaps and readiness checks     | WS6-03, WS6-04, WS8-04, WS8-05, WS8-06 | 7-10 engineer-days |

#### Sprint 7 Exit Criteria

- Arbitration path exists and is operable.
- Go-live evidence pack is complete with checklist proof.
- Launch/no-launch decision can be made from objective evidence.

## Effort Summary By Phase

| Phase                                 | Sprints | Effort Range         |
| ------------------------------------- | ------- | -------------------- |
| Foundation and launch-scope alignment | 1-3     | 31-46 engineer-days  |
| Commercial core implementation        | 4-5     | 25-38 engineer-days  |
| Payout and operations completion      | 6-7     | 26-38 engineer-days  |
| Total estimated effort                | 1-7     | 82-122 engineer-days |

## Dependencies And Critical Path

1. WS1-01 and WS1-02 are hard prerequisites for safe webhook and billing operations.
2. WS2 launch-tier decision and WS9 pricing catalog are prerequisites for accurate public pricing page.
3. WS4 deal model must exist before WS5 consent-gated licensing and WS3 payout orchestration can fully land.
4. WS8 runbook and env contract tasks must be complete before final go-live sign-off.

## Suggested Delivery Order

### Phase A. Stabilize Production Safety

Complete before any additional monetization work:

- WS1-01
- WS1-02
- WS1-03
- WS1-04
- WS1-05
- WS7-01
- WS7-02

### Phase B. Decide Launch Scope And Billing Model

- WS2-01
- WS2-02
- WS2-03
- WS9-01
- explicit scope decision for subscription tiers

### Phase C. Build Commercial Core

- WS4-01 through WS4-08
- WS5-01
- WS5-02
- WS9-02 through WS9-04

### Phase D. Add Payouts And Connect

- WS3-01 through WS3-05

### Phase E. Finish Operational Readiness

- WS5-03
- WS5-04
- WS5-05
- WS6-01 through WS6-05
- WS7-03 through WS7-07
- WS8-01 through WS8-06

## Recommended Launch Scope

Given the current implementation state, the pragmatic path is:

### Recommended first production scope

- Actor registration and verification
- Consent and representation management
- Subscription billing for the full planned tier catalog
- Public pricing page with side-by-side comparison across Actor, Agency, and Studio profile types
- Annual pricing at launch
- No public studio/project/deal/payment marketplace flows until WS4 and WS3 are complete

### What should not go live yet

- Deal payments
- Connect onboarding and payouts
- Revenue-sharing workflows
- Refund / dispute / arbitration features
- Studio-facing commercial marketplace promises

This reduces launch risk and aligns production claims with actual implementation.

## Tracking Template

Use this section format when work begins on an item:

### Item Record

- `ID:`
- `Status:`
- `Owner:`
- `Dependencies:`
- `Implementation notes:`
- `Validation evidence:`
- `Open risks:`

## First 10 Tasks To Start Next

1. Implement WS1-01 and remove unsafe DB TLS behavior.
2. Implement WS1-02 and add webhook event idempotency storage.
3. Implement WS1-03 for subscription lifecycle webhook coverage.
4. Verify and enforce WS1-04 fail-closed behavior for TI -> HDICR outages.
5. Implement WS1-05 correlation ID propagation end-to-end.
6. Make the explicit launch-scope decision for WS2.
7. Expand `billing.ts` and env contracts to the chosen launch tier set.
8. Add rate limiting and route validation hardening from WS7-01 and WS7-02.
9. Design the TI commercial schema additions from WS4.
10. Decide whether HDICR should retain any Stripe secret usage, then close WS8-02.

## Completion Definition

This backlog is complete only when:

- all release-gate items are complete,
- the chosen launch scope is fully implemented end-to-end,
- manual console configuration is reconciled with code and docs,
- and the launch checklist has evidence for every claimed capability.
