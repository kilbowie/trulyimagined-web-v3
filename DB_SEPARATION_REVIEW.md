# HDICR & TI M2M Integration Validation Review

## Findings (Severity-Ordered)

### 1. Critical: TI app still performs direct HDICR database reads instead of HTTP M2M calls

- [apps/web/src/app/api/actor/onboarding-status/route.ts](apps/web/src/app/api/actor/onboarding-status/route.ts#L3) imports and uses [queryHdicr](apps/web/src/app/api/actor/onboarding-status/route.ts#L3), then directly queries [actors](apps/web/src/app/api/actor/onboarding-status/route.ts#L46) and [consent_ledger](apps/web/src/app/api/actor/onboarding-status/route.ts#L64).
- [apps/web/src/lib/manual-verification.ts](apps/web/src/lib/manual-verification.ts#L1) also uses [queryHdicr](apps/web/src/lib/manual-verification.ts#L1) directly.
- This violates the separation rule: TI should access HDICR via authenticated HTTP, not DB-level access.

### 2. High: M2M env contract mismatch with expected variable names

- Expected TI vars include AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET, AUTH0_M2M_AUDIENCE, HDICR_API_URL.
- Current TI env uses [HDICR_CLIENT_ID](apps/web/.env.local#L86), [HDICR_CLIENT_SECRET](apps/web/.env.local#L87), [HDICR_M2M_AUDIENCE](apps/web/.env.local#L89), [HDICR_REMOTE_BASE_URL](apps/web/.env.local#L85).
- Code in [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L65) resolves from HDICR*CLIENT_ID/SECRET and optional HDICR_M2M_AUDIENCE, not AUTH0_M2M*\* names.
- If deployment automation expects AUTH0*M2M*\* names, auth can fail despite code being logically correct.

### 3. High: Invalid token path returns 401 instead of required 403

- In [shared/middleware/src/index.ts](shared/middleware/src/index.ts#L127), token validation errors return null.
- Service handlers treat !user as 401 in:
  - [services/identity-service/src/index.ts](services/identity-service/src/index.ts#L160)
  - [services/consent-service/src/index.ts](services/consent-service/src/index.ts#L47)
  - [services/licensing-service/src/handler.ts](services/licensing-service/src/handler.ts#L109)
  - [services/representation-service/src/index.ts](services/representation-service/src/index.ts#L682)
- Result: missing token and invalid token both produce 401, not a 401/403 split.

### 4. High: Deploy template still models a single shared DATABASE_URL

- [infra/api-gateway/template.yaml](infra/api-gateway/template.yaml#L13) injects only DATABASE_URL.
- This conflicts with separate HDICR_DATABASE_URL and TI_DATABASE_URL service isolation.

### 5. Medium: Token refresh margin is 30 seconds, not 5+ minutes

- Cache gate in [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L103) uses expiresAt - 30000.
- Requested behavior is refresh at least 5 minutes before expiry.
- Legacy helper [apps/web/src/lib/hdicr/hdicr-auth.ts](apps/web/src/lib/hdicr/hdicr-auth.ts#L30) does use a 5-minute buffer, but it is deprecated and not the main path.

### 6. Medium: No explicit request timeout on Auth0 token fetch or HDICR HTTP calls

- Token fetch in [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L109) has no AbortController timeout.
- Remote HDICR fetch in [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L163) also has no explicit timeout.
- Fail-closed behavior exists for network exceptions, but long hangs remain possible.

### 7. Medium: Representation service still reads local actors table directly

- [services/representation-service/src/index.ts](services/representation-service/src/index.ts#L128) queries FROM actors.
- Given TI/HDICR split, this is risky unless representation-service is explicitly HDICR-owned and deployed against HDICR DB only.
- Needs explicit ownership clarification before repo split/deploy.

### 8. Low: No correlation ID or cross-service tracing context

- No correlation/request-id propagation found across TI to HDICR call path.
- This will slow debugging in production M2M failures.

## What Is Working Correctly

- M2M fetch uses client_credentials against Auth0 token endpoint:
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L109)
- Bearer token is attached to HDICR requests:
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L168)
- Fail-closed behavior for transport/token fetch errors (503 class):
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L124)
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L179)
- HDICR-side JWT verification uses JWKS + audience + issuer + RS256:
  - [shared/middleware/src/index.ts](shared/middleware/src/index.ts#L14)
  - [shared/middleware/src/index.ts](shared/middleware/src/index.ts#L64)
- Auth is enforced before route logic in service handlers:
  - [services/identity-service/src/index.ts](services/identity-service/src/index.ts#L157)
  - [services/consent-service/src/index.ts](services/consent-service/src/index.ts#L44)
  - [services/licensing-service/src/handler.ts](services/licensing-service/src/handler.ts#L106)
  - [services/representation-service/src/index.ts](services/representation-service/src/index.ts#L679)
- TI app has split DB pool support:
  - [apps/web/src/lib/db.ts](apps/web/src/lib/db.ts#L43)

## Environment Validation Snapshot

- TI required set:
  - TI_DATABASE_URL present at [apps/web/.env.local](apps/web/.env.local#L13)
- TI required missing by requested naming contract:
  - AUTH0_M2M_CLIENT_ID missing
  - AUTH0_M2M_CLIENT_SECRET missing
  - AUTH0_M2M_AUDIENCE missing
  - HDICR_API_URL missing (current equivalent is [HDICR_REMOTE_BASE_URL](apps/web/.env.local#L85))
- HDICR required evidence:
  - AUTH0_DOMAIN, AUTH0_AUDIENCE, NODE_ENV appear in deploy template globals at [infra/api-gateway/template.yaml](infra/api-gateway/template.yaml#L14)
  - HDICR_DATABASE_URL is not represented in template (single DATABASE_URL model)

## Type Safety Review

- Token response has inline structural typing (good baseline), but no canonical shared interface:
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts#L132)
- JWT decode/verify still uses any in middleware:
  - [shared/middleware/src/index.ts](shared/middleware/src/index.ts#L22)
  - [shared/middleware/src/index.ts](shared/middleware/src/index.ts#L60)
- HDICR client responses use many Record<string, any> payloads, reducing contract safety:
  - [apps/web/src/lib/hdicr/identity-client.ts](apps/web/src/lib/hdicr/identity-client.ts#L49)

## Runtime Evidence Collected

- Targeted tests passed:
  - pnpm --filter @trulyimagined/web test -- src/lib/hdicr/hdicr-http-client.test.ts
  - Includes bearer token attachment and token cache behavior checks.

## Recommended Fixes (Priority)

1. Replace TI direct HDICR DB reads with HTTP client calls via existing HDICR clients.
2. Standardize env contract:
   - Either rename code to consume AUTH0*M2M*\* and HDICR_API_URL, or keep current names and align ops docs/CI secrets contract.
3. Return 403 for invalid or expired tokens:
   - Differentiate missing header versus verify failure in middleware result type.
4. Update infra template for split DB env:
   - Separate env injection by service (HDICR_DATABASE_URL for HDICR services, TI_DATABASE_URL for TI services).
5. Increase token refresh buffer to at least 5 minutes in active client path.
6. Add request timeouts (AbortController) to token and remote fetch calls.
7. Add correlation id propagation and logging from TI to HDICR.

## Suggested End-to-End Verification Plan

1. Start HDICR service(s) locally.
2. Start TI app locally.
3. Trigger one TI flow that calls HDICR and verify token acquisition log.
4. Confirm outgoing TI request has Authorization bearer header (redacted).
5. Confirm HDICR validates token and enforces scope.
6. Confirm TI no longer issues direct SQL against HDICR tables in runtime paths.
7. Run DB split smoke checks and ensure no tenant_id errors.
8. Execute one negative test: invalid token should return 403.
9. Execute one missing token test: should return 401.

## Go / No-Go

- No-Go for repo separation and Vercel deployment right now.
- Reason: unresolved High/Critical items (direct TI to HDICR DB access, env contract mismatch risk, 401/403 auth semantics, and single-DB deploy template model).
- After those are fixed and revalidated, this should move to Go.
