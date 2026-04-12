# SUPERSEDED DOCUMENT

This prompt is superseded for active implementation execution.

Use these files instead:
- `docs/PRE_DEPLOYMENT_VALIDATION/00-START-HERE.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md`
- `PRODUCTION_READINESS_PLAN.md`

Reason: this prompt includes conflicting assumptions (including deployment target/domain variants) and is retained only for historical reference.

---

# Complete HDICR & TI Implementation & Pre-Deployment Validation Prompt

## Paste this entire prompt into GitHub Copilot Chat in VS Code:

---

You are a senior infrastructure and backend engineer conducting a final pre-deployment validation of two microservices (HDICR and Truly Imagined/TI) that communicate via HTTP with Auth0 M2M authentication. Both services have been fully implemented with all critical and high-severity fixes and are ready to be validated before independent Vercel deployment.

**Current implementation status:**
- Auth0 M2M application created and configured with correct credentials
- Environment variables standardized across both services (AUTH0_M2M_*, HDICR_API_URL)
- TI no longer performs direct HDICR database reads (all via HTTP client with Bearer tokens)
- Database separation completed (HDICR_DATABASE_URL and TI_DATABASE_URL both configured)
- Token validation middleware returns correct HTTP status codes (401 vs 403)
- M2M token fetching includes 5-minute refresh buffer and 10-second timeouts
- HDICR service calls include 8-second timeouts and correlation IDs
- Both services are ready for independent Vercel deployment as separate services
- Repos are separated (or properly configured as monorepo with Vercel)

**I need you to systematically validate the complete implementation before we proceed to Vercel deployment. This is the final gate before going live. Please review:**

---

## 1. Code Isolation & Service Boundaries Validation

### 1.1 TI Service → HDICR Communication
- [ ] Verify TI has **zero** direct database queries to HDICR tables
  - Search for any remaining `queryHdicr` calls with direct SQL (not HTTP)
  - Confirm no imports of HDICR services in TI codebase
  - Search for any direct schema access: `SELECT FROM actors`, `FROM consent_ledger`, etc.
  - Flag any remaining cross-service direct database access
- [ ] Verify all HDICR data access in TI goes through HTTP client
  - Locate TI's HDICR HTTP client (e.g., `src/lib/hdicr/*`)
  - Confirm all requests include Bearer token in Authorization header
  - Confirm all requests target `HDICR_API_URL` environment variable (not hardcoded)
  - Confirm all requests include correlation ID header (X-Correlation-ID)
- [ ] Verify TI never instantiates or imports HDICR services
  - Representation-service, identity-service, consent-service should not be imported in TI
  - These services should only exist in HDICR deployment context

### 1.2 HDICR Service Database Access
- [ ] Verify all HDICR services query only `HDICR_DATABASE_URL`
  - No references to `TI_DATABASE_URL` in HDICR code
  - No fallback to legacy `DATABASE_URL`
  - Representation-service, identity-service, consent-service all use HDICR_DATABASE_URL
- [ ] Verify representation-service is HDICR-owned and queries HDICR schema
  - This service queries `FROM actors` and identity tables
  - Confirm it's deployed only as part of HDICR, not TI
  - Confirm TI accesses actor data via HTTP calls to representation-service, not direct queries

### 1.3 Schema Isolation
- [ ] Verify TI and HDICR have completely separate schemas
  - TI tables: user_profiles, support_tickets, licenses, contracts, marketplace_listings, etc.
  - HDICR tables: actors, identities, consent_ledger, registries, verifications, etc.
  - No overlapping table names or shared references
- [ ] Confirm no migrations create cross-service dependencies
  - Each service's migrations are independent
  - No foreign keys between HDICR and TI tables
  - Each service can be deployed/migrated independently

---

## 2. Environment Configuration Validation

