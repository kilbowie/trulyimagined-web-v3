# Post-Extraction Implementation Backlog

Last updated: 2026-04-14
Status: In progress (P0-1 complete, P1-1 in implementation)

## Confirmed Architecture Decision

- D1 confirmed: `identity.verification_session.*` events are processed directly in TI at a single Stripe webhook endpoint, then synced to HDICR.
- Rationale: platform is operating as one integrated system for the foreseeable future; split webhook endpoints are deferred until a later HDICR independence phase.

## Goal

Close remaining repo-separation and production-readiness gaps, then implement and harden Stripe webhook driven identity, licensing, wallet, and payout flows.

## Priority Legend

- P0: Launch blocker
- P1: Required before production cutover
- P2: Important follow-up and hardening

## P0 Launch Blockers

### P0-1 Add representation coverage to TI contract gate

- Scope
  - Extend TI contract gate to validate representation endpoints against copied representation OpenAPI spec.
  - Align tests with active TI representation client surface.
- Files
  - trulyimagined/apps/web/src/lib/hdicr/openapi-contract-gate.contract.test.ts
  - trulyimagined/apps/web/src/lib/hdicr/representation-client.ts
  - trulyimagined/services/representation-service/openapi.yaml
- Acceptance criteria
  - Contract test includes representation domain assertions.
  - pnpm test:contract passes with representation included.

### P0-2 Publish and verify live Stripe webhook endpoint

- Scope
  - Confirm production endpoint is live at https://trulyimagined.com/api/webhooks/stripe.
  - Register endpoint in Stripe and finalize STRIPE_WEBHOOK_SECRET for production.
- Files
  - trulyimagined/apps/web/src/app/api/webhooks/stripe/route.ts
  - trulyimagined/apps/web/vercel.json
- Acceptance criteria
  - Endpoint returns expected non-404 behavior in production.
  - Stripe dashboard delivery log shows successful event delivery to production endpoint.
  - STRIPE_WEBHOOK_SECRET updated and deployed.

### P0-3 Reconcile post-extraction audit docs with extracted reality

- Scope
  - Remove stale monorepo and env naming assumptions from audit docs.
  - Align docs with extracted-repo runtime model and deploy paths.
- Files
  - docs/post-repo-extraction-audit/00-POST-EXTRACTION-AUDIT.md
  - docs/post-repo-extraction-audit/AUDIT-QUICK-REFERENCE.md
  - docs/post-repo-extraction-audit/COPILOT-POST-EXTRACTION-AUDIT-PROMPT.md
- Acceptance criteria
  - Docs reflect current TI and HDICR env/runtime contracts.
  - No stale guidance remains for deprecated naming or paths.

### P0-4 Run extracted-repo readiness gate

- Scope
  - Execute full TI and HDICR validation from extracted repos only.
  - Include webhook reachability and TI to HDICR remote smoke verification.
- Acceptance criteria
  - TI: pnpm build, pnpm type-check, pnpm test, pnpm test:contract pass.
  - HDICR: pnpm build, pnpm type-check, pnpm test, sam validate -t infra/template.yaml pass.
  - Webhook endpoint and remote integration smoke checks pass.

## P1 Required Before Production Cutover (Webhook and Licensing Flows)

### P1-1 Implement single-endpoint KYC processing model (TI -> HDICR sync)

- Scope
  - Implement TI as the direct processor for `identity.verification_session.*` events at the Stripe webhook endpoint.
  - Implement outbound sync from TI to HDICR for KYC status/session updates.
  - Define retry, error handling, and reconciliation for TI->HDICR sync failures.
- Implementation progress
  - TI webhook now updates TI actor verification state on Stripe identity events before HDICR sync.
  - HDICR identity sync calls now use bounded retry with structured failure logging.
  - TI audit entries are persisted for identity webhook state transitions and sync-failure triage.
- Inputs
  - docs/webhook-setup-guide/IMPLEMENTATION_PLAN.md
  - docs/webhook-setup-guide/copilot_webhook_audit_prompt.md
- Acceptance criteria
  - TI webhook handler updates TI KYC state on identity events.
  - TI reliably syncs the same state to HDICR using authenticated service-to-service calls.
  - Sync failure path is observable and replayable without data loss.

### P1-2 Audit existing schema against proposed webhook migration model

- Scope
  - Compare current TI schema to proposed tables in webhook guide.
  - Identify create, alter, and non-adopt items before writing migration.
- Inputs
  - docs/webhook-setup-guide/database-migration.sql
- Acceptance criteria
  - Gap matrix produced: exists, partial, missing, not applicable.
  - Approved migration plan that avoids destructive changes.

### P1-3 Implement webhook event processing matrix and handler ownership

- Scope
  - Map all required events to handlers and business outcomes.
  - Ensure 19 event categories from guide are covered or explicitly deferred.
