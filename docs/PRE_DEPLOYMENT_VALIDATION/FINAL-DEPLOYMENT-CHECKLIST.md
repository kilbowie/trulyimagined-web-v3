# Final Deployment Checklist - Separate Repos Architecture

**Architecture**: Two separate repositories (TI + HDICR)  
**TI Deployment**: Vercel (`trulyimagined.com`)  
**HDICR Deployment**: AWS Lambda/SAM (`hdicr.trulyimagined.com`)  
**Status**: Ready to execute

---

## 📋 Master Checklist

### Phase 1: Pre-Deployment Setup (Week 1)

#### Prepare Repositories
- [ ] Create GitHub repo: `trulyimagined-web` (TI application)
- [ ] Create GitHub repo: `hdicr-service` (HDICR service)
- [ ] Clone both repos locally
- [ ] Set up directory structures per guides

#### TI Repository Setup
- [ ] Copy code into `trulyimagined-web/`
- [ ] Create `.env.example` with all required variables
- [ ] Implement HDICR HTTP client (`src/lib/hdicr/`)
- [ ] Configure database access (TI_DATABASE_URL only)
- [ ] Create `vercel.json`
- [ ] Test locally: `npm run dev`
- [ ] Push to GitHub

#### HDICR Repository Setup
- [ ] Copy code into `hdicr-service/`
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
- [ ] In `hdicr-service/` directory:
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

---

### Phase 7: Final Validation (Week 3 End)

#### Pre-Launch Testing
- [ ] Both services deployed and live
- [ ] Both domains accessible via HTTPS
- [ ] Auth0 flows work (login/logout)
- [ ] M2M authentication works
- [ ] Database connections work
- [ ] Logs show proper correlation IDs
- [ ] Error handling works (test with bad token)
- [ ] Performance is acceptable

#### Go-Live
- [ ] Marketing/comms ready (if needed)
- [ ] You've monitored logs for 24+ hours
- [ ] No critical issues found
- [ ] Ready to announce

---

## 🚀 Quick Reference Commands

### TI Repository
```bash
# Local setup
cd trulyimagined-web
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
cd hdicr-service
npm install
npm run dev              # Starts on localhost:3001

# Build
npm run build
sam build -t infra/template.yaml

# Deployment
sam deploy --guided

# Test production
curl https://api.trulyimagined.com/health
```

---

## 📊 Architecture Summary

```
GitHub
├── trulyimagined-web/        (TI Next.js app)
│   ├── src/
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
└── hdicr-service/            (HDICR Lambda service)
    ├── src/                  (Express app)
    ├── authorizer/           (API Gateway authorizer)
    ├── infra/template.yaml   (SAM CloudFormation)
    ├── .env.example
    └── package.json

Vercel
└── TI Web App → https://trulyimagined.com

AWS
└── HDICR Lambda → https://api.trulyimagined.com

Auth0
├── M2M Application (TI → HDICR)
│   Audience: https://api.trulyimagined.com
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
- Use `dig api.trulyimagined.com` to verify

---

## 📝 Environment Variables Summary

### TI (.env.production in Vercel)
```
TI_DATABASE_URL=postgresql://...
HDICR_API_URL=https://api.trulyimagined.com
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
CustomDomainName=api.trulyimagined.com
S3BucketName=trulyimagined-media
```

---

## 📚 Document Reference

| Document | Purpose | Use When |
|----------|---------|----------|
| TI-REPO-SETUP.md | Complete TI repo setup guide | Setting up TI application |
| HDICR-REPO-SETUP.md | Complete HDICR repo setup guide | Setting up HDICR service |
| hdicr-template.yaml | SAM CloudFormation template | Deploying HDICR to Lambda |

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
