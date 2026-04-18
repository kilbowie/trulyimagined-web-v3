# FINAL AUDIT PROMPT — Truly Imagined & HDICR

# Run in VS Code Copilot across both repos. Output to: FINAL_AUDIT.md

---

## Instructions for Copilot

You are conducting a comprehensive audit of two interconnected platforms for production readiness. Your output must be a single markdown file called `FINAL_AUDIT.md` placed in the root of the TI repo. The audit covers three dimensions: (1) planned vs implemented, (2) backend without frontend UI, and (3) general production readiness.

**Output format:** For every item, use one of these statuses:

- `✅ DONE` — implemented and matches plan
- `⚠️ PARTIAL` — started but incomplete or diverges from plan
- `❌ MISSING` — planned but not implemented
- `🔧 BACKEND ONLY` — API/logic exists but no frontend UI
- `🗑️ REMOVE` — exists but should not (legacy/conflicting code)
- `📋 NOT YET PLANNED` — neither planned nor built, but should be considered

---

## PART 1: CONFIRMED ARCHITECTURE — The Source of Truth

The following decisions are LOCKED IN. Audit the codebase against these exactly.

### 1.1 Platform Separation

| Decision             | Confirmed Choice                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Repos                | Separate repositories (TI + HDICR)                                                               |
| TI Deployment        | Vercel (Next.js 15, App Router, TypeScript strict)                                               |
| HDICR Deployment     | AWS Lambda / SAM / API Gateway                                                                   |
| TI Database          | `trimg-db-ti` — AWS RDS PostgreSQL, `eu-west-1`                                                  |
| HDICR Database       | `trimg-db-v3` — AWS RDS PostgreSQL 15.10, `eu-west-1`                                            |
| Auth                 | Auth0 — shared tenant, M2M for TI → HDICR service calls                                          |
| Branding             | `api.trulyimagined.com` for HDICR API                                                            |
| S3 (TI media)        | `trulyimagined-media` — single bucket, prefix-based folders (`actors/`, `agencies/`, `studios/`) |
| S3 (HDICR artefacts) | `hdicr-sam-artifacts-*` — SAM deployment artefacts                                               |
| Logo hosting         | Cloudflare R2 at `https://assets.trulyimagined.com/logo.png`                                     |

**Audit tasks:**

