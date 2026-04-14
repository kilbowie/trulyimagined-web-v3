# GitHub Copilot Prompt: Post-Extraction Audit & Fix Preparation

## Context

You have successfully completed repo separation (extraction of TI and HDICR from monorepo into separate GitHub repositories). This prompt audits the extraction quality, identifies any issues, and prepares fixes.

**Current State:**
- ✅ Monorepo split into two repos (TI + HDICR)
- ✅ Both repos pushed to GitHub
- ✅ Both repos have independent package structures
- ? Audit needed: Verify completeness, identify missing pieces, find integration gaps

**Your Role:**
You will audit both repos, identify issues, categorize them by severity, and prepare fixes before moving to Phase 6 deployment.

---

## EXTRACTION AUDIT CHECKLIST

### TI Repository Audit

#### File Structure & Build System
- [ ] **Root files present**:
  - [ ] `package.json` exists and is valid (run: `jq . package.json` | no errors)
  - [ ] `pnpm-workspace.yaml` exists with correct format
  - [ ] `tsconfig.json` exists and is valid
  - [ ] `.gitignore` exists and includes `.env`, `node_modules`, `.next`, `dist`
  - [ ] `vercel.json` exists (if Vercel-specific config needed)
  - [ ] `README.md` exists with setup instructions

- [ ] **Workspace structure correct**:
  - [ ] `apps/web/` directory exists (Next.js app)
  - [ ] `shared/types/` directory exists (shared TypeScript types)
  - [ ] `shared/utils/` directory exists (shared utilities)
  - [ ] No extra service directories (should only have web app)
  - [ ] No references to HDICR service directories

#### Dependencies & Lockfile
- [ ] **pnpm-lock.yaml is valid**:
  - [ ] File exists at repo root
  - [ ] Run: `pnpm install --frozen-lockfile` succeeds (no errors)
  - [ ] All dependencies resolve correctly
  - [ ] No unmet peer dependencies

