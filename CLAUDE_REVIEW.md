## CLAUDE_REVIEW: Real Extraction Implementation Plan (TI + HDICR)

Date: 2026-04-12  
Status: Planning complete, implementation not started  
Scope: Production-grade split extraction from monorepo into two greenfield repos with validated dry-run sequence.

## 1) Objectives and Constraints

### Objectives
- Extract TI into: C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/trulyimagined
- Extract HDICR into: C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/hdicr
- Preserve already validated behavior from dry-runs.
- Establish independent build/test/deploy pipelines with canonical contract host/audience.
- Prepare for production deployment via default branch main using HTTPS remotes.

### Fixed decisions (confirmed)
- Target remotes: https://github.com/kilbowie/trulyimagined.git and https://github.com/kilbowie/hdicr
- Both target repos are empty (greenfield).
- Default branch strategy: main.
- Remote protocol: HTTPS.
- Shared package strategy: copy shared internal packages into both repos in initial extraction.

### Canonical contract lock
- Canonical HDICR URL/audience: https://hdicr.trulyimagined.com
- This must remain consistent across TI env vars, Auth0 audience, HDICR config, and docs.

### Ready-state lock (newly confirmed)
- ACM certificate status: Issued.
- ACM certificate ARN: arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9
- Certificate domains: *.trulyimagined.com and trulyimagined.com
- SAM artifact bucket prepared: hdicr-sam-artifacts-<timestamp>
- Target repos are greenfield and use HTTPS remotes on default branch main.

## 2) Current readiness summary

- Phase 1 blocker closure: complete (type-check/tests/HTTP boundary/split DB safety).
- TI dry-run extraction: install/type-check/test/build all green.
- HDICR dry-run extraction: install/type-check/test/build all green.
- Operator docs in place:
  - docs/PRE_DEPLOYMENT_VALIDATION/REAL-EXTRACTION-EXECUTION-CHECKLIST.md
  - docs/PRE_DEPLOYMENT_VALIDATION/REAL-EXTRACTION-COPY-MAP.md
  - docs/PRE_DEPLOYMENT_VALIDATION/CROSS-BRANCH-EXTRACTION-COMPARISON.md

## 3) Implementation backlog (execution-ready)

### Phase 0: Preflight lock (blocking)
1. Confirm monorepo clean state and rollback tag exists:
   - pre-split-monorepo-2026-04-12
2. Confirm target local folders exist and are clean:
   - C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/trulyimagined
   - C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/hdicr
3. Confirm remotes and default branch policy:
   - origin main for both targets
4. Create run evidence log structure:
   - /runlogs/YYYYMMDD-real-extraction/{commands.md, outputs.md, commits.md, ci-links.md}

Exit criteria:
- All preflight checks pass and evidence log initialized.

### Phase 1: Anchor branch prep (parallel)
1. Create extraction branch for TI from rollback tag:
   - git checkout -b extract/ti-split-20260412 pre-split-monorepo-2026-04-12
2. Create extraction branch for HDICR from rollback tag:
   - git checkout -b extract/hdicr-split-20260412 pre-split-monorepo-2026-04-12
3. Verify both branches point to expected anchor lineage.

Parallelism:
- TI and HDICR branch creation independent.

Exit criteria:
- Both extraction branches are ready and validated.

### Phase 2: TI extraction into trulyimagined (depends on Phase 1 TI branch)
1. Copy mapped TI paths exactly from REAL-EXTRACTION-COPY-MAP.
2. Ensure TI root workspace files are created/configured:
   - package.json
   - pnpm-workspace.yaml
   - tsconfig.json
   - .gitignore
   - vercel.json
3. Validate TI bootstrap sequence:
   - pnpm install --no-frozen-lockfile
   - pnpm --filter @trulyimagined/types build
   - pnpm --filter @trulyimagined/utils build
   - pnpm type-check
   - pnpm test
   - pnpm build
4. Run TI OpenAPI contract gate test:
   - pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts
5. Commit and push TI extraction baseline to main-flow branch strategy (PR into main if protections apply).
6. Record command outputs and commit SHA in evidence.

Exit criteria:
- TI repo gates all green, contract gate green, branch pushed.

### Phase 3: HDICR extraction into hdicr (depends on Phase 1 HDICR branch)
1. Copy mapped HDICR paths exactly from REAL-EXTRACTION-COPY-MAP.
2. Ensure HDICR root workspace files are created/configured:
   - package.json
   - pnpm-workspace.yaml
   - tsconfig.json
   - .gitignore
   - infra/template.yaml
3. Validate HDICR bootstrap sequence (order is mandatory):
   - pnpm install --no-frozen-lockfile
   - pnpm --filter @trulyimagined/types build
   - pnpm --filter @trulyimagined/utils build
   - pnpm --filter @trulyimagined/middleware build
   - pnpm --filter @trulyimagined/database build
   - pnpm type-check
   - pnpm test
   - pnpm build
