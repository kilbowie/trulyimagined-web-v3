# GitHub Copilot Prompt: TI + HDICR Extraction & Deployment Implementation Review

## READY STATE CONFIRMATION

**Certificate Status**: ✅ **ISSUED**  
**Certificate ARN**: `arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9`  
**Domains**: `*.trulyimagined.com` (wildcard) + `trulyimagined.com` (apex)  
**Validation**: Both domains validated (Success status)  
**Date**: April 12, 2026

---

## Your Role

You are reviewing a **production-grade extraction and deployment plan** for two microservices:
- **TI** (Next.js web app) → Vercel → `https://trulyimagined.com`
- **HDICR** (Node.js/Lambda service) → AWS Lambda/SAM → `https://hdicr.trulyimagined.com`

This extraction is being performed by a solo founder (Adam Greene) who has:
- ✅ Completed dry-run validations (both services build/test clean)
- ✅ Prepared two empty target GitHub repositories
- ✅ Created and validated AWS ACM wildcard certificate
- ✅ Prepared S3 bucket for SAM artifacts
- ✅ Documented detailed extraction checklist with phases 0-7

**Your job**: Final review to confirm the plan is executable and safe before implementation begins.

---

## LOCKED ARCHITECTURAL DECISIONS

### Repositories (Separate, Independent)
```
GitHub Org: kilbowie
├─ trulyimagined-web (TI web app)
│  └─ Remote: https://github.com/kilbowie/trulyimagined.git
│  └─ Default branch: main
│  └─ Status: Empty (greenfield)
│
└─ hdicr-service (HDICR Lambda service)
   └─ Remote: https://github.com/kilbowie/hdicr.git
   └─ Default branch: main
   └─ Status: Empty (greenfield)
```

### Deployment Targets
```
TI Web App
├─ Platform: Vercel
├─ Domain: https://trulyimagined.com
├─ HTTPS: Automatic
├─ Preview deployments: Enabled
└─ Environment variables: Vercel secrets

HDICR Service
├─ Platform: AWS Lambda + API Gateway
├─ Domain: https://hdicr.trulyimagined.com
├─ HTTPS: ACM wildcard certificate (ISSUED)
├─ SAM template: infra/template.yaml
├─ S3 artifacts bucket: hdicr-sam-artifacts-<timestamp>
└─ Environment variables: CloudFormation parameters
```

### Authentication (Auth0)
```
M2M Application (TI → HDICR)
├─ Audience: https://hdicr.trulyimagined.com ✅ LOCKED
├─ Credentials: Stored securely (not in git)
├─ Scopes: read:actors, read:identities, read:consent
└─ Status: Validated and working

User Auth App (Login)
├─ Callback URL: https://trulyimagined.com/api/auth/callback
├─ Logout URL: https://trulyimagined.com
└─ Status: Configured
```

### Databases (RDS - Separate Instances)
```
TI Database
├─ Instance: trimg-db-ti
├─ Engine: PostgreSQL 15.10
├─ Connection: TI_DATABASE_URL env var
└─ Encryption: ✅ Enabled

HDICR Database
├─ Instance: trimg-db-v3
├─ Engine: PostgreSQL 15.10
├─ Connection: HDICR_DATABASE_URL env var
└─ Encryption: ✅ Enabled
```

### AWS Certificate (ISSUED)
```
Wildcard Certificate Details
├─ ARN: arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9
├─ Primary domain: *.trulyimagined.com ✅ Success
├─ Secondary domain: trulyimagined.com ✅ Success
├─ Key algorithm: RSA 2048
├─ Export: Disabled (stays in AWS ACM vault)
├─ Region: eu-west-1 (matches SAM deploy region)
└─ Status: Ready for API Gateway custom domain
```

