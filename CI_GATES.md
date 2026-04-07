# CI/CD Stage Gates

This document defines the mandatory stage gates that must pass before code merges and deploys.

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Lint Job (Type Check + Lint + Guardrails)                      │
│ ✓ pnpm type-check (HARD GATE)                                  │
│ ✓ pnpm lint (HARD GATE)                                        │
│ ✓ HDICR DB import guardrail                                    │
└────────────┬────────────────────────────────────────────────────┘
             │ (must pass to proceed)
             ├─────────────────┬────────────────────┐
             ▼                 ▼                    ▼
    ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Security Job     │  │ Test Job     │  │ Build Job        │
    │ (depends: lint)  │  │ (depends: L) │  │ (depends: L, S)  │
    │ ✓ Snyk Scan      │  │ ✓ Unit Tests │  │ ✓ Build Check    │
    │ ✓ Audit Check    │  │ ✓ Integration│  │ (HARD GATE)      │
    └──────────────────┘  └──────────────┘  └──────────────────┘
             │                 │                    │
             └─────────────────┼────────────────────┘
                               │ (all must pass)
                               ▼
                    ┌─────────────────────┐
                    │ Deploy (main only)  │
                    │ or Preview (PR/dev) │
                    └─────────────────────┘
```

## Hard Gates (Non-Negotiable)

### 1. Type Check (`pnpm type-check`)

**Purpose:** Enforce TypeScript strict mode across the entire monorepo

**Scope:** 8 workspace projects

- `shared/types`
- `infra/database`
- `shared/utils`
- `apps/web`
- `shared/middleware`
- `services/consent-service`
- `services/identity-service`
- `services/licensing-service`

**Failure behavior:** Blocks all downstream jobs (security, test, build, deploy)

**Local validation before push:**

```bash
pnpm type-check
```

**Key rules:**

- No `any` without explicit justification (use `any` pragmatically for external APIs only)
- Strict null checking enabled (no implicit `undefined`)
- No missing imports or unresolved symbols

### 2. Lint (`pnpm lint`)

**Purpose:** Enforce code style and catch common errors

**Failure behavior:** Blocks all downstream jobs

**Local validation:**

```bash
pnpm lint
```

### 3. Build Check (`pnpm build`)

**Purpose:** Verify the production build succeeds with minimal env

**Failure behavior:** Blocks both deploy jobs (production and preview)

**Scope:** Assets bundling, tree-shaking, dead code elimination

---

## Soft Gates (Can Warn)

### Security Scan (Snyk)

- Severity threshold: **high** or **critical**
- Known CVE exceptions documented in workflow
- Policy: `continue-on-error: false` (new security findings should block, but may continue on outages)

### Audit Check (`pnpm audit`)

- Controlled by allowlist in workflow
- Current exceptions: `GHSA-h25m-26qc-wcjf` (Next.js <15.0.8 DoS)
- Pending: Upgrade to Next.js 15.3.0+ to remove exception

---

## Branch Protection Rules

These workflow jobs must be enabled as **required status checks** in GitHub branch settings:

**For `main` branch:**

- `lint` (Type Check & Lint job) — **REQUIRED**
- `build` (Build Check job) — **REQUIRED**
- `test` (Unit Tests job) — **REQUIRED**
- `security` (Security Scan job) — **REQUIRED**
- Require branches to be up to date before merging — **ENABLED**
- Require PR reviews before merging — **ENABLED** (e.g., 1 approval)

**For `develop` branch:**

- `lint` — **REQUIRED**
- `build` — **REQUIRED**
- `test` — **REQUIRED**
- Require branches to be up to date before merging — **ENABLED**
- Require PR reviews before merging — **OPTIONAL** (development velocity)

---

## Pre-Commit Local Workflow

Before pushing, run this locally to catch issues early:

```bash
# Full CI simulation
pnpm install --frozen-lockfile
pnpm --filter @trulyimagined/types build
pnpm type-check
pnpm lint
pnpm test
pnpm --filter @trulyimagined/web test:integration
pnpm build
```

**Or use the fast-path for rapid iteration:**

```bash
# Quick check (30s)
pnpm type-check && pnpm lint
```

---

## Overriding Hard Gates (Emergency Only)

### For Type-Check Failures

If a type-check failure is a false positive:

1. **Document the issue** in the code comment immediately above the violation

   ```typescript
   // @ts-expect-error -- HDICR-1234: External API returns untyped response.
   // Remove when API contract is documented.
   const data = await externalAPI.fetch();
   ```

2. **Open an issue** in the project tracker to address the underlying type gap

3. **Request exception review** from the team via PR comments

4. **DO NOT disable TypeScript strict mode** globally

---

## CI Enforcement Validation

After each deployment, verify:

```bash
# Confirm type-check still enforced
git log --oneline -n 5 | grep -i 'type-check'

# Check branch protection is active
gh api repos/{owner}/{repo}/branches/main/protection
```

---

## Rollout Checklist

- [x] Type-check runs and fails hard on errors
- [x] Lint checks are enforced in workflow
- [x] Build check blocks preview/production deploys
- [x] Test job runs integration suite
- [x] All downstream jobs depend on lint passing
- [ ] GitHub branch protection rules configured (manual dashboard step)
- [ ] Team documentation updated in CONTRIBUTING.md (pending)
- [ ] Rollout dashboard created for monitoring CI health

---

## Monitoring & Alerts

### Common CI Failures

| Failure                  | Root Cause                     | Fix                                                           |
| ------------------------ | ------------------------------ | ------------------------------------------------------------- |
| `pnpm type-check` errors | Uncommitted type violations    | `pnpm type-check` locally, review error, add type annotations |
| `pnpm lint` fails        | Style violations               | `pnpm lint --fix` and recommit                                |
| Build fails              | Missing imports after refactor | Check all adapter clients for completeness                    |
| Integration tests fail   | Adapter mode mismatch          | Ensure env vars match test suite expectations                 |

### Bypass Procedures

**GitHub UI:**

- Admins can dismiss failed checks via "Allow auto-merge" → "Require branches to be up to date before merging"
- Creates audit trail for security review

**CLI (for maintainers):**

```bash
git push --force-with-lease  # Last resort; should trigger post-incident review
```

---

## Next Steps

1. **Configure GitHub branch protection** for `main` and `develop` with required checks
2. **Add to CONTRIBUTING.md** with link to this document
3. **Create CI health dashboard** to monitor gate performance
4. **Document known exceptions** (e.g., Snyk allowlist, audit CVEs)
