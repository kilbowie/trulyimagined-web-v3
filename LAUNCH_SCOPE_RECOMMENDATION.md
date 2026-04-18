# LAUNCH_SCOPE_RECOMMENDATION

_Generated: 2026-04-18_
_Applies to first public TI release_

## Purpose

Define what TI can and cannot claim publicly at first release so that marketing, sales, support, and product messaging stay aligned with implemented functionality.

## Decision Lock (2026-04-18)

The following decisions are now fixed for first release planning and execution:

1. First release includes the full planned tier catalog.
2. All tiers are intended to be live at first release (no placeholder tiers).
3. Currency default order is:
   - request geolocation header from edge/platform,
   - then browser locale/language,
   - then signed-in account profile country.
4. GBP pricing uses dynamic FX conversion from USD.
5. Annual pricing is included at first release.
6. Technical implementation decisions:
   - FX source: Bank of England daily exchange rates
   - Recommended primary edge country header: `x-vercel-ip-country`
   - Secondary fallback edge header (if present): `cf-ipcountry`
   - GBP display values use exact two-decimal conversion from USD
   - Settlement currency remains USD where checkout is configured for USD charging

## Release Positioning

### Recommended first-release product statement

Truly Imagined is launching first as a trusted identity, consent, and representation platform with subscription billing, while commercial deal marketplace and payout workflows remain in staged rollout.

## Public Claims Matrix

### Claims allowed at first release

| Area                             | Allowed Public Claim                                                              | Evidence Basis                                                     |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Identity verification            | Actors can complete identity verification workflows with status tracking          | Verification routes, dashboard flow, Stripe Identity integration   |
| Consent controls                 | Actors can create and manage consent preferences with auditable history           | Consent routes, consent preferences UI, ledger model               |
| Representation workflows         | Actors and agents can request, manage, and terminate representation relationships | Representation APIs and dashboards implemented                     |
| Invitation codes                 | Agencies can issue and actors can redeem invitation codes                         | Code generation/list/accept routes and UI                          |
| Subscription billing             | TI supports account billing, checkout, billing portal, and subscription summary   | Billing routes and billing dashboard implemented                   |
| Compliance-oriented architecture | TI and HDICR are separated with authenticated service-to-service integration      | M2M auth, JWKS validation, no direct cross-db runtime dependencies |

### Claims allowed only with explicit caveat

| Area                 | Caveated Claim                                | Required Caveat                                                                        |
| -------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Subscription tiers   | Multiple subscription plans are available     | Only claim tiers that are actually configured and purchasable in production            |
| Admin operations     | Admin workflows exist                         | Specify current admin scope (verification, feedback, IAM) and avoid broad admin claims |
| Licensing visibility | License records and usage views are available | Clarify this is not yet a full studio marketplace licensing lifecycle                  |

### Claims that must not be made at first release

| Area                      | Disallowed Claim                                                                | Reason                                                      |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Studio marketplace        | Studios can create projects, cast, and execute full deal workflow in production | Studio/project/deal surfaces are not implemented end-to-end |
| Deal automation           | End-to-end deal creation, negotiation, approval, and payment is live            | Core deal domain is missing                                 |
| Payouts                   | Actor/agency payouts via Stripe Connect are fully live                          | Connect onboarding and payout orchestration not complete    |
| Refund/dispute automation | Full refund and dispute processing is operational                               | Not implemented                                             |
| Arbitration workflow      | Consent-revocation arbitration is fully operational                             | Arbitration workflow not implemented                        |

## Website And Sales Copy Guardrails

### Homepage guardrails

- Emphasize trust, verification, consent governance, and representation.
- Avoid language implying fully live studio marketplace economics.
- Do not promise payouts, deal settlements, or arbitration unless those paths are released.

### Pricing page guardrails

- Show only purchasable tiers as Available.
- Do not show Coming soon for tiers in first-release pricing catalog; all published tiers must be live.
- Keep feature comparison claims tied to currently implemented capability.
- Support USD and GBP presentation with explicit user toggle.
- Apply UK default using the locked detection order (edge geolocation, then locale, then profile country).
- Include annual pricing options at first release.

### Sales and partnership guardrails

- Allowed: planned roadmap discussion for deals/payouts.
- Not allowed: contractual commitments that those features are currently available unless explicitly enabled per customer under controlled rollout.

## Launch Scope Definition For First Release

### In scope

- Actor onboarding and profile management
- Identity verification flows
- Consent management and history
- Agent representation and invitation-code workflows
- Subscription checkout, portal, and billing visibility
- Full planned tier catalog across Actor, Agency, and Studio profile types
- Public pricing page with side-by-side tier comparison
- USD/GBP support with UK default behavior and manual toggle
- Annual pricing display and purchase options

### Out of scope

- Studio marketplace workflows
- Project posting and job board
- Deal templates and deal lifecycle
- Stripe Connect onboarding and payout orchestration
- Refund/dispute and arbitration workflows

## Controlled Rollout Policy

If any out-of-scope capability is enabled for pilot users:

1. It must be behind explicit feature flags.
2. It must be excluded from broad public claims.
3. It must have a support runbook and manual fallback.

## Public Claims Release Checklist

All items must be true before publishing launch copy:

- Product, Engineering, and Operations sign-off on this scope.
- Website copy reviewed against disallowed claims table.
- Pricing copy and tier labels exactly match live configuration.
- Support team brief includes in-scope vs out-of-scope response guidance.
- Incident escalation owner assigned for billing and verification issues.

## Leadership Confirmations Recorded

The pricing and launch-scope decisions above are confirmed and now treated as implementation requirements.

Remaining optional leadership call:

1. Whether any studio/deal capabilities will run as private pilot at launch.

## Suggested Public Launch Statement

Truly Imagined now offers production-ready identity verification, consent governance, and representation workflows with integrated subscription billing. Marketplace deal creation, payout orchestration, and advanced commercial workflows are being rolled out in staged releases.
