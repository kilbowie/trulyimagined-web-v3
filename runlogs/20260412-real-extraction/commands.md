## Phase 0: Preflight Lock
Date: 2026-04-12
Operator: Adam Greene

### Commands Executed
- git status --short
- git tag --list pre-split-monorepo-2026-04-12
- Test-Path <target directories>
- git ls-remote --heads https://github.com/kilbowie/trulyimagined.git
- git ls-remote --heads https://github.com/kilbowie/hdicr.git

### Outputs (Summary)
- Monorepo working tree: clean after planning checkpoint commit.
- Rollback anchor tag: present (`pre-split-monorepo-2026-04-12`).
- Local target paths: exist.
- Local target .git folders: not present.
- Remote reachability: both remotes reachable.
- Remote emptiness check: both remotes already have `refs/heads/main`.

### Validation Result
PASS WITH DEVIATION

### Decision / Deviation
- Phase 0 precondition "remotes empty" is not strictly met due to GitHub auto-created README commits on both remotes.
- Operator decision: proceed using existing remote main history and push extraction branches.

## Phase 1: Anchor Branch Prep
Date: 2026-04-12
Operator: Adam Greene

### Commands Executed
- git checkout -b extract/ti-split-20260412 pre-split-monorepo-2026-04-12
- git checkout -b extract/hdicr-split-20260412 pre-split-monorepo-2026-04-12
- git rev-parse HEAD (each branch)
- git rev-list -n 1 pre-split-monorepo-2026-04-12

### Outputs (Summary)
- Branch extract/ti-split-20260412 created from rollback tag.
- Branch extract/hdicr-split-20260412 created from rollback tag.
- Both branch SHAs match rollback tag SHA exactly.

### Validation Result
PASS

### Decision / Deviation
- No deviation in Phase 1. Branches anchored correctly and ready for extraction phases.

## Phase 2: TI Extraction
Date: 2026-04-12
Operator: Adam Greene

### Commands Executed
- Source branch context: git checkout extract/ti-split-20260412 (monorepo)
- Initialized target repo at C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/trulyimagined from remote main
- Copied mapped TI scope:
	- apps/web
	- shared/types
	- shared/utils
	- infra/database
	- services/*/openapi.yaml
- Created TI root files:
	- package.json
	- pnpm-workspace.yaml
	- tsconfig.json
	- .gitignore
	- vercel.json
	- .npmrc
- Ran TI validation gates:
	- pnpm install --no-frozen-lockfile
	- pnpm --filter @trulyimagined/types build
	- pnpm --filter @trulyimagined/utils build
	- pnpm --filter @trulyimagined/database build
	- pnpm type-check
	- pnpm test
	- pnpm build
	- pnpm test:contract
- Committed and pushed target branch:
	- git checkout -b extract/ti-split-20260412
	- git add .
	- git commit -m "extract: split TI into independent repo"
	- git push -u origin extract/ti-split-20260412

### Outputs (Summary)
- TI target gates: type-check PASS, test PASS, build PASS, contract test PASS.
- Contract gate validates included HDICR OpenAPI specs and required schema fields.
- TI extraction branch pushed to remote successfully.

### Validation Result
PASS

### Decision / Deviation
- Proceeded with existing remote main README baseline per approved Phase 0 deviation.

## Phase 3: HDICR Extraction
Date: 2026-04-12
Operator: Adam Greene

### Commands Executed
- Source branch context: git checkout extract/hdicr-split-20260412 (monorepo)
- Initialized target repo at C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/hdicr from remote main
- Copied mapped HDICR scope:
	- services/identity-service
	- services/consent-service
	- services/licensing-service
	- services/representation-service
	- shared/types
	- shared/utils
	- shared/middleware
	- infra/database
- Created HDICR root files:
	- package.json
	- pnpm-workspace.yaml
	- tsconfig.json
	- .gitignore
	- .npmrc
	- infra/template.yaml
- Ran HDICR validation gates:
	- pnpm install --no-frozen-lockfile
	- clean stale build metadata (*.tsbuildinfo, dist)
	- pnpm --filter @trulyimagined/types build
	- pnpm --filter @trulyimagined/utils build
	- pnpm --filter @trulyimagined/middleware build
	- pnpm --filter @trulyimagined/database build
	- pnpm type-check
	- pnpm test (required one repair run: pnpm install --force --no-frozen-lockfile)
	- pnpm build
	- sam validate -t infra/template.yaml (attempted)
- Committed and pushed target branch:
	- git checkout -b extract/hdicr-split-20260412
	- git add .
	- git commit -m "extract: split HDICR into independent repo"
	- git push -u origin extract/hdicr-split-20260412

### Outputs (Summary)
- HDICR target gates: type-check PASS, test PASS, build PASS.
- Initial TS6305 and Vitest module resolution issues were resolved by cleaning copied incremental/build artifacts and reinstalling dependencies with --force.
- HDICR extraction branch pushed to remote successfully.

### Validation Result
PASS WITH BLOCKER

### Decision / Deviation
- Proceeded with existing remote main README baseline per approved Phase 0 deviation.
- SAM validation is currently blocked in this environment because SAM CLI is not installed.
