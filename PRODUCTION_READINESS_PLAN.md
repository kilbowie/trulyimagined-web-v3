# PRODUCTION_READINESS_PLAN

## Purpose

Operator-ready implementation backlog to move from current NO-GO to GO, then execute split-repo deployment:

- TI on Vercel at `trulyimagined.com`
- HDICR on AWS Lambda/SAM at `hdicr.trulyimagined.com`

## Source Of Truth

Use only these documents for execution:

1. `docs/PRE_DEPLOYMENT_VALIDATION/00-START-HERE.md`
2. `docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md`
3. `docs/PRE_DEPLOYMENT_VALIDATION/TI-REPO-SETUP.md`
4. `docs/PRE_DEPLOYMENT_VALIDATION/HDICR-REPO-SETUP.md`
5. `docs/PRE_DEPLOYMENT_VALIDATION/hdicr-template.yaml`
6. `docs/PRE_DEPLOYMENT_VALIDATION/LOCAL-SMOKE-PREREQUISITES.md`

## Superseded Documents (Do Not Execute From)

- `docs/PRE_DEPLOYMENT_VALIDATION/VERCEL-DEPLOYMENT-CHECKLIST.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/DEPLOYMENT-PREPARATION-SUMMARY.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/HOW-TO-USE-VALIDATION-PROMPT.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/copilot-final-pre-deployment-validation.md`

## Canonical Runtime Contracts

- Canonical HDICR host: `hdicr.trulyimagined.com`
- TI env contract includes:
  - `TI_DATABASE_URL`
  - `HDICR_API_URL=https://hdicr.trulyimagined.com`
  - `AUTH0_M2M_CLIENT_ID`
  - `AUTH0_M2M_CLIENT_SECRET`
  - `AUTH0_M2M_AUDIENCE=https://hdicr.trulyimagined.com`
  - `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_BASE_URL`
- HDICR env contract includes:
  - `HDICR_DATABASE_URL`
  - `AUTH0_DOMAIN`
  - `AUTH0_AUDIENCE=https://hdicr.trulyimagined.com`

## Phase Backlog

### Phase 0: Governance Lock

- [x] P0-1 Confirm implementation run uses only Source Of Truth docs.
- [x] P0-2 Freeze canonical domain/audience values across all environments.
- [x] P0-3 Tag current monorepo commit as rollback anchor before extraction.

### Phase 1: NO-GO Blocker Closure (Pre-Split Baseline)

- [x] P1-1 Resolve all TypeScript/type-check failures in current workspace.
- [x] P1-2 Resolve all failing tests in current workspace.
- [x] P1-3 Eliminate remaining TI direct HDICR SQL runtime paths (HTTP-only boundary).
- [x] P1-4 Enforce split DB contract in production (no unsafe fallback behavior).
- [ ] P1-5 Ensure local TI -> HDICR smoke test has explicit startup prerequisites and passes.

### Execution Status (2026-04-12 · Final Update)

**P1 Closure Evidence (2026-04-12T12:51-12:57Z):**

- **P1-1 (Type-Check)**: `pnpm type-check` -> ✓ Pass (all 9 projects)
- **P1-2 (Tests)**: `pnpm test` -> ✓ Pass (143 web tests, 26 service tests, all suites green)
- **P1-3 (HTTP-Only Boundary)**: ✓ Implemented and validated
  - Added HDICR verification session API extensions
  - Migrated 4 TI verification routes from direct DB to HTTP client calls
  - Eliminated co-import guardrail violations in route imports
- **P1-4 (Split DB Safety)**: ✓ Enforced
  - Removed legacy `DATABASE_URL` fallback in `apps/web/src/lib/db.ts`
  - Made `TI_DATABASE_URL` mandatory with explicit error if missing
  - Made HDICR pool optional (gracefully handles missing env)
  - Post-change validation: type-check ✓ | tests ✓ | build ✓ (no regressions)
  - Commit: `2769d82` (P1-4: Enforce split DB safety by disabling legacy DATABASE_URL fallback)
- **P1-5 (Local Smoke Prereqs)**: ⏸ In Progress
  - Added prerequisite documentation and check script
  - Requires live local stack to validate (env vars + running services)

### A + B + D Execution Delta (2026-04-12)

