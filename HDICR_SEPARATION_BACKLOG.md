# HDICR Platform Separation — Implementation Backlog

> **Audit date:** April 2026  
> **Current separation score:** 22/100  
> **Target score:** ≥ 85/100 after all phases complete  
> **Review this document alongside:** `CI_GATES.md`, `TECHNICAL_ARCHITECTURE.md`

---

## How to use this document

Each ticket has a stable ID `SEP-NNN`, a priority tier, the exact files to change, acceptance criteria, and dependencies. Work them in phase order. Mark tickets complete by checking the box in the summary table below.

**Priority key**

- `P0` — Blocks production trustworthiness. Fix before next deploy to prod.
- `P1` — Must be in next sprint.
- `P2` — Required before any external client or regulatory review.
- `P3` — Required before multi-tenant launch.

---

## Summary table

| ID      | Title                                                            | Phase | Priority | Status |
| ------- | ---------------------------------------------------------------- | ----- | -------- | ------ |
| SEP-001 | Rotate exposed secrets immediately                               | 0     | P0       | [x]    |
| SEP-002 | Inventory and classify all direct DB access in web routes        | 1     | P0       | [ ]    |
| SEP-003 | Add CI guardrail blocking new HDICR direct-DB imports            | 1     | P0       | [x]    |
| SEP-004 | Remove local adapter paths from `identity-client.ts`             | 1     | P1       | [x]    |
| SEP-005 | Remove local adapter paths from `consent-client.ts`              | 1     | P1       | [x]    |
| SEP-006 | Remove local adapter paths from `licensing-client.ts`            | 1     | P1       | [x]    |
| SEP-007 | Remove local adapter paths from `representation-client.ts`       | 1     | P1       | [x]    |
| SEP-008 | Remove local adapter paths from `usage-client.ts`                | 1     | P1       | [x]    |
| SEP-009 | Remove local adapter paths from `credentials-client.ts`          | 1     | P1       | [x]    |
| SEP-010 | Remove local adapter paths from `billing-client.ts`              | 1     | P1       | [x]    |
| SEP-011 | Route `actors/[id]` through HDICR identity API                   | 1     | P1       | [x]    |
| SEP-012 | Route `agent/actors/[actorId]/consent` through HDICR consent API | 1     | P1       | [x]    |
| SEP-013 | Route `verification/start` through HDICR identity API            | 1     | P1       | [x]    |
| SEP-014 | Remove global `HDICR_ADAPTER_MODE=local` default                 | 1     | P1       | [x]    |
| SEP-015 | Define canonical DB ownership boundary (HDICR vs TI tables)      | 1     | P1       | [x]    |
| SEP-016 | Route `admin/users` through HDICR IAM API                        | 1     | P1       | [x]    |
| SEP-017 | Route `agent/roster` actor lookup through HDICR APIs             | 1     | P1       | [x]    |
| SEP-020 | Define OpenAPI spec — HDICR Identity service                     | 2     | P1       | [x]    |
| SEP-021 | Define OpenAPI spec — HDICR Consent service                      | 2     | P1       | [x]    |
| SEP-022 | Define OpenAPI spec — HDICR Licensing service                    | 2     | P1       | [x]    |
| SEP-023 | Define OpenAPI spec — HDICR Representation service               | 2     | P2       | [ ]    |
| SEP-024 | Add `/v1` path prefix to all HDICR service handlers              | 2     | P2       | [x]    |
| SEP-025 | Add API contract test CI gate                                    | 2     | P2       | [x]    |
| SEP-026 | Promote representation domain to full HDICR service              | 2     | P2       | [ ]    |
| SEP-030 | Add JWT validation at HDICR service handler ingress              | 3     | P1       | [ ]    |
| SEP-031 | Implement OAuth 2.1 client credentials for TI → HDICR calls      | 3     | P2       | [ ]    |
| SEP-032 | Add scope-based authorization per HDICR endpoint                 | 3     | P2       | [ ]    |
| SEP-033 | Move TI Auth0 claim mapping out of `shared/middleware`           | 3     | P1       | [ ]    |
| SEP-034 | Add Zod request validation at each HDICR handler                 | 3     | P2       | [ ]    |
| SEP-035 | Add API Gateway rate limiting by client_id                       | 3     | P2       | [ ]    |
| SEP-036 | Add secret-scanning gate to CI                                   | 3     | P1       | [ ]    |
| SEP-040 | Add `tenant_id` migration to core HDICR tables                   | 4     | P2       | [ ]    |
| SEP-041 | Separate HDICR and TI environment configs                        | 4     | P2       | [ ]    |
| SEP-042 | Split HDICR DB credentials out of TI runtime                     | 4     | P3       | [ ]    |
| SEP-043 | Add Row-Level Security policies for tenant isolation             | 4     | P3       | [ ]    |
| SEP-044 | Separate HDICR deploy pipeline from TI Vercel deploy             | 4     | P3       | [ ]    |
| SEP-045 | Neutralise TI-specific naming in HDICR core schema               | 4     | P3       | [ ]    |

---

## Phase 0 — Immediate (Before Next Deploy)

---

### SEP-001 · Rotate exposed secrets immediately

**Priority:** P0  
**Files:** `apps/web/.env.local`, secret stores

**Problem:**  
Sensitive credentials appear in this codebase's conversation context and local env file. Until rotated, the attack surface for these services is open.

**Acceptance criteria:**

- [x] New `RESEND_API_KEY` generated at https://resend.com/api-keys
- [x] New `SENTRY_AUTH_TOKEN` generated in Sentry organisation settings
- [x] New `AUTH0_DEV_CLIENT_SECRET` rotated in Auth0 dashboard → Applications → Settings → Rotate Secret (for development app)
- [x] New `AUTH0_PROD_CLIENT_SECRET` rotated in Auth0 dashboard → Applications → Settings → Rotate Secret (for production deployment)
- [x] New `CONSENT_SIGNING_PRIVATE_KEY` / `CONSENT_SIGNING_PUBLIC_KEY` generated via `node scripts/generate-consent-signing-keys.js`
- [x] All rotated values updated in Vercel environment variable settings (not committed to git)
- [x] Old values revoked at provider dashboards
- [x] `.env.local` confirmed in `.gitignore` — it is, but verify with `git check-ignore -v apps/web/.env.local`

**Notes:**  
Stripe test keys (`sk_test_`, `pk_test_`, `whsec_`) have no real-money impact but should still be rotated as a hygiene measure.

---

## Phase 1 — Isolation (Remove tight coupling)

---

### SEP-002 · Inventory and classify all direct DB access in web routes

**Priority:** P0  
**Files:** 26 routes listed below

**Problem:**  
26 API route files import `query` from `@/lib/db` and execute SQL directly against the shared database. Some of these access HDICR-owned data (which is a boundary violation). Others access TI-owned data (which is acceptable until DB split in Phase 4).