4. Validate SAM template before commit:
   - sam validate -t infra/template.yaml
   - verify parameters include CertificateArn, CustomDomainName, Auth0Audience, HDICRDatabaseURL, Auth0Domain
   - verify env keys include AUTH0_AUDIENCE, AUTH0_DOMAIN, HDICR_DATABASE_URL, NODE_ENV
5. Commit and push HDICR extraction baseline to main-flow branch strategy.
6. Record command outputs and commit SHA in evidence.

Exit criteria:
- HDICR repo gates all green, branch pushed.

### Phase 4: Cross-repo parity validation (depends on Phases 2 and 3)
1. Confirm TI contract tests pass against included HDICR specs.
2. Verify canonical URL/audience consistency in both repos and active docs.
3. Verify no cross-repo relative imports; independent dependency graphs.
4. Capture parity report artifact in evidence logs.

Exit criteria:
- Parity and contract integrity confirmed.

### Phase 5: Platform configuration readiness (can run in parallel after Phase 3)
1. TI (Vercel)
   - Link GitHub repo
   - Configure preview + production env vars
    - S3 Media Bucket (Photo Storage):
       - S3 bucket verified: trulyimagined-media
          - Region: eu-west-1
          - Purpose: Photo uploads (actor headshots, agency/studio profile photos)
          - Bucket exists: aws s3 ls | grep trulyimagined-media
       - Bucket configuration verified:
          - Versioning: Enabled (protects against accidental deletes)
             - aws s3api get-bucket-versioning --bucket trulyimagined-media shows Status: Enabled
          - Encryption: AES256 enabled (default encryption)
             - aws s3api get-bucket-encryption --bucket trulyimagined-media shows AES256
          - Public access: Blocked (all access via presigned URLs)
             - aws s3api get-public-access-block --bucket trulyimagined-media confirms blocked
          - CORS configured to allow TI uploads:
             - AllowedOrigins: https://trulyimagined.com, http://localhost:3000
             - AllowedMethods: GET, PUT, POST, DELETE, HEAD
             - AllowedHeaders: *
             - MaxAgeSeconds: 3600
             - Verify: aws s3api get-bucket-cors --bucket trulyimagined-media
       - Folder structure verified:
          - actors/ folder exists (actor headshots)
             - aws s3 ls s3://trulyimagined-media/actors/ shows .keep file
          - agencies/ folder exists (agency profile photos)
             - aws s3 ls s3://trulyimagined-media/agencies/ shows .keep file
          - studios/ folder exists (studio project artwork)
             - aws s3 ls s3://trulyimagined-media/studios/ shows .keep file
       - IAM policy prepared for TI Lambda/App:
          - allows s3:ListBucket on trulyimagined-media
          - allows s3:GetObject on actors/*, agencies/*, studios/*
          - allows s3:PutObject on actors/*, agencies/*, studios/*
          - allows s3:DeleteObject on actors/*, agencies/*, studios/*
          - Note: attach policy to TI IAM role during Phase 6 deployment
   - Confirm domain mapping trulyimagined.com
2. HDICR (AWS)
   - IAM access and artifact bucket
   - SAM template parameter reconciliation
   - API custom domain setup for hdicr.trulyimagined.com
   - use certificate ARN arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9
3. Auth0
   - Audience set to canonical URL
   - M2M app credentials validated
   - callback/logout URLs validated
4. DNS
   - required records for apex and API subdomain verified

Region note:
- Deployment region is eu-west-1 and certificate is currently in eu-west-1.
- Confirm API Gateway endpoint type and final certificate-region requirement before deploy. If edge-optimized endpoint is selected, certificate placement requirements may differ.

Exit criteria:
- All platform prerequisites validated and documented.

### Phase 6: Deployment order and go-live validation (strict sequence)
1. Deploy HDICR first and validate health/protected routes.
   - sam build -t infra/template.yaml
   - sam deploy with parameter overrides for HDICRDatabaseURL, Auth0Domain, Auth0Audience, CertificateArn, CustomDomainName, S3BucketName, Environment
2. Deploy TI preview and validate TI -> HDICR integration.
3. Promote HDICR production then TI production.
4. Verify S3 media integration from TI:
    - S3 bucket accessible from TI (Vercel)
       - test presigned URL generation (if implemented in TI)
       - TI can list bucket contents: aws s3 ls s3://trulyimagined-media/
       - TI can upload test file to actors/ folder
       - TI can download test file from actors/ folder
    - CORS configuration working
       - browser can upload directly to S3 using presigned URL
       - no CORS errors in browser console
       - localhost and production domains both work
    - Verify security
       - files are versioned (check version history)
       - files are encrypted at rest
       - public access is still blocked
       - only authorized users can access their entity folder
5. Validate non-functional checks:
   - 401/403 behavior
   - fail-closed timeout behavior
   - correlation IDs across logs
   - observability alarms and dashboards

Exit criteria:
- Both services production-ready with validation evidence.

### Phase 7: Closeout
1. Update PRODUCTION_READINESS_PLAN with:
   - Phase completion status
   - commit SHAs
   - CI links
   - key outputs
2. Produce final GO/NO-GO summary with residual risks.
3. Confirm rollback lineage and recovery instructions remain valid.

Exit criteria:
- Runbook evidence complete and launch decision package ready.

## 4) File-level implementation touchpoints

Monorepo source-of-truth docs:
- PRODUCTION_READINESS_PLAN.md
- docs/PRE_DEPLOYMENT_VALIDATION/REAL-EXTRACTION-EXECUTION-CHECKLIST.md
- docs/PRE_DEPLOYMENT_VALIDATION/REAL-EXTRACTION-COPY-MAP.md
- docs/PRE_DEPLOYMENT_VALIDATION/CROSS-BRANCH-EXTRACTION-COMPARISON.md
- docs/PRE_DEPLOYMENT_VALIDATION/TI-REPO-SETUP.md
- docs/PRE_DEPLOYMENT_VALIDATION/HDICR-REPO-SETUP.md
- docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md

Extraction scope (TI target):
- apps/web
- shared/types
- shared/utils
- infra/database
- services/*/openapi.yaml