- **A (Phase 0-2 hardening) complete**
  - Canonical production host/audience drift removed from active source-of-truth runbooks.
  - Active CI build workflow now sets `HDICR_API_URL=https://hdicr.trulyimagined.com`.
  - Service OpenAPI server URLs aligned to `https://hdicr.trulyimagined.com`.
  - Rollback anchor created: `pre-split-monorepo-2026-04-12`.
- **B (Phase 3 contract parity prep) complete**
  - Added explicit identity-service OpenAPI response schemas for manual verification session endpoints and actor verification status endpoint.
  - Extended TI OpenAPI contract gate to assert required fields for these schemas.
  - Validation: `pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts` -> ✓ Pass.
- **D (dry-run extraction preparation) in progress**
  - Dry-run prep report created: `docs/PRE_DEPLOYMENT_VALIDATION/SPLIT-DRY-RUN-PREP.md`.
  - Initial scan confirms expected workspace/tsconfig coupling still needs extraction rewrites; no immediate hard-stop import blockers found in quick scan.

### Phase 2: Repo Split Execution

- [ ] P2-1 Create `trulyimagined-web` repository.
- [ ] P2-2 Extract TI app and TI-specific assets/config from monorepo.
- [ ] P2-3 Create `hdicr-service` repository.
- [ ] P2-4 Extract HDICR services and AWS deployment assets.
- [ ] P2-5 Remove cross-repo relative imports and confirm independent dependency graphs.
- [ ] P2-6 Add README + env templates for each new repo.

### Phase 3: Build And Test Independence

- [ ] P3-1 TI repo: install, type-check, test, build all pass.
- [ ] P3-2 HDICR repo: install, type-check, test, build all pass.
- [ ] P3-3 Contract parity check: TI client endpoints align with HDICR route surface.
- [ ] P3-4 Security hygiene check: no secrets committed; `.env*` handling verified.

### Phase 4: Environment And Platform Configuration

- [ ] P4-1 Configure TI Vercel project and environment variables (Preview + Production).
- [ ] P4-2 Configure HDICR AWS prerequisites (IAM, S3 artifacts bucket, ACM cert, API Gateway domain).
- [ ] P4-3 Reconcile `hdicr-template.yaml` paths and handler targets against extracted HDICR repo layout.
- [ ] P4-4 Configure Auth0 applications, audience, callback/logout URLs.
- [ ] P4-5 Verify canonical M2M env vars exist in Vercel Preview + Production.

### Phase 5: Deployments

- [ ] P5-1 Deploy HDICR to AWS SAM (staging).
- [ ] P5-2 Validate HDICR health and protected endpoint behavior on staging domain.
- [ ] P5-3 Deploy TI to Vercel Preview and validate TI -> HDICR integration.
- [ ] P5-4 Promote HDICR to production.
- [ ] P5-5 Promote TI to production.

### Phase 6: Hardening And Go-Live Validation

- [ ] P6-1 Verify 401/403 auth semantics end-to-end.
- [ ] P6-2 Verify fail-closed timeout behavior for TI -> HDICR calls.
- [ ] P6-3 Verify correlation ID propagation across TI and HDICR logs.
- [ ] P6-4 Verify CloudWatch alarms/log groups and Vercel observability coverage.
- [ ] P6-5 Run final full regression and readiness checklist.
- [ ] P6-6 Publish severity-ranked final GO/NO-GO report.

## Exit Criteria (GO)

All must be true:

1. No critical or high findings remain.
2. TI and HDICR deploy independently from separate repositories.
3. Production domains reachable with valid HTTPS:
   - `https://trulyimagined.com`
   - `https://hdicr.trulyimagined.com`
4. TI dashboard path successfully consumes HDICR data with M2M auth.
5. Logs show traceable correlation IDs across service boundary.
6. Type-check/tests/build are green in both repos.

## Risks And Controls

- Risk: stale conflicting runbooks used during execution.
  - Control: superseded banners + this file as master backlog.
- Risk: path mismatch between extracted HDICR repo and SAM template.
  - Control: explicit reconciliation task P4-3 before first deploy.
- Risk: domain/audience mismatch between Auth0, TI envs, and HDICR config.
  - Control: Phase 0 lock + Phase 4 configuration verification.

## Implementation Start Checklist (Next Run)

- [ ] Confirm owners for each phase.
- [ ] Confirm branch naming and tagging strategy.
- [ ] Execute Phase 1 tasks in order.
- [ ] Do not begin repo extraction before Phase 1 passes.
