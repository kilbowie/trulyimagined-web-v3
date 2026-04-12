# Cross-Branch Extraction Comparison

Date: 2026-04-12
Objective: Consolidate TI and HDICR dry-run extraction outcomes into one operator-ready reference.

## Branches Evaluated
- TI dry-run branch: `dryrun/extract-ti-from-pre-split-2026-04-12`
- HDICR dry-run branch: `dryrun/extract-hdicr-from-pre-split-2026-04-12`

## Result Snapshot

| Area | TI Dry-Run | HDICR Dry-Run |
| --- | --- | --- |
| Extraction workspace | `dryruns/ti-repo` | `dryruns/hdicr-repo` |
| Install | PASS | PASS |
| Type-check | PASS | PASS |
| Tests | PASS | PASS |
| Build | PASS | PASS |
| Additional bootstrap required | OpenAPI specs + shared package build output for tests | Shared/infra package build bootstrap for TS project references |

## Extraction Scope Comparison

### TI scope (validated)
- `apps/web`
- `shared/types`
- `shared/utils`
- `infra/database`
- `services/*/openapi.yaml` (contract gate dependency for TI tests)

### HDICR scope (validated)
- `services/identity-service`
- `services/consent-service`
- `services/licensing-service`
- `services/representation-service`
- `shared/types`
- `shared/utils`
- `shared/middleware`
- `infra/database`

## Key Differences and Implications

1. Contract parity dependency in TI tests
- TI contract gate reads OpenAPI specs from service paths.
- Practical implication: TI repo must either vendor service OpenAPI specs or pull them from a canonical contract artifact during CI.

2. TS project-reference bootstrap in HDICR
- HDICR services rely on declaration outputs from shared/infra packages.
- Practical implication: build order must include dependency package bootstrap before aggregate type-check/build.

3. Shared package strategy remains the main split decision
- Both extractions require `@trulyimagined/*` internal packages.
- Practical implication: choose one strategy before production split:
  - Copy shared packages into each repo.
  - Publish internal packages and pin versions.
  - Hybrid approach with contract/version enforcement.

## Standardized Bootstrap Sequences

### TI repo bootstrap sequence
1. `pnpm install --no-frozen-lockfile`
2. `pnpm --filter @trulyimagined/types build`
3. `pnpm --filter @trulyimagined/utils build`
4. `pnpm type-check`
5. `pnpm test`
6. `pnpm build`

### HDICR repo bootstrap sequence
1. `pnpm install --no-frozen-lockfile`
2. `pnpm --filter @trulyimagined/types build`
3. `pnpm --filter @trulyimagined/utils build`
4. `pnpm --filter @trulyimagined/middleware build`
5. `pnpm --filter @trulyimagined/database build`
6. `pnpm type-check`
7. `pnpm test`
8. `pnpm build`

## Readiness Decision
Extraction viability is confirmed for both TI and HDICR dry-runs, provided the documented bootstrap order and contract artifact handling are applied.

## Recommended Next Implementation Step
Proceed to Phase 2 real extraction using the validated package sets above, and embed the bootstrap sequences directly into each new repo README and CI pipeline from day one.
