# DB Separation Fix Backlog (Reviewed + Normalized)

Status: No-Go for repo separation and Vercel split until Priority 1 and 2 are complete.
Owner: Platform/Backend
Scope: TI app, shared auth middleware, HDICR services, deployment config
Source of truth alignment: This backlog is reconciled to findings documented in DB_SEPARATION_REVIEW.md.

---

## 0) Review Normalization Notes (Applied)

This backlog keeps your intent, but normalizes a few items to match the current codebase:

1. Env var naming is treated as a decision gate with one canonical target (Option A recommended).
2. 401/403 behavior is implemented via shared middleware contract, not ad-hoc per service.
3. Deployment split is tracked as two tracks:
   - infra/api-gateway/template.yaml (if SAM path is active)
   - Vercel env config (if Vercel-first path is active)
4. Representation service ownership is explicitly a blocking decision before final Go.
5. Verification commands are normalized for this repo and Windows shell usage.

---

## 1) Priority 1 - Critical (Blocking)

### 1.1 Remove direct HDICR DB access from TI runtime paths
Severity: Critical
Why: TI must consume HDICR via HTTP + M2M, not direct SQL.

Scope:
- Replace TI-side queryHdicr runtime usage with HDICR HTTP client calls.

Known files to fix:
- apps/web/src/app/api/actor/onboarding-status/route.ts
- apps/web/src/lib/manual-verification.ts

Tasks:
- [ ] Replace actors lookup SQL with identity/representation HTTP client method(s).
- [ ] Replace consent_ledger SQL with consent HTTP client method(s).
- [ ] Remove runtime imports of queryHdicr where no longer needed.
- [ ] Update/add tests to mock invokeHdicrRemote path instead of DB query path.

Acceptance criteria:
- [ ] No TI runtime route/lib file issues direct SQL against HDICR-owned tables.
- [ ] TI dashboard/onboarding flow still resolves actor + consent status via HTTP.

Verification:
- [ ] Search returns no remaining queryHdicr usage in TI runtime paths.
- [ ] Manual flow works: login -> dashboard -> onboarding status endpoint returns success.

---

### 1.2 Standardize M2M env naming contract
Severity: Critical
Why: avoid deploy drift between code and ops conventions.

Decision (required):
- Recommended canonical contract (Option A):
  - AUTH0_M2M_CLIENT_ID
  - AUTH0_M2M_CLIENT_SECRET
  - AUTH0_M2M_AUDIENCE
  - HDICR_API_URL

Current implementation uses:
- HDICR_CLIENT_ID
- HDICR_CLIENT_SECRET
- HDICR_M2M_AUDIENCE
- HDICR_REMOTE_BASE_URL

Tasks:
- [ ] Update apps/web/src/lib/hdicr/hdicr-http-client.ts to read canonical names.
- [ ] Keep backward-compatible fallbacks for one release window (recommended): read new first, old second.
- [ ] Update apps/web/src/lib/hdicr/flags.ts to support HDICR_API_URL (with optional fallback to HDICR_REMOTE_BASE_URL during transition).
- [ ] Update apps/web/.env.example and docs.
- [ ] Update Vercel project env vars (TI and any dependent services).

Acceptance criteria:
- [ ] Canonical names work in local + preview + prod.
- [ ] Old names either removed or explicitly marked deprecated with removal date.

Verification:
- [ ] Token fetch succeeds with canonical vars only.
- [ ] Remote base URL resolves from HDICR_API_URL.

---

## 2) Priority 2 - High (Blocking)

### 2.1 Correct 401 vs 403 semantics in auth flow
Severity: High
Why: distinguish unauthenticated from rejected credentials.

Current issue:
- Shared middleware returns null for token problems; handlers map null to 401 only.

Tasks:
- [ ] Introduce discriminated auth result in shared/middleware/src/index.ts:
  - unauthenticated (missing/malformed header) -> 401
  - token rejected (invalid signature/exp/aud/iss) -> 403
  - authenticated -> user payload
- [ ] Update handlers:
  - services/identity-service/src/index.ts
  - services/consent-service/src/index.ts
  - services/licensing-service/src/handler.ts
  - services/representation-service/src/index.ts
- [ ] Update ingress/auth tests to assert split behavior.

Acceptance criteria:
- [ ] Missing Authorization header returns 401.
- [ ] Invalid/expired token returns 403.
- [ ] Valid token + missing scope remains 403 with explicit scope message.

---

### 2.2 Split DB configuration at deploy layer
Severity: High
Why: prevent wrong-db connection and keep service ownership clean.

Track A (if SAM/infra template is active):
- [ ] Update infra/api-gateway/template.yaml to avoid single shared DATABASE_URL for split services.
- [ ] Introduce explicit per-service env wiring (HDICR_DATABASE_URL or TI_DATABASE_URL as appropriate).