- [ ] Confirm TI repo has NO direct database references to `trimg-db-v3` (HDICR's DB)
- [ ] Confirm HDICR repo has NO direct database references to `trimg-db-ti` (TI's DB)
- [ ] Confirm TI communicates with HDICR ONLY via authenticated HTTP API calls (Auth0 M2M)
- [ ] Confirm no shared database tables, no cross-service foreign keys
- [ ] Confirm HDICR has zero Stripe payment dependencies (Stripe Identity only)
- [ ] List any files in HDICR that reference `stripe` — these should be Identity-only or flagged for removal

### 1.2 Stripe Architecture (TI Only)

All commercial Stripe logic lives exclusively in TI. HDICR is payment-agnostic.

| Decision          | Confirmed Choice                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe Connect    | Express accounts                                                                                                                                                                       |
| Charge type       | Separate Charges and Transfers                                                                                                                                                         |
| Platform fee      | `application_fee_amount` on PaymentIntents                                                                                                                                             |
| Actors/Agencies   | Express connected accounts (receive payouts)                                                                                                                                           |
| Studios           | Stripe Customers (pay via PaymentIntent)                                                                                                                                               |
| Subscriptions     | Stripe Products and Prices (separate from deal payments)                                                                                                                               |
| Stripe Identity   | Full implementation in TI — sessions initiated from TI, webhook results handled in TI, then synced to HDICR via `POST /identity/verify-confirmed`                                      |
| Webhook endpoint  | Single: `POST /api/stripe/webhooks` (platform + Connect + Identity events, one signing secret)                                                                                         |
| Previous approach | Bank-token approach is DEPRECATED — `stripe.bankAccountTokens.create()` and `payment_methods` table with `stripe_bank_account_id` must be removed, replaced by `stripe_accounts` table |

**Platform events (no `event.account`):**

| Event                           | Purpose                  |
| ------------------------------- | ------------------------ |
| `customer.subscription.created` | Provision tier access    |
| `customer.subscription.updated` | Handle plan/seat changes |
| `customer.subscription.deleted` | Revoke access            |
| `invoice.payment_succeeded`     | Confirm payment          |
| `invoice.payment_failed`        | Dunning flow             |
| `payment_intent.succeeded`      | Confirm deal payment     |
| `payment_intent.payment_failed` | Mark deal failed         |
| `charge.refunded`               | Handle refund            |

**Connect events (`event.account` present):**

| Event               | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `account.updated`   | Onboarding status changed                 |
| `transfer.created`  | Payout initiated — audit log              |
| `transfer.reversed` | Transfer reversed — flag for intervention |
| `transfer.updated`  | Metadata/status update                    |

**NOTE:** `transfer.failed` does NOT exist as a Stripe event. Use `transfer.reversed`. For bank payout failures: `payout.failed` fires on the connected account.

**Identity events:**

| Event                                          | Purpose                      |
| ---------------------------------------------- | ---------------------------- |
| `identity.verification_session.verified`       | Update actor identity status |
| `identity.verification_session.requires_input` | Prompt retry                 |
| `identity.verification_session.canceled`       | Clean up session             |

**Audit tasks:**

- [ ] Scan entire TI codebase for all Stripe-related code. For each file found, report: file path, what it implements, whether it is Connect-aware (`transfer_data`, `application_fee_amount`, `account` params), whether webhooks use `request.text()` (correct for App Router) not `request.json()` (incorrect)
- [ ] Confirm webhook handler exists at `POST /api/stripe/webhooks` (single endpoint, not two)
- [ ] Confirm webhook uses `stripe.webhooks.constructEvent()` for signature verification
- [ ] Confirm webhook has event deduplication (check for already-processed event IDs)
- [ ] Confirm ALL events listed above are handled (or stubbed with TODO)
- [ ] Confirm Connect events check for `event.account` presence to distinguish from platform events
- [ ] Confirm no references to `transfer.failed` anywhere in codebase
- [ ] Confirm bank-token approach code is removed or marked deprecated
- [ ] Confirm `stripe_accounts` table exists (or migration exists) to replace `payment_methods`
- [ ] Scan HDICR codebase for any Stripe payment references — flag all as `🗑️ REMOVE`
- [ ] Confirm HDICR exposes `POST /identity/verify-confirmed` endpoint for TI to call after Identity webhook

### 1.3 Subscription Tiers & Pricing

| Tier               | Monthly | Annual               | Seats                                                                                                 |
| ------------------ | ------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| Actor Free         | $0      | —                    | 1 (HDICR registration, 1 headshot, consent preferences, image reservation)                            |
| Actor Creator      | $14     | $120/yr (~29% off)   | 1 (full consent management, licensing opt-in, unlimited media, agent linking, marketplace visibility) |
| Agency Independent | $75     | $749/yr (~17% off)   | 1 agent                                                                                               |
| Agency Boutique    | $225    | $2,249/yr (~17% off) | 3 agents, 2 assistants                                                                                |
| Agency Agency      | $449    | $4,490/yr (~17% off) | 6 agents, 3 assistants                                                                                |
| Agency Enterprise  | Custom  | Custom               | Custom                                                                                                |
| Studio Indie       | $299    | $2,990/yr (~17% off) | —                                                                                                     |
| Studio Mid         | $599    | $5,990/yr (~17% off) | —                                                                                                     |
| Studio Enterprise  | Custom  | Custom               | —                                                                                                     |

**Transaction fee (sliding scale on deal value, paid by studio):**

| Deal Value Band  | Platform Fee |
| ---------------- | ------------ |
| $0–$10,000       | 17.5%        |
| $10,001–$25,000  | 15%          |
| $25,001–$50,000  | 13%          |
| $50,001–$100,000 | 9%           |
| $100,001+        | 7.5%         |

**Audit tasks:**

- [ ] Confirm Stripe Products and Prices are seeded (or seed script exists) matching the tiers above
- [ ] Confirm platform fee calculation logic exists with correct band boundaries
- [ ] Confirm fee calculation includes unit tests for band boundaries and rounding
- [ ] List all `STRIPE_PRICE_*` environment variables and confirm they match tier structure
- [ ] Confirm subscription gating middleware exists (route protection by tier)
- [ ] Confirm seat management logic exists for Agency tiers

### 1.4 Auth0 & M2M Authentication

| Decision               | Confirmed Choice                                  |
| ---------------------- | ------------------------------------------------- |
| Auth provider          | Auth0 (shared tenant for both TI and HDICR)       |
| Service-to-service     | Auth0 M2M (`client_credentials` grant)            |
| TI → HDICR auth        | Bearer token in Authorization header              |
| HDICR token validation | JWKS from Auth0, validates `aud` and `exp` claims |
| API identifier         | `https://hdicr.trulyimagined.com`                 |
| Scopes                 | `read:actors`, `read:identities`, `read:consent`  |

**Audit tasks:**

- [ ] Confirm TI has M2M token client (`src/lib/hdicr-auth.ts` or similar) using `client_credentials` grant
- [ ] Confirm token caching exists (in-memory, refreshed before expiry)
- [ ] Confirm all HDICR HTTP calls include `Authorization: Bearer ${token}` header
- [ ] Confirm HDICR has auth middleware validating tokens via JWKS
- [ ] Confirm middleware returns 401 for missing token, 403 for invalid/expired
- [ ] Confirm correlation ID (`X-Correlation-ID`) is passed on all cross-service calls
- [ ] Confirm no secrets are logged anywhere (token contents, client secrets, etc.)

### 1.5 HDICR — Identity & Consent Truth Layer

HDICR is the authoritative source for:

- Actor identity registration and verification status
- Consent preferences (work types, territories, content restrictions, blocking)
- Consent versioning (immutable ledger with version history)

**Key concepts:**

- Consent is versioned: each change creates a new `consent_ledger` entry (v1, v2, v3...)
- Licenses lock the `consentVersionId` at signing time — future consent changes don't retroactively void existing licenses
- Consent revocation on active licenses triggers arbitration (30-day negotiation window)
- Actor has ultimate approval authority over consent — agents can request exceptions but cannot override

**Consent model fields:**

- `work_types`: e.g., Film/TV, Advertising, Synthetic Media, Voice Replication
- `territories`: allowed/blocked regions (ISO country codes)
- `content_restrictions`: content the actor won't participate in
- `blocking`: specific studios or usage types the actor blocks entirely

**HDICR endpoints expected:**

- `POST /identity/verify-confirmed` — TI calls after Stripe Identity webhook confirms actor
- `GET /api/v1/consent/check` — TI queries before licensing (input: actor_id, requested_usage, territory, studio_id)
- `PATCH /api/consent/revoke` — actor revokes work type or territory
- Actor profile CRUD
- Consent preference CRUD with version control

**Audit tasks:**

- [ ] Confirm consent_ledger table exists with version numbering
- [ ] Confirm consent check endpoint returns allow/conditional/deny with reason
- [ ] Confirm consent revocation creates new ledger version
- [ ] Confirm revocation checks for active license conflicts before completing
- [ ] Confirm `POST /identity/verify-confirmed` endpoint exists and accepts TI's M2M-authenticated calls
- [ ] List all HDICR API endpoints — document which have implementation and which are stubs

### 1.6 TI — Licensing & Marketplace Layer

TI is the commercial layer built on top of HDICR consent truth.

**User roles:**

- **Actor** — registers identity (via HDICR), sets consent, receives deal proposals, approves/rejects
- **Agent/Agency** — represents actors, reviews deals on their behalf, can annotate but cannot override actor consent
- **Studio** — creates projects, searches actors, proposes licence terms, pays deal amounts

**Core features planned:**

| Feature                    | Sprint   | Description                                                                    |
| -------------------------- | -------- | ------------------------------------------------------------------------------ |
| Actor profiles             | Sprint 1 | Registration, headshot upload, consent preferences via HDICR                   |
| Agency profiles            | Sprint 2 | Company info, agent invitation codes, roster management                        |
| Agent–actor representation | Sprint 2 | Invitation code redemption, representation approval, 30-day offboarding        |
| Studio profiles            | Sprint 2 | Company info, billing contact, KYC stub                                        |
| Project creation           | Sprint 2 | Usage intent, usage type, territory, casting_open flag                         |
| Job board                  | Sprint 2 | Filtered view of projects where `casting_open = true`, express interest action |
| Deal templates             | Sprint 3 | Equity-based predefined templates                                              |
| Deal creation              | Sprint 3 | Studio proposes terms (scope, duration, compensation)                          |
| Deal approval              | Sprint 3 | Actor/agent accept or reject (no counter-proposal in v1)                       |
| HDICR consent gate         | Sprint 3 | On deal approval, TI calls HDICR consent check; no valid consent = no licence  |
| Licence minting            | Sprint 4 | Creates licence record with locked consentVersionId                            |
| Usage logging              | Sprint 4 | Every usage event logged against licence for audit trail                       |
| Consent revocation         | Sprint 5 | Triggers arbitration if active licences affected                               |
| Arbitration workflow       | Sprint 5 | 30-day negotiation: Day 0–5 automated check, Day 0–30 negotiation, outcome     |
| Payment processing         | Sprint 6 | PaymentIntents, payout splits (actor/agent/TI), invoice generation             |
| Subscription billing       | Sprint 6 | Tier provisioning, seat management, dunning                                    |
| Refund & dispute flow      | Sprint 6 | Studio-initiated refunds, charge disputes, consent-revocation disputes         |
| Admin dashboards           | Sprint 6 | Arbitrations, payments, licences, user growth                                  |
| W3C Verifiable Credentials | Sprint 6 | TI issues credentials signed with TI's JWT_SIGNING_KEY                         |

**Audit tasks:**

- [ ] For EACH feature above, report status: `✅ DONE`, `⚠️ PARTIAL`, `❌ MISSING`, `🔧 BACKEND ONLY`
- [ ] For `⚠️ PARTIAL` items, describe what exists and what's missing
- [ ] For `🔧 BACKEND ONLY` items, list the API route(s) and confirm no corresponding UI page exists
- [ ] Confirm deals table exists with fields: template_id, actor_id, agent_id, studio_user_id, status, commercial_terms (JSONB), consent_version_id, payment_status, payment_intent_id
- [ ] Confirm licences table exists with fields: deal_id, actor_id, studio_user_id, start_date, end_date, territory, usage_type, commercial_terms, consent_version_at_signing, status
- [ ] Confirm license_usage_log table exists for audit trail
- [ ] Confirm arbitration_requests table exists
- [ ] Confirm agent_invitation_codes table exists
- [ ] List all database tables in TI with column counts — flag any that appear unused

### 1.7 Email Infrastructure

| Address                          | Purpose                                               | Platform                  |
| -------------------------------- | ----------------------------------------------------- | ------------------------- |
| `a.r.greene@trulyimagined.com`   | Founder personal                                      | Google Workspace          |
| `support@trulyimagined.com`      | Customer support                                      | Google Workspace + Resend |
| `noreply@trulyimagined.com`      | Transactional (password resets, confirmations)        | Resend                    |
| `notification@trulyimagined.com` | System notifications (payment events, status changes) | Resend                    |

**Audit tasks:**

- [ ] Confirm Resend integration exists with `RESEND_API_KEY`
- [ ] Confirm email templates exist for: verification, deal proposals, deal approvals, payment confirmations, consent changes
- [ ] List all places email is sent from TI — confirm correct sender address is used per context

### 1.8 Infrastructure Security

**Known issues from previous audits:**

| Issue                                 | Status                         | Action Required                            |
| ------------------------------------- | ------------------------------ | ------------------------------------------ |
| RDS `trimg-db-v3` storage encryption  | ❌ `storage_encrypted = false` | Snapshot-and-restore to encrypted instance |
| RDS `trimg-db-v3` publicly accessible | ⚠️ `true`                      | Restrict to VPC security group             |
| RDS `trimg-db-v3` deletion protection | ⚠️ `false`                     | Enable                                     |
| RDS `trimg-db-v3` Multi-AZ            | ⚠️ `false`                     | Enable for production HA                   |
| RDS `trimg-db-v3` backup retention    | ⚠️ 1 day                       | Increase to 7+ days                        |
| SSL enforcement                       | ✅ `rds.force_ssl = 1`         | Confirmed                                  |
| IAM wildcard policies                 | ⚠️                             | Replace with explicit ARNs                 |
| Static AWS credentials in code        | ⚠️                             | Replace with IAM role-based resolution     |

**Audit tasks:**

- [ ] Check current RDS encryption status for BOTH instances
- [ ] Confirm connection strings use `sslmode=require`
- [ ] Confirm no hardcoded secrets in any source file (search for API keys, passwords, tokens in code, comments, docs)
- [ ] Confirm `.env.local` and `.env` are in `.gitignore`
- [ ] List all env vars across both repos with classification (public/sensitive/secret)
- [ ] Confirm Sentry is configured in TI for error tracking
- [ ] Confirm no PII is logged (full names, email addresses, ID numbers should be redacted in logs)

---

## PART 2: BACKEND WITHOUT FRONTEND AUDIT

For each API route or backend service that exists, check if there is a corresponding frontend page or component.

**Report format:**

```
### [Feature Name]
- **API route(s):** `/api/...`
- **Backend status:** ✅ Implemented / ⚠️ Partial
- **Frontend UI:** ✅ Exists / ❌ Missing
- **Notes:** [What the user can/cannot do without the UI]
```

**Specifically check for:**

- [ ] Actor profile creation — API + UI?
- [ ] Actor consent management — API + UI?
- [ ] Agency profile creation — API + UI?
- [ ] Agent invitation code generation — API + UI?
- [ ] Agent invitation code redemption — API + UI?
- [ ] Representation management — API + UI?
- [ ] Studio profile creation — API + UI?
- [ ] Project creation — API + UI?
- [ ] Job board / casting view — API + UI?
- [ ] Deal creation — API + UI?
- [ ] Deal approval/rejection — API + UI?
- [ ] Licence dashboard (actor view) — API + UI?
- [ ] Licence dashboard (admin view) — API + UI?
- [ ] Payment initiation — API + UI?
- [ ] Earnings dashboard (actor/agent) — API + UI?
- [ ] Stripe Connect onboarding — API + UI?
- [ ] Stripe Identity verification — API + UI?
- [ ] Subscription management — API + UI?
- [ ] Admin dashboard — API + UI?
- [ ] Arbitration workflow — API + UI?
- [ ] Consent revocation — API + UI?
- [ ] Refund processing — API + UI?

---

## PART 3: PRODUCTION READINESS CHECKLIST

### 3.1 Security

- [ ] No secrets in version control (grep for patterns: `sk_live_`, `sk_test_`, `whsec_`, `re_`, `password`, `secret`, API key patterns)
- [ ] All secrets externalized to Vercel env (TI) or AWS Secrets Manager/Parameter Store (HDICR)
- [ ] CORS configured correctly on HDICR API Gateway
- [ ] Rate limiting on sensitive endpoints (`/api/payment/*`, `/api/stripe/*`, `/api/consent/*`)
- [ ] Input validation on all API routes (Zod, Joi, or equivalent)
- [ ] SQL injection prevention (parameterized queries only, no string interpolation)
- [ ] XSS prevention on frontend (Next.js default escaping, no `dangerouslySetInnerHTML`)
- [ ] CSRF protection on state-changing operations

### 3.2 Error Handling

- [ ] All Stripe API calls wrapped in try/catch with retry logic for 429/5xx
- [ ] Stripe error details never exposed to frontend
- [ ] HDICR unavailability returns 503 (fail-closed) not 200 with empty data
- [ ] Database connection errors handled gracefully
- [ ] All error responses include correlation ID for tracing

### 3.3 Database

- [ ] Connection pooling configured for serverless (pool size 5–20)
- [ ] Idle connection timeout set
- [ ] All migrations can be applied independently per service
- [ ] No cross-service foreign keys
- [ ] Indexes on frequently queried columns (actor_id, studio_id, status, created_at)

### 3.4 Monitoring & Observability

- [ ] Structured logging with timestamp, method, path, status, response time, correlation ID
- [ ] Sentry configured for uncaught exceptions
- [ ] Health check endpoint exists on both services
- [ ] Stripe webhook processing lag trackable

### 3.5 Deployment

- [ ] TI deploys to Vercel on push (confirm build succeeds)
- [ ] HDICR deploys via SAM (confirm `template.yaml` exists and is valid)
- [ ] Environment variables documented (`.env.example` in both repos)
- [ ] Preview deployments work (Vercel branch previews)
- [ ] Rollback strategy documented

### 3.6 Stripe Dashboard Configuration

These are manual steps that must be completed in the Stripe dashboard — confirm each:

- [ ] Stripe Connect enabled (Platform mode → Express)
- [ ] Platform name set to "Truly Imagined"
- [ ] Platform redirect URLs configured (return + refresh)
- [ ] Webhook endpoint registered with correct URL
- [ ] "Connect events" toggle enabled on webhook
- [ ] Stripe Identity enabled (if using full implementation)
- [ ] Products and Prices seeded matching tier table above
- [ ] Payout schedule configured (manual, not automatic)

### 3.7 Vercel Environment Variables

Confirm ALL of the following are set in Vercel (not in committed files):

**Stripe:**

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_CONNECT_RETURN_URL`
- [ ] `STRIPE_CONNECT_REFRESH_URL`
- [ ] All `STRIPE_PRICE_*` variables (one per subscription tier)

**HDICR integration:**

- [ ] `HDICR_API_URL`
- [ ] `AUTH0_M2M_CLIENT_ID`
- [ ] `AUTH0_M2M_CLIENT_SECRET`
- [ ] `HDICR_API_AUDIENCE` or `AUTH0_M2M_AUDIENCE`

**Auth0 (user-facing):**

- [ ] `AUTH0_DOMAIN`
- [ ] `AUTH0_CLIENT_ID`
- [ ] `AUTH0_CLIENT_SECRET`
- [ ] `AUTH0_AUDIENCE`

**Database:**

- [ ] `TI_DATABASE_URL` or `DATABASE_URL` (with `sslmode=require`)

**AWS:**

- [ ] `AWS_REGION`
- [ ] `AWS_S3_BUCKET` (= `trulyimagined-media`)
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`

**Email:**

- [ ] `RESEND_API_KEY`

**Credentials:**

- [ ] `JWT_SIGNING_KEY` (TI's own keypair for W3C credentials)
- [ ] `JWT_PUBLIC_KEY` (from HDICR, for verifying HDICR-signed tokens)

**Monitoring:**

- [ ] `NEXT_PUBLIC_SENTRY_DSN`

**App:**

- [ ] `NEXT_PUBLIC_BASE_URL` (production URL, not localhost)

### 3.8 HDICR Lambda Environment Variables

Confirm in SAM `template.yaml` or AWS console:

- [ ] `HDICR_DATABASE_URL` (with SSL)
- [ ] `AUTH0_DOMAIN`
- [ ] `AUTH0_AUDIENCE`
- [ ] `STRIPE_SECRET_KEY` (HDICR's own key — Identity only)
- [ ] `STRIPE_WEBHOOK_SECRET` (if Identity webhooks handled in HDICR — NOTE: per confirmed architecture, Identity webhooks are handled in TI, not HDICR)

---

## PART 4: SUPERSEDED DECISIONS — Confirm These Are NOT Implemented

Earlier planning placed certain functionality in HDICR that has since been migrated to TI. Confirm none of the following exist in HDICR:

- [ ] Stripe payment processing (PaymentIntents, Customers, Invoices) — should NOT be in HDICR
- [ ] Stripe Connect logic (account creation, transfers) — should NOT be in HDICR
- [ ] Stripe webhook handler for payment events — should NOT be in HDICR
- [ ] Sprint 1, Stories 1.1 and 1.2 (Stripe Identity session creation and webhook handling in HDICR's `identity-service`) — SUPERSEDED, migrated to TI
- [ ] Bank-token approach (`stripe.bankAccountTokens.create()`) — DEPRECATED, should not exist in either repo
- [ ] `payment_methods` table with `stripe_bank_account_id` — DEPRECATED
- [ ] Two separate webhook endpoints in TI (`/api/webhooks/stripe` AND `/api/webhooks/stripe-connect`) — should be ONE endpoint at `/api/stripe/webhooks`
- [ ] Any `transfer.failed` event handling — this event does not exist

---

## OUTPUT FORMAT FOR FINAL_AUDIT.md

Structure the output as follows:

```markdown
# FINAL_AUDIT.md

_Generated: [DATE] by GitHub Copilot_
_Repos audited: TI (trulyimagined-web-v3) + HDICR_

## Executive Summary

- Total items audited: X
- ✅ DONE: X
- ⚠️ PARTIAL: X
- ❌ MISSING: X
- 🔧 BACKEND ONLY: X
- 🗑️ REMOVE: X
- 📋 NOT YET PLANNED: X

## 1. Architecture Compliance

[Results for Part 1]

## 2. Stripe Implementation Audit

[Detailed file-by-file Stripe code inventory]

## 3. Feature Status (Planned vs Implemented)

[Table: Feature | Sprint | Status | API Routes | UI Pages | Notes]

## 4. Backend Without Frontend

[Results for Part 2]

## 5. Production Readiness

[Results for Part 3]

## 6. Superseded Code to Remove

[Results for Part 4]

## 7. Recommended Priority Actions

[Ordered list of what to fix first, grouped by: 🔴 Blockers, 🟠 High, 🟡 Medium, 🟢 Low]

## 8. Environment Variable Inventory

[Full table of all env vars found across both repos]

## 9. Database Schema Inventory

[All tables, their columns, and which service owns them]
```

---

_END OF PROMPT_
