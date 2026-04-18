# Sprint 1 Completion Note (M1: Platform Safe)

Date: 2026-04-18  
Branch: `release/sprint-1`

## Scope Closed

Sprint 1 implementation items completed:

- WS1-01: Replace `rejectUnauthorized: false` with validated RDS TLS
- WS7-01: Add rate limiting to sensitive API surfaces
- WS7-02: Standardize input validation pattern for critical write routes
- WS1-02: Webhook idempotency persistence and duplicate guard
- WS1-03 (early pull-in): Subscription + invoice lifecycle webhook handling
- WS1-04: Fail-closed behavior when HDICR is unavailable
- WS1-05: Correlation ID propagation baseline TI -> HDICR

## M1 Gate Criteria Mapping

### 1) `lib/db.ts` has no `rejectUnauthorized: false` in active production path

Status: PASS

Evidence:

- `buildSslConfig()` enforces `ca + rejectUnauthorized: true` when `RDS_CA_CERT` is present.
- Production startup hard-fails if `RDS_CA_CERT` is missing.
- Dev fallback remains explicit and isolated to non-production usage.

References:

- `apps/web/src/lib/db.ts`
- `apps/web/.env.example`

### 2) Webhook dedupe table exists with unique event ID; duplicate delivery returns `200`

Status: PASS

Evidence:

- Persistent `stripe_events` table exists with unique `stripe_event_id` constraint.
- Duplicate insert guarded via `ON CONFLICT (stripe_event_id) DO NOTHING`.
- Duplicate delivery short-circuits safely and returns `200`.

References:

- `infra/database/migrations/035_ti_webhook_commercial_tables.sql`
- `apps/web/src/app/api/webhooks/stripe/route.ts`

### 3) Sensitive routes (webhook, billing, verification) have rate limits

Status: PASS

Evidence:

- Added explicit limit entries for billing/connect/admin/deals in middleware.
- Existing auth/verification/consent limits preserved.
- Webhook endpoint remains intentionally exempt from IP throttle and secured via Stripe signature verification.

References:

- `apps/web/src/middleware.ts`

### 4) Correlation ID propagates from TI outbound requests into HDICR logs

Status: PASS

Evidence:

- Incoming `x-correlation-id` is extracted in TI routes.
- Domain clients accept optional `correlationId` and forward it to transport.
- Transport sets outbound `X-Correlation-ID`; generates UUID when absent.

References:

- `apps/web/src/lib/validation.ts`
- `apps/web/src/lib/hdicr/hdicr-http-client.ts`
- `apps/web/src/lib/hdicr/consent-client.ts`
- `apps/web/src/lib/hdicr/identity-client.ts`
- `apps/web/src/lib/hdicr/representation-client.ts`
- `apps/web/src/app/api/consent/grant/route.ts`
- `apps/web/src/app/api/consent/revoke/route.ts`
- `apps/web/src/app/api/identity/link/route.ts`
- `apps/web/src/app/api/representation/request/route.ts`

### 5) HDICR unavailability returns fail-closed response

Status: PASS

Evidence:

- HDICR transport throws `HdicrHttpError(503)` on timeout/network/token acquisition failures.
- Route-level error translation returns safe upstream failure responses rather than silent success.
- Critical write routes now use shared `routeErrorResponse()`.

References:

- `apps/web/src/lib/hdicr/hdicr-http-client.ts`
- `apps/web/src/lib/validation.ts`
- `apps/web/src/app/api/consent/grant/route.ts`
- `apps/web/src/app/api/consent/revoke/route.ts`
- `apps/web/src/app/api/identity/link/route.ts`
- `apps/web/src/app/api/representation/request/route.ts`

## Verification Results

Validation run on this branch:

- `pnpm type-check`: PASS
- `pnpm test`: PASS (51 files, 167 tests)

## Commits Included (Sprint 1 close set)

- `0472069` feat(ws1-02/ws1-03): verify deduplication complete; add invoice payment handlers
- `49e604d` feat(ws1-04): add routeErrorResponse and enforce fail-closed on HDICR routes
- `3d993c9` feat(ws1-05): propagate x-correlation-id from TI requests into HDICR calls
- `ec0cf94` fix: resolve TypeScript errors from WS1-03/WS1-05
- `f5d0a77` fix(m1-gate): align Stripe v21 invoice typing and contract tests

## Exit Decision

Sprint 1 / M1 gate criteria are met on `release/sprint-1` based on implementation and validation evidence above.