Extraction scope (HDICR target):
- services/identity-service
- services/consent-service
- services/licensing-service
- services/representation-service
- shared/types
- shared/utils
- shared/middleware
- infra/database

## 5) Risk register with controls

1. Scope-copy drift
- Control: enforce REAL-EXTRACTION-COPY-MAP mechanically; post-copy path verification.

2. Build-order regressions
- Control: preserve dry-run build ordering exactly; fail fast on declaration errors.

3. Contract gate failure from missing OpenAPI specs in TI
- Control: ensure all four service openapi.yaml files are present in TI target.

4. Canonical audience/host drift
- Control: explicit string verification against https://hdicr.trulyimagined.com before deploy.

5. SAM template mismatch after extraction
- Control: explicit template-path reconciliation in platform phase before first deploy.

6. Branch protection friction on main
- Control: use short-lived extraction branches and PR into main with required checks.

7. Certificate/domain binding failure at API Gateway
- Control: validate certificate status is Issued, ARN matches deploy region strategy, and confirm domain mapping outputs before DNS cutover.

8. DNS cutover misconfiguration
- Control: apply CNAME only after successful SAM deploy outputs, then validate propagation and health checks before TI production promotion.

## 6) Verification matrix

1. Preflight
- git status clean
- rollback tag present
- remotes reachable

2. TI repo
- install/type-check/test/build pass
- contract gate pass

3. HDICR repo
- install/type-check/test/build pass with strict bootstrap sequence

4. CI
- both extraction branches pass required checks

5. Platform
- env var parity and secrets configured
- Auth0 audience and scopes valid
- DNS/domain and certificate validated

6. Deployment
- HDICR health/protected endpoints pass
- TI integration pass
- production domain and observability checks pass

## 7) Critical failure modes (stop conditions)

1. Monorepo state is dirty before extraction starts.
2. Certificate is not Issued or ARN/domain binding validation fails.
3. Canonical URL/audience drift is detected between TI env, Auth0, and HDICR config.
4. TI contract gate fails due to missing/mismatched OpenAPI specs.
5. sam validate fails for infra/template.yaml.
6. Cross-repo imports are detected after extraction.
7. HDICR health checks fail after deploy.
8. Database connectivity fails from deployed HDICR runtime.

## 8) Evidence logging contract

Capture all phase evidence under /runlogs/20260412-real-extraction with at least:
- commands.md
- outputs.md
- commits.md
- ci-links.md
- parity-report.md
- deployment-log.md

For each phase, record: timestamp (UTC), operator, branches, ordered commands, full outputs, validation result (PASS/FAIL/WARN), and decisions/deviations.

## 9) Inputs still needed before implementation start

None required to begin extraction planning-to-execution handoff.

Optional confirmations to reduce execution risk:
1. Whether direct commit to main is allowed or PR-required in each target repo.
2. Exact API Gateway endpoint type (regional vs edge-optimized) to finalize ACM region handling.
3. Preferred evidence format (single markdown file vs split logs + CI links).

## 10) Recommendation for implementation kickoff

- Start with Phase 0 + Phase 1 in one run.
- Execute Phase 2 and Phase 3 as two controlled tracks; do not interleave deployment prep until both are green.
- Gate deployment on successful Phase 4 parity verification and documented platform readiness.