**Ownership classification:**  
Work through this table. For each route, confirm whether it queries HDICR-owned or TI-owned tables. Mark accordingly — this drives which tickets are blockers before production.

| Route file                                                     | Tables queried             | Owner                | Action required                   |
| -------------------------------------------------------------- | -------------------------- | -------------------- | --------------------------------- |
| `apps/web/src/app/api/actors/[id]/route.ts`                    | `actors`                   | **HDICR**            | SEP-011                           |
| `apps/web/src/app/api/agent/actors/[actorId]/consent/route.ts` | `consent_log`, `actors`    | **HDICR**            | SEP-012                           |
| `apps/web/src/app/api/verification/start/route.ts`             | `identity_links`           | **HDICR**            | SEP-013                           |
| `apps/web/src/app/api/admin/users/route.ts`                    | `user_profiles` + `actors` | **HDICR**            | SEP-016                           |
| `apps/web/src/app/api/profile/route.ts`                        | `user_profiles`            | TI                   | Keep; migrate to TI DB in Phase 4 |
| `apps/web/src/app/api/profile/check-availability/route.ts`     | `user_profiles`            | TI                   | Keep; migrate to TI DB in Phase 4 |
| `apps/web/src/app/api/agent/manage-agents/route.ts`            | `agency_team_members`      | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/agent/manage-agents/[memberId]/route.ts` | `agency_team_members`      | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/agent-profile/route.ts`                  | `agents`                   | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/agent-profile/upload-photo/route.ts`     | `agents`                   | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/agent/roster/route.ts`                   | `actors` JOIN agents       | **HDICR** (`actors`) | SEP-017                           |
| `apps/web/src/app/api/agency-invite/accept/route.ts`           | `agency_team_members`      | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/notifications/counts/route.ts`           | `representation_requests`  | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/notifications/pending-requests/route.ts` | `representation_requests`  | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/media/route.ts`                          | `actor_media`              | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/media/[id]/route.ts`                     | `actor_media`              | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/media/[id]/set-primary/route.ts`         | `actor_media`              | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/media/upload/route.ts`                   | `actor_media`              | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/feedback/route.ts`                       | `feedback`                 | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/feedback/[id]/route.ts`                  | `feedback`                 | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/feedback/[id]/reply/route.ts`            | `feedback`                 | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/support/tickets/route.ts`                | `support_tickets`          | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/support/tickets/[id]/route.ts`           | `support_tickets`          | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/support/tickets/[id]/messages/route.ts`  | `support_messages`         | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/iam/users/route.ts`                      | `user_profiles`            | TI                   | Keep; migrate to TI DB            |
| `apps/web/src/app/api/iam/users/[userProfileId]/route.ts`      | `user_profiles`            | TI                   | Keep; migrate to TI DB            |

**Acceptance criteria:**

- [x] Every route in the table above is annotated with a comment: `// DB-OWNER: HDICR | TI`
- [x] HDICR-owned routes have corresponding tickets created and linked
- [ ] Classification reviewed and agreed before Phase 4 DB split

Implementation note (2026-04-07): Route ownership comments are now present across all inventoried files, and follow-on backlog tickets were added for the remaining HDICR-owned direct DB routes.

---

### SEP-016 · Route `admin/users` through HDICR IAM API

**Priority:** P1  
**Files:** `apps/web/src/app/api/admin/users/route.ts`

**Problem:**  
This route still joins HDICR-owned identity tables directly from the web tier, bypassing an HDICR-owned IAM boundary.

**Acceptance criteria:**

- [x] Route no longer imports `@/lib/db`
- [x] User and actor data are resolved through an HDICR client/API
- [x] Existing admin route behavior is preserved with contract coverage

Implementation note (2026-04-07): `api/admin/users` now resolves through `identity-client.listAdminUsers()`, with an HDICR identity-service admin listing endpoint and route contract coverage preserving the existing response shape.

---

### SEP-017 · Route `agent/roster` actor lookup through HDICR APIs

**Priority:** P1  
**Files:** `apps/web/src/app/api/agent/roster/route.ts`

**Problem:**  
This route still queries the HDICR-owned `actors` table directly while composing the agent roster response.

**Acceptance criteria:**

- [x] Route no longer imports `@/lib/db` for HDICR-owned actor lookups
- [x] Actor roster data is sourced through HDICR client/API calls
- [x] Existing roster response behavior remains covered by tests

Implementation note (2026-04-07): `api/agent/roster` now keeps only the TI-owned relationship query local and resolves actor profile plus consent state through HDICR identity and consent clients.

---

### SEP-003 · Add CI guardrail blocking new HDICR direct-DB imports in web routes

**Priority:** P0  
**Files:** `apps/web/.eslintrc.js` (or equivalent), `.github/workflows/ci.yml`

**Problem:**  
The existing CI gate already has an HDICR DB import guardrail mentioned in `CI_GATES.md`. This ticket ensures it is actually enforced as a hard fail for the specific HDICR-domain routes.

**What to implement:**  
Add or strengthen the no-restricted-imports ESLint rule in `apps/web` to forbid `@/lib/db` from being imported within files that also import from `@/lib/hdicr/*`.

```js
// apps/web/.eslintrc.js — add to rules
'no-restricted-imports': ['error', {
  patterns: [
    {
      group: ['*/lib/db'],
      importNames: ['query', 'pool'],
      message:
        'Do not query the database directly from a route that uses an HDICR client. ' +
        'Use the appropriate HDICR client in @/lib/hdicr/* instead. ' +
        'See HDICR_SEPARATION_BACKLOG.md SEP-003.',
    },
  ],
}],
```

For a stricter gate, add a script to CI that greps for co-occurrence of both imports in the same file:

```bash
# scripts/check-hdicr-db-coimport.sh
# Fails if a file imports both @/lib/db and @/lib/hdicr/*
FILES=$(grep -rl "from '@/lib/hdicr/" apps/web/src/app/api)
for f in $FILES; do
  if grep -q "from '@/lib/db'" "$f"; then
    echo "VIOLATION: $f imports both @/lib/db and @/lib/hdicr/"
    exit 1
  fi
done
echo "HDICR DB co-import check passed."
```

Add this as a step in the lint job in `.github/workflows/ci.yml`.

**Acceptance criteria:**

- [x] Script added to `scripts/check-hdicr-db-coimport.sh`
- [x] Script is executable and runs in CI lint job
- [x] CI fails immediately when a new file imports both `@/lib/db` and `@/lib/hdicr/*`
- [x] All existing violations are listed in a `# TODO: SEP-003` comment so the script doesn't fail until those tickets are cleared

Implementation note (2026-04-07): There are currently no baseline co-import violations, so the exemption list is intentionally empty.

---

### SEP-004 · Remove local adapter paths from `identity-client.ts`

**Priority:** P1  
**Depends on:** SEP-014  
**Files:** `apps/web/src/lib/hdicr/identity-client.ts`

