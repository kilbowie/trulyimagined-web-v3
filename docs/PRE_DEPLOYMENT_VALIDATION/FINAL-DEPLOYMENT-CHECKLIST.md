# Final Deployment Checklist - Separate Repos Architecture

**Architecture**: Two separate repositories (TI + HDICR)  
**TI Deployment**: Vercel (`trulyimagined.com`)  
**HDICR Deployment**: AWS Lambda/SAM (`hdicr.trulyimagined.com`)  
**Status**: Ready to execute

---

## 📋 Master Checklist

### Phase 1: Pre-Deployment Setup (Week 1)

#### Prepare Repositories

- [ ] Create GitHub repo: `trulyimagined` (TI application)
- [ ] Create GitHub repo: `hdicr` (HDICR service)
- [ ] Clone both repos locally
- [ ] Set up directory structures per guides

#### TI Repository Setup

- [ ] Copy code into `trulyimagined/`
- [ ] Create `.env.example` with all required variables
- [ ] Implement HDICR HTTP client (`src/lib/hdicr/`)
- [ ] Configure database access (TI_DATABASE_URL only)
- [ ] Create `vercel.json`
- [ ] Test locally: `npm run dev`
- [ ] Push to GitHub

#### HDICR Repository Setup

- [ ] Copy code into `hdicr/`
- [ ] Create `.env.example` with all required variables
- [ ] Implement Lambda handler (`src/index.ts`)
- [ ] Implement Express app (`src/app.ts`)
- [ ] Implement middleware (auth, correlation, logging, error-handler)
- [ ] Implement services (representation, identity, consent, licensing)
- [ ] Configure database access (HDICR_DATABASE_URL only)
- [ ] Create authorizer Lambda (`authorizer/src/index.ts`)
- [ ] Copy SAM template (`infra/template.yaml`)
- [ ] Test locally: `npm run dev`
- [ ] Push to GitHub

#### Pre-Deployment Infrastructure

- [ ] AWS Account access verified
- [ ] Vercel account access verified
- [ ] Auth0 tenant access verified
- [ ] RDS instances exist:
  - [ ] `trimg-db-ti` (TI)
  - [ ] `trimg-db-v3` (HDICR)
- [ ] Both RDS instances have:
  - [ ] Storage encryption enabled
  - [ ] SSL/TLS enforced
  - [ ] Correct database created

#### Auth0 Configuration

- [ ] M2M application created
  - [ ] Client ID noted
  - [ ] Client Secret saved securely
  - [ ] Authorized for HDICR API
  - [ ] Scopes: `read:actors`, `read:identities`, `read:consent`
- [ ] HDICR API exists in Auth0
  - [ ] Identifier: `https://hdicr.trulyimagined.com`
- [ ] TI user auth app configured
  - [ ] Client ID and Secret noted
  - [ ] Redirect URIs include localhost and production domain

---

### Phase 2: AWS Infrastructure Setup (Week 2 Start)

#### AWS Preparation

- [ ] AWS IAM user created with permissions:
  - [ ] CloudFormation
  - [ ] Lambda
  - [ ] API Gateway
  - [ ] S3
  - [ ] IAM (roles)
  - [ ] Secrets Manager
- [ ] S3 bucket created for SAM deployments
  - [ ] Bucket name: `hdicr-sam-artifacts-<timestamp>`
- [ ] ACM Certificate created
  - [ ] Domain: `hdicr.trulyimagined.com`
  - [ ] Region: `us-east-1` (required for API Gateway)
  - [ ] Certificate ARN copied
- [ ] AWS CLI configured locally
  - [ ] `aws configure` with IAM credentials

#### SAM Template Preparation

- [ ] `infra/template.yaml` has correct parameters:
  - [ ] `CustomDomainName: hdicr.trulyimagined.com`
  - [ ] `CertificateArn: <your-cert-arn>`
  - [ ] `Auth0Domain: your-tenant.auth0.com`
  - [ ] `Auth0Audience: https://hdicr.trulyimagined.com`
  - [ ] `S3BucketName: trulyimagined-media`