- [ ] **Package.json correctness**:
  - [ ] Root workspace includes correct workspaces: `apps/*`, `shared/*`
  - [ ] All @trulyimagined/* imports are satisfied by local packages
  - [ ] No external dependencies on @trulyimagined/middleware (HDICR-only)
  - [ ] No external dependencies on @trulyimagined/database (HDICR-only)

#### Code Quality
- [ ] **TypeScript compilation**:
  - [ ] Run: `pnpm type-check` (should pass, no errors)
  - [ ] Run: `pnpm build` (should pass completely)
  - [ ] No stray references to HDICR services

- [ ] **HDICR Integration Layer**:
  - [ ] File exists: `apps/web/src/lib/hdicr/client.ts` (HTTP client)
  - [ ] File exists: `apps/web/src/lib/hdicr/openapi-contract-gate.contract.test.ts`
  - [ ] Contract gate test runs: `pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts`
  - [ ] Contract gate test PASSES (validates OpenAPI schemas)
  - [ ] Four HDICR service OpenAPI specs are referenced in contract gate:
    - [ ] `identity-service.openapi.yaml`
    - [ ] `consent-service.openapi.yaml`
    - [ ] `licensing-service.openapi.yaml`
    - [ ] `representation-service.openapi.yaml`

- [ ] **Environment Variables**:
  - [ ] `.env.example` or `.env.local.example` exists
  - [ ] Documents required vars: `HDICR_API_URL`, `AUTH0_*`, `TI_DATABASE_URL`
  - [ ] `.env.local` is in `.gitignore` (no secrets in repo)

#### Tests
- [ ] **Test suite**:
  - [ ] Run: `pnpm test` (if tests exist)
  - [ ] All tests pass
  - [ ] No tests reference HDICR services directly (only via HTTP client)

#### Git & GitHub
- [ ] **Git status**:
  - [ ] Run: `git status` (should be clean, no uncommitted changes)
  - [ ] No `.env` or secrets files in git history
  - [ ] Run: `git log --oneline | head -5` (shows meaningful commits)

- [ ] **GitHub configuration**:
  - [ ] Repo exists at: `https://github.com/kilbowie/trulyimagined`
  - [ ] Default branch is `main`
  - [ ] `main` branch is protected (requires PR review)
  - [ ] Branch includes all extraction commits

---

### HDICR Repository Audit

#### File Structure & Build System
- [ ] **Root files present**:
  - [ ] `package.json` exists and is valid
  - [ ] `pnpm-workspace.yaml` exists with correct format
  - [ ] `tsconfig.json` exists and is valid
  - [ ] `.gitignore` exists and includes `.env`, `node_modules`, `dist`, `.aws-sam`
  - [ ] `infra/template.yaml` exists (SAM template)
  - [ ] `README.md` exists with setup instructions

- [ ] **Workspace structure correct**:
  - [ ] `services/identity-service/` exists
  - [ ] `services/consent-service/` exists
  - [ ] `services/licensing-service/` exists
  - [ ] `services/representation-service/` exists
  - [ ] `shared/types/` directory exists
  - [ ] `shared/utils/` directory exists
  - [ ] `shared/middleware/` directory exists
  - [ ] `shared/database/` directory exists (Prisma schema, migrations)
  - [ ] `infra/` directory exists
  - [ ] No references to TI web app or Vercel-specific files

#### Dependencies & Lockfile
- [ ] **pnpm-lock.yaml is valid**:
  - [ ] File exists at repo root
  - [ ] Run: `pnpm install --no-frozen-lockfile` succeeds
  - [ ] All dependencies resolve correctly
  - [ ] No unmet peer dependencies
  - [ ] No TI-specific packages (like @next/*)

- [ ] **Package.json correctness**:
  - [ ] Root workspace includes: `services/*`, `shared/*`, `infra`
  - [ ] All @trulyimagined/* imports are satisfied by local packages
  - [ ] No external dependencies on Next.js, @vercel/*, or web frameworks
  - [ ] No TI app dependencies present

#### Code Quality
- [ ] **TypeScript compilation**:
  - [ ] Run: `pnpm type-check` (should pass)
  - [ ] Run: `pnpm build` (should pass completely)
  - [ ] No references to TI web app or Vercel

- [ ] **OpenAPI Specifications**:
  - [ ] Each service has OpenAPI spec:
    - [ ] `services/identity-service/openapi.yaml` exists and is valid
    - [ ] `services/consent-service/openapi.yaml` exists and is valid
    - [ ] `services/licensing-service/openapi.yaml` exists and is valid
    - [ ] `services/representation-service/openapi.yaml` exists and is valid
  - [ ] Specs can be validated: `openapi-cli validate <spec>` (if tool installed)
  - [ ] All endpoints documented in specs
  - [ ] Specs match actual Lambda handler routes

- [ ] **Database Setup**:
  - [ ] `shared/database/prisma/schema.prisma` exists
  - [ ] Database is configured for `trimg-db-v3` (HDICR database)
  - [ ] Migrations exist in `shared/database/prisma/migrations/`
  - [ ] Connection string uses environment variable: `DATABASE_URL`
  - [ ] SSL enforcement present in Prisma schema or connection string

- [ ] **Lambda Handlers**:
  - [ ] Each service has main handler file (e.g., `src/index.ts`)
  - [ ] Handlers export correct format for API Gateway integration
  - [ ] CORS headers set correctly in responses
  - [ ] Error handling includes proper HTTP status codes (401, 403, 500)
  - [ ] Correlation ID middleware applied to all routes

- [ ] **Auth Integration**:
  - [ ] `shared/middleware/auth.ts` exists and is used in all services
  - [ ] Auth0 audience is hardcoded or configurable: `https://hdicr.trulyimagined.com`
  - [ ] JWT validation happens before route handlers
  - [ ] Missing token returns 401 Unauthorized
  - [ ] Invalid/expired token returns 403 Forbidden

- [ ] **Environment Variables**:
  - [ ] `.env.example` exists documenting:
    - [ ] `HDICR_DATABASE_URL`
    - [ ] `AUTH0_DOMAIN`
    - [ ] `AUTH0_AUDIENCE`
    - [ ] `NODE_ENV`
  - [ ] `.env.local` is in `.gitignore`
  - [ ] SAM template references env vars as CloudFormation parameters

#### SAM Template Validation
- [ ] **Template structure**:
  - [ ] File: `infra/template.yaml` is valid YAML
  - [ ] Run: `sam validate -t infra/template.yaml` (should pass with no errors)
  - [ ] Template has `AWSTemplateFormatVersion: '2010-09-09'`
  - [ ] Contains `Transform: AWS::Serverless-2016-10-31`

- [ ] **Lambda Function Definition**:
  - [ ] Function defined in template with type: `AWS::Serverless::Function`
  - [ ] CodeUri points to correct service directory
  - [ ] Handler points to correct handler file
  - [ ] Runtime is `nodejs18.x` or `nodejs20.x`
  - [ ] Timeout is set (minimum 30 seconds for cold starts)
  - [ ] Memory is set (minimum 512 MB)
  - [ ] Environment variables section includes:
    - [ ] `HDICR_DATABASE_URL: !Ref HDICRDatabaseURL`
    - [ ] `AUTH0_DOMAIN: !Ref Auth0Domain`
    - [ ] `AUTH0_AUDIENCE: !Ref Auth0Audience`
    - [ ] `NODE_ENV: !Ref Environment`

- [ ] **API Gateway Configuration**:
  - [ ] Events section includes API Gateway trigger
  - [ ] CORS enabled with correct origins
  - [ ] Paths include all service routes
  - [ ] Custom domain name configured:
    - [ ] `DomainName: !Ref CustomDomainName`
    - [ ] `CertificateArn: !Ref CertificateArn`
    - [ ] `BasePath: ""`
    - [ ] `EndpointConfiguration: REGIONAL`
    - [ ] `SecurityPolicy: TLS_1_2`

- [ ] **Parameters Section**:
  - [ ] `HDICRDatabaseURL` parameter exists
    - [ ] Type: String
    - [ ] NoEcho: true
  - [ ] `Auth0Domain` parameter exists
  - [ ] `Auth0Audience` parameter exists (default: `https://hdicr.trulyimagined.com`)
  - [ ] `CertificateArn` parameter exists
  - [ ] `CustomDomainName` parameter exists (default: `hdicr.trulyimagined.com`)
  - [ ] `Environment` parameter exists (default: `production`)
  - [ ] `S3BucketName` parameter exists (for media uploads)

- [ ] **Outputs Section**:
  - [ ] Outputs include:
    - [ ] Lambda function ARN
    - [ ] API Gateway endpoint
    - [ ] Custom domain name

#### Tests
- [ ] **Test suite**:
  - [ ] Run: `pnpm test` (if tests exist)
  - [ ] All tests pass
  - [ ] Contract gate tests pass (validates against TI expectations)
  - [ ] No external dependencies on TI code

#### Git & GitHub
- [ ] **Git status**:
  - [ ] Run: `git status` (should be clean)
  - [ ] No `.env` or secrets in git history
  - [ ] Run: `git log --oneline | head -5` (shows meaningful commits)

- [ ] **GitHub configuration**:
  - [ ] Repo exists at: `https://github.com/kilbowie/hdicr`
  - [ ] Default branch is `main`
  - [ ] `main` branch is protected
  - [ ] Branch includes all extraction commits

---

### Cross-Repo Validation

#### Integration Points
- [ ] **OpenAPI Contract**:
  - [ ] TI contract gate references all four HDICR OpenAPI specs
  - [ ] Specs physically exist in HDICR repo
  - [ ] Specs are identical between TI expectations and HDICR reality
  - [ ] Any spec updates are coordinated between repos

- [ ] **URL Consistency** (CRITICAL):
  - [ ] Auth0 M2M audience: `https://hdicr.trulyimagined.com` (in HDICR)
  - [ ] TI HDICR_API_URL: `https://hdicr.trulyimagined.com` (in TI)
  - [ ] HDICR SAM CustomDomainName: `hdicr.trulyimagined.com` (in template)
  - [ ] All three match exactly (no drift)

- [ ] **No Cross-Repo Imports**:
  - [ ] TI does not import from HDICR services directly
  - [ ] HDICR does not import from TI code
  - [ ] Both repos have independent copies of `@trulyimagined/types`, `@trulyimagined/utils`
  - [ ] Search for cross-repo imports (should find none):
    - [ ] In TI: No imports from `../../../hdicr/`
    - [ ] In HDICR: No imports from `../../../trulyimagined/apps/`

- [ ] **Database Separation**:
  - [ ] TI uses `trimg-db-ti` (TI_DATABASE_URL)
  - [ ] HDICR uses `trimg-db-v3` (HDICR_DATABASE_URL)
  - [ ] Connection strings are different and separate
  - [ ] No cross-database queries

#### Communication Protocol
- [ ] **HTTP/REST Communication**:
  - [ ] TI calls HDICR over HTTPS (not direct database access)
  - [ ] TI uses Auth0 M2M for HDICR authentication
  - [ ] HDICR validates Auth0 tokens from TI
  - [ ] All requests include correlation IDs for tracing

---

## ISSUE CATEGORIZATION & FIXES

### Critical Issues (MUST FIX before Phase 6)

**If found:**
1. **Missing OpenAPI specs** in HDICR
   - Fix: Copy from monorepo or generate from handlers
   
2. **Contract gate test fails** in TI
   - Fix: Sync OpenAPI specs between repos or update contract

3. **Canonical URL drift** (different audiences/domains)
   - Fix: Ensure all three locations match exactly

4. **Cross-repo imports detected**
   - Fix: Remove and use HTTP communication instead

5. **SAM template validation fails**
   - Fix: Correct YAML syntax, parameter names, or structure

### High Priority Issues (FIX before Phase 6)

**If found:**
1. **Build or type-check fails** in either repo
   - Fix: Install missing dependencies, resolve import errors

2. **Test suite fails** (especially contract gate)
   - Fix: Update tests or sync specs

3. **Environment variable documentation missing**
   - Fix: Create `.env.example` files

4. **Database connection string incorrect**
   - Fix: Verify RDS endpoint and credentials

### Medium Priority Issues (CAN FIX during Phase 6)

**If found:**
1. **Missing README.md** in either repo
   - Fix: Create setup documentation

2. **Git history is messy** (many tiny commits)
   - Fix: Squash before Phase 6 if desired

3. **Incomplete comments** in configuration files
   - Fix: Add documentation

---

## AUDIT COMMANDS (For Your Use)

Run these commands in each repo to gather audit data:

### TI Repository

```bash
cd /path/to/trulyimagined

# Build & type check
pnpm install --no-frozen-lockfile
pnpm type-check
pnpm build
pnpm test --if-present

# Contract gate validation
pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts

# Git status
git status
git log --oneline | head -10

# Check for HDICR imports
grep -r "services/identity-service\|services/consent-service\|services/licensing-service\|services/representation-service" apps/ || echo "✅ No HDICR service imports found"

# Verify env vars documented
grep -l "HDICR_API_URL\|AUTH0" .env.* 2>/dev/null || echo "⚠️  No .env.example found"
```

### HDICR Repository

```bash
cd /path/to/hdicr

# Build & type check
pnpm install --no-frozen-lockfile
pnpm type-check
pnpm build
pnpm test --if-present

# SAM template validation
sam validate -t infra/template.yaml

# Git status
git status
git log --oneline | head -10

# Check for TI imports
grep -r "../../trulyimagined/apps/web\|@next/\|vercel" services/ shared/ infra/ || echo "✅ No TI web app imports found"

# Verify OpenAPI specs exist
ls -la services/*/openapi.yaml