- Inputs
  - docs/webhook-setup-guide/WEBHOOK_SETUP_GUIDE.md
  - docs/webhook-setup-guide/stripe-webhook-handler.js
- Acceptance criteria
  - Event matrix includes identity, payments, subscriptions, invoice/payment intent failures, payouts, connected account identity updates.
  - Every event is mapped to DB writes and audit behavior.

### P1-4 Enforce idempotent, async webhook processing semantics

- Scope
  - Ensure signature verification, idempotency, and safe retries are implemented.
  - Ensure handlers acknowledge quickly and process without duplicate side effects.
- Acceptance criteria
  - Duplicate event replay does not create duplicate license, payout, or audit side effects.
  - Failure path records processing errors and supports manual retry workflow.

### P1-5 Implement KYC gating across license, payout, and withdrawal flows

- Scope
  - Enforce verified status checks at API and data layers for all gated operations.
  - Confirm denial behavior and audit outcomes for blocked attempts.
- Acceptance criteria
  - Unverified studio/actor/agent flows are blocked with auditable outcomes.
  - Verified flows proceed successfully.

### P1-6 Implement and verify license split and wallet update invariants

- Scope
  - Define split logic (TI fee, actor share, agent share) and rounding rules.
  - Apply wallet updates atomically with auditable metadata.
- Acceptance criteria
  - charge.succeeded creates consistent license and wallet state.
  - refund/dispute paths reverse or freeze funds consistently.
  - Agent-present and unrepresented actor paths both verified.

### P1-7 Implement payout and withdrawal lifecycle handling

- Scope
  - Cover payout request creation, release, withdrawal creation, payout succeeded/failed handling.
  - Ensure failed payouts return funds appropriately.
- Acceptance criteria
  - payout.created, payout.paid, payout.failed update state and balances consistently.
  - Failure reasons are preserved in logs and audit entries.

### P1-8 Define and implement webhook observability and alerting

- Scope
  - Add operational queries, dashboards, and alerting for failed events and blocked gates.
  - Ensure operational runbook exists for manual replay and triage.
- Acceptance criteria
  - Operators can identify failures from structured logs and DB query surfaces.
  - Alerts exist for repeated webhook failures and critical event processing failures.

### P1-9 Align webhook setup docs to actual TI deployment model

- Scope
  - Rework setup guide sections that assume generic Express mounting into actual TI runtime structure.
  - Normalize env var naming to current TI conventions where applicable.
- Inputs
  - docs/webhook-setup-guide/WEBHOOK_SETUP_GUIDE.md
  - docs/webhook-setup-guide/IMPLEMENTATION_PLAN.md
- Acceptance criteria
  - Setup guide is executable against current TI app shape and deployment model.
  - Endpoint registration and local test sections are accurate.

## P2 Important Follow-Up and Hardening

### P2-1 Decide long-term location for copied OpenAPI specs in TI

- Scope
  - Keep as intentional contract snapshots or relocate to dedicated contracts area.
  - Update docs and test paths accordingly.
- Acceptance criteria
  - Decision documented and reflected in repo structure.

### P2-2 Remove legacy HDICR env fallback names after cutover stability period

- Scope
  - Remove fallback support once canonical names are fully verified in production.
- Acceptance criteria
  - Runtime config only supports canonical env names.
  - Docs and tests updated.

### P2-3 Improve extracted repo operator documentation

- Scope
  - Add practical setup and deploy guidance in both root READMEs and env examples.
- Acceptance criteria
  - A new operator can run validation and deployment from docs alone.

### P2-4 Resolve unrelated formatting drift before final readiness signoff

- Scope
  - Clean known formatting-only diffs in HDICR once functional changes are stable.
- Acceptance criteria
  - Clean git status on both extracted repos at release checkpoint.

## Ordered Implementation Path

1. Complete P0-1 and P0-2 first (contract parity plus live webhook endpoint).
2. Execute P1-1 implementation for TI-owned identity event processing and TI to HDICR sync.
3. Execute P1-2 schema audit and approved migration plan.
4. Implement P1-3 through P1-7 event handling and data invariants.
5. Execute P1-8 and P1-9 operational and documentation alignment.
6. Run P0-4 full readiness gate and only then proceed to P2 hardening items.

## Decision Log Placeholders

- Decision D1: Confirmed. TI processes `identity.verification_session.*` events directly at single Stripe webhook endpoint and syncs to HDICR.
- Decision D2: Confirmed. In current platform phase, TI single Stripe webhook endpoint owns both identity and financial webhook event processing; HDICR receives synchronized identity/KYC state from TI.
- Decision D3: OpenAPI snapshot strategy in TI.
- Decision D4: Cutover date for removing legacy env fallbacks.