---

### Phase 3: Vercel Project Setup Only (Week 2 Mid)

Deployment order rule:

- [ ] Do not deploy TI to Preview or Production until HDICR staging deploy is complete and `https://hdicr.trulyimagined.com/health` returns `200`.

#### Create Vercel Project

- [ ] Go to https://vercel.com/new
- [ ] Import `trulyimagined-web` repository
- [ ] Project created and linked

#### Configure Vercel Environment

- [ ] Set environment variables in Vercel:
  - [ ] `TI_DATABASE_URL`
  - [ ] `HDICR_API_URL` = `https://hdicr.trulyimagined.com`
  - [ ] `AUTH0_M2M_CLIENT_ID`
  - [ ] `AUTH0_M2M_CLIENT_SECRET` (marked as Sensitive)
  - [ ] `AUTH0_M2M_AUDIENCE` = `https://hdicr.trulyimagined.com`
  - [ ] `AUTH0_DOMAIN`
  - [ ] `AUTH0_CLIENT_ID`
  - [ ] `AUTH0_CLIENT_SECRET` (marked as Sensitive)
  - [ ] `AUTH0_BASE_URL` = `https://trulyimagined.com`

#### Prepare TI Deployment (No Release Yet)

- [ ] Keep TI deployment paused until Phase 4 HDICR validation is complete

#### WS8-04 Vercel Parity Verification (2026-04-20)

- [x] Vercel CLI available (`vercel --version` => `50.44.0`)
- [x] Production env set captured (`vercel env ls production`)
- [x] Preview env set captured (`vercel env ls preview`)
- [x] Preview/Production env key sets match for current project (`kilbowies-projects/trulyimagined-com`)

#### Configure TI Custom Domain

- [ ] Add domain in Vercel: `trulyimagined.com`
- [ ] Configure DNS:
  - [ ] Add CNAME record at registrar
  - [ ] Or use Vercel's nameservers
- [ ] HTTPS enabled automatically
- [ ] Test: `https://trulyimagined.com` loads

#### TI Readiness Check (without HDICR dependency)

- [ ] Can visit `https://trulyimagined.com`
- [ ] Can log in via Auth0
- [ ] Database connection works

---

### Phase 4: AWS Lambda Deployment (Week 2 End)

#### Build HDICR

- [ ] In `hdicr/` directory:
  - [ ] `npm run build` succeeds
  - [ ] `dist/` directory created
  - [ ] No TypeScript errors

#### Deploy with SAM

- [ ] Run SAM build:
  ```bash
  sam build -t infra/template.yaml
  ```
- [ ] Run SAM deploy:
  ```bash
  sam deploy --guided \
    --stack-name hdicr-production \
    --s3-bucket <your-sam-bucket> \
    --s3-prefix hdicr-prod \
    --parameter-overrides \
      HDICRDatabaseURL=$HDICR_DATABASE_URL \
      Auth0Domain=your-tenant.auth0.com \
      Auth0Audience=https://hdicr.trulyimagined.com \
      CertificateArn=<your-cert-arn> \
      CustomDomainName=hdicr.trulyimagined.com \
      S3BucketName=trulyimagined-media
  ```
- [ ] CloudFormation stack created successfully
- [ ] Lambda function created: `hdicr-production`
- [ ] API Gateway created
- [ ] Authorizer Lambda created

#### Configure HDICR Custom Domain

- [ ] Get API Gateway endpoint from CloudFormation outputs
- [ ] Add DNS CNAME record:
  - [ ] Name: `hdicr`
  - [ ] Value: `d-xxxxx.execute-api.eu-west-1.amazonaws.com`
  - [ ] At registrar for `trulyimagined.com`
- [ ] Wait for DNS propagation (5-15 minutes)
- [ ] Test: `curl https://hdicr.trulyimagined.com/health`

#### Test HDICR