Track B (if Vercel-first):
- [ ] Ensure TI project has TI_DATABASE_URL only for TI runtime responsibilities.
- [ ] Ensure HDICR services/projects have HDICR_DATABASE_URL.
- [ ] Remove ambiguous shared DATABASE_URL usage from deployment config where possible.

Acceptance criteria:
- [ ] No production path depends on a single shared DATABASE_URL for both domains.
- [ ] Service startup logs confirm expected DB target.

---

### 2.3 Representation service ownership decision (blocking gate)
Severity: High
Why: code currently queries actors directly; ownership must be explicit.

Decision to record:
- [ ] representation-service is HDICR-owned (recommended based on current behavior), OR
- [ ] representation-service is TI-owned and must stop direct actors queries.

Tasks if HDICR-owned:
- [ ] Document ownership in architecture docs and service README.
- [ ] Ensure deployment targets HDICR DB only.
- [ ] Ensure TI consumes representation over HTTP.

Tasks if TI-owned:
- [ ] Replace direct actors queries with hdicr_ref and/or HDICR HTTP calls.
- [ ] Re-test all representation flows.

Acceptance criteria:
- [ ] Ownership documented and enforced in deploy config.
- [ ] No ambiguous cross-domain query path remains.

---

## 3) Priority 3 - Medium

### 3.1 Increase active token refresh buffer to 5 minutes
Severity: Medium
Tasks:
- [ ] Update apps/web/src/lib/hdicr/hdicr-http-client.ts cache gate from 30s to 5m.
- [ ] Keep unit tests aligned to new threshold.

Acceptance criteria:
- [ ] Token is refreshed before expiry with >=5m buffer.

---

### 3.2 Add explicit fetch timeouts
Severity: Medium
Tasks:
- [ ] Add timeout wrapper (AbortController) for:
  - Auth0 token request
  - HDICR remote requests
- [ ] Map timeout to fail-closed 503 with non-sensitive message.

Acceptance criteria:
- [ ] Slow upstreams do not hang request indefinitely.

---

### 3.3 Add correlation ID propagation
Severity: Medium
Tasks:
- [ ] TI adds X-Correlation-ID on HDICR calls.
- [ ] HDICR services read/generate correlation id and include it in structured logs.
- [ ] Echo correlation id in response headers where appropriate.

Acceptance criteria:
- [ ] A single TI request can be traced across TI and HDICR logs.

---

## 4) Priority 4 - Low

### 4.1 Type safety improvements for auth + HDICR client payloads
Severity: Low
Tasks:
- [ ] Add explicit TokenResponse and JwtClaims interfaces.
- [ ] Reduce Record<string, any> and Promise<any> in key paths.
- [ ] Keep response contracts backward-compatible.

Acceptance criteria:
- [ ] No critical auth/client path relies on any for core security fields.

---

## 5) Execution Order (Recommended)

Phase 1 (Blockers):
1. 1.1 Remove direct TI -> HDICR DB access
2. 1.2 Env contract standardization
3. 2.1 401/403 semantics
4. 2.2 Deploy DB split wiring
5. 2.3 Representation ownership decision + enforcement

Phase 2 (Hardening):
6. 3.1 Token refresh buffer
7. 3.2 Timeouts
8. 3.3 Correlation IDs

Phase 3 (Quality):
9. 4.1 Type safety

---

## 6) Validation Checklist (Go/No-Go Gate)

All must be true for Go:
- [ ] TI runtime no longer directly queries HDICR-owned tables.
- [ ] M2M env contract is canonical and deployed consistently.
- [ ] 401 vs 403 behavior is correct across all HDICR services.
- [ ] Deployment config clearly separates HDICR and TI DB URLs.
- [ ] Representation service ownership is documented and enforced.
- [ ] End-to-end TI -> HDICR M2M flow passes in local and preview.
- [ ] Separation verification and sync checks remain green.

Suggested command set:
- [ ] pnpm --filter @trulyimagined/web test -- src/lib/hdicr/hdicr-http-client.test.ts
- [ ] pnpm check:db-separation-state
- [ ] pnpm db:sync:once

Optional smoke checks:
- [ ] Missing token -> 401
- [ ] Invalid token -> 403
- [ ] Valid token + scope mismatch -> 403 with scope detail

---

## 7) Estimated Effort (Reconciled)

- Priority 1 + 2 (blocking): ~8-12 hours
- Priority 3 (hardening): ~3-5 hours
- Priority 4 (type safety): ~2-4 hours
- Integration + regression pass: ~4-6 hours

Total practical window: ~3-5 days with validation and deployment coordination.

---

## 8) Branching + Commit Strategy

Recommended branches:
- feature/ti-remove-direct-hdicr-db-access
- feature/standardize-m2m-env-contract
- feature/auth-401-403-semantics
- feature/split-db-deploy-config
- feature/correlation-timeouts-token-buffer

Commit style:
- fix: boundary/security correctness
- refactor: env contract standardization
- ops: deployment/env wiring
- docs: ownership and architecture clarifications