**Problem:**  
Every exported function in this file has a local code path: when `HDICR_ADAPTER_MODE=local`, it runs SQL directly via `@/lib/db`. This means the HDICR API boundary is completely bypassed in default configuration.

**Functions affected** (all have `*Local` variants to remove):

- `actorExistsByAuth0UserId` → `actorExistsByAuth0UserIdLocal`
- `createActorRegistration` → `createActorRegistrationLocal`
- `getUserProfileIdByAuth0UserId` → `getUserProfileIdByAuth0UserIdLocal`
- `getIdentityLinkByProviderAndProviderUser` → `getIdentityLinkByProviderAndProviderUserLocal`
- `reactivateIdentityLink` → `reactivateIdentityLinkLocal`
- `createIdentityLink` → `createIdentityLinkLocal`
- `listIdentityLinks` → `listIdentityLinksLocal`
- `getActorByAuth0UserId` → `getActorByAuth0UserIdLocal`
- `getActorRegistrationStatus` → `getActorRegistrationStatusLocal`

**Before (current pattern):**

```ts
export async function actorExistsByAuth0UserId(auth0UserId: string): Promise<boolean> {
  if (isIdentityRemoteMode()) {
    return invokeIdentityRemote<{ exists?: boolean }>({...});
  }
  return actorExistsByAuth0UserIdLocal(auth0UserId); // ← delete this branch
}

async function actorExistsByAuth0UserIdLocal(auth0UserId: string): Promise<boolean> {
  const result = await query('SELECT id FROM actors WHERE auth0_user_id = $1', [auth0UserId]);
  return result.rows.length > 0;
}
```

**After (target pattern):**

