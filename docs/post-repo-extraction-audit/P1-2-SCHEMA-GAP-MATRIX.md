# P1-2 Schema Gap Matrix: Webhook Migration Model vs Current TI/HDICR Schema

Date: 2026-04-14  
Owner: TI extraction implementation  
Inputs:
- docs/webhook-setup-guide/database-migration.sql
- infra/database/migrations/*.sql

## Summary
The proposed webhook migration model in docs/webhook-setup-guide/database-migration.sql is a monolithic reference schema. The extracted platform now uses split-domain ownership and does not map 1:1.

Key result:
- Keep split ownership model (TI runtime + HDICR identity source).
- Do not adopt the proposed users table.
- Implement only missing TI-owned operational tables needed for webhook reliability and commercial flows.

## Gap Matrix

| Proposed object | Status | Current equivalent | Decision |
|---|---|---|---|
| users | partial | user_profiles (TI), actors (HDICR), agents (TI), identity_links (HDICR/TI sync) | non-adopt as single table; preserve split model |
| subscriptions | partial | Stripe is current source of truth; no TI subscription table in migrations | defer local table unless product requires historical query model |
| licenses (commercial purchase licenses) | missing for TI commercial semantics | licenses exists in 008 but HDICR consent/API licensing domain, not Stripe purchase licensing | create TI-owned commercial license table (new name to avoid collision) |
| wallet_balances | missing | no wallet balance table in TI migrations | create TI-owned wallet balance table |
| payout_requests | missing | no payout requests table in TI migrations | create TI-owned payout request table |
| withdrawals | missing | no withdrawal lifecycle table in TI migrations | create TI-owned withdrawal table |
| audit_events (immutable) | partial | audit_log exists; guardrails views/triggers exist for some domains | add TI webhook audit event table or extend audit_log conventions with immutable insert-only usage |
| kyc_audit | partial | identity_links + audit_log capture some state but no dedicated status-transition ledger | create TI KYC status transition ledger for replay/debug/reporting |
| stripe_events (raw webhook event log) | missing | no stripe webhook raw events table in TI migrations | create TI stripe_events table with processed/error metadata |
| v_verified_users | partial | derivable from actor verification_status + identity links + user flags | create TI view only if needed for ops queries |
| v_active_licenses | missing | no TI commercial license table currently | create after commercial licenses table |

## Notes on Existing Architecture
- Split DB boundaries are already explicit in code and migration ownership comments.
- HDICR outbox + TI hdicr_ref read-models already exist (027, 030), so new webhook persistence should align with that pattern.
- Existing licenses table from 008 is HDICR domain licensing (consent/API), not studio purchase payment licenses.

## Approved Migration Plan (Non-Destructive)

### Create (TI-owned)
1. stripe_events
- Columns: stripe_event_id unique, event_type, payload jsonb, processed, processing_error, received_at.
- Purpose: idempotency, replay, and incident triage.

2. kyc_status_transitions
- Columns: user_profile_id, old_status, new_status, stripe_session_id, trigger_event, reason, changed_at.
- Purpose: immutable KYC state transition history for identity events.

3. commercial_licenses
- Separate from HDICR licenses.
- Columns: studio_user_profile_id, actor_user_profile_id, agent_user_profile_id nullable, stripe_charge_id unique, amount_cents, status, created_at/updated_at.
- Purpose: webhook-driven payment/license lifecycle.

4. wallet_balances
- Columns: user_profile_id unique, balance_cents, currency, updated_at.

5. payout_requests
- Columns: agent_user_profile_id, actor_user_profile_id, commercial_license_id, amount_cents, status, requested_at, released_at.

6. withdrawals
- Columns: user_profile_id, amount_cents, currency, status, stripe_payout_id unique, requested_at, completed_at, failure_reason.

### Alter
1. audit_log usage conventions
- Enforce insert-only behavior for webhook/audit events at application layer and migration docs.
- Optional: add narrow trigger guard for webhook event resource_type values.

2. Identity status mapping conventions
- Standardize TI status mapping from Stripe events:
  - processing/requires_input -> pending
  - verified -> verified
  - canceled/redacted -> rejected

### Non-Adopt
1. users super-table from guide
- Rejected due split-domain architecture and existing production-linked shape.

2. Cross-table CHECK constraints with subqueries from reference SQL
- Avoid due operational complexity and split ownership boundaries.
- Enforce gates in API/domain logic with auditable denials.

## Risks and Mitigations
- Risk: naming collision with existing licenses table.
  - Mitigation: introduce TI-specific name (commercial_licenses) and explicit ownership comments.
- Risk: dual identity semantics across TI and HDICR.
  - Mitigation: persist TI event log + transition ledger; reconcile via HDICR sync/outbox worker.
- Risk: replay duplicates from Stripe retries.
  - Mitigation: unique stripe_event_id + idempotent handlers + processed/error tracking.

## Acceptance Criteria Mapping (P1-2)
- Gap matrix produced: complete.
- Status categories applied: exists/partial/missing/non-adopt complete.
- Non-destructive migration plan defined: complete.