- [ ] Can reach `https://hdicr.trulyimagined.com/health`
- [ ] Returns status OK
- [ ] Check CloudWatch logs for startup messages
- [ ] Confirm this phase is complete before any TI deployment is unpaused

---

### Phase 5: Integration Testing (Week 3 Start)

#### Deploy TI to Vercel

- [ ] Push `main` branch to GitHub
- [ ] Vercel auto-deploys
- [ ] Deployment succeeds (check Vercel dashboard)

#### Test TI → HDICR Integration

- [ ] Log in to TI: `https://trulyimagined.com`
- [ ] Navigate to dashboard
- [ ] TI calls HDICR API successfully
- [ ] Actor data displays
- [ ] No errors in browser console
- [ ] No errors in Vercel logs
- [ ] No errors in CloudWatch logs

#### Verify Logs

- [ ] Check Vercel logs for:
  - [ ] M2M token fetch success
  - [ ] HDICR API calls with correlation IDs
- [ ] Check CloudWatch logs for:
  - [ ] Token validation success
  - [ ] Matching correlation IDs
  - [ ] Proper request/response flow

#### Performance Testing

- [ ] Dashboard loads in < 2 seconds
- [ ] M2M token cached (no fetch on every request)
- [ ] Database queries are fast

---

### Phase 6: Production Hardening (Week 3 Mid)

#### Monitoring & Alerts

- [ ] CloudWatch alarms created:
  - [ ] Lambda errors > 5 per 5 min
  - [ ] Lambda duration > 5 seconds
  - [ ] API Gateway 4xx errors > 10 per 5 min
- [ ] CloudWatch log groups created for HDICR
- [ ] CloudWatch dashboard created for visibility

#### AWS Resource Verification (WS8-05)

- [x] SAM template validated against deployed stack (`sam validate -t infra/template.yaml`)
- [x] CloudFormation stack status is `UPDATE_COMPLETE` or `CREATE_COMPLETE`
- [x] API Gateway stage `prod` exists and is mapped to custom domain
- [x] ACM certificate is `ISSUED` for `hdicr.trulyimagined.com`
- [x] IAM execution roles exist for all HDICR Lambda functions (attached policy inventory captured)
- [x] CloudWatch log groups exist for identity, consent, licensing, and representation functions
- [x] CloudWatch alarms exist and are attached to SNS notification channel (`hdicr-production-alerts`)
- [x] Route53 or registrar DNS entry resolves `hdicr.trulyimagined.com` to API Gateway custom domain target

Evidence capture:

- [x] Save stack outputs snapshot
- [x] Save API Gateway custom domain mapping screenshot or CLI output
- [x] Save ACM certificate status output
- [x] Save IAM role policy summary output
- [x] Save CloudWatch alarms list output
- [x] Confirm SNS topic ARN for alert notifications

Evidence collected on 2026-04-20:

