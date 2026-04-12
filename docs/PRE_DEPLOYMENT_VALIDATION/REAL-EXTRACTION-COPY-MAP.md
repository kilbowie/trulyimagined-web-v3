# Real Extraction Copy Map (Exact Source -> Target)

Date: 2026-04-12
Purpose: Mechanical operator mapping of every monorepo path that must be copied into the TI and HDICR extracted repositories.

## Usage Notes

- Copy only mapped paths.
- Do not copy generated directories: `node_modules`, `.next`, `dist`, `coverage`, `.turbo`.
- Source base is monorepo root.
- Target base is extracted repo root (`trulyimagined-web` or `hdicr-service`).

## TI Repository Copy Map (`trulyimagined-web`)

### Workspace packages and app

| Source (monorepo) | Target (`trulyimagined-web`) |
| --- | --- |
| `apps/web` | `apps/web` |
| `shared/types` | `shared/types` |
| `shared/utils` | `shared/utils` |
| `infra/database` | `infra/database` |

### Contract specs required by TI gate

| Source (monorepo) | Target (`trulyimagined-web`) |
| --- | --- |
| `services/identity-service/openapi.yaml` | `services/identity-service/openapi.yaml` |
| `services/consent-service/openapi.yaml` | `services/consent-service/openapi.yaml` |
| `services/licensing-service/openapi.yaml` | `services/licensing-service/openapi.yaml` |
| `services/representation-service/openapi.yaml` | `services/representation-service/openapi.yaml` |

### Root-level workspace files to create in TI target

| Source | Target (`trulyimagined-web`) |
| --- | --- |
| `package.json` (new TI root workspace manifest) | `package.json` |
| `pnpm-workspace.yaml` (new TI workspace definition) | `pnpm-workspace.yaml` |
| `tsconfig.json` (new TI root project references) | `tsconfig.json` |
| `.gitignore` (new TI target ignore rules) | `.gitignore` |

## HDICR Repository Copy Map (`hdicr-service`)

### Service packages

| Source (monorepo) | Target (`hdicr-service`) |
| --- | --- |
| `services/identity-service` | `services/identity-service` |
| `services/consent-service` | `services/consent-service` |
| `services/licensing-service` | `services/licensing-service` |
| `services/representation-service` | `services/representation-service` |

### Shared and infra packages

| Source (monorepo) | Target (`hdicr-service`) |
| --- | --- |
| `shared/types` | `shared/types` |
| `shared/utils` | `shared/utils` |
| `shared/middleware` | `shared/middleware` |
| `infra/database` | `infra/database` |

### Root-level workspace files to create in HDICR target

| Source | Target (`hdicr-service`) |
| --- | --- |
| `package.json` (new HDICR root workspace manifest) | `package.json` |
| `pnpm-workspace.yaml` (new HDICR workspace definition) | `pnpm-workspace.yaml` |
| `tsconfig.json` (new HDICR root project references) | `tsconfig.json` |
| `.gitignore` (new HDICR target ignore rules) | `.gitignore` |

## Optional Path Verification Commands

Run from monorepo root before copy:

```bash
test -d apps/web
test -d shared/types
test -d shared/utils
test -d shared/middleware
test -d infra/database
test -f services/identity-service/openapi.yaml
test -f services/consent-service/openapi.yaml
test -f services/licensing-service/openapi.yaml
test -f services/representation-service/openapi.yaml
```

## Completion Checks

- TI target contains only mapped TI paths plus TI root workspace files.
- HDICR target contains only mapped HDICR paths plus HDICR root workspace files.
- No generated artifacts were copied.