### DNS Configuration (Ready)
```
Current State
├─ CNAME validation records: ✅ Added (both domains validated)
└─ CNAME routing record: Pending (added AFTER SAM deploy)

After SAM Deployment
├─ Add: CNAME record for hdicr subdomain
│  ├─ Name: hdicr
│  ├─ Type: CNAME
│  ├─ Value: d-xxxxx.execute-api.eu-west-1.amazonaws.com
│  └─ (Value provided by SAM output)
└─ TTL: 3600 seconds
```

---

## EXTRACTION PLAN OVERVIEW

### Phase 0: Preflight Lock (Blocking)
**Status**: Ready to execute  
**Duration**: 5 minutes  
**Tasks**:
- [ ] Confirm monorepo `git status` is clean
- [ ] Confirm rollback tag `pre-split-monorepo-2026-04-12` exists
- [ ] Confirm target local directories are empty
- [ ] Confirm GitHub remotes are reachable and empty
- [ ] Create runlog directory: `/runlogs/20260412-real-extraction/`

**Exit criteria**: All preflight checks pass, evidence log initialized

---

### Phase 1: Anchor Branch Prep (Parallel)
**Status**: Ready to execute  
**Duration**: 5 minutes  
**Tasks**:

**TI Branch:**
- [ ] Create branch: `git checkout -b extract/ti-split-20260412 pre-split-monorepo-2026-04-12`
- [ ] Verify branch points to rollback tag

**HDICR Branch:**
- [ ] Create branch: `git checkout -b extract/hdicr-split-20260412 pre-split-monorepo-2026-04-12`
- [ ] Verify branch points to rollback tag

**Exit criteria**: Both extraction branches created and verified

---

### Phase 2: TI Extraction (Depends: Phase 1 TI branch)
**Status**: Ready to execute  
**Duration**: 30 minutes  
**Tasks**:

