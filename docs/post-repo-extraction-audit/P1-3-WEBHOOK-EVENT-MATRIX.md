# P1-3 Webhook Event Processing Matrix

Date: 2026-04-15
Status: Complete

## Overview

Maps all 19 Stripe events from the webhook setup guide to their handler, DB writes, audit
behaviour, and implementation status. Every event is explicitly categorised: Implemented,
Deferred, or No Action.

---

## Identity Verification (KYC)

| Event                                          | Status         | Handler                           | TI DB Writes                                                        | Audit       |
| ---------------------------------------------- | -------------- | --------------------------------- | ------------------------------------------------------------------- | ----------- |
| `identity.verification_session.created`        | Deferred       | Acknowledged, no-op               | None                                                                | None        |
| `identity.verification_session.processing`     | ✅ Implemented | `handleVerificationProcessing`    | `actors.verification_status = 'pending'`, `kyc_status_transitions`  | `audit_log` |
| `identity.verification_session.requires_input` | ✅ Implemented | `handleVerificationRequiresInput` | `actors.verification_status = 'pending'`, `kyc_status_transitions`  | `audit_log` |
| `identity.verification_session.verified`       | ✅ Implemented | `handleVerificationVerified`      | `actors.verification_status = 'verified'`, `kyc_status_transitions` | `audit_log` |
| `identity.verification_session.redacted`       | ✅ Implemented | `handleVerificationCanceled`      | `actors.verification_status = 'rejected'`, `kyc_status_transitions` | `audit_log` |
| `identity.verification_session.canceled`       | ✅ Implemented | `handleVerificationCanceled`      | `actors.verification_status = 'rejected'`, `kyc_status_transitions` | `audit_log` |

HDICR sync: all identity events trigger `withHdicrSyncRetries` after TI state is updated.

---

## Payments (Licenses)

| Event                    | Status         | Handler                 | TI DB Writes                                                                                | Audit                             |
| ------------------------ | -------------- | ----------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| `charge.succeeded`       | ✅ Implemented | `handleChargeSucceeded` | INSERT `commercial_licenses`, UPSERT `wallet_balances` (actor + agent)                      | `audit_log`                       |
| `charge.failed`          | ✅ Implemented | `handleChargeFailed`    | None                                                                                        | `audit_log` (if metadata present) |
| `charge.refunded`        | ✅ Implemented | `handleChargeRefunded`  | UPDATE `commercial_licenses.status = 'refunded'`, UPSERT `wallet_balances` (negative delta) | `audit_log`                       |
| `charge.dispute.created` | ✅ Implemented | `handleChargeDisputed`  | UPDATE `commercial_licenses.status = 'disputed'`                                            | `audit_log`                       |

### `charge.succeeded` — required charge metadata

| Field                    | Required | Notes                                              |
| ------------------------ | -------- | -------------------------------------------------- |
| `studio_user_profile_id` | Yes      | TI user_profile.id of the studio                   |
| `actor_user_profile_id`  | Yes      | TI user_profile.id of the actor                    |
| `agent_user_profile_id`  | No       | TI user_profile.id of agent; omit if unrepresented |
| `agent_commission_pct`   | No       | Integer 0–100; defaults to 25 if agent present     |
| `use_case`               | No       | Free-text licence use description                  |

### KYC gate (P1-5 coverage)

`handleChargeSucceeded` calls `assertActorKycVerified()` for both studio and actor before any
DB write. If either is not `'verified'`, the handler throws, which is caught by the outer
try/catch and recorded as a `processing_error` on the `stripe_events` row. The 200 response is
still returned to Stripe; the event will not be retried automatically, but the error is
observable and the event is replayable via the `stripe_events` table.

---

## Subscriptions

| Event                           | Status   | Notes                                  |
| ------------------------------- | -------- | -------------------------------------- |
| `customer.subscription.created` | Deferred | Subscription model not yet implemented |
| `customer.subscription.updated` | Deferred |                                        |
| `customer.subscription.deleted` | Deferred |                                        |

