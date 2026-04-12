# Real Extraction Execution Checklist

Date: 2026-04-12
Purpose: Operator-grade, step-by-step execution checklist for real TI and HDICR repository extraction based on validated dry-runs.

Companion mapping file: `docs/PRE_DEPLOYMENT_VALIDATION/REAL-EXTRACTION-COPY-MAP.md`

## Preconditions (Must Be True Before Starting)

- [ ] You are on `develop` with a clean working tree.
- [ ] Rollback anchor tag exists: `pre-split-monorepo-2026-04-12`.
- [ ] GitHub repositories exist:
  - [ ] `trulyimagined-web`
  - [ ] `hdicr-service`
- [ ] Local folder layout for extraction exists (example):
  - [ ] `<parent>/trulyimagined-web`
  - [ ] `<parent>/hdicr-service`

## Phase A: Prepare Extraction Branches

Run from monorepo root:

```bash
git fetch --all --tags
git checkout develop
git pull --ff-only
git checkout -b extract/ti-real pre-split-monorepo-2026-04-12
git checkout -b extract/hdicr-real pre-split-monorepo-2026-04-12
```

- [ ] Branch `extract/ti-real` created from rollback tag.
- [ ] Branch `extract/hdicr-real` created from rollback tag.

## Phase B: Execute TI Real Extraction

### B1. Copy validated TI scope

From branch `extract/ti-real`, copy only:

- `apps/web`
- `shared/types`
- `shared/utils`
- `infra/database`
- `services/*/openapi.yaml` (contract gate dependency)

- [ ] TI scope copied into `trulyimagined-web` repo.

### B2. Create TI root workspace files

At TI repo root, ensure:

- [ ] `package.json` with workspaces: `apps/*`, `shared/*`, `infra/*`
- [ ] `pnpm-workspace.yaml`
- [ ] root `tsconfig.json`
- [ ] `.gitignore`

### B3. Bootstrap and validate TI

Run in TI repo root:

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @trulyimagined/types build
pnpm --filter @trulyimagined/utils build
pnpm type-check
pnpm test
pnpm build
```

- [ ] Install passes.
- [ ] Type-check passes.
- [ ] Tests pass.
- [ ] Build passes.

### B4. Commit TI extraction

```bash
git add .
git commit -m "chore: initial TI repo extraction from monorepo baseline"
```

- [ ] Initial TI extraction commit created.
- [ ] Branch pushed to TI remote for CI validation.

## Phase C: Execute HDICR Real Extraction

### C1. Copy validated HDICR scope

From branch `extract/hdicr-real`, copy only:

- `services/identity-service`
- `services/consent-service`
- `services/licensing-service`
- `services/representation-service`
- `shared/types`
- `shared/utils`
- `shared/middleware`
- `infra/database`

- [ ] HDICR scope copied into `hdicr-service` repo.

### C2. Create HDICR root workspace files

At HDICR repo root, ensure:

- [ ] `package.json` with workspaces: `services/*`, `shared/*`, `infra/*`
- [ ] `pnpm-workspace.yaml`
- [ ] root `tsconfig.json`
- [ ] `.gitignore`

### C3. Bootstrap and validate HDICR

Run in HDICR repo root:

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @trulyimagined/types build
pnpm --filter @trulyimagined/utils build
pnpm --filter @trulyimagined/middleware build
pnpm --filter @trulyimagined/database build
pnpm type-check
pnpm test
pnpm build
```

- [ ] Install passes.
- [ ] Type-check passes.
- [ ] Tests pass.
- [ ] Build passes.

### C4. Commit HDICR extraction

```bash
git add .
git commit -m "chore: initial HDICR repo extraction from monorepo baseline"
```

- [ ] Initial HDICR extraction commit created.
- [ ] Branch pushed to HDICR remote for CI validation.

## Phase D: Cross-Repo Contract Validation

- [ ] TI contract tests still pass against included HDICR OpenAPI specs.
- [ ] Identity, consent, and licensing OpenAPI specs are version-aligned with TI client usage.
- [ ] Canonical host remains `https://hdicr.trulyimagined.com` in active docs/specs.

Recommended command in TI repo:

```bash
pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts
```

## Phase E: Readiness Outputs

- [ ] TI repo has README with bootstrap and CI order.
- [ ] HDICR repo has README with bootstrap and CI order.
- [ ] CI pipelines in both repos include the validated bootstrap sequence.
- [ ] `PRODUCTION_READINESS_PLAN.md` Phase 2/3 tasks updated with commit refs and gate evidence.

## Rollback Procedure

If extraction fails or drifts:

1. Stop extraction changes in target repo.
2. Reset extraction branch to rollback anchor lineage.
3. Re-run from `pre-split-monorepo-2026-04-12` using this checklist.

Reference:

```bash
git checkout <extract-branch>
git reset --hard pre-split-monorepo-2026-04-12
```

## Exit Criteria for Real Extraction Completion

- [ ] Both target repos have clean extraction commits.
- [ ] Both repos pass install/type-check/test/build independently.
- [ ] Contract gate validation passes in TI repo.
- [ ] Documentation and CI bootstrap sequences are committed.
- [ ] Phase 2 and Phase 3 readiness items can be marked complete with evidence.