**Copy Phase**:
- [ ] Copy all TI paths from REAL-EXTRACTION-COPY-MAP.md exactly
- [ ] Verify no extra files (no services/*/* except openapi.yaml)
- [ ] Create root workspace files:
  - [ ] `package.json` (monorepo root)
  - [ ] `pnpm-workspace.yaml`
  - [ ] `tsconfig.json`
  - [ ] `.gitignore`
  - [ ] `vercel.json`

**Bootstrap Phase** (exact order):
```
1. pnpm install --no-frozen-lockfile
2. pnpm --filter @trulyimagined/types build
3. pnpm --filter @trulyimagined/utils build
4. pnpm type-check
5. pnpm test (if tests exist)
6. pnpm build
```

**Contract Gate** (validation):
- [ ] Contract gate test file exists: `src/lib/hdicr/openapi-contract-gate.contract.test.ts`
- [ ] All four HDICR service OpenAPI specs present in TI target
- [ ] M2M audience matches: `https://hdicr.trulyimagined.com`
- [ ] Run: `pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts`
- [ ] Test passes ✅

**Commit & Push**:
- [ ] Commit message: "extract: split TI into independent repo"
- [ ] Push to GitHub: `git push origin extract/ti-split-20260412`
- [ ] Verify GitHub shows branch with all commits
- [ ] Log evidence: command outputs, commit SHA

**Exit criteria**: TI builds cleanly, contract gate passes, branch pushed, CI green

---

### Phase 3: HDICR Extraction (Depends: Phase 1 HDICR branch)
**Status**: Ready to execute  
**Duration**: 30 minutes  
**Tasks**:

**Copy Phase**:
- [ ] Copy all HDICR paths from REAL-EXTRACTION-COPY-MAP.md exactly
- [ ] Verify no extra files
- [ ] Create root workspace files:
  - [ ] `package.json` (monorepo root)
  - [ ] `pnpm-workspace.yaml`
  - [ ] `tsconfig.json`
  - [ ] `.gitignore`
  - [ ] `infra/template.yaml` (with CertificateArn parameter)

**Bootstrap Phase** (strict order, do NOT skip):
```
1. pnpm install --no-frozen-lockfile
2. pnpm --filter @trulyimagined/types build
3. pnpm --filter @trulyimagined/utils build
4. pnpm --filter @trulyimagined/middleware build
5. pnpm --filter @trulyimagined/database build
6. pnpm type-check
7. pnpm test (if tests exist)
8. pnpm build
```

**SAM Template Validation**:
- [ ] `sam validate -t infra/template.yaml` passes
- [ ] Template contains Lambda function definition
- [ ] Template contains API Gateway custom domain configuration
- [ ] Parameters section includes:
  - [ ] `CertificateArn` (Type: String)
  - [ ] `CustomDomainName` (Default: hdicr.trulyimagined.com)
  - [ ] `Auth0Audience` (Default: https://hdicr.trulyimagined.com)
  - [ ] `HDICRDatabaseURL` (Type: String, NoEcho: true)
  - [ ] `Auth0Domain` (Type: String)
- [ ] Environment variables section sets:
  - [ ] `AUTH0_AUDIENCE: https://hdicr.trulyimagined.com`
  - [ ] `AUTH0_DOMAIN: !Ref Auth0Domain`
  - [ ] `HDICR_DATABASE_URL: !Ref HDICRDatabaseURL`
  - [ ] `NODE_ENV: !Ref Environment`

**Commit & Push**:
- [ ] Commit message: "extract: split HDICR into independent repo"
- [ ] Push to GitHub: `git push origin extract/hdicr-split-20260412`
- [ ] Verify GitHub shows branch with all commits
- [ ] Log evidence: command outputs, commit SHA

**Exit criteria**: HDICR builds cleanly, SAM template validates, branch pushed, CI green

---

### Phase 4: Cross-Repo Parity Validation (Depends: Phases 2 & 3)
**Status**: Ready to execute  
**Duration**: 15 minutes  
**Tasks**:

**Contract Alignment**:
- [ ] TI contract gate references all four HDICR service OpenAPI specs
- [ ] All referenced specs exist in HDICR repo
- [ ] Specs match between TI expectations and HDICR exports

**Canonical URL Consistency** (CRITICAL - must match exactly):
- [ ] Auth0 M2M audience: `https://hdicr.trulyimagined.com` ✅
- [ ] TI HDICR_API_URL default: `https://hdicr.trulyimagined.com` ✅
- [ ] HDICR SAM template CustomDomainName: `hdicr.trulyimagined.com` ✅
- [ ] HDICR SAM template Auth0Audience: `https://hdicr.trulyimagined.com` ✅
- [ ] TI Vercel callback: `https://trulyimagined.com/api/auth/callback` ✅
- [ ] Search both repos for hardcoded URLs; no drift detected

**Dependency Independence**:
- [ ] TI has no imports from HDICR services (only shared packages)
- [ ] HDICR has no imports from TI services
- [ ] Shared packages have no circular dependencies
- [ ] Both repos can build independently

**Evidence Capture**:
- [ ] Create parity report: `/runlogs/20260412-real-extraction/parity-report.md`
- [ ] Document all checks and outcomes

**Exit criteria**: All parity checks pass, no canonical URL drift, no cross-repo coupling

---

### Phase 5: Platform Configuration Readiness (Can run parallel after Phase 3)
**Status**: Ready to execute  
**Duration**: 30 minutes  
**Tasks**:

**TI (Vercel)**:
- [ ] Vercel project created and linked to `https://github.com/kilbowie/trulyimagined`
- [ ] Environment variables configured (mark secrets as Sensitive):
  - [ ] `TI_DATABASE_URL` = PostgreSQL connection string
  - [ ] `HDICR_API_URL` = `https://hdicr.trulyimagined.com`
  - [ ] `AUTH0_M2M_CLIENT_ID` = M2M client ID
  - [ ] `AUTH0_M2M_CLIENT_SECRET` = M2M secret (SENSITIVE)
  - [ ] `AUTH0_M2M_AUDIENCE` = `https://hdicr.trulyimagined.com`
  - [ ] `AUTH0_DOMAIN` = your-tenant.auth0.com
  - [ ] `AUTH0_CLIENT_ID` = User auth client ID
  - [ ] `AUTH0_CLIENT_SECRET` = User auth secret (SENSITIVE)
  - [ ] `AUTH0_BASE_URL` = `https://trulyimagined.com`

**S3 Media Bucket (Photo Storage)**:
- [ ] S3 bucket verified: trulyimagined-media
  - [ ] Region: eu-west-1 ✅
  - [ ] Purpose: Photo uploads (actor headshots, agency/studio profile photos)
  - [ ] Bucket exists: aws s3 ls | grep trulyimagined-media ✅

- [ ] Bucket configuration verified:
  - [ ] Versioning: Enabled (protects against accidental deletes)
    - [ ] aws s3api get-bucket-versioning --bucket trulyimagined-media shows Status: Enabled ✅
  - [ ] Encryption: AES256 enabled (default encryption)
    - [ ] aws s3api get-bucket-encryption --bucket trulyimagined-media shows AES256 ✅
  - [ ] Public access: Blocked (all access via presigned URLs)
    - [ ] aws s3api get-public-access-block --bucket trulyimagined-media confirms blocked ✅
  - [ ] CORS: Configured to allow TI uploads:
    - [ ] AllowedOrigins: https://trulyimagined.com, http://localhost:3000 ✅
    - [ ] AllowedMethods: GET, PUT, POST, DELETE, HEAD ✅
    - [ ] AllowedHeaders: * ✅
    - [ ] MaxAgeSeconds: 3600 ✅
    - [ ] Verify: aws s3api get-bucket-cors --bucket trulyimagined-media ✅

- [ ] Folder structure verified:
  - [ ] actors/ folder exists (actor headshots)
    - [ ] aws s3 ls s3://trulyimagined-media/actors/ shows .keep file ✅
  - [ ] agencies/ folder exists (agency profile photos)
    - [ ] aws s3 ls s3://trulyimagined-media/agencies/ shows .keep file ✅
  - [ ] studios/ folder exists (studio project artwork)
    - [ ] aws s3 ls s3://trulyimagined-media/studios/ shows .keep file ✅

- [ ] IAM Policy prepared for TI Lambda/App:
  - [ ] Policy allows S3:ListBucket on trulyimagined-media
  - [ ] Policy allows S3:GetObject on actors/*, agencies/*, studios/*
  - [ ] Policy allows S3:PutObject on actors/*, agencies/*, studios/*
  - [ ] Policy allows S3:DeleteObject on actors/*, agencies/*, studios/*
  - [ ] Note: This policy will be attached to TI's IAM role during Phase 6 deployment

- [ ] Domain `trulyimagined.com` configured in Vercel
- [ ] HTTPS enabled (automatic)
- [ ] Preview deployments enabled

**HDICR (AWS)**:
- [ ] AWS IAM user has permissions:
  - [ ] CloudFormation (create/update stacks)
  - [ ] Lambda (create/update functions)
  - [ ] API Gateway (create/update domains)
  - [ ] S3 (upload artifacts)
  - [ ] IAM (create/update roles)
  - [ ] Logs (create/view log groups)
  - [ ] CloudWatch (create alarms)
- [ ] S3 artifact bucket exists and is accessible:
  - [ ] Name: `hdicr-sam-artifacts-<timestamp>`
  - [ ] Region: eu-west-1
  - [ ] Verify: `aws s3 ls s3://hdicr-sam-artifacts-<timestamp>`
- [ ] ACM Certificate confirmed:
  - [ ] ARN: `arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9` ✅
  - [ ] Status: Issued ✅
  - [ ] Domains: `*.trulyimagined.com` + `trulyimagined.com` ✅
- [ ] AWS CLI configured:
  - [ ] `aws sts get-caller-identity` returns valid credentials
  - [ ] `aws configure get region` returns eu-west-1

**Auth0 (Validation)**:
- [ ] M2M application audience: `https://hdicr.trulyimagined.com` ✅
- [ ] M2M application authorized for HDICR API with correct scopes ✅
- [ ] User auth app callback URL: `https://trulyimagined.com/api/auth/callback` ✅
- [ ] User auth app logout URL: `https://trulyimagined.com` ✅
- [ ] Credentials stored securely (not in git) ✅

**DNS Provider (Ready)**:
- [ ] Registrar access confirmed
- [ ] Can add CNAME records to trulyimagined.com
- [ ] Current DNS records reviewed (no conflicts)

**Exit criteria**: All platform prerequisites validated, secrets configured, credentials ready

---

### Phase 6: Deployment Order and Go-Live Validation (Strict Sequence)
**Status**: Ready to execute  
**Duration**: 45 minutes  
**Tasks**:

**Deploy HDICR First** (never deploy TI first):

1. **SAM Build**:
   - [ ] Run: `sam build -t infra/template.yaml`
   - [ ] Verify build succeeds without errors

2. **SAM Deploy**:
   ```bash
   sam deploy --stack-name hdicr-production \
     --s3-bucket hdicr-sam-artifacts-<timestamp> \
     --s3-prefix hdicr-prod \
     --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       HDICRDatabaseURL='postgresql://...' \
       Auth0Domain='your-tenant.auth0.com' \
       Auth0Audience='https://hdicr.trulyimagined.com' \
       CertificateArn='arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9' \
       CustomDomainName='hdicr.trulyimagined.com' \
       S3BucketName='trulyimagined-media' \
       Environment='production'
   ```
   - [ ] Stack creation/update succeeds
   - [ ] Outputs include: API Gateway endpoint, Lambda function ARN
   - [ ] Record outputs in evidence log

3. **Health Check** (via temporary API Gateway endpoint):
   ```bash
   curl https://d-xxxxx.execute-api.eu-west-1.amazonaws.com/health
   ```
   - [ ] Returns 200 OK with status payload
   - [ ] Response includes timestamp and version

4. **Configure DNS** (critical step):
   - [ ] Get API Gateway endpoint from SAM outputs
   - [ ] Add CNAME record at registrar:
     ```
     Name: hdicr
     Type: CNAME
     Value: d-xxxxx.execute-api.eu-west-1.amazonaws.com
     TTL: 3600
     ```
   - [ ] Wait 5-15 minutes for DNS propagation
   - [ ] Verify propagation: `nslookup hdicr.trulyimagined.com`

5. **Test Custom Domain**:
   ```bash
   curl https://hdicr.trulyimagined.com/health
   ```
   - [ ] Returns 200 OK
   - [ ] Shows status: ok
   - [ ] CloudWatch logs show request

6. **Auth Flow Validation**:
   - [ ] Request without token: `curl https://hdicr.trulyimagined.com/api/identity/actor/test`
   - [ ] Should return 401 Unauthorized
   - [ ] Request with invalid token returns 403 Forbidden
   - [ ] Logs show proper auth validation flow

**Deploy TI (After HDICR is validated)**:

1. **Merge TI extraction branch to main**:
   - [ ] Create PR: `extract/ti-split-20260412` → `main`
   - [ ] CI checks pass
   - [ ] Merge to main

2. **Vercel Preview Deployment** (automatic on branch push):
   - [ ] Wait for deployment to complete
   - [ ] Preview URL shows working TI app
   - [ ] TI can reach HDICR: Check Vercel logs for M2M token fetch success
   - [ ] Dashboard loads actor data from HDICR
   - [ ] Correlation IDs present in both TI Vercel logs and HDICR CloudWatch logs

3. **Vercel Production Deployment**:
   - [ ] Push to main completes merge
   - [ ] Vercel automatic production deployment starts
   - [ ] Deployment succeeds at `https://trulyimagined.com`
   - [ ] Production logs show successful HDICR integration

**Verify S3 Media Bucket Integration**:
- [ ] S3 bucket accessible from TI (Vercel)
  - [ ] Test presigned URL generation (if implemented in TI)
  - [ ] TI can list bucket contents: aws s3 ls s3://trulyimagined-media/
  - [ ] TI can upload test file to actors/ folder
  - [ ] TI can download test file from actors/ folder

- [ ] CORS configuration working
  - [ ] Browser can upload directly to S3 using presigned URL
  - [ ] No CORS errors in browser console
  - [ ] Multiple domains (localhost + production) both work

- [ ] Verify security
  - [ ] Files are versioned (check version history)
  - [ ] Files are encrypted at rest
  - [ ] Public access is still blocked
  - [ ] Only authorized users can access their entity's folder

**Non-Functional Validation**:
- [ ] 401 behavior: Request without token returns 401 Unauthorized
- [ ] 403 behavior: Request with invalid token returns 403 Forbidden
- [ ] Timeout behavior: HDICR timeout causes TI to fail-closed (503 Service Unavailable)
- [ ] Correlation IDs: Traced end-to-end (TI request → HDICR request in logs)
- [ ] CloudWatch alarms: Configured and tested (no false positives)

**Exit criteria**: Both services in production, all validation checks pass, no critical errors

---

### Phase 7: Closeout
**Status**: Ready to execute  
**Duration**: 15 minutes  
**Tasks**:

**Documentation Update**:
- [ ] Update PRODUCTION_READINESS_PLAN.md with:
  - [ ] Phase completion dates
  - [ ] Final commit SHAs (TI main branch, HDICR main branch)
  - [ ] Vercel production URL
  - [ ] AWS CloudFormation stack name and link
  - [ ] Certificate ARN used
  - [ ] S3 bucket used for artifacts

**Runbook Creation**:
- [ ] Create RUNBOOK.md in both repos with:
  - [ ] How to redeploy (SAM deploy command for HDICR, Vercel merge for TI)
  - [ ] How to roll back (git revert or rollback tag)
  - [ ] Emergency contacts
  - [ ] Escalation procedures
  - [ ] Log locations (CloudWatch for HDICR, Vercel dashboard for TI)

**Risk Register Review**:
- [ ] Review all identified risks
- [ ] Verify all mitigations are in place
- [ ] Document residual risks
- [ ] Sign off on go-live

**Final GO/NO-GO Decision**:
- [ ] All phases complete and documented
- [ ] No blockers remaining
- [ ] All validation checks pass
- [ ] Risk register reviewed and signed
- [ ] **GO/NO-GO**: **GO** ✅

**Exit criteria**: Runbook complete, launch decision documented, ready for operations

---

## CRITICAL FAILURE MODES (STOP IF DETECTED)

### 1. Pre-Extraction State Not Clean
- Monorepo has uncommitted changes or dirty state
- **ACTION**: `git status` must be clean. Reset and start over.

### 2. Certificate Not Issued or Invalid
- Certificate status is not "Issued" or shows validation errors
- **ACTION**: Fix certificate validation before proceeding.

### 3. Canonical URL Drift Detected
- Auth0 audience ≠ TI env var ≠ HDICR config
- **ACTION**: Halt Phase 4 until all three match exactly.

### 4. Contract Gate Fails
- OpenAPI specs missing or mismatched
- **ACTION**: Halt Phase 2 until all four service specs are present and valid.

### 5. SAM Template Invalid
- `sam validate -t infra/template.yaml` fails
- **ACTION**: Halt Phase 3 until template YAML is valid.

### 6. Cross-Repo Imports Detected
- TI imports from HDICR services (or vice versa)
- **ACTION**: Halt Phase 4 until all cross-repo imports are removed.

### 7. API Gateway Custom Domain Fails
- Certificate ARN invalid or certificate not Issued
- API Gateway reports domain binding error
- **ACTION**: Verify certificate status and ARN before retrying.

### 8. Database Connection Fails
- SAM deploy fails with database connection timeout
- **ACTION**: Verify RDS security group allows Lambda access, verify connection string.

---

## EVIDENCE LOGGING REQUIREMENTS

For each phase, capture in `/runlogs/20260412-real-extraction/`:

**files**:
- `commands.md` - Exact bash commands run
- `outputs.md` - Full output of each command (successes and failures)
- `commits.md` - Commit SHAs and messages
- `ci-links.md` - GitHub Actions URLs
- `parity-report.md` - Phase 4 parity validation results
- `deployment-log.md` - Phase 6 deployment details

**Format** (each phase):
```
## Phase X: [Phase Name]
Date: YYYY-MM-DD HH:MM:SS UTC
Operator: Adam Greene
Branch(es): [branch names]

### Commands Executed
[List of commands in order]

### Outputs
[Full command outputs - include both success and any warnings]

### Commits
[Commit SHAs and messages]

### CI Status
[GitHub Actions links if applicable]

### Validation Result
✅ PASS / ❌ FAIL / ⚠️ WARN

### Decision
[Any notes on deviations or manual decisions]
```

---

## QUICK REFERENCE: YOUR CURRENT STATE

| Component | Status | Notes |
|-----------|--------|-------|
| **Monorepo** | ✅ Clean | Ready for extraction |
| **GitHub Repos** | ✅ Empty | trulyimagined + hdicr |
| **ACM Certificate** | ✅ **ISSUED** | ARN: `arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9` |
| **Certificate Domains** | ✅ Validated | `*.trulyimagined.com` + `trulyimagined.com` |
| **S3 Bucket** | ✅ Created | hdicr-sam-artifacts-<timestamp> |
| **Auth0 M2M** | ✅ Configured | Audience: https://hdicr.trulyimagined.com |
| **RDS Databases** | ✅ Ready | trimg-db-ti + trimg-db-v3 |
| **Extraction Plan** | ✅ Documented | Phases 0-7, all tasks listed |
| **Dry Runs** | ✅ Validated | Both TI + HDICR build/test pass |

---

## YOUR REVIEW CHECKLIST (Before Implementation)

- [ ] Read this prompt completely
- [ ] Verify all locked decisions align with your vision
- [ ] Confirm all critical failure modes make sense
- [ ] Check Phase 0-7 tasks are achievable in your environment
- [ ] Verify evidence logging structure is clear
- [ ] Confirm DNS provider is ready
- [ ] Test `aws` CLI works in your terminal
- [ ] Verify `sam` CLI is installed: `sam --version`
- [ ] Verify `pnpm` is installed: `pnpm --version`
- [ ] Ready to proceed: **YES** ✅

---

## IMPLEMENTATION KICKOFF

**You are ready to execute Phases 0-7.**

Use this prompt as your:
1. **Master checklist** (tick off items as you complete them)
2. **Reference guide** (come back here when you need to verify next steps)
3. **Validation gate** (each phase has clear exit criteria)
4. **Evidence template** (runlog structure provided)

**Next step**: Open terminal, switch to monorepo root, and begin Phase 0 preflight checks.

```bash
cd /path/to/kilbowie-monorepo
git status                                    # Should be clean
git tag | grep pre-split-monorepo-2026-04-12 # Should exist
pnpm test && pnpm build                       # Should pass
```

When Phase 0 passes, you move to Phase 1: Branch creation.

---

## FINAL CONFIRMATION

**Operator**: Adam Greene  
**Project**: Truly Imagined (TI) + HDICR  
**Certificate ARN**: `arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9` ✅  
**Status**: Ready for implementation  
**Date**: April 12, 2026  

**You have everything. Execute with confidence.** 🚀