---

## Subscription Billing

| Event                           | Status         | Handler                     | TI DB Writes | Audit                             |
| ------------------------------- | -------------- | --------------------------- | ------------ | --------------------------------- |
| `invoice.payment_failed`        | Deferred       | Acknowledged, no-op         | None         | None                              |
| `payment_intent.payment_failed` | ✅ Implemented | `handlePaymentIntentFailed` | None         | `audit_log` (if metadata present) |

---

## Payouts (Withdrawals)

| Event            | Status         | Handler               | TI DB Writes                                             | Audit       |
| ---------------- | -------------- | --------------------- | -------------------------------------------------------- | ----------- |
| `payout.created` | ✅ Implemented | `handlePayoutCreated` | INSERT `withdrawals` (status `processing`)               | `audit_log` |
| `payout.paid`    | ✅ Implemented | `handlePayoutPaid`    | UPDATE `withdrawals.status = 'completed'`                | `audit_log` |
| `payout.failed`  | ✅ Implemented | `handlePayoutFailed`  | UPDATE `withdrawals.status = 'failed'`, `failure_reason` | `audit_log` |

### `payout.created` — required payout metadata

| Field             | Required | Notes                                      |
| ----------------- | -------- | ------------------------------------------ |
| `user_profile_id` | Yes      | TI user_profile.id of the withdrawing user |

---

## Agent Connected Account

| Event                               | Status   | Notes                                                           |
| ----------------------------------- | -------- | --------------------------------------------------------------- |
| `v2.core.account[identity].updated` | Deferred | Connected account model deferred until HDICR independence phase |

---

## Summary Counts

| Category          | Implemented | Deferred                                          |
| ----------------- | ----------- | ------------------------------------------------- |
| Identity / KYC    | 5           | 1 (`created` — no action needed at creation time) |
| Payments          | 4           | 0                                                 |
| Subscriptions     | 0           | 3                                                 |
| Billing           | 1           | 1 (`invoice.payment_failed`)                      |
| Payouts           | 3           | 0                                                 |
| Connected Account | 0           | 1                                                 |
| **Total**         | **13**      | **6**                                             |

---

## Deferred Backlog

- **Subscriptions** (`customer.subscription.*`, `invoice.payment_failed`): requires a
  subscription model in TI (tables, state machine, billing portal integration). Declared as a
  separate future backlog item.
- **`identity.verification_session.created`**: No business action required at session creation;
  existing flow creates the session server-side and stores the session ID. Acknowledged silently.
- **`v2.core.account[identity].updated`**: Stripe connected account identity updates relevant
  only when TI operates as a platform with agents on Stripe Connect. Deferred until HDICR
  independence phase.

---

## Idempotency Properties

All handlers rely on the `stripe_events` replay guard implemented in P1-4:

1. `persistStripeEventReceipt` inserts the raw event with `ON CONFLICT DO NOTHING`; returns
   `alreadyProcessed = true` if a processed row already exists.
2. Replayed already-processed events return `{received: true, replayed: true}` without re-running
   any handler.
3. `commercial_licenses.stripe_charge_id UNIQUE` provides natural idempotency for `charge.*`.
4. `withdrawals.stripe_payout_id UNIQUE` provides natural idempotency for `payout.created`.

---

## Related Backlog Items

| Item | Relationship                                                                      |
| ---- | --------------------------------------------------------------------------------- |
| P1-2 | Migration 035 creates the TI tables written by these handlers                     |
| P1-4 | Idempotency/replay guard already implemented; all handlers benefit                |
| P1-5 | KYC gate (`assertActorKycVerified`) is implemented inside `handleChargeSucceeded` |
| P1-6 | License split logic (wallet credits) implemented inside `handleChargeSucceeded`   |
| P1-7 | Payout/withdrawal lifecycle implemented via `handlePayout*`                       |