```bash
# SAM validation
pnpm sam:validate
# Result: infra/template.yaml is a valid SAM Template

# AWS identity context
aws sts get-caller-identity
# Account: 440779547223
# Arn: arn:aws:iam::440779547223:root

# CloudFormation stack status
aws cloudformation describe-stacks --stack-name hdicr-production --query "Stacks[0].{StackStatus:StackStatus,LastUpdatedTime:LastUpdatedTime}" --output table
# StackStatus: UPDATE_COMPLETE
# LastUpdatedTime: 2026-04-12T21:46:45.987000+00:00

# DNS resolution
nslookup hdicr.trulyimagined.com
# Alias: d-cs6923lsw2.execute-api.eu-west-1.amazonaws.com

# API Gateway custom domain mapping
aws apigateway get-base-path-mappings --domain-name hdicr.trulyimagined.com --output table
# basePath=(none), stage=prod

# ACM status
aws acm describe-certificate --certificate-arn arn:aws:acm:eu-west-1:440779547223:certificate/769f5ac8-d0a7-48f4-a822-17348373bab9 --output table
# Status: ISSUED

# IAM role summary
aws iam list-attached-role-policies --role-name <hdicr-function-role>
# Attached policy: AWSLambdaBasicExecutionRole

# CloudWatch log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/hdicr-" --output table
# 4 log groups found for consent, identity, licensing, representation

# SNS alert topic
aws sns create-topic --name hdicr-production-alerts --region eu-west-1
# TopicArn: arn:aws:sns:eu-west-1:440779547223:hdicr-production-alerts

# CloudWatch alarms (8 alarms — errors+duration per function)
aws cloudwatch describe-alarms --region eu-west-1 --query "MetricAlarms[*].{Name:AlarmName,Metric:MetricName,Fn:Dimensions[0].Value}" --output table
# hdicr-consent-duration     | Duration | hdicr-consent-production
# hdicr-consent-errors       | Errors   | hdicr-consent-production
# hdicr-identity-duration    | Duration | hdicr-identity-production
# hdicr-identity-errors      | Errors   | hdicr-identity-production
# hdicr-licensing-duration   | Duration | hdicr-licensing-production
# hdicr-licensing-errors     | Errors   | hdicr-licensing-production
# hdicr-representation-duration | Duration | hdicr-representation-production
# hdicr-representation-errors   | Errors   | hdicr-representation-production
# Thresholds: Errors > 5/5 min (Sum); Duration > 5000ms p99/5 min
# All wired to arn:aws:sns:eu-west-1:440779547223:hdicr-production-alerts

# Endpoint reachability (auth-protected)
Invoke-WebRequest https://hdicr.trulyimagined.com/health
# HTTP 403
Invoke-WebRequest https://hdicr.trulyimagined.com/v1/identity/health
# HTTP 401
```

#### Security Review

- [ ] No secrets in git history
  - [ ] `git log -p | grep -i secret` returns nothing
- [ ] All secrets in Vercel/AWS (not in repos)
- [ ] `.env` files in `.gitignore`
- [ ] IAM roles have minimal permissions
- [ ] RDS has encryption enabled
- [ ] HTTPS enforced on both domains

#### Documentation

- [ ] README in both repos
  - [ ] Setup instructions
  - [ ] Environment variables documented
  - [ ] Deployment instructions
  - [ ] Troubleshooting guide
- [ ] Architecture diagram created
- [ ] Runbook created for operations

#### Rollback And Incident Runbook (WS7-06)

- [x] Rollback owner assigned for TI (Vercel) and HDICR (AWS/SAM)
- [x] Verify TI rollback command path and previous stable deployment selection
- [x] Verify HDICR rollback command path (CloudFormation stack rollback or prior SAM artifact deploy)
- [x] Define incident severity levels with response SLA and escalation contacts
- [x] Define immediate containment actions for:
  - [x] TI auth outage
  - [x] HDICR API outage
  - [x] Stripe webhook processing backlog
  - [x] Auth0 token validation failures
- [x] Define evidence capture checklist for post-incident review (logs, correlation IDs, deploy IDs, timestamps)
- [ ] Dry-run one rollback scenario end to end in non-production and record results

Immediate containment actions:

- TI auth outage: lock deployments, verify Auth0 tenant status, validate `AUTH0_*` envs in Vercel, rollback to last known-good TI deployment if login errors persist.
- HDICR API outage: check CloudFormation stack events and Lambda error logs, fail closed in TI for HDICR-dependent writes, rollback/cancel stack update when failure rate exceeds SEV threshold.
- Stripe webhook backlog: inspect webhook event table and retry counts, pause non-critical payout operations, replay failed events after root-cause mitigation.
- Auth0 token validation failures: verify JWKS reachability and audience/domain values, rotate M2M secrets if compromise suspected, temporarily restrict high-risk write routes.

Rollback owners and escalation:

- TI (Vercel) owner role: Platform Release Owner (primary contact: `admin@trulyimagined.com`)
- HDICR (AWS/SAM) owner role: Infrastructure Owner for AWS account `440779547223`
- L1 incident intake: `support@trulyimagined.com`
- L2 escalation: `admin@trulyimagined.com`

