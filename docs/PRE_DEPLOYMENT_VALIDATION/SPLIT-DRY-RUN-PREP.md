# Split Repo Dry-Run Preparation

Date: 2026-04-12
Scope: Phase D parallel preparation for repo extraction readiness.

## Objective
Run a non-destructive readiness scan before actual TI/HDICR extraction to identify blockers in dependency graph, TypeScript project wiring, and canonical environment/domain contracts.

## Executed Checks
1. Rollback anchor tag creation:
   - Created tag: pre-split-monorepo-2026-04-12
2. Cross-boundary import scan:
   - Pattern scan for deep relative imports and explicit cross-folder imports from apps/web/src and services
   - Result: no immediate hard blockers detected by the quick scan
3. Workspace package coupling scan:
   - Found workspace-coupled internal packages (`workspace:*`) across TI/services/shared/infra packages
4. TypeScript project reference scan:
   - Services currently reference shared infra packages via monorepo relative paths
5. Canonical domain/env drift scan in active paths:
   - Source-of-truth docs now canonicalized to hdicr.trulyimagined.com
   - One active CI workflow still used legacy key/value pattern before this pass; now patched

## Findings

### F1: Expected workspace coupling remains for split extraction
Status: expected / manageable

Internal dependencies still use workspace protocol (e.g., @trulyimagined/types, @trulyimagined/utils, @trulyimagined/middleware, @trulyimagined/database).

Impact:
- TI and HDICR repos will each need an internal strategy for these packages:
  - copy-in per repo,
  - publish versioned packages,
  - or add git submodule/sync workflow.

### F2: Services depend on monorepo TS references
Status: expected / requires migration checklist

Service tsconfig files reference monorepo paths such as:
- ../../infra/database
- ../../shared/middleware

Impact:
- During extraction, tsconfig references must be rewritten to repo-local package paths.

### F3: Canonical environment/domain lock now consistent in source-of-truth and active CI
Status: remediated

Completed in this pass:
- Replaced residual api.trulyimagined.com references in active pre-deployment runbooks
- Updated service OpenAPI server URLs to https://hdicr.trulyimagined.com
- Updated CI build env to include canonical HDICR_API_URL and aligned legacy alias to same canonical host

### F4: Contract parity strengthened for manual verification endpoints
Status: remediated

Completed in this pass:
- Identity OpenAPI now has explicit response schemas for:
  - open/create/schedule/batch/complete verification sessions
  - actor verification status update
- Contract gate tests now enforce required keys for those schemas

## Extraction Checklist Delta (Actionable)

Before creating new repos:
1. Decide internal package strategy for @trulyimagined/* shared modules.
2. Prepare tsconfig rewrite map for service references.
3. Keep canonical env contract only:
   - TI: HDICR_API_URL + AUTH0_M2M_*
   - HDICR: AUTH0_AUDIENCE=https://hdicr.trulyimagined.com
4. Keep rollback anchor tag immutable:
   - pre-split-monorepo-2026-04-12

## Recommended Next Command Sequence (When starting real extraction)
1. Create extraction branches for TI and HDICR from pre-split-monorepo-2026-04-12.
2. Copy target folders into new repos.
3. Rewrite package.json + tsconfig references.
4. Run independent gates in each repo:
   - install
   - type-check
   - test
   - build
5. Re-run OpenAPI contract gate in TI repo against HDICR API specs.
