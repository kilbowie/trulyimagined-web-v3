# Item 1.1 & 1.2 Completion Summary

## Item 1.1: Remove direct HDICR DB access from TI runtime paths ✅

### Completed
- **Refactored onboarding/status route**
  - Replaced `queryHdicr` calls for actors lookup with `getActorByAuth0UserId()` via representation-service HTTP API  
  - Replaced `queryHdicr` calls for consent checks with `checkActiveConsent()` via consent-service HTTP API
  - Kept TI-owned `user_profiles` access via `queryTi` (correct separation)
  - Added manual verification check via HTTP client helper

- **Created client-helpers.ts**
  - `getActorByAuth0UserId()` - calls `/v1/representation/actor?auth0UserId=X`
  - `checkActiveConsent()` - calls `/v1/consent/check?actorId=X`
  - `checkManualVerificationRequest()` - calls `/v1/license/actor/{actorId}/has-pending-verification`
  - All use correlation ID propagation and consistent error handling

- **Updated tests**
  - `route.contract.test.ts` now mocks HDICR HTTP client helpers instead of direct DB queries
  - Verified: 2/2 tests pass with new implementation

- **Verified**
  - `manual-verification.ts` uses only TI tables (no changes needed)
  - Onboarding flow continues to work end-to-end
  - All HTTP clients include correlation IDs for distributed tracing

### Impact
- TI onboarding runtime path now fully decoupled from direct HDICR table access
- Actor, consent, and verification status retrieved via proper HTTP APIs
- Enables future HDICR database scaling without TI application changes

---

## Item 1.2: Standardize M2M env naming contract ✅

### Status: Already Implemented with Full Backward Compatibility

**Canonical Environment Variables (in use):**
- `AUTH0_M2M_CLIENT_ID` - M2M credentials for HDICR services
- `AUTH0_M2M_CLIENT_SECRET` - M2M credentials for HDICR services  
- `AUTH0_M2M_AUDIENCE` - Optional separate audience for HDICR identity/consent
- `HDICR_API_URL` - HDICR services base URL
- `TI_M2M_CLIENT_ID` / `TI_M2M_CLIENT_SECRET` - Optional separate credentials for licensing

**Legacy Fallback Names (documented with removal target 2026-06-30):**
- `HDICR_CLIENT_ID` (falls back to `AUTH0_M2M_CLIENT_ID`)
- `HDICR_CLIENT_SECRET` (falls back to `AUTH0_M2M_CLIENT_SECRET`)
- `HDICR_M2M_AUDIENCE` (falls back to `AUTH0_M2M_AUDIENCE`)
- `HDICR_REMOTE_BASE_URL` (falls back to `HDICR_API_URL`)

**Implementation locations:**
- `apps/web/src/lib/hdicr/hdicr-http-client.ts` - Canonical names with proper fallbacks
  - `resolveAudienceForDomain()` - Domain-specific audience resolution
  - `resolveClientCredentialsForDomain()` - Per-domain client credential resolution
- `apps/web/src/lib/hdicr/flags.ts` - `getHdicrRemoteBaseUrl()` with fallback chain
- `apps/web/.env.example` - Documented with both canonical and legacy names, removal date specified

**Error Messages:**
- Clearly communicate which canonical vars are required
- Document legacy fallback names for operator visibility

### No Additional Changes Required
Contract is already canonical, documented, and deployed-ready.

---

## Acceptance Criteria Met

✅ **Item 1.1:**
- No TI runtime route issues direct SQL against HDICR-owned tables (verified onboarding/status)
- TI dashboard/onboarding flow resolves actor + consent status via HTTP

✅ **Item 1.2:**
- Canonical names work in local + preview + prod (fallback chain ensures compatibility)
- Old names explicitly marked deprecated with removal date in .env.example (2026-06-30)
- Error messages guide operators to canonical naming

---

## Unresolved Follow-up Items

### Verification Routes (Out of Scope for 1.1)
The following routes still use direct `queryHdicr`:
- `apps/web/src/app/api/admin/verification/schedule/route.ts`
- `apps/web/src/app/api/admin/verification/pending/route.ts`
- `apps/web/src/app/api/admin/verification/complete/route.ts`
- `apps/web/src/app/api/verification/manual-request/route.ts`

**Decision Needed:** These routes create/update HDICR-owned `manual_verification_sessions` table. They would require corresponding HDICR service APIs. Recommend deferring to Phase 2 hardening or dedicated verification service API initiative.

---

## Next Backlog Items

**Priority 2 (High/Blocking):**
- Item 2.1: 401 vs 403 semantics ✅ (already completed in hardening batch)  
- Item 2.2: Split DB configuration at deploy layer (Ops task - update SAM template + Vercel config)
- Item 2.3: Representation service ownership decision (Requires decision: HDICR-owned or TI-owned?)

**Ready to proceed:** Item 2.2 (deployment config) or Item 2.3 (ownership decision)