# Check environment variables
grep -l "HDICR_DATABASE_URL\|AUTH0" .env.* 2>/dev/null || echo "⚠️  No .env.example found"
```

### Cross-Repo Validation

```bash
# Run in TI repo
grep -r "hdicr.trulyimagined.com" . --include="*.ts" --include="*.js" --include="*.json" || echo "Check HDICR_API_URL in .env"

# Run in HDICR repo
grep -r "https://hdicr.trulyimagined.com" . --include="*.ts" --include="*.yaml" || echo "Check Auth0 audience in template"

# Verify no shared bucket references
grep -r "trulyimagined-media" /path/to/hdicr/services/ || echo "✅ No S3 bucket ref needed in HDICR yet"
```

---

## DELIVERABLES AFTER AUDIT

Copilot will produce:

1. **Audit Summary**
   - Critical issues found (if any)
   - High priority issues found (if any)
   - Medium priority issues found (if any)
   - Green checks for all passing validations

2. **Issue Fixes** (for each issue)
   - Specific code changes required
   - File paths and line numbers
   - Exact commands to run

3. **Pre-Phase 6 Checklist**
   - All critical items MUST be done
   - All high priority items SHOULD be done
   - Ready for Phase 6 go/no-go decision

---

## NEXT STEPS AFTER AUDIT

### If All Issues Green ✅
→ Proceed directly to Phase 6 (Deployment)

### If Critical Issues Found 🔴
→ Apply fixes, re-test, then proceed to Phase 6

### If High Priority Issues Found 🟠
→ Apply fixes, re-test, then proceed to Phase 6

### If Only Medium Priority Issues 🟡
→ Can proceed to Phase 6, fix during deployment or post-deployment

---

## INSTRUCTIONS FOR YOU

1. **Copy this entire prompt**
2. **Open VS Code + GitHub Copilot Chat**
3. **Paste the prompt**
4. **Copilot will ask**:
   - Are you auditing TI, HDICR, or both?
   - Do you have specific repos to check?
   - Any known issues to investigate?
5. **You provide**:
   - "Audit both TI and HDICR"
   - Repo paths or GitHub URLs
   - Any specific concerns
6. **Copilot will**:
   - Run through the audit checklist
   - Identify issues
   - Provide fix recommendations
   - Give pre-Phase 6 readiness status

---

## CONFIRMATION

**This audit covers:**
- ✅ File structure & organization
- ✅ Build system & dependencies
- ✅ TypeScript compilation
- ✅ Tests & contract validation
- ✅ SAM template structure
- ✅ Environment variables
- ✅ Git status & GitHub config
- ✅ Cross-repo integration
- ✅ URL consistency
- ✅ No cross-repo coupling
- ✅ Database separation
- ✅ HTTP communication protocol

**Result:** Complete extraction quality assessment + prepared fixes for any issues found.

---

**Paste this prompt into Copilot now. You'll get a complete audit and be ready for Phase 6 deployment.** 🚀