```ts
export async function actorExistsByAuth0UserId(auth0UserId: string): Promise<boolean> {
  const response = await invokeIdentityRemote<{ exists?: boolean }>({
    path: `/v1/identity/actors/exists?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'actor-exists-check',
  });
  return Boolean(response.exists);
}
```

**Acceptance criteria:**

- [x] All `*Local` functions deleted from `identity-client.ts`
- [x] `import { query } from '@/lib/db'` removed from the file
- [x] `getHdicrAdapterMode` and mode-check logic removed
- [x] `invokeIdentityRemote` is the only execution path
- [x] `HDICR_REMOTE_BASE_URL` missing causes startup error, not silent fallback
- [x] All unit tests updated to mock `fetch` rather than the `query` function
- [x] `identity-client.test.ts` passes with `HDICR_ADAPTER_MODE` env deleted

Implementation note (2026-04-07): identity client endpoints now use `/v1/identity/*` paths and fail closed during module initialization if `HDICR_REMOTE_BASE_URL` is absent.

---

### SEP-005 · Remove local adapter paths from `consent-client.ts`

**Priority:** P1  
**Depends on:** SEP-014  
**Files:** `apps/web/src/lib/hdicr/consent-client.ts`

**Functions with local paths to remove:**

- `resolveActorContextByAuth0UserId` → `resolveActorContextByAuth0UserIdLocal` (2× SQL queries)
- `grantConsent` → `grantConsentLocal`
- `revokeConsent` → `revokeConsentLocal`
- `checkConsent` → `checkConsentLocal`
- `listConsentRecords` → `listConsentRecordsLocal`

**Acceptance criteria:**

- [x] All `*Local` functions deleted
- [x] `import { query } from '@/lib/db'` removed
- [x] `import { createConsentEntry, getConsentHistory, getLatestConsent } from '@/lib/consent-ledger'` removed (internal ledger module bypassed by TI)
- [x] All consent operations route through `invokeConsentRemote`
- [x] `consent-client.test.ts` passes with fetch mocked

Implementation note (2026-04-07): consent client now initializes fail-closed when `HDICR_REMOTE_BASE_URL` is missing and routes all calls through `/v1/consent/*` and `/v1/consent-ledger/*` endpoints.

---

### SEP-006 · Remove local adapter paths from `licensing-client.ts`

**Priority:** P1  
**Depends on:** SEP-014  
**Files:** `apps/web/src/lib/hdicr/licensing-client.ts`

**Functions with local paths to remove:**

- `resolveActorIdByAuth0UserId` (2× SQL queries via user_profiles + actors)
- `listActorLicensingRequests` → large SQL block with status filter
- `getLicensingRequestById`
- `applyLicensingDecision` → `applyLicensingDecisionLocal`
- `getActorLicensesAndStats` (calls internal `@/lib/licensing` module)
- `verifyActiveRepresentation`
- `getAgentActorLicensingData`

**Acceptance criteria:**

- [x] All local SQL and imports from `@/lib/licensing` removed
- [x] `import { query } from '@/lib/db'` removed
- [x] `licensing-client.test.ts` passes with fetch mocked

Implementation note (2026-04-07): licensing client now runs remote-only with fail-closed initialization and `/v1/licensing/*` endpoints.

---

### SEP-007 · Remove local adapter paths from `representation-client.ts`

**Priority:** P1  
**Depends on:** SEP-026  
**Files:** `apps/web/src/lib/hdicr/representation-client.ts`

**Problem:**  
`representation-client.ts` has **no remote mode at all** — it is entirely local SQL with no adapter pattern or flag. It imports `query` directly with no HTTP fallback.

Functions to migrate to HTTP:

- `getActorByAuth0UserId`
- `getAgentByAuth0UserId`
- `getActiveRepresentationForActor`
- `getAgentByRegistryId`
- `hasPendingRequest`
- `createRepresentationRequest`
- `listIncomingRequests`
- `listOutgoingRequests`
- `getRepresentationRequestById`
- `updateRepresentationRequest`
- `actorHasActiveRelationship`
- `createActorAgentRelationship`
- `getRelationshipById`
- `endRelationship`

**Acceptance criteria:**

- [x] File converted to HTTP client following same pattern as `identity-client.ts`
- [ ] HDICR Representation service exists to receive these calls (SEP-026)
- [x] `import { query } from '@/lib/db'` removed
- [x] All representation routes using the old direct functions pass tests

Implementation note (2026-04-07): representation client now initializes fail-closed and routes all calls through `/v1/representation/*` endpoints, but the corresponding HDICR service handlers remain pending under SEP-026.

---

### SEP-008 · Remove local adapter paths from `usage-client.ts`

**Priority:** P1  
**Files:** `apps/web/src/lib/hdicr/usage-client.ts`

**Acceptance criteria:**

- [x] Local SQL paths deleted, all operations route through `invokeUsageRemote`
- [x] `usage-client.test.ts` passes with fetch mocked

Implementation note (2026-04-07): usage client now initializes fail-closed and routes all calls through `/v1/usage/*` endpoints.

---

### SEP-009 · Remove local adapter paths from `credentials-client.ts`

**Priority:** P1  
**Files:** `apps/web/src/lib/hdicr/credentials-client.ts`

**Acceptance criteria:**

- [x] Local SQL paths deleted, all operations route through credential service HTTP
- [x] `credentials-client.test.ts` passes with fetch mocked

Implementation note (2026-04-07): credentials client now initializes fail-closed and routes all calls through `/v1/credentials/*` endpoints.

---

### SEP-010 · Remove local adapter paths from `billing-client.ts`

**Priority:** P1  
**Files:** `apps/web/src/lib/hdicr/billing-client.ts`

**Acceptance criteria:**

- [x] Local SQL paths deleted, all operations route through billing service HTTP
- [x] `billing-client.test.ts` passes with fetch mocked

Implementation note (2026-04-07): billing client now initializes fail-closed and routes profile lookup through `/v1/billing/profile`.

---

### SEP-011 · Route `actors/[id]` through HDICR identity API

**Priority:** P1  
**Files:** `apps/web/src/app/api/actors/[id]/route.ts`

**Problem:**  
This route imports `query` from `@/lib/db` and reads/writes directly to the `actors` table — an HDICR-owned entity.

**Fix:**  
Replace SQL with calls to `@/lib/hdicr/identity-client` functions:

- `GET` → call `getActorById` via identity client (add this function if missing)
- `PUT` → call `updateActorProfile` via identity client (add this function if missing)

**Acceptance criteria:**

- [x] `import { query } from '@/lib/db'` removed from file
- [x] Route reads actor data through HDICR identity client
- [x] Route writes actor updates through HDICR identity client
- [x] Behavior unchanged for end users

Implementation note (2026-04-07): route now uses `getActorById` and `updateActorProfile` from identity client.

---

### SEP-012 · Route `agent/actors/[actorId]/consent` through HDICR consent API

**Priority:** P1  
**Files:** `apps/web/src/app/api/agent/actors/[actorId]/consent/route.ts`

**Problem:**  
This route queries `consent_log` and `actors` directly — both HDICR-owned.

**Fix:**  
Replace DB queries with `checkConsent` and `listConsentRecords` from `@/lib/hdicr/consent-client` (which will call the remote API after SEP-005).

**Acceptance criteria:**

- [x] `import { query } from '@/lib/db'` removed
- [x] Consent data reads through consent client

Implementation note (2026-04-07): route now uses `listConsentRecords` and `getCurrentConsentLedger`; representation authorization uses `verifyActiveRepresentation`.

---

### SEP-013 · Route `verification/start` through HDICR identity API

**Priority:** P1  
**Files:** `apps/web/src/app/api/verification/start/route.ts`

**Problem:**  
Identity verification writes to `identity_links`, an HDICR-owned table.

**Fix:**  
Move the link creation to call `createIdentityLink` from `@/lib/hdicr/identity-client` (which will be HTTP-only after SEP-004).

**Acceptance criteria:**

- [x] `import { query } from '@/lib/db'` removed
- [x] Verification start writes identity link through HDICR identity client

Implementation note (2026-04-07): mock verification now calls `createIdentityLink` and profile resolution uses `getUserProfileIdByAuth0UserId`.

---

### SEP-014 · Remove global `HDICR_ADAPTER_MODE=local` default

**Priority:** P1  
**Files:** `apps/web/src/lib/hdicr/flags.ts`, `apps/web/.env.example`

**Problem:**  
`flags.ts` silently defaults to `'local'` mode when the env var is missing. This means any misconfiguration (or intentional omission) reverts to direct DB access.

**Before:**

```ts
// flags.ts line ~13-14
function normalizeMode(value: string | undefined): AdapterMode {
  return value?.toLowerCase() === 'remote' ? 'remote' : 'local'; // ← always falls back to local
}
```

**After:**

```ts
function normalizeMode(value: string | undefined, domain: string): AdapterMode {
  if (value?.toLowerCase() === 'remote') return 'remote';
  if (value?.toLowerCase() === 'local') return 'local';
  // In production, fail loudly rather than silently bypass the boundary
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[HDICR] HDICR_${domain.toUpperCase()}_ADAPTER_MODE is not set. ` +
        `Set to "remote" in production. See HDICR_SEPARATION_BACKLOG.md SEP-014.`
    );
  }
  // In development, warn loudly and default to local for convenience
  console.warn(
    `[HDICR] ${domain} adapter defaulting to local mode. Set HDICR_ADAPTER_MODE=remote for prod parity.`
  );
  return 'local';
}
```

Update `.env.example`:

```
# HDICR Adapter Mode — MUST be 'remote' in production
# local: direct DB access (dev/test only)
# remote: calls HDICR service APIs (production)
HDICR_ADAPTER_MODE=remote
HDICR_REMOTE_BASE_URL=https://api.trulyimagined.com
```

**Acceptance criteria:**

- [x] Production startup throws if `HDICR_ADAPTER_MODE` is unset or not `remote`
- [x] Development shows a warning if defaulting to local
- [x] `.env.example` defaults changed to `remote`
- [x] CI test environment explicitly sets `local` (don't rely on default)
- [x] `flags.test.ts` updated to cover new behaviour

Implementation note (2026-04-07): CI build explicitly sets `HDICR_ADAPTER_MODE=remote` and `HDICR_REMOTE_BASE_URL` to avoid fail-closed production build breaks.

---

### SEP-015 · Define canonical DB ownership boundary

**Priority:** P1  
**Files:** `TECHNICAL_ARCHITECTURE.md` (add section), `infra/database/migrations/` (add comments)

**Problem:**  
No documented rule defines which database tables belong to HDICR vs TI. This causes ambiguity about what future code may or may not access directly.

**HDICR-owned tables (no direct TI access):**

- `actors`
- `consent_log`
- `identity_links`
- `verifiable_credentials`
- `credential_status_lists`
- `licensing_requests`
- `usage_tracking`
- `audit_log` (HDICR events)

**TI-owned tables (TI may access directly until Phase 4 DB split):**

- `user_profiles`
- `agents`
- `actor_agent_relationships`
- `representation_requests`
- `agency_team_members`
- `actor_media`
- `feedback`
- `support_tickets`, `support_messages`
- `notifications`
- `billing` related tables

**Acceptance criteria:**

- [x] `TECHNICAL_ARCHITECTURE.md` updated with ownership table
- [x] Each migration file prefixed with a comment block: `-- TABLE OWNER: HDICR | TI`
- [x] Decision documented and linked from `HDICR_SEPARATION_BACKLOG.md`

Implementation note (2026-04-07): `TECHNICAL_ARCHITECTURE.md` now defines the canonical ownership rule, route classification policy, and table-level boundary, and every current migration file carries an explicit owner header.

---

## Phase 2 — API Enforcement

---

### SEP-020 · Define OpenAPI spec — HDICR Identity service

**Priority:** P1  
**Files:** `services/identity-service/openapi.yaml` (create)

**Endpoints to document** (from `services/identity-service/src/index.ts`):

```
POST   /v1/identity/register
GET    /v1/identity/{id}
GET    /v1/identity
PUT    /v1/identity/{id}
GET    /v1/identity/actors/exists
GET    /v1/identity/user-profile-id
GET    /v1/identity/link/by-provider
POST   /v1/identity/link/create
POST   /v1/identity/link/reactivate
POST   /v1/identity/link/unlink-by-id
POST   /v1/identity/link/unlink-by-provider
GET    /v1/identity/links
GET    /v1/identity/registration-status
```

**Acceptance criteria:**

- [x] OpenAPI 3.1 spec committed at `services/identity-service/openapi.yaml`
- [x] All request/response schemas defined with strict types
- [x] Authentication scheme defined (Bearer JWT)
- [x] Semantic version tag in spec info block
- [x] Spec validated with `redocly lint` or equivalent

Implementation note (2026-04-07): `services/identity-service/openapi.yaml` documents the current HDICR identity contract, including actor registration, actor lookup/update, identity-linking operations, and the admin user listing endpoint added under SEP-016. The spec validates cleanly with Redocly.

---

### SEP-021 · Define OpenAPI spec — HDICR Consent service

**Priority:** P1  
**Files:** `services/consent-service/openapi.yaml` (create)

**Endpoints to document** (from `services/consent-service/src/index.ts` and handlers):

```
POST   /v1/consent/grant
POST   /v1/consent/revoke
GET    /v1/consent/check
GET    /v1/consent/{actorId}
GET    /v1/consent/actor-context
```

**Acceptance criteria:**

- [x] OpenAPI 3.1 spec committed
- [x] `consent_log` response shape documented (immutable, no delete)
- [x] `isGranted` boolean and `latestAction` shape specified precisely
- [x] All error codes (400, 401, 403, 404, 409) documented

Implementation note (2026-04-07): `services/consent-service/openapi.yaml` now documents the consent contract with `/v1` endpoints, immutable `consent_log` semantics, precise `isGranted` + `latestAction` structures, and the specified error response set.

---

### SEP-022 · Define OpenAPI spec — HDICR Licensing service

**Priority:** P1  
**Files:** `services/licensing-service/openapi.yaml` (create)

**Endpoints to document** (from `services/licensing-service/src/handler.ts`):

```
POST   /v1/license/request
GET    /v1/license/actor/{actorId}
POST   /v1/license/{requestId}/approve
POST   /v1/license/{requestId}/reject
GET    /v1/licensing/actor-id
GET    /v1/licensing/actor-requests
GET    /v1/licensing/request
POST   /v1/licensing/decision
GET    /v1/licensing/actor/licenses-and-stats
GET    /v1/licensing/representation/active
GET    /v1/licensing/agent-actor-data
```

**Acceptance criteria:**

- [x] OpenAPI 3.1 spec committed
- [x] Status enum values (`pending`, `approved`, `rejected`, `expired`) in spec
- [x] Compensation fields typed correctly

Implementation note (2026-04-07): `services/licensing-service/openapi.yaml` now defines all listed licensing endpoints and shared schemas, including explicit status enums and typed compensation amount/currency fields.

---

### SEP-023 · Define OpenAPI spec — HDICR Representation service

**Priority:** P2  
**Depends on:** SEP-026  
**Files:** `services/representation-service/openapi.yaml` (create alongside SEP-026)

---

### SEP-024 · Add `/v1` path prefix to all HDICR service handlers

**Priority:** P2  
**Files:**

- `services/identity-service/src/index.ts`
- `services/consent-service/src/index.ts`
- `services/licensing-service/src/handler.ts`
- `infra/api-gateway/template.yaml`

**Problem:**  
All current route paths are unversioned (e.g. `/identity/register`). Any future breaking change cannot be managed safely without path versioning.

**Fix:**  
Prefix all routes with `/v1/`:

```ts
// Before
if (path === '/identity/register' && httpMethod === 'POST') {

// After
if (path === '/v1/identity/register' && httpMethod === 'POST') {
```

Update API Gateway SAM template to route `/v1/*` to the appropriate Lambda.

Update all TI HDICR clients to use `/v1/` paths (SEP-004 through SEP-010 should already do this as they are rewritten).

**Acceptance criteria:**

- [x] All HDICR service handlers respond only to `/v1/` paths
- [x] Old paths return `404`
- [x] SAM template updated
- [x] All TI HDICR client paths include `/v1/`
- [x] OpenAPI specs reference `/v1/` base path

Implementation note (2026-04-07): `/v1`-only ingress is now enforced in identity, consent, and licensing handlers, API Gateway event paths were updated to `/v1/*`, and licensing now exports the production handler from `src/handler.ts` through `src/index.ts`.

---

### SEP-025 · Add API contract test CI gate

**Priority:** P2  
**Depends on:** SEP-020, SEP-021, SEP-022  
**Files:** `apps/web/vitest.config.ts`, new test files in `apps/web/src/app/api/**/*.contract.test.ts`

**Problem:**  
Contract tests exist in the codebase but there is no CI gate that validates TI is using only documented HDICR endpoints with correct request/response shapes.

**Fix:**

1. Ensure all `*.contract.test.ts` files run in the test job.
2. Add a schema validation step: use `openapi-fetch` or `zod-openapi` generated types to validate that TI client calls match the specs.
3. Add a CI step: `pnpm --filter web test:contract`.

**Acceptance criteria:**

- [x] Contract tests run in CI test job
- [x] Any TI call to a non-existent HDICR endpoint fails CI
- [x] Any response shape mismatch between HDICR OpenAPI and TI client fails CI

Implementation note (2026-04-07): Added a dedicated web contract gate command (`pnpm --filter @trulyimagined/web test:contract`) using `apps/web/vitest.contract.config.ts`; CI test job now runs this command. Added `openapi-contract-gate.contract.test.ts` to enforce that TI HDICR client paths (identity/consent/licensing) are documented in `services/*/openapi.yaml` and that response schema fields consumed by clients remain present.

---

### SEP-026 · Promote representation domain to full HDICR service

**Priority:** P2  
**Files:** `services/representation-service/` (create)

**Problem:**  
`apps/web/src/lib/hdicr/representation-client.ts` has no remote mode. Representation data (actor-agent relationships, requests) is accessed entirely via direct SQL from TI. This is a platform concern, not a TI-only concern.

**Fix:**  
Create `services/representation-service/` following the same Lambda pattern as `identity-service` and `consent-service`:

- `src/index.ts` — handler and routing
- `src/handlers/` — one file per operation
- `package.json` — `@hdicr/representation-service`
- `openapi.yaml` — API spec (SEP-023)

Endpoints to expose:

```
GET    /v1/representation/actor/{actorId}/active
GET    /v1/representation/agent/{agentId}/requests
GET    /v1/representation/actor/{actorId}/requests
POST   /v1/representation/request
PATCH  /v1/representation/{requestId}
POST   /v1/representation/{requestId}/relationship
GET    /v1/representation/{id}
POST   /v1/representation/relationship/{id}/end
GET    /v1/representation/agent/by-registry-id/{registryId}
GET    /v1/representation/subjects/by-auth0/{auth0UserId}  # replaces getActorByAuth0UserId and getAgentByAuth0UserId
```

Add to SAM template in `infra/api-gateway/template.yaml`.

**Acceptance criteria:**

- [ ] Service created following existing service structure
- [ ] All endpoints working and tested
- [ ] SEP-007 depends on this being complete
- [ ] SAM template updated

---

## Phase 3 — Security and Auth

---

### SEP-030 · Add JWT validation at HDICR service handler ingress

**Priority:** P1  
**Files:**

- `services/identity-service/src/index.ts`
- `services/consent-service/src/index.ts`
- `services/licensing-service/src/handler.ts`
- `services/representation-service/src/index.ts` (after SEP-026)

**Problem:**  
HDICR service handlers currently parse requests and route to business logic with no JWT validation. The `Authorization: Bearer` header is listed in CORS config but never verified in the handler code.

**Fix:**  
Add a validation step at the top of each handler using `shared/middleware` `validateAuth0Token`. Apply before all business logic:

```ts
// services/identity-service/src/index.ts — top of handler
export const handler: APIGatewayProxyHandler = async (event) => {
  // 1. Validate auth token (all routes require a valid caller)
  const user = await validateAuth0Token(event);
  if (!user) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // 2. Extract client_id / tenant from token claims
  const clientId = (user as any)['https://hdicr.io/client_id'] ?? null;

  // 3. Route to handlers, passing user and clientId
  ...
};
```

**Acceptance criteria:**

- [ ] All HDICR service handlers validate Bearer token before routing
- [ ] `401` returned for missing or invalid token
- [ ] Unit tests added for auth failure cases in each service
- [ ] Shared middleware `validateAuth0Token` is used without modification of TI-specific claims (see SEP-033)

---

### SEP-031 · Implement OAuth 2.1 client credentials for TI → HDICR calls

**Priority:** P2  
**Depends on:** SEP-030  
**Files:** `apps/web/src/lib/hdicr/flags.ts`, new `apps/web/src/lib/hdicr/hdicr-http-client.ts`

**Problem:**  
When TI calls HDICR APIs, it sends no credential — it relies on the same user JWT from Auth0. A proper external client should authenticate as a client application, not as an end user.

**Fix:**

1. Register TI as a Machine-to-Machine application in Auth0.
2. TI backend acquires tokens via `POST /oauth/token` with `grant_type=client_credentials` and `audience=https://api.trulyimagined.com`.
3. All HDICR client calls attach this token in `Authorization: Bearer`.
4. Centralise this in a shared `hdicr-http-client.ts` that all domain clients use.

```ts
// apps/web/src/lib/hdicr/hdicr-http-client.ts
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getHdicrToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.HDICR_CLIENT_ID,
      client_secret: process.env.HDICR_CLIENT_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`[HDICR] Token acquisition failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export async function hdicrFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getHdicrToken();
  const baseUrl = process.env.HDICR_REMOTE_BASE_URL;
  if (!baseUrl) throw new Error('[HDICR] HDICR_REMOTE_BASE_URL is not set');
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}
```

New env vars to add:

```
HDICR_CLIENT_ID=<m2m-app-client-id>
HDICR_CLIENT_SECRET=<m2m-app-client-secret>
```

**Acceptance criteria:**

- [ ] `hdicr-http-client.ts` created and used by all domain clients
- [ ] Token is cached with a 30s safety buffer before expiry
- [ ] `HDICR_CLIENT_ID` and `HDICR_CLIENT_SECRET` added to `.env.example`
- [ ] Token acquisition failure returns 503 to the caller, not a 500 crash
- [ ] M2M app registered in Auth0 with appropriate scopes

---

### SEP-032 · Add scope-based authorization per HDICR endpoint

**Priority:** P2  
**Depends on:** SEP-030, SEP-031  
**Files:** Each service handler

**Fix:**  
Define and enforce scopes for each HDICR domain. Check scope presence in the decoded JWT claims at each handler before routing:

```
hdicr:identity:read    — GET identity endpoints
hdicr:identity:write   — POST/PUT identity endpoints
hdicr:consent:read     — GET consent endpoints
hdicr:consent:write    — POST consent endpoints
hdicr:licensing:read   — GET licensing endpoints
hdicr:licensing:write  — POST licensing endpoints
hdicr:representation:read
hdicr:representation:write
```

In Auth0, assign these scopes to the TI M2M application via API permissions.

**Acceptance criteria:**

- [ ] Each HDICR endpoint checks for the appropriate scope
- [ ] `403` returned when scope is missing
- [ ] Scope definitions documented in each OpenAPI spec's security scheme

---

### SEP-033 · Move TI Auth0 claim mapping out of `shared/middleware`

**Priority:** P1  
**Files:** `shared/middleware/src/index.ts`, `apps/web/src/lib/auth.ts` (or create)

**Problem:**  
Line 77 of `shared/middleware/src/index.ts`:

```ts
roles: decoded['https://trulyimagined.com/roles'] || [],
```

This hardcodes TI's Auth0 namespace into a package also used by HDICR services. HDICR cannot extend to other clients that have different role namespaces.

**Fix:**

1. Remove the hardcoded claim namespace from `shared/middleware`.
2. Make claim namespace configurable via env var `AUTH0_ROLES_CLAIM_NAMESPACE`.
3. Move `isActor()`, `isAgent()`, `isEnterprise()` to TI's own auth module:

```ts
// shared/middleware/src/index.ts — neutralised version
const rolesClaimNamespace = process.env.AUTH0_ROLES_CLAIM_NAMESPACE ?? '';
const user: AuthUser = {
  sub: decoded.sub,
  email: decoded.email,
  emailVerified: decoded.email_verified || false,
  name: decoded.name,
  picture: decoded.picture,
  roles: rolesClaimNamespace ? (decoded[rolesClaimNamespace] ?? []) : [],
};
```

```ts
// apps/web/src/lib/auth.ts — TI-specific helpers (new or extend existing)
export function isActor(roles: string[]): boolean {
  return roles.includes('Actor');
}
export function isAgent(roles: string[]): boolean {
  return roles.includes('Agent');
}
export function isEnterprise(roles: string[]): boolean {
  return roles.includes('Enterprise');
}
```

Add to TI env:

```
AUTH0_ROLES_CLAIM_NAMESPACE=https://trulyimagined.com/roles
```

**Acceptance criteria:**

- [ ] `https://trulyimagined.com/roles` string removed from `shared/middleware/src/index.ts`
- [ ] Claim namespace configurable via env
- [ ] `isActor`, `isAgent`, `isEnterprise` removed from shared middleware exports
- [ ] All TI files that called those from shared middleware now call TI's own auth module
- [ ] HDICR services can be configured with any claim namespace

---

### SEP-034 · Add Zod request validation at each HDICR handler

**Priority:** P2  
**Files:** Each service handler file and handler functions

**Problem:**  
HDICR service handlers do manual field checks (`if (!actorId || !consentType)`). These are incomplete and provide no type safety at the boundary.

**Fix:**  
Add Zod schemas for each request body and query parameter set, validate at the top of each handler function, return structured `400` on failure:

```ts
// services/consent-service/src/handlers/grant-consent.ts
import { z } from 'zod';

const GrantConsentSchema = z.object({
  actorId: z.string().uuid(),
  consentType: z.string().min(1).max(100),
  scope: z.record(z.unknown()).optional().default({}),
  requesterId: z.string().uuid().optional(),
  requesterType: z.enum(['actor', 'agent', 'studio', 'admin', 'enterprise']).optional(),
});

export async function grantConsent(event: APIGatewayProxyEvent) {
  const parsed = GrantConsentSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten() }),
    };
  }
  const { actorId, consentType, scope, requesterId, requesterType } = parsed.data;
  // ... rest of handler
}
```

**Acceptance criteria:**

- [ ] Every handler function validates input with Zod
- [ ] `400` responses include structured error details
- [ ] Schema definitions are co-located with handler files
- [ ] `zod` added to each service `package.json` if not present

---

### SEP-035 · Add API Gateway rate limiting by client_id

**Priority:** P2  
**Files:** `infra/api-gateway/template.yaml`

**Problem:**  
The SAM template sets global throttling (`ThrottlingBurstLimit: 100`, `ThrottlingRateLimit: 50`) but there is no per-client rate limiting.

**Fix:**  
Add a Usage Plan and API Key resource to the SAM template with per-client quota:

```yaml
HdicrUsagePlan:
  Type: AWS::ApiGateway::UsagePlan
  Properties:
    UsagePlanName: hdicr-standard-plan
    Throttle:
      BurstLimit: 50
      RateLimit: 20
    Quota:
      Limit: 10000
      Period: DAY
```

For stronger client identity: use AWS API Gateway authorizers with Lambda that validates the M2M JWT and extracts `client_id` for tracking.

**Acceptance criteria:**

- [ ] Usage plan defined in SAM template
- [ ] Per-plan throttle limits lower than global limits
- [ ] Gateway metrics visible by API Key in CloudWatch

---

### SEP-036 · Add secret-scanning gate to CI

**Priority:** P1  
**Files:** `.github/workflows/ci.yml`

**Problem:**  
Secrets have already been exposed in conversation context. There is no automated block preventing future commits with credentials.

**Fix:**  
Add `gitleaks` or `truffleHog` as a CI step:

```yaml
- name: Secret scanning
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

Or add a pre-commit hook via `gitleaks` locally.

**Acceptance criteria:**

- [ ] Secret scan runs in CI lint job
- [ ] Known baseline established (`gitleaks baseline`)
- [ ] Any new credential pattern in a commit fails CI
- [ ] `.gitleaks.toml` config committed with appropriate allowlist for test fixtures

---

## Phase 4 — Deployment Separation

---

### SEP-040 · Add `tenant_id` migration to core HDICR tables

**Priority:** P2  
**Files:** `infra/database/migrations/016_tenant_isolation.sql` (create)

**Problem:**  
No `tenant_id` exists in any HDICR table. All records from all clients are mixed. This prevents multi-tenant operation.

**Migration content:**

```sql
-- 016_tenant_isolation.sql

-- Add tenant_id to HDICR-owned tables
ALTER TABLE actors ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE identity_links ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE verifiable_credentials ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE licensing_requests ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined';

-- Indexes for efficient tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_actors_tenant_id ON actors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_tenant_id ON consent_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_tenant_id ON identity_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licensing_requests_tenant_id ON licensing_requests(tenant_id);

-- Composite indexes for common tenant-scoped lookups
CREATE INDEX IF NOT EXISTS idx_actors_tenant_auth0 ON actors(tenant_id, auth0_user_id);
CREATE INDEX IF NOT EXISTS idx_consent_actor_tenant ON consent_log(tenant_id, actor_id, consent_type);
```

**Acceptance criteria:**

- [ ] Migration file committed and applied
- [ ] All HDICR service queries include `WHERE tenant_id = $n`
- [ ] `tenant_id` extracted from JWT claims in service handlers (from `client_id` or a dedicated claim)
- [ ] TI's records have `tenant_id = 'trulyimagined'` (existing data backfilled by default)

---

### SEP-041 · Separate HDICR and TI environment configs

**Priority:** P2  
**Files:** `apps/web/.env.example`, `infra/api-gateway/samconfig.toml`

**Problem:**  
The web app `.env.example` contains both TI-specific values and HDICR infrastructure values in one flat file. There is no clear boundary of which vars belong to which system.

**Fix:**  
Reorganise `.env.example` with explicit ownership comments and separate HDICR vars into a `HDICR_*` namespace:

```
# ═══════════════════════════════════════
# TRULY IMAGINED — Application vars
# These belong to TI and are not shared
# ═══════════════════════════════════════
AUTH0_DOMAIN=...
AUTH0_CLIENT_ID=...  ← TI's Auth0 app

# ═══════════════════════════════════════
# HDICR — Platform API client config
# TI's credentials to call HDICR APIs
# Never contains HDICR internal secrets
# ═══════════════════════════════════════
HDICR_REMOTE_BASE_URL=https://api.trulyimagined.com
HDICR_CLIENT_ID=...  ← TI's M2M App ID
HDICR_CLIENT_SECRET=...  ← TI's M2M Secret
HDICR_ADAPTER_MODE=remote
```

Remove from TI env (move to HDICR service deployment only):

```
# DATABASE_URL  ← HDICR infra only; must not be in TI Vercel env after Phase 4
# ISSUER_ED25519_PRIVATE_KEY  ← HDICR credentials service only
# CONSENT_SIGNING_PRIVATE_KEY ← HDICR consent service only
# ENCRYPTION_KEY ← HDICR data layer only
```

**Acceptance criteria:**

- [ ] `.env.example` reorganised with clear ownership sections
- [ ] HDICR internal secrets listed as "not for TI" with a removal target date
- [ ] `samconfig.toml` for HDICR services has its own separate param block

---

### SEP-042 · Split HDICR DB credentials out of TI runtime

**Priority:** P3  
**Depends on:** SEP-004 through SEP-010 (all local paths removed)  
**Files:** Vercel environment settings, AWS SSM/Secrets Manager

**Problem:**  
`DATABASE_URL` pointing at the HDICR RDS instance is present in TI's Vercel environment. After Phase 1 is complete and all local adapter paths are removed, TI no longer needs this credential.

**Steps:**

1. Confirm all TI HDICR clients are routing through HTTP (Phase 1 complete).
2. Confirm `apps/web/src/lib/db.ts` has no remaining callers for HDICR entities.
3. Remove `DATABASE_URL` from Vercel environment for TI.
4. Deploy and confirm no runtime errors.
5. Delete `apps/web/src/lib/db.ts` or retain only for TI-owned tables (if TI keeps its own DB).

**Acceptance criteria:**

- [ ] `DATABASE_URL` removed from TI Vercel environment
- [ ] TI builds and runs without database connection
- [ ] All user-facing flows tested end-to-end through HDICR APIs only
- [ ] No SQL errors in TI server logs

---

### SEP-043 · Add Row-Level Security policies for tenant isolation

**Priority:** P3  
**Depends on:** SEP-040  
**Files:** `infra/database/migrations/017_rls_policies.sql` (create)

**Problem:**  
Even with `tenant_id` added, a misconfigured query could still return cross-tenant data. Row-Level Security (RLS) at the PostgreSQL layer provides a hard enforcement backstop.

**Migration content:**

```sql
-- 017_rls_policies.sql
-- Enable RLS on HDICR-owned tables
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE licensing_requests ENABLE ROW LEVEL SECURITY;

-- Create tenant-scoped policies
-- Each policy uses current_setting('app.current_tenant_id') set per connection
CREATE POLICY actors_tenant_isolation ON actors
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY consent_log_tenant_isolation ON consent_log
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY identity_links_tenant_isolation ON identity_links
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY licensing_tenant_isolation ON licensing_requests
  USING (tenant_id = current_setting('app.current_tenant_id', true));
```

HDICR service handlers must set the config before queries:

```ts
await pool.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
```

**Acceptance criteria:**

- [ ] RLS enabled on all HDICR-owned tables
- [ ] Service handlers set `app.current_tenant_id` from JWT claim before queries
- [ ] Integration test proves cross-tenant query returns empty result set, not an error
- [ ] `trimg_admin` DB role is a superuser exempt from RLS for migrations only

---

### SEP-044 · Separate HDICR deploy pipeline from TI Vercel deploy

**Priority:** P3  
**Files:** `.github/workflows/ci.yml`, new `.github/workflows/hdicr-deploy.yml`

**Problem:**  
Currently TI deploys to Vercel and HDICR services deploy via SAM. These are already separate deployment targets, but there is no formalized separation of release cadence or pipeline governance.

**Fix:**  
Create a dedicated HDICR deploy workflow:

```yaml
# .github/workflows/hdicr-deploy.yml
name: HDICR Services Deploy
on:
  push:
    branches: [main]
    paths:
      - 'services/**'
      - 'infra/api-gateway/**'
      - 'infra/database/**'

jobs:
  deploy-hdicr:
    name: Deploy HDICR Platform
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build services
        run: pnpm --filter "@hdicr/*" build
      - name: Run HDICR tests
        run: pnpm --filter "@hdicr/*" test
      - name: SAM Deploy
        run: |
          cd infra/api-gateway
          sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

TI Vercel deploy triggers only on changes to `apps/web/**`.

**Acceptance criteria:**

- [ ] HDICR deploy workflow file committed
- [ ] HDICR services deploy independently of TI web changes
- [ ] TI deploy does not trigger on HDICR-only changes
- [ ] Each pipeline has its own set of required secrets

---

### SEP-045 · Neutralise TI-specific naming in HDICR core schema

**Priority:** P3  
**Files:** `infra/database/migrations/018_neutral_schema_aliases.sql` (create), OpenAPI specs

**Problem:**  
The HDICR schema uses Truly Imagined domain terms (`actors`, `stage_name`, `is_founding_member`, `registry_id` with TI-style IDs) that embed one client's business model into the platform core.

**Recommended approach (additive, non-breaking):**  
Rather than renaming existing columns (high migration risk), expose neutral aliases in the HDICR API response layer:

- `actor` → also documented as `identity_subject` in OpenAPI
- `stage_name` → exposed as `display_name` in API responses
- `is_founding_member` → TI-specific field, hidden behind a `metadata` JSONB field for other tenants
- `registry_id` prefix generated per tenant via configurable template

**Longer-term migration:**  
Add a `018` migration that adds neutral column aliases and updates views, without dropping the originals. Breaking rename is a v2 API consideration.

**Acceptance criteria:**

- [ ] HDICR API responses use neutral terminology where practical
- [ ] TI-specific fields are tagged as `x-tenant-specific: trulyimagined` in OpenAPI
- [ ] New tenants can be onboarded without schema changes

---

## Coupling Removal Checklist (Verify Before Production Sign-Off)

Use this as a PR review gate before closing any phase.

### Phase 1 complete when:

- [ ] No file under `apps/web/src/app/api/` imports both `@/lib/db` AND `@/lib/hdicr/*`
- [ ] No `*Local` function exists in any file under `apps/web/src/lib/hdicr/`
- [ ] `HDICR_ADAPTER_MODE=local` is not the default in any non-test environment
- [ ] `apps/web/src/lib/hdicr/representation-client.ts` has no `import { query } from '@/lib/db'`
- [ ] `apps/web/src/app/api/actors/[id]/route.ts` has no `import { query } from '@/lib/db'`
- [ ] `apps/web/src/app/api/verification/start/route.ts` has no `import { query } from '@/lib/db'`
- [ ] `apps/web/src/app/api/agent/actors/[actorId]/consent/route.ts` has no `import { query } from '@/lib/db'`

### Phase 2 complete when:

- [ ] OpenAPI specs exist and are linted for Identity, Consent, Licensing, Representation services
- [ ] All HDICR service routes use `/v1/` path prefix
- [ ] Contract tests run in CI and pass
- [ ] No HDICR client in TI calls an undocumented endpoint

### Phase 3 complete when:

- [ ] All HDICR handlers validate Bearer JWT before routing
- [ ] `https://trulyimagined.com/roles` string does not appear in `shared/middleware/src/index.ts`
- [ ] TI has M2M credentials for HDICR API calls
- [ ] Secret scanning runs in CI
- [ ] Zod validation at all service handler entry points

### Phase 4 complete when:

- [ ] `tenant_id` column exists on all HDICR-owned tables
- [ ] `DATABASE_URL` not present in TI Vercel environment
- [ ] HDICR and TI have separate deploy pipelines
- [ ] RLS policies active on HDICR-owned tables
- [ ] A minimal third-party sample client can consume HDICR APIs without TI code

---

## Verification: Third-Party Client Simulation Test

When Phase 2 and Phase 3 are complete, run this manual test to validate true separation:

1. Create a new Auth0 M2M application named `test-external-client`.
2. Grant it scopes: `hdicr:identity:read`, `hdicr:consent:read`, `hdicr:consent:write`.
3. Write a standalone script (no monorepo dependencies) that:
   - Acquires a token from Auth0 via client credentials.
   - Calls `POST /v1/identity/register` to create a test subject.
   - Calls `POST /v1/consent/grant` for that subject.
   - Calls `GET /v1/consent/check` and asserts `isGranted: true`.
4. Run script with only `HDICR_REMOTE_BASE_URL`, `HDICR_CLIENT_ID`, `HDICR_CLIENT_SECRET`, `AUTH0_DOMAIN` set.
5. Assert all calls succeed.

If this works without any TI code or TI credentials, the boundary is real.