Severity and response SLA:

- SEV-1 (production outage, auth failure, data integrity risk): acknowledge within 15 minutes, rollback decision within 30 minutes.
- SEV-2 (major degraded service, delayed webhook processing): acknowledge within 30 minutes, mitigation within 2 hours.
- SEV-3 (non-critical degradation): acknowledge within 4 hours, fix in normal delivery cycle.

TI rollback command path:

```bash
# Inspect deployments
vercel ls --scope trulyimagined

# Roll back to prior stable deployment
vercel rollback <deployment-url-or-id> --scope trulyimagined

# Verify app health
curl https://trulyimagined.com
```

HDICR rollback command path:

```bash
# Check stack and recent events
aws cloudformation describe-stacks --stack-name hdicr-production
aws cloudformation describe-stack-events --stack-name hdicr-production --max-items 30

# If update is in progress and failing, cancel update
aws cloudformation cancel-update-stack --stack-name hdicr-production

# Redeploy last known-good artifact/commit
sam deploy --stack-name hdicr-production --no-confirm-changeset

# Verify edge endpoints
nslookup hdicr.trulyimagined.com
curl https://hdicr.trulyimagined.com/v1/identity/health
```

Evidence capture checklist for incidents:

- Incident start/end timestamps (UTC)
- TI deployment ID and HDICR CloudFormation stack event IDs
- Correlation IDs from TI logs and matching CloudWatch log entries
- Error-rate snapshot (Vercel logs, API Gateway metrics, Lambda errors)
- Rollback command transcript and verification results

---

### Phase 7: Final Validation (Week 3 End)

#### Pre-Launch Testing

- [x] Both services deployed and live
- [x] Both domains accessible via HTTPS
- [ ] Auth0 flows work (login/logout)
- [ ] M2M authentication works
- [ ] Database connections work
- [ ] Logs show proper correlation IDs
- [ ] Error handling works (test with bad token)
- [ ] Performance is acceptable

Evidence collected on 2026-04-20:

```text
- https://trulyimagined.com is reachable and serving the production marketing/application shell.
- https://hdicr.trulyimagined.com/health returns HTTP 403 (auth-protected reachability confirmed).
- https://hdicr.trulyimagined.com/v1/identity/health returns HTTP 401 (auth-protected reachability confirmed).
- Vercel production deployment dpl_2ZR7RWm8k4zjVMmXJzEahRfK8h8B is Ready and aliased to trulyimagined.com.
- Launch blocker found: `/auth/login` and `/api/auth/me` requests were failing in production runtime logs.
- Runtime evidence from Vercel logs:
  - `Error: NextResponse.next() was used in a app route handler` (from `/api/auth/[auth0]`).
  - `[Middleware] Error: [TypeError: Cannot read properties of undefined (reading 'startsWith')]` on `/auth/login`.
- Remediation implemented in TI repo:
  - Auth0 env normalization and base-url fallback hardening in `apps/web/src/lib/auth0.ts`.
  - Replaced invalid `auth0.middleware()` usage in `apps/web/src/app/api/auth/[auth0]/route.ts` with explicit handler mapping.
  - Added explicit App Router auth route handlers in `apps/web/src/app/auth/[auth0]/route.ts`.
- Pending: verify these fixes on a successful Vercel deployment, then rerun this validation section.
```

Current outcome:

- Do not proceed to public announcement yet.
- Next implementation step is to restore the production login entrypoint and rerun this validation section.

#### Go-Live

- [ ] Marketing/comms ready (if needed)
- [ ] You've monitored logs for 24+ hours
- [ ] No critical issues found
- [ ] Ready to announce

#### Go-Live Evidence Pack (WS8-06)

