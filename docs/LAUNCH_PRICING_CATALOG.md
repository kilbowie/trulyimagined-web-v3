# Launch Pricing Catalog (WS9-01)

Last updated: 2026-04-18  
Owner: TI Platform / Commercial Engineering

## Purpose

This document is the launch-source commercial catalog for Sprint 3 pricing UX work.
It defines the canonical tier IDs, labels, profile applicability, Stripe environment keys, and seat model behavior.

Canonical implementation source: `apps/web/src/lib/billing.ts`.

## Launch Catalog Summary

The launch catalog contains six subscription plans plus one seat add-on SKU.
All plans support monthly and yearly billing intervals.

### Actor

| Tier ID              | Label              | Billing model | Monthly env key                           | Yearly env key                           |
| -------------------- | ------------------ | ------------- | ----------------------------------------- | ---------------------------------------- |
| `actor_professional` | Actor Professional | Subscription  | `STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY` | `STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY` |

### Agency

| Tier ID              | Label              | Billing model | Monthly env key                           | Yearly env key                           |
| -------------------- | ------------------ | ------------- | ----------------------------------------- | ---------------------------------------- |
| `agency_independent` | Agency Independent | Subscription  | `STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY` | `STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY` |
| `agency_boutique`    | Agency Boutique    | Subscription  | `STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY`    | `STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY`    |
| `agency_sme`         | Agency SME         | Subscription  | `STRIPE_PRICE_AGENCY_SME_MONTHLY`         | `STRIPE_PRICE_AGENCY_SME_YEARLY`         |

Agency seat expansion SKU:

| SKU                | Purpose                                | Env key                          |
| ------------------ | -------------------------------------- | -------------------------------- |
| Agency seat add-on | Additional paid seats beyond base seat | `STRIPE_PRICE_AGENCY_SEAT_ADDON` |

### Studio / Enterprise

| Tier ID            | Label            | Billing model | Monthly env key                         | Yearly env key                         |
| ------------------ | ---------------- | ------------- | --------------------------------------- | -------------------------------------- |
| `studio_indie`     | Studio Indie     | Subscription  | `STRIPE_PRICE_STUDIO_INDIE_MONTHLY`     | `STRIPE_PRICE_STUDIO_INDIE_YEARLY`     |
| `studio_midmarket` | Studio Midmarket | Subscription  | `STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY` | `STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY` |

## Role Availability

Tier visibility is constrained by role mapping in `billing.ts`:

- Actor-facing: `Actor`
- Agency-facing: `Agent`, `Admin`
- Studio-facing: `Enterprise`, `Admin`

## Interval Model

Intervals are canonicalized as:

- `monthly`
- `yearly`

`defaultInterval` is `monthly` for all launch tiers.

## Checkout / Webhook Alignment

The following paths must remain aligned with this catalog:

- Checkout route: `apps/web/src/app/api/billing/checkout/route.ts`
- Webhook plan resolution: `apps/web/src/app/api/webhooks/stripe/route.ts`
- Env key declaration: `apps/web/.env.example`

## Seat Model (Launch)

Agency seat allocation is enforced from subscription lifecycle data:

- Source of truth: `user_subscriptions.seat_count`
- Occupying statuses: invited and active agency team members
- Enforcement points:
  - create invite
  - resend invite
  - membership status transitions
  - invite acceptance

Implementation source: `apps/web/src/lib/agency-seat-limits.ts`.

## Aliases (Backward Compatibility)

Legacy aliases accepted by billing plan resolution:

- `actor_pro` -> `actor_professional`
- `agent_pro` -> `agency_independent`
- `studio_enterprise` -> `studio_midmarket`

## Sprint 3 Input Contract

WS9-02 and WS9-03 must consume this document and `billing.ts` as authoritative.
No new launch tier IDs, labels, or env key names should be introduced without coordinated changes to:

- `billing.ts`
- `.env.example`
- checkout handler
- webhook plan mapping logic
- this document