### 2.1 Environment Variable Standardization
- [ ] Verify TI uses standardized environment variable names:
  - `AUTH0_M2M_CLIENT_ID` ✅ (not HDICR_CLIENT_ID)
  - `AUTH0_M2M_CLIENT_SECRET` ✅ (not HDICR_CLIENT_SECRET)
  - `AUTH0_M2M_AUDIENCE` ✅ (not HDICR_M2M_AUDIENCE)
  - `HDICR_API_URL` ✅ (not HDICR_REMOTE_BASE_URL)
  - `TI_DATABASE_URL` ✅ (for TI's database)
  - `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` ✅ (for user login)
- [ ] Verify HDICR uses correct environment variable names:
  - `HDICR_DATABASE_URL` ✅ (for HDICR's database)
  - `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` ✅ (for token validation)
  - `NODE_ENV` ✅ (development/staging/production)
- [ ] Verify no hardcoded values that should be environment variables
  - Auth0 domain must come from `AUTH0_DOMAIN` env var
  - API URLs must come from env vars (HDICR_API_URL, etc.)
  - Database connection strings must come from env vars
  - Flag any hardcoded strings that contain credentials, domains, or URLs
- [ ] Verify all required env vars are validated at startup
  - Consider using zod, t3-env, or similar validation
  - Services should fail fast if required vars are missing
  - Error messages should be clear about which var is missing

### 2.2 Vercel Environment Configuration
- [ ] Confirm two separate Vercel projects exist:
  - HDICR project (separate from TI)
  - TI project (separate from HDICR)
  - Each has its own Settings → Environment Variables section
- [ ] Verify HDICR Vercel project has all required environment variables set:
  - `HDICR_DATABASE_URL` = connection string to trimg-db-v3
  - `AUTH0_DOMAIN` = your Auth0 domain
  - `AUTH0_AUDIENCE` = https://hdicr.trulyimagined.com
  - `NODE_ENV` = production
- [ ] Verify TI Vercel project has all required environment variables set:
  - `TI_DATABASE_URL` = connection string to trimg-db-ti
  - `HDICR_API_URL` = https://hdicr.trulyimagined.com (or staging URL if applicable)
  - `AUTH0_M2M_CLIENT_ID` = M2M client ID (mark as Sensitive)
  - `AUTH0_M2M_CLIENT_SECRET` = M2M secret (mark as Sensitive ⚠️)
  - `AUTH0_M2M_AUDIENCE` = https://hdicr.trulyimagined.com
  - `AUTH0_DOMAIN` = your Auth0 domain
  - `AUTH0_CLIENT_ID` = TI user auth client ID
  - `AUTH0_CLIENT_SECRET` = TI user auth secret (mark as Sensitive ⚠️)
  - `NODE_ENV` = production
- [ ] Flag if any secrets are missing or marked incorrectly
  - All *_SECRET vars must be marked as Sensitive
  - If a var is not marked as Sensitive, it will be logged in build output
- [ ] Flag if environment variables are visible in git history
  - No `.env.production` files should be committed
  - No secrets should appear in any commit

---

## 3. Authentication & Authorization Validation

### 3.1 M2M Token Fetching (TI → Auth0)
- [ ] Locate the M2M token fetch implementation (likely `src/lib/hdicr/hdicr-http-client.ts`)
- [ ] Verify correct grant type and credentials:
  - Uses `grant_type: client_credentials` (not authorization_code)
  - Sends `client_id: AUTH0_M2M_CLIENT_ID` and `client_secret: AUTH0_M2M_CLIENT_SECRET`
  - Targets correct endpoint: `https://${AUTH0_DOMAIN}/oauth/token`
  - Requests correct audience: `audience: AUTH0_M2M_AUDIENCE`
- [ ] Verify request has proper timeout:
  - Uses AbortController or similar mechanism
  - Timeout is 10 seconds (not unlimited)
  - Timeout errors are caught and handled gracefully
- [ ] Verify token caching behavior:
  - Tokens are cached in memory (not re-fetched on every request)
  - Cache is refreshed when token is within 5 minutes of expiry
  - Cache key is correct (scope/audience specific if multiple audiences exist)
  - Expired tokens are discarded and fresh tokens are fetched
- [ ] Verify error handling:
  - Network errors (no connectivity) are caught and return 503 to caller
  - Auth0 errors (invalid credentials, wrong audience) are logged
  - Sensitive data (secrets, token contents) is never logged
  - Error messages are user-friendly, not exposing internals

### 3.2 M2M Token Usage in HDICR Calls (TI → HDICR)
- [ ] Verify every HDICR HTTP request includes Bearer token:
  - Authorization header format: `Authorization: Bearer ${access_token}`
  - Token is passed in header, not in URL or body
  - No Bearer prefix duplicated (not `Bearer Bearer ...`)
- [ ] Verify request construction is correct:
  - All HDICR requests target `${HDICR_API_URL}/...` (uses env var, not hardcoded)
  - Content-Type is `application/json`
  - Correlation ID is included in `X-Correlation-ID` header
- [ ] Verify error handling for different response codes:
  - 200: Success, parse and return response
  - 401: Unauthorized, likely stale token, retry with fresh token
  - 403: Forbidden, token is invalid/rejected, log error and return 403 to client
  - 404: Not found, log warning and return 404 (actor not found)
  - 5xx: Server error, log error and return 503 to client (fail-closed)
- [ ] Verify request timeout:
  - HDICR requests have 8-second timeout (AbortController)
  - Timeout errors return 503 (fail-closed)
  - Timeout doesn't break subsequent requests

### 3.3 Token Validation Middleware (HDICR)
- [ ] Locate the token validation middleware (likely `shared/middleware/src/index.ts`)
- [ ] Verify it extracts and validates Bearer tokens:
  - Extracts token from `Authorization: Bearer ...` header
  - Returns 401 if header is missing
  - Returns 403 if token is invalid/expired/wrong audience
- [ ] Verify JWT validation is correct:
  - Uses Auth0 JWKS (JSON Web Key Set) to validate signature
  - Validates `exp` claim (expiry) — rejects expired tokens
  - Validates `aud` claim (audience) — rejects tokens with wrong audience
  - Validates `iss` claim (issuer) — rejects tokens from wrong Auth0 tenant
- [ ] Verify middleware is applied globally:
  - Applied to ALL HDICR routes (not just specific ones)
  - Applied before route handlers execute
  - Errors in validation are caught and return proper HTTP status
- [ ] Verify error responses don't expose secrets:
  - Error messages don't include token contents
  - Error messages don't include Auth0 secrets
  - Error responses are consistent format (easy to debug)

### 3.4 Correlation ID Propagation
- [ ] Verify correlation IDs are generated and propagated:
  - TI generates correlation ID (UUID) for each request
  - TI includes correlation ID in `X-Correlation-ID` header on HDICR request
  - HDICR extracts correlation ID from header
  - Both TI and HDICR include correlation ID in all logs
- [ ] Verify logs can be traced end-to-end:
  - Given a correlation ID, you can find all logs (TI + HDICR) for that request
  - Timestamp and correlation ID make it easy to trace problems across services

---

## 4. HTTP Communication & Error Handling

### 4.1 Request/Response Structure
- [ ] Verify TI → HDICR requests are well-formed:
  - Example: `GET https://hdicr.trulyimagined.com/api/representation/actor-by-auth0/abc123`
  - Headers: `Authorization: Bearer eyJhbGc...`, `X-Correlation-ID: uuid`, `Content-Type: application/json`
  - No extraneous headers or malformed requests
- [ ] Verify HDICR responses are well-formed:
  - 200 responses: Valid JSON with expected actor/identity/consent data
  - 401 responses: JSON with error message, no token contents
  - 403 responses: JSON with error message
  - 404 responses: JSON with error message
  - 5xx responses: JSON with error message, no stack traces exposed
- [ ] Verify TI response handling:
  - Parses JSON responses correctly
  - Validates response shape matches expected contract (optional but recommended)
  - Handles unexpected fields gracefully
  - Handles missing required fields as errors

### 4.2 Fail-Closed Behavior
- [ ] Verify TI uses fail-closed strategy:
  - Network errors → return 503 (don't return partial/cached data)
  - Token fetch failures → return 503 (don't use stale token)
  - HDICR unavailability → return 503 (graceful degradation)
  - No fallbacks that expose stale/incomplete data to clients
- [ ] Verify error logging includes context:
  - Timestamp
  - Correlation ID
  - Error message
  - Service (TI or HDICR)
  - Relevant context (URL, status code, etc.)
  - NOT: full token contents, secrets, or PII

---

## 5. Database Configuration

### 5.1 Connection String & Pool Configuration
- [ ] Verify TI uses TI_DATABASE_URL:
  - All database connections in TI use `process.env.TI_DATABASE_URL`
  - No fallback to `DATABASE_URL` or `HDICR_DATABASE_URL`
  - Connection string includes SSL/TLS requirement (`?sslmode=require`)
- [ ] Verify HDICR uses HDICR_DATABASE_URL:
  - All database connections in HDICR use `process.env.HDICR_DATABASE_URL`
  - All HDICR services use the same database URL
  - Connection string includes SSL/TLS requirement
- [ ] Verify connection pool is appropriate for Vercel:
  - Pool size is 5-20 (serverless environments need smaller pools)
  - Connection timeout is reasonable (5-10 seconds)
  - Idle timeout is set (connections are recycled)
  - Max connections per host is limited

### 5.2 Schema Separation
- [ ] Verify TI schema is completely separate:
  - TI tables: user_profiles, support_tickets, licenses, contracts, marketplace_listings, etc.
  - HDICR tables: actors, identities, consent_ledger, registries, verifications, etc.
  - No overlapping table names
- [ ] Verify migrations are independent:
  - Each service has its own migrations directory
  - Migrations can be applied independently
  - No cross-service foreign keys or references

### 5.3 RDS Instance Configuration
- [ ] Verify two RDS instances exist and are configured:
  - Instance 1: `trimg-db-v3` for HDICR
  - Instance 2: `trimg-db-ti` for TI
  - Both are PostgreSQL 15+ with appropriate instance size
- [ ] Verify security is configured on both instances:
  - Storage encryption is enabled ✅ (you flagged this as previously missing)
  - `rds.force_ssl = 1` is set (SSL/TLS is enforced)
  - VPC security group restricts access (not publicly accessible in production)
  - Separate database users for HDICR and TI (optional but recommended)
- [ ] Verify backups and availability:
  - Automated backups are enabled
  - Backup retention is at least 7 days
  - Multi-AZ is enabled if production (for HA)
  - RDS cluster/failover is configured if needed

---

## 6. Vercel Deployment Configuration

### 6.1 HDICR Vercel Project
- [ ] Verify project settings:
  - Repository: Separate HDICR repo (not part of TI monorepo, or properly isolated)
  - Framework: Next.js (or Node.js depending on your setup)
  - Build command: `npm run build` (or your build script)
  - Output directory: `.next` (or your build output)
  - Node.js version: 18+ (as per modern standards)
- [ ] Verify environment variables are set (not in repo):
  - `HDICR_DATABASE_URL` ✅
  - `AUTH0_DOMAIN` ✅
  - `AUTH0_AUDIENCE` ✅
  - `NODE_ENV` = production ✅
  - No secrets in git history
- [ ] Verify custom domain:
  - `hdicr.trulyimagined.com` points to HDICR Vercel project
  - HTTPS is enabled
  - DNS is configured correctly (A or CNAME record)
- [ ] Verify deployment hooks (optional but useful):
  - Automatic deployments on git push (enabled)
  - Preview deployments for PRs (enabled)
  - Production deployments on main/develop branch (configured)

### 6.2 TI Vercel Project
- [ ] Verify project settings:
  - Repository: Separate TI repo (not part of HDICR)
  - Framework: Next.js (or Node.js)
  - Build command: `npm run build`
  - Output directory: `.next`
  - Node.js version: 18+
- [ ] Verify environment variables are set (not in repo):
  - `TI_DATABASE_URL` ✅
  - `HDICR_API_URL` ✅
  - `AUTH0_M2M_CLIENT_ID` ✅ (marked as Sensitive)
  - `AUTH0_M2M_CLIENT_SECRET` ✅ (marked as Sensitive)
  - `AUTH0_M2M_AUDIENCE` ✅
  - `AUTH0_DOMAIN` ✅
  - `AUTH0_CLIENT_ID` ✅
  - `AUTH0_CLIENT_SECRET` ✅ (marked as Sensitive)
  - `NODE_ENV` = production ✅
  - No secrets in git history
- [ ] Verify custom domain:
  - `trulyimagined.com` points to TI Vercel project
  - HTTPS is enabled
  - DNS is configured correctly
- [ ] Verify preview deployments:
  - Preview URLs work
  - Environment variables are correctly set for preview (optional but useful)

### 6.3 Repository Separation
- [ ] Verify repos are actually separate:
  - `git remote -v` shows different origins
  - No monorepo structure (or monorepo is properly configured)
  - Each repo has its own `package.json`, migrations, configs, README
- [ ] Verify .gitignore is correct:
  - `.env.local` is never committed
  - `.env*.production` is never committed
  - `.env` template is documented (e.g., `.env.example`)
  - No secrets appear in git history: `git log -p | grep -i secret` returns nothing
- [ ] Verify documentation:
  - README.md exists for both services
  - Setup instructions are clear
  - Deployment instructions are clear
  - Environment variables are documented

---

## 7. Local Development Environment

### 7.1 Development Setup
- [ ] Verify both services can run locally:
  - HDICR: `npm run dev` → listens on http://localhost:4001
  - TI: `npm run dev` → listens on http://localhost:3000
  - Both read from correct `.env.local` files
  - Both connect to correct databases (local or AWS)
- [ ] Verify development environment variables:
  - `.env.local` files exist for both services
  - Files are in `.gitignore` (never committed)
  - Files contain localhost URLs and development credentials
  - Auth0 is configured for localhost redirect URIs

### 7.2 Local End-to-End Testing
- [ ] Verify you can test complete flow locally:
  1. Start HDICR: `npm run dev` in hdicr directory
  2. Start TI: `npm run dev` in ti directory
  3. Log in to TI at http://localhost:3000
  4. Navigate to dashboard
  5. TI calls HDICR API successfully
  6. Actor data is displayed
  7. No database errors, no schema mismatches, no auth failures
- [ ] Verify logs show correct flow:
  - TI logs: token fetch from Auth0, HDICR API call, correlation ID
  - HDICR logs: token validation, actor query, response
  - No sensitive data in logs (no secrets, no full tokens)
- [ ] Verify error scenarios work:
  - Stop HDICR → TI dashboard shows graceful error (503)
  - Corrupt M2M credentials → token fetch fails, TI handles gracefully
  - Stop TI database → TI shows database error
  - Services recover correctly when dependencies restart

---

## 8. Security Review

### 8.1 Secrets Management
- [ ] Verify no secrets are hardcoded in source:
  - Search: `grep -r "AUTH0" apps/web/src` → should find only env var references
  - Search: `grep -r "secret" apps/web/src` → should find no hardcoded values
  - Search: `grep -r "password" apps/web/src` → should find no hardcoded values
- [ ] Verify all secrets are in Vercel:
  - Secrets marked as "Sensitive" in Vercel dashboard
  - Secrets are not printed in build logs
  - Secrets are available at runtime
- [ ] Verify `.env` files are correct:
  - `.env.local` is in `.gitignore` ✅
  - `.env.production` does not exist in repo (only in Vercel) ✅
  - `.env.example` shows template without actual values ✅

### 8.2 API Security
- [ ] Verify HDICR requires authentication:
  - All endpoints have token validation middleware
  - No endpoints bypass authentication
  - Missing token returns 401
  - Invalid token returns 403
- [ ] Verify M2M scopes are enforced (if implemented):
  - TI M2M app only has scopes it needs (least privilege)
  - Scopes are checked before allowing operations (optional but recommended)
- [ ] Verify CORS is properly configured:
  - HDICR allows requests from `trulyimagined.com` domain only
  - CORS doesn't use wildcard `*` (too permissive)
  - Preflight requests are handled correctly

### 8.3 Data Protection
- [ ] Verify encryption in transit:
  - All TI ↔ HDICR calls use HTTPS (Vercel enforces this)
  - Database connections use SSL/TLS (`sslmode=require`)
  - No plaintext connections
- [ ] Verify encryption at rest:
  - RDS storage encryption is enabled on both instances ✅
  - Database backups are encrypted
- [ ] Verify sensitive data handling:
  - Actor identity data is only readable by authenticated services
  - Consent data is only readable by authenticated services
  - License/contract data is only readable by authenticated services
  - API responses don't expose unnecessary data (only what's needed)

---

## 9. Monitoring & Observability

### 9.1 Logging
- [ ] Verify both services log requests:
  - Timestamp, method, path, status code, response time
  - Correlation ID on every log entry
  - Environment (development/staging/production)
- [ ] Verify errors are logged with context:
  - Error message
  - Stack trace (for non-user errors)
  - Correlation ID (for tracing)
  - Request context (URL, headers, etc.)
- [ ] Verify sensitive data is never logged:
  - Full tokens never logged
  - Bearer prefix logged but token contents omitted
  - Database passwords never logged
  - User PII is minimal (auth0_user_id OK, email/name maybe not)

### 9.2 Performance Monitoring
- [ ] Consider adding latency tracking for:
  - TI → Auth0 token fetch (should be <500ms, typically cached)
  - TI → HDICR API call (should be <1s)
  - HDICR → Database query (should be <100ms)
  - P99 latencies are important (not just average)
- [ ] Consider adding error rate tracking:
  - M2M auth failures per hour
  - HDICR unavailability per hour
  - Database connection errors per hour
  - API errors by status code

### 9.3 Alerting (Optional for v1, but recommended)
- [ ] Errors > threshold (e.g., >1% error rate) trigger alert
- [ ] HDICR unavailability for >5 minutes triggers alert
- [ ] Database connection pool exhaustion triggers alert

---

## 10. Pre-Deployment Checklist

### 10.1 Code Quality
- [ ] All tests pass:
  - `npm run test` passes for both HDICR and TI
  - No console.error during normal operation
  - No TypeScript errors (strict mode)
- [ ] Code review complete:
  - All critical/high fixes are implemented ✅
  - No obvious bugs or anti-patterns
  - Codebase is ready for production
- [ ] Git history is clean:
  - No secrets in any commit
  - No debug code left in
  - No `console.log` statements (except for structured logging)

### 10.2 Infrastructure Readiness
- [ ] Vercel projects are created and configured:
  - HDICR project with correct settings and env vars ✅
  - TI project with correct settings and env vars ✅
  - Custom domains configured and DNS pointing correctly ✅
- [ ] Databases are ready:
  - `trimg-db-v3` exists with HDICR schema ✅
  - `trimg-db-ti` exists with TI schema ✅
  - Both have encryption enabled ✅
  - Both have SSL/TLS enforced ✅
- [ ] Auth0 is configured:
  - M2M application exists with correct scopes ✅
  - HDICR API exists in Auth0 ✅
  - TI Auth0 app has correct redirect URIs for production ✅

### 10.3 Documentation
- [ ] README.md for both services includes:
  - Local setup instructions
  - Required environment variables (with descriptions)
  - How to deploy to Vercel
  - How to troubleshoot common issues
- [ ] Architecture documentation exists:
  - Shows HDICR and TI as separate services
  - Shows M2M auth flow
  - Shows database separation
  - Shows deployment topology
- [ ] Runbook exists for operations:
  - How to check service health
  - How to debug M2M auth failures
  - How to check HDICR availability from TI
  - How to check database connectivity
  - How to view logs in Vercel

---

## 11. Final Assessment & GO/NO-GO Decision

### Summary Section
After all checks, provide:
1. **What's working correctly** — list all successful validations
2. **Issues found** — categorize by severity:
   - **CRITICAL** (blocks deployment, must fix)
   - **HIGH** (should fix before deployment)
   - **MEDIUM** (can fix after deployment)
   - **LOW** (nice to have)
3. **Specific recommendations** — for each issue, describe the fix
4. **Re-validation timeline** — how long to fix critical/high issues

### GO / NO-GO Decision

- **GO**: All critical and high issues are resolved, all checks pass
  - Proceed to Vercel deployment
  - Both services are ready for production
  - You can confidently press "Deploy" in Vercel

- **NO-GO**: Critical or High issues exist
  - Do NOT proceed to deployment
  - Fix the listed issues
  - Re-run this validation prompt after fixes
  - Then provide an updated GO/NO-GO

- **CONDITIONAL GO**: Only Medium/Low issues exist
  - You can deploy now
  - Fix medium/low issues in parallel after deployment
  - Monitor logs during and after deployment

---

## Post-Validation Deployment Steps (if GO decision)

Once Copilot confirms GO:

1. **Final sanity check locally**:
   ```bash
   # Start HDICR
   cd hdicr && npm run dev
   
   # Start TI (in another terminal)
   cd ti && npm run dev
   
   # Test in browser
   http://localhost:3000 → log in → dashboard → should show actor data
   ```

2. **Deploy to Vercel**:
   ```bash
   # Push to main/production branch
   git push origin main
   
   # Vercel automatically deploys
   # Monitor deployment in Vercel dashboard
   ```

3. **Test production after deployment**:
   - Log in to https://trulyimagined.com
   - Navigate to dashboard
   - Verify actor data loads
   - Check Vercel logs for errors

4. **Monitor for 24 hours**:
   - Watch error rates
   - Monitor response latencies
   - Check auth flow works end-to-end
   - Be ready to roll back if issues appear

---

## If Copilot Asks Clarifying Questions

Be ready to answer:
- "Is HDICR deployed to Vercel already?" → Not yet, both need to be deployed
- "Are there two separate repos?" → Yes (or: monorepo with separate deployments)
- "What framework are you using?" → Next.js (or specify)
- "Are both services running locally right now?" → Yes / Can be started
- "What's your Auth0 setup?" → Single tenant, M2M app configured, both user apps configured
- "Have all critical fixes been implemented?" → Yes (or: list what's still in progress)