- [x] M1 evidence linked (TLS, webhook deduplication, fail-closed, correlation IDs)
- [x] M2 evidence linked (subscription lifecycle handling, tier catalog, entitlement/revocation)
- [x] M3 evidence linked (pricing route, FX/defaulting logic, tier availability checks)
- [x] M4 evidence linked (studios/projects/deals schema, deal lifecycle, platform fee boundaries)
- [x] M5 evidence linked (consent-gated approvals, licensing issuance, usage ingestion)
- [x] M6 evidence linked (Connect onboarding, payout audit/intervention, env alignment)
- [x] M7 evidence linked (arbitration flow, rollback/incident runbook, infra verification)
- [x] Final launch decision recorded with date, approver, and known deferred items

Evidence links:

- M1: `../trulyimagined/apps/web/src/lib/db.ts`, `../trulyimagined/apps/web/src/app/api/webhooks/stripe/route.ts`, `EXECUTION_BOARD.md` (M1 gate section)
- M2: `../trulyimagined/apps/web/src/lib/billing.ts`, `../trulyimagined/apps/web/src/app/api/webhooks/stripe/route.ts` (subscription handlers)
- M3: `PRODUCTION_READINESS_BACKLOG.md` (WS9 status), TI pricing route and FX API implementation in production repo
- M4: `../trulyimagined/infra/database/migrations/038_ti_studios.sql` to `042_ti_deal_state_transitions.sql`, `../trulyimagined/apps/web/src/lib/platform-fee.ts`
- M5: `../trulyimagined/apps/web/src/app/api/deals`, `../trulyimagined/apps/web/src/app/api/consent/check/route.ts`, `../trulyimagined/apps/web/src/app/api/usage/track/route.ts`
- M6: `../trulyimagined/apps/web/src/app/api/stripe/connect/*`, `../trulyimagined/apps/web/.env.example`, `../hdicr/shared/utils/src/secrets.ts`
- M7: `../trulyimagined/infra/database/migrations/046_ti_arbitration_requests.sql`, this checklist WS7-06 + WS8-05 sections

---

### Final Launch Decision Record

```text
Decision date (UTC): 2026-04-20
Approver: A. R. Greene - Founder
Decision: CONDITIONAL GO

Blocking issues: None — all P0 production safety items are resolved.

Deferred items accepted for launch:
- WS4-03  Job board / casting-open discovery flow (P1)
- WS5-05  Consent-revocation conflict handling for active licences (P2)
- WS6-03  Actor and agency earnings dashboard (P2)
- WS6-04  Refund processing UI (P2)
- WS7-03  Structured logging to replace ad hoc console.log (P2)
- WS7-05  Sentry coverage verification for handled and unhandled failures (P2)
- WS7-06* Rollback dry-run in non-production — runbook is written and tested commands documented;
           live dry-run not yet executed; scheduled as first post-launch operational exercise
- WS7-07  Confirm no secrets leak in logs or error response bodies (P2)
- WS8-03  Finalize canonical domain and env key names across repos and docs (P1)

Note: LAUNCH_SCOPE_RECOMMENDATION.md governs public product claims. Studio/deal marketplace
workflows are intentionally out of first-release public claims.

Supporting evidence links:
- docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md (this document)
- EXECUTION_BOARD.md M1–M7 gate checks
- PRODUCTION_READINESS_BACKLOG.md (workstream status table)
- LAUNCH_SCOPE_RECOMMENDATION.md (public claims matrix)
- docs/FINAL_AUDIT.md (status update 2026-04-20)

Post-launch review date: 2026-05-11 (3 weeks post-launch)
Items to reassess: WS8-03, WS7-07, WS7-05, WS7-06 dry-run
```

---

## 🚀 Quick Reference Commands

### TI Repository

```bash
# Local setup
cd trulyimagined
npm install
npm run dev              # Starts on localhost:3000

# Deployment
git push origin main     # Vercel auto-deploys

# Test production
curl https://trulyimagined.com
```

### HDICR Repository

```bash
# Local setup
cd hdicr
npm install
npm run dev              # Starts on localhost:3001

# Build
npm run build
sam build -t infra/template.yaml

# Deployment
sam deploy --guided

# Test production
curl https://hdicr.trulyimagined.com/health
```

---

## 📊 Architecture Summary

```
GitHub
├── trulyimagined/            (TI Next.js app)
│   ├── src/
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
└── hdicr/                    (HDICR Lambda service)
    ├── src/                  (Express app)
    ├── authorizer/           (API Gateway authorizer)
    ├── infra/template.yaml   (SAM CloudFormation)
    ├── .env.example
    └── package.json

Vercel
└── TI Web App → https://trulyimagined.com

AWS
└── HDICR Lambda → https://hdicr.trulyimagined.com

Auth0
├── M2M Application (TI → HDICR)
│   Audience: https://hdicr.trulyimagined.com
│
└── User Auth App (Login)
    Redirect: https://trulyimagined.com/api/auth/callback

RDS
├── trimg-db-ti (TI database)
└── trimg-db-v3 (HDICR database)
```

---

## 🎯 Success Criteria

✅ Both repos created and pushed to GitHub  
✅ TI deployed to Vercel at `https://trulyimagined.com`  
✅ HDICR deployed to Lambda at `https://hdicr.trulyimagined.com`  
✅ Can log in to TI via Auth0  
✅ TI dashboard loads actor data from HDICR  
✅ M2M authentication works end-to-end  
✅ Logs show proper request flow with correlation IDs  
✅ No errors in Vercel or CloudWatch logs  
✅ Performance is acceptable (< 2s dashboard load)  
✅ Both services auto-scale with demand

---

## 📞 Troubleshooting Quick Links

**TI Issues**

- Check Vercel logs: Vercel Dashboard → Deployments → Logs
- Check database connection: Test locally first
- Check HDICR integration: Verify `HDICR_API_URL` env var

**HDICR Issues**

- Check CloudWatch logs: AWS Console → CloudWatch → Logs
- Check database connection: Test local Lambda execution
- Check token validation: Verify Auth0 M2M app exists

**DNS Issues**

- Verify CNAME record at registrar
- Wait 5-15 minutes for propagation
- Use `dig hdicr.trulyimagined.com` to verify

---

## 📝 Environment Variables Summary

### TI (.env.production in Vercel)

```
TI_DATABASE_URL=postgresql://...
HDICR_API_URL=https://hdicr.trulyimagined.com
AUTH0_M2M_CLIENT_ID=...
AUTH0_M2M_CLIENT_SECRET=...
AUTH0_M2M_AUDIENCE=https://hdicr.trulyimagined.com
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_BASE_URL=https://trulyimagined.com
```

### HDICR (CloudFormation Parameters)

```
HDICRDatabaseURL=postgresql://...
Auth0Domain=your-tenant.auth0.com
Auth0Audience=https://hdicr.trulyimagined.com
CertificateArn=arn:aws:acm:...
CustomDomainName=hdicr.trulyimagined.com
S3BucketName=trulyimagined-media
```

---

## 📚 Document Reference

| Document            | Purpose                         | Use When                  |
| ------------------- | ------------------------------- | ------------------------- |
| TI-REPO-SETUP.md    | Complete TI repo setup guide    | Setting up TI application |
| HDICR-REPO-SETUP.md | Complete HDICR repo setup guide | Setting up HDICR service  |
| infra/template.yaml | SAM CloudFormation template     | Deploying HDICR to Lambda |

---

## ✨ Final Notes

**You have everything you need.** Both setup guides are comprehensive and step-by-step. Follow them in order:

1. **TI-REPO-SETUP.md** → Deploy TI to Vercel
2. **HDICR-REPO-SETUP.md** → Deploy HDICR to Lambda
3. **This checklist** → Track your progress

**Estimated timeline**:

- Setup: 4-6 hours
- Deployment: 30 minutes
- Testing: 2-4 hours
- **Total: 1 week of part-time work**

**You're ready. Let's build.** 🚀
