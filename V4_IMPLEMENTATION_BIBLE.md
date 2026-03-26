# Truly Imagined V4 - Complete Implementation Bible

**Document Purpose:** Single source of truth for MCP agents and developers implementing production-ready identity platform  
**Last Updated:** March 26, 2026  
**Target State:** Production-ready MVP with $155-315/month infrastructure cost  
**Implementation Timeline:** 3-4 weeks

---

## 📋 Table of Contents

1. [Vision & Architecture Philosophy](#vision--architecture-philosophy)
2. [Technology Stack Decision Matrix](#technology-stack-decision-matrix)
3. [Required Accounts & Credentials](#required-accounts--credentials)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Service Implementation Guides](#service-implementation-guides)
6. [Mock Data Strategy](#mock-data-strategy)
7. [Database Schema & Migrations](#database-schema--migrations)
8. [API Endpoints Specification](#api-endpoints-specification)
9. [Frontend Components & UI](#frontend-components--ui)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Procedures](#deployment-procedures)
12. [Monitoring & Observability](#monitoring--observability)
13. [Security & Compliance](#security--compliance)
14. [Launch Checklist](#launch-checklist)

---

## 🎯 Vision & Architecture Philosophy

### Core Mission

Build a **production-grade, modular, standards-compliant identity orchestration platform** that enables:

- Actors to register verified identities
- Agents to manage talent with consent
- Verifiable credentials issuance (W3C standard)
- Multi-provider identity verification (Stripe Identity primary)
- Consent-based data sharing with audit trail

### Core Principles

1. **Security First**: Encryption, audit trails, compliance-ready from day 1
2. **Cost-Optimized**: Use free tiers aggressively, upgrade only when needed
3. **Standards-Aligned**: OIDC, OAuth2, W3C VC, DIDs, GDPR Article 30
4. **Observable**: Know when things break before users complain
5. **Incremental**: Ship MVP, iterate based on user feedback

### Non-Negotiables

- ✅ **Vercel** - Frontend hosting (edge network, auto-deploy)
- ✅ **AWS** - Backend infrastructure (RDS, Lambda, S3, CloudWatch)
- ✅ **Stripe** - Payments & Identity verification
- ✅ **Auth0** - Authentication (OIDC/OAuth2)
- ✅ **GitHub** - Version control, CI/CD

### Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           USERS (Actors, Agents, Admins)        │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         VERCEL EDGE (Next.js 14 App Router)     │
│         - SSR/ISR pages                         │
│         - Auth0 session management              │
│         - shadcn/ui components                  │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐  ┌────────▼────────────┐
│ AWS RDS        │  │ AWS Lambda Services │
│ (PostgreSQL)   │  │ - Identity Service  │
│ - Users        │  │ - Credential Svc    │
│ - Actors       │  │ - Consent Service   │
│ - Credentials  │  │ - Verification Svc  │
│ - Consent Logs │  └─────────┬───────────┘
└────────────────┘            │
                   ┌──────────┴──────────┐
                   │                     │
         ┌─────────▼────────┐  ┌────────▼────────┐
         │ AWS S3           │  │ External IDPs   │
         │ - Actor Media    │  │ - Stripe ID     │
         │ - Credentials    │  │ - Auth0         │
         └──────────────────┘  └─────────────────┘
```

---

## 💻 Technology Stack Decision Matrix

### **Tier 0: Launch Now** 🔴 **REQUIRED** - Week 1

| Category                  | Service                | Cost        | Purpose                       | Setup Time |
| ------------------------- | ---------------------- | ----------- | ----------------------------- | ---------- |
| **Version Control**       | GitHub Free/Pro        | $0-7/mo     | Code hosting, CI/CD           | ✅ Have    |
| **Authentication**        | Auth0 Essentials       | $35/mo      | OIDC/OAuth2                   | ✅ Have    |
| **Payments & ID Verify**  | Stripe                 | Variable    | Payments + Stripe Identity    | ✅ Have    |
| **Backend Infra**         | AWS (RDS/Lambda/S3)    | $100-250/mo | Database, serverless, storage | ✅ Have    |
| **Frontend Hosting**      | Vercel Pro             | $20/mo      | Edge CDN, auto-deploy         | 30 min     |
| **Error Tracking**        | Sentry Free            | $0/mo       | Real-time error alerts        | 30 min     |
| **Email Service**         | Resend Free            | $0/mo       | Transactional emails          | 1 hr       |
| **Security Scanning**     | Snyk Free + Dependabot | $0/mo       | Vulnerability scanning        | 30 min     |
| **UI Components**         | shadcn/ui + Radix      | $0          | Design system                 | 1-2 hrs    |
| **CI/CD Orchestration**   | GitHub MCP             | $0          | Automated deployments         | 1 hr       |
| **Infrastructure Mgmt**   | AWS MCP                | $0          | Manage RDS/Lambda/S3          | 1-2 hrs    |
| **Deployment Automation** | Vercel MCP             | $0          | Deploy frontend               | 30 min     |

**Tier 0 Total:** $155-312/month (including existing services)  
**Setup Time:** 8-12 hours

---

### **Tier 1: Post-Launch** 🟠 **HIGH PRIORITY** - Week 2-3

| Category              | Service            | Cost     | Purpose                 | When to Add            |
| --------------------- | ------------------ | -------- | ----------------------- | ---------------------- |
| **Product Analytics** | PostHog Cloud Free | $0/mo    | User behavior tracking  | Week 2 (once live)     |
| **Documentation**     | Notion Personal    | $0/mo    | Internal wiki, runbooks | Week 1 (alongside dev) |
| **Monitoring**        | AWS CloudWatch     | $0-3/mo  | Infrastructure metrics  | ✅ Included in AWS     |
| **Log Aggregation**   | CloudWatch Logs    | $0.50/GB | Centralized logging     | ✅ Included in AWS     |

**Tier 1 Total:** $0-3/month  
**Setup Time:** 3-4 hours

---

### **Tier 2: Growth Phase** 🟡 **MEDIUM PRIORITY** - Month 2+

| Category                   | Service              | Cost  | When to Add                         |
| -------------------------- | -------------------- | ----- | ----------------------------------- |
| **Customer Support**       | Crisp Free           | $0/mo | When >5 support emails/week         |
| **Infrastructure as Code** | Terraform Cloud Free | $0/mo | When AWS console clicks annoy you   |
| **Better Log Search**      | BetterStack Free     | $0/mo | If CloudWatch search frustrates you |
| **Auth User Management**   | Auth0 MCP            | $0    | When managing many users/roles      |

**Tier 2 Total:** $0/month (all free tiers)

---

### **Services to SKIP for MVP**

❌ **Not Needed Yet:**

- Datadog/New Relic ($15-31/mo) - CloudWatch sufficient
- Intercom ($74/mo) - Use email support
- Vanta/Drata ($200-1000/mo) - DIY compliance
- LaunchDarkly ($75/mo) - Build simple feature flags
- Paid analytics - PostHog free tier sufficient
- Accounting software - Stripe dashboard + Google Sheets

---

## 🔐 Required Accounts & Credentials

### **Essential Accounts (Setup Week 1)**

#### **1. GitHub Account**

- **URL:** https://github.com
- **Plan:** Free (2,000 Actions minutes/mo) or Pro ($7/mo for 3,000 minutes)
- **Required For:** Version control, CI/CD, Dependabot
- **Setup Steps:**
  1. Create account (or use existing)
  2. Generate Personal Access Token (fine-grained)
  3. Scopes needed: `repo`, `workflow`, `write:packages`
  4. Save token as `GITHUB_TOKEN`

#### **2. Auth0 Account**

- **URL:** https://auth0.com
- **Plan:** Essentials ($35/mo, 1,000 MAUs)
- **Required For:** User authentication, JWT validation, OIDC
- **Setup Steps:**
  1. Create tenant: `kilbowieconsulting.uk.auth0.com` (existing)
  2. Create application: "Truly Imagined Web"
  3. Configure callback URLs
  4. Create M2M application for Management API (Auth0 MCP)
  5. Save credentials: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`

#### **3. Stripe Account**

- **URL:** https://stripe.com
- **Plan:** Pay-per-transaction (2.9% + 30¢)
- **Required For:** Payments + Stripe Identity verification
- **Setup Steps:**
  1. Create account (or use existing)
  2. Get API keys (test mode for dev)
  3. Enable Stripe Identity
  4. Configure webhook endpoint
  5. Save: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

#### **4. AWS Account**

- **URL:** https://aws.amazon.com
- **Plan:** Pay-as-you-go (~$100-250/mo for RDS + Lambda + S3)
- **Required For:** RDS PostgreSQL, Lambda functions, S3 storage
- **Setup Steps:**
  1. Create account (or use existing)
  2. Create RDS PostgreSQL instance (db.t3.medium)
  3. Create S3 bucket: `trimg-actor-media`
  4. Create IAM user for MCP access (least-privilege policy)
  5. Save: `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`

#### **5. Vercel Account**

- **URL:** https://vercel.com
- **Plan:** Hobby ($0) → Pro ($20/mo at launch)
- **Required For:** Frontend hosting, edge CDN, auto-deploy
- **Setup Steps:**
  1. Sign up with GitHub account
  2. Import repository
  3. Generate API token (for Vercel MCP)
  4. Configure environment variables in dashboard
  5. Save: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`

#### **6. Sentry Account**

- **URL:** https://sentry.io
- **Plan:** Free (5,000 errors/mo)
- **Required For:** Error tracking, performance monitoring
- **Setup Steps:**
  1. Sign up with GitHub account
  2. Create project: "trulyimagined-web"
  3. Get DSN and auth token
  4. Save: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`

#### **7. Resend Account**

- **URL:** https://resend.com
- **Plan:** Free (100 emails/day = 3,000/mo)
- **Required For:** Transactional emails (welcome, verification, credential issued)
- **Setup Steps:**
  1. Sign up
  2. Verify domain (add DNS records: SPF, DKIM, DMARC)
  3. Create API key
  4. Save: `RESEND_API_KEY`

#### **8. Snyk Account**

- **URL:** https://snyk.io
- **Plan:** Free (200 tests/mo)
- **Required For:** Dependency vulnerability scanning
- **Setup Steps:**
  1. Sign up with GitHub account
  2. Connect repository
  3. Generate API token
  4. Save: `SNYK_TOKEN`

---

### **Post-Launch Accounts (Setup Week 2+)**

#### **9. PostHog Account**

- **URL:** https://app.posthog.com
- **Plan:** Free (1M events/mo)
- **Required For:** Product analytics, session replay, feature flags
- **Setup Steps:**
  1. Sign up
  2. Create project
  3. Get API key and project token
  4. Save: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY`

#### **10. Notion Account**

- **URL:** https://notion.so
- **Plan:** Free (Personal plan)
- **Required For:** Internal documentation, runbooks, system architecture
- **Setup Steps:**
  1. Sign up
  2. Create workspace: "Truly Imagined"
  3. (Optional) Generate integration token for Notion MCP
  4. Save: `NOTION_API_KEY` (if using MCP)

---

### **Optional Accounts (Add When Needed)**

#### **11. Crisp Account** (When support volume increases)

- **URL:** https://crisp.chat
- **Plan:** Free (2 operators)
- **Required For:** Customer support chat widget

#### **12. Terraform Cloud** (When infrastructure scales)

- **URL:** https://app.terraform.io
- **Plan:** Free (<500 resources)
- **Required For:** Infrastructure as Code

---

## 🔑 Environment Variables Reference

### **Development Environment (.env.local)**

Create `apps/web/.env.local` with the following:

```bash
# ============================================
# DEVELOPMENT ENVIRONMENT VARIABLES
# ============================================
# Copy this to .env.local and fill in real values
# ============================================

# ----------------
# Application Settings
# ----------------
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Truly Imagined

# ----------------
# Auth0 (Authentication)
# ----------------
# Next.js SDK variables
AUTH0_SECRET=use_a_long_random_value_at_least_32_characters_long_CHANGE_THIS
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_AUDIENCE=https://api.trulyimagined.com

# Legacy for Lambda middleware
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com

# Management API (for Auth0 MCP)
AUTH0_MANAGEMENT_CLIENT_ID=your_m2m_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_m2m_client_secret

# ----------------
# Database (PostgreSQL on AWS RDS)
# ----------------
# DEVELOPMENT: Use local database or dev RDS instance
DATABASE_URL=postgresql://username:password@localhost:5432/trulyimagined_dev

# Alternative format (for separate vars):
# DATABASE_HOST=localhost
# DATABASE_NAME=trulyimagined_dev
# DATABASE_USER=postgres
# DATABASE_PASSWORD=your_password
# DATABASE_PORT=5432
# DATABASE_SSL=false

# ----------------
# AWS Services
# ----------------
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA_your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET_NAME=trimg-actor-media-dev

# Development: Use local file system instead of S3
USE_MOCK_S3=true
MOCK_S3_DIRECTORY=./mock-s3-storage

# ----------------
# Stripe (Payments & Identity Verification)
# ----------------
# DEVELOPMENT: Use test keys
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Development: Use mock Stripe webhooks
USE_MOCK_STRIPE=true

# ----------------
# Verifiable Credentials - Ed25519 Keys
# ----------------
# Generated with: node scripts/generate-issuer-keys.js
ISSUER_ED25519_PUBLIC_KEY=z6Mk...your_public_key
ISSUER_ED25519_PRIVATE_KEY=zrv...your_private_key

# ----------------
# Consent Proof - JWT Signing Keys
# ----------------
# Generated with: node scripts/generate-consent-signing-keys.js
CONSENT_SIGNING_PRIVATE_KEY="base64_encoded_private_key"
CONSENT_SIGNING_PUBLIC_KEY="base64_encoded_public_key"
CONSENT_SIGNING_KEY_ID="consent-key-1234567890"

# ----------------
# Database Encryption - AES-256 Key
# ----------------
# Generated with: node scripts/generate-encryption-key.js
ENCRYPTION_KEY=your_64_character_hex_string_here

# ----------------
# Email Service (Resend)
# ----------------
# DEVELOPMENT: Use Resend test mode
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=notifications@yourdomain.com
RESEND_FROM_NAME=Truly Imagined

# Development: Use mock emails (logs to console instead of sending)
USE_MOCK_EMAILS=true

# ----------------
# Error Tracking (Sentry)
# ----------------
SENTRY_DSN=https://your_key@o1234567.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=your_auth_token_here
NEXT_PUBLIC_SENTRY_DSN=https://your_key@o1234567.ingest.sentry.io/1234567

# Development: Disable Sentry in dev to reduce noise
SENTRY_ENABLED=false

# ----------------
# Product Analytics (PostHog)
# ----------------
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
POSTHOG_API_KEY=your_personal_api_key

# Development: Disable PostHog in dev
POSTHOG_ENABLED=false

# ----------------
# MCP Server Tokens
# ----------------
GITHUB_TOKEN=ghp_your_github_personal_access_token
VERCEL_TOKEN=your_vercel_api_token
VERCEL_PROJECT_ID=prj_your_project_id
SNYK_TOKEN=your_snyk_api_token
NOTION_API_KEY=secret_your_notion_integration_token

# ----------------
# Development Tools
# ----------------
# Mock data configuration
USE_MOCK_DATA=true
MOCK_USER_EMAIL=test@trulyimagined.com
MOCK_ACTOR_COUNT=10
MOCK_AGENT_COUNT=5

# Feature flags (simple boolean flags for dev)
FEATURE_STRIPE_IDENTITY=true
FEATURE_W3C_CREDENTIALS=true
FEATURE_CONSENT_PROOFS=true
FEATURE_USAGE_TRACKING=false

# ----------------
# Logging & Debugging
# ----------------
LOG_LEVEL=debug
DEBUG_MODE=true
```

---

### **Production Environment (Vercel Dashboard)**

**CRITICAL:** Never commit production secrets to Git. Set these in Vercel dashboard:

```bash
# Vercel Dashboard > Settings > Environment Variables
# Select: Production, Preview, Development (as appropriate)

# Auth0 (different tenant for production)
AUTH0_SECRET=production_secret_64_characters_minimum
AUTH0_BASE_URL=https://trulyimagined.com
AUTH0_ISSUER_BASE_URL=https://kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=production_client_id
AUTH0_CLIENT_SECRET=production_client_secret
AUTH0_AUDIENCE=https://api.trulyimagined.com

# Database (production RDS)
DATABASE_URL=postgresql://trimg_admin:strong_password@prod-rds.amazonaws.com:5432/trulyimagined_prod

# AWS (production credentials)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA_production_key
AWS_SECRET_ACCESS_KEY=production_secret_key
AWS_S3_BUCKET_NAME=trimg-actor-media-prod

# Stripe (live keys)
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_production_webhook_secret

# Encryption Keys (CRITICAL - rotate regularly)
ISSUER_ED25519_PRIVATE_KEY=production_issuer_private_key
CONSENT_SIGNING_PRIVATE_KEY=production_consent_private_key
ENCRYPTION_KEY=production_aes256_key

# Email (production domain)
RESEND_API_KEY=re_production_api_key
RESEND_FROM_EMAIL=notifications@trulyimagined.com

# Monitoring (enable in production)
SENTRY_DSN=production_sentry_dsn
SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=production_sentry_dsn

NEXT_PUBLIC_POSTHOG_KEY=production_posthog_key
POSTHOG_ENABLED=true

# Disable mocks in production
USE_MOCK_DATA=false
USE_MOCK_S3=false
USE_MOCK_STRIPE=false
USE_MOCK_EMAILS=false
```

---

## 📦 Service Implementation Guides

### **1. Sentry (Error Tracking)** 🔴 CRITICAL

**Purpose:** Real-time error tracking, performance monitoring, release tracking

**Setup Steps:**

```bash
# 1. Install dependencies
pnpm add -w @sentry/nextjs @sentry/node

# 2. Run Sentry wizard
npx @sentry/wizard@latest -i nextjs

# 3. The wizard creates these files:
# - sentry.client.config.ts
# - sentry.server.config.ts
# - sentry.edge.config.ts
# - next.config.js (modified)

# 4. Configure Sentry
```

**File: `apps/web/sentry.client.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.SENTRY_ENABLED === 'true',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Session replay for debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Ignore common errors
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
});
```

**File: `apps/web/sentry.server.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.SENTRY_ENABLED === 'true',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Attach user context
  beforeSend(event, hint) {
    // Don't send PII in error messages
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

**Usage in Code:**

```typescript
// Capture errors manually
import * as Sentry from '@sentry/nextjs';

try {
  await issueCredential(userId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'credential-issuance',
      userId: userId,
    },
    level: 'error',
  });
  throw error;
}

// Add breadcrumbs for context
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info',
});
```

**Verification:**

```bash
# Test Sentry integration
curl -X POST http://localhost:3000/api/sentry-test

# Check Sentry dashboard:
# https://sentry.io/organizations/YOUR_ORG/issues/
```

---

### **2. GitHub MCP (CI/CD Orchestration)** 🔴 CRITICAL

**Purpose:** Automated deployments, PR management, code reviews, issue tracking

**Setup Steps:**

```bash
# 1. Install GitHub MCP
pnpm add -w @modelcontextprotocol/server-github

# 2. Generate GitHub Personal Access Token
# Go to: https://github.com/settings/tokens/new
# Token name: trulyimagined-mcp
# Expiration: 90 days (rotate regularly)
# Scopes:
#   ✅ repo (full control of private repositories)
#   ✅ workflow (update GitHub Actions workflows)
#   ✅ write:packages (upload packages to GitHub Package Registry)

# 3. Save token to .env.local
echo "GITHUB_TOKEN=ghp_your_token_here" >> apps/web/.env.local
```

**File: `scripts/mcp-servers/github.ts`** (optional wrapper)

```typescript
import { GitHubMCPServer } from '@modelcontextprotocol/server-github';

const server = new GitHubMCPServer({
  token: process.env.GITHUB_TOKEN!,
  owner: 'yourusername',
  repo: 'trulyimagined-web-v3',
});

// Example: Create PR
export async function createDeploymentPR(branchName: string, title: string) {
  return await server.createPullRequest({
    head: branchName,
    base: 'main',
    title: title,
    body: 'Automated PR created by MCP agent',
  });
}

// Example: Trigger GitHub Actions workflow
export async function triggerDeploy(environment: 'staging' | 'production') {
  return await server.dispatchWorkflow({
    workflow_id: 'deploy.yml',
    ref: 'main',
    inputs: {
      environment: environment,
    },
  });
}
```

**File: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Run tests
        run: pnpm test

  security-scan:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  deploy:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Notify Sentry of deployment
        run: |
          curl -X POST https://sentry.io/api/0/organizations/YOUR_ORG/releases/ \
            -H 'Authorization: Bearer ${{ secrets.SENTRY_AUTH_TOKEN }}' \
            -H 'Content-Type: application/json' \
            -d '{"version":"${{ github.sha }}", "projects":["trulyimagined-web"]}'
```

**Required GitHub Secrets:**

```bash
# Add these in: GitHub repo > Settings > Secrets and variables > Actions

VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=team_xxx or user_xxx
VERCEL_PROJECT_ID=prj_xxx
SNYK_TOKEN=your_snyk_token
SENTRY_AUTH_TOKEN=your_sentry_token
```

**Verification:**

```bash
# Trigger workflow manually
gh workflow run deploy.yml -f environment=staging

# Check workflow status
gh run list --workflow=deploy.yml
```

---

### **3. AWS MCP (Infrastructure Management)** 🔴 CRITICAL

**Purpose:** Manage RDS, Lambda, S3, CloudWatch, Secrets Manager

**Setup Steps:**

```bash
# 1. Install AWS MCP
pnpm add -w @aws-sdk/client-mcp @aws-sdk/client-rds @aws-sdk/client-lambda @aws-sdk/client-s3 @aws-sdk/client-cloudwatch @aws-sdk/client-secrets-manager

# 2. Create IAM user for MCP access
# AWS Console > IAM > Users > Create user
# User name: trulyimagined-mcp
# Attach policies (least privilege):
```

**File: `infra/iam/mcp-user-policy.json`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RDSReadOnly",
      "Effect": "Allow",
      "Action": ["rds:Describe*", "rds:ListTagsForResource"],
      "Resource": "*"
    },
    {
      "Sid": "LambdaManagement",
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:InvokeFunction",
        "lambda:GetFunctionConfiguration"
      ],
      "Resource": "arn:aws:lambda:eu-west-1:YOUR_ACCOUNT_ID:function:trulyimagined-*"
    },
    {
      "Sid": "S3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetBucketLocation"
      ],
      "Resource": ["arn:aws:s3:::trimg-actor-media-*", "arn:aws:s3:::trimg-actor-media-*/*"]
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManagerReadOnly",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "arn:aws:secretsmanager:eu-west-1:YOUR_ACCOUNT_ID:secret:trulyimagined/*"
    },
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": ["cloudwatch:GetMetricStatistics", "cloudwatch:ListMetrics"],
      "Resource": "*"
    }
  ]
}
```

**Save IAM credentials:**

```bash
# Add to .env.local
AWS_ACCESS_KEY_ID=AKIA_your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=eu-west-1
```

**File: `scripts/mcp-servers/aws.ts`**

```typescript
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import {
  LambdaClient,
  InvokeFunctionCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const region = process.env.AWS_REGION || 'eu-west-1';

// RDS Client
const rdsClient = new RDSClient({ region });

export async function getRDSStatus() {
  const command = new DescribeDBInstancesCommand({
    DBInstanceIdentifier: 'trimg-db-v3',
  });
  const response = await rdsClient.send(command);
  return response.DBInstances?.[0];
}

// Lambda Client
const lambdaClient = new LambdaClient({ region });

export async function invokeLambda(functionName: string, payload: any) {
  const command = new InvokeFunctionCommand({
    FunctionName: functionName,
    Payload: JSON.stringify(payload),
  });
  const response = await lambdaClient.send(command);
  return JSON.parse(new TextDecoder().decode(response.Payload));
}

// S3 Client
const s3Client = new S3Client({ region });

export async function listS3Objects(bucketName: string, prefix?: string) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: 100,
  });
  const response = await s3Client.send(command);
  return response.Contents || [];
}

// CloudWatch Logs
const cwLogsClient = new CloudWatchLogsClient({ region });

export async function queryLogs(logGroup: string, filterPattern: string, hours: number = 1) {
  const startTime = Date.now() - hours * 60 * 60 * 1000;
  const command = new FilterLogEventsCommand({
    logGroupName: logGroup,
    filterPattern: filterPattern,
    startTime: startTime,
    limit: 100,
  });
  const response = await cwLogsClient.send(command);
  return response.events || [];
}

// Example usage: Query errors in Lambda logs
export async function getLambdaErrors(functionName: string) {
  return await queryLogs(
    `/aws/lambda/${functionName}`,
    '"ERROR"',
    24 // last 24 hours
  );
}
```

**Verification:**

```bash
# Test AWS MCP connection
node -e "require('./scripts/mcp-servers/aws').getRDSStatus().then(console.log)"
```

---

### **4. Vercel MCP (Frontend Deployment)** 🔴 CRITICAL

**Purpose:** Automated frontend deployments, environment variable management

**Setup Steps:**

```bash
# 1. Install Vercel MCP
pnpm add -w @vercel/mcp vercel

# 2. Link repository to Vercel
cd apps/web
npx vercel link

# This creates .vercel/project.json with:
# - projectId
# - orgId

# 3. Generate Vercel API token
# Go to: https://vercel.com/account/tokens
# Token name: trulyimagined-mcp
# Scope: Full Access (or limit to specific projects)
# Save as: VERCEL_TOKEN

# 4. Get project details
npx vercel project ls
```

**File: `scripts/mcp-servers/vercel.ts`**

```typescript
import { VercelClient } from '@vercel/client';

const client = new VercelClient({
  token: process.env.VERCEL_TOKEN!,
});

const projectId = process.env.VERCEL_PROJECT_ID!;

// Deploy to production
export async function deployProduction() {
  return await client.createDeployment({
    name: 'trulyimagined-web',
    project: projectId,
    target: 'production',
    gitSource: {
      type: 'github',
      repo: 'yourusername/trulyimagined-web-v3',
      ref: 'main',
    },
  });
}

// Get deployment status
export async function getDeploymentStatus(deploymentId: string) {
  return await client.getDeployment(deploymentId);
}

// Update environment variable
export async function updateEnvVar(
  key: string,
  value: string,
  target: 'production' | 'preview' | 'development'
) {
  return await client.createProjectEnvVar(projectId, {
    key: key,
    value: value,
    type: 'encrypted',
    target: [target],
  });
}

// Get project info
export async function getProjectInfo() {
  return await client.getProject(projectId);
}

// List deployments
export async function listDeployments(limit: number = 10) {
  return await client.getDeployments({
    projectId: projectId,
    limit: limit,
  });
}
```

**Verification:**

```bash
# Deploy from CLI
npx vercel --prod

# Check deployment status
npx vercel inspect DEPLOYMENT_URL
```

---

### **5. Resend (Email Service)** 🔴 CRITICAL

**Purpose:** Transactional emails (welcome, verification, credential issued)

**Setup Steps:**

```bash
# 1. Install Resend
pnpm add -w resend

# 2. Sign up at https://resend.com

# 3. Verify domain
# Add DNS records in your domain registrar:
# - TXT record for domain verification
# - DKIM, SPF, DMARC records for email authentication

# 4. Create API key
# Resend Dashboard > API Keys > Create API Key
# Name: trulyimagined-production
# Permission: Full Access
# Save as: RESEND_API_KEY

# 5. Configure sending domain
RESEND_FROM_EMAIL=notifications@trulyimagined.com
RESEND_FROM_NAME=Truly Imagined
```

**File: `apps/web/src/lib/email.ts`**

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@trulyimagined.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Truly Imagined';

// Mock email in development
const USE_MOCK = process.env.USE_MOCK_EMAILS === 'true';

async function sendEmail(to: string, subject: string, html: string) {
  if (USE_MOCK) {
    console.log('📧 [MOCK EMAIL]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html}\n`);
    return { id: `mock-${Date.now()}` };
  }

  try {
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html,
    });
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    throw error;
  }
}

// Welcome email after registration
export async function sendWelcomeEmail(userEmail: string, userName: string) {
  const subject = 'Welcome to Truly Imagined';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Truly Imagined! 🎭</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Thank you for joining Truly Imagined, the global performer digital identity registry.</p>
          <p>Your account has been created successfully. You can now:</p>
          <ul>
            <li>Complete your actor profile</li>
            <li>Verify your identity with Stripe Identity</li>
            <li>Issue W3C verifiable credentials</li>
            <li>Manage consent preferences</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Go to Dashboard</a>
          <p>If you have any questions, reply to this email or visit our help center.</p>
          <p>Best regards,<br>The Truly Imagined Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Truly Imagined. All rights reserved.</p>
          <p>Kilbowie Consulting | Glasgow, UK</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return await sendEmail(userEmail, subject, html);
}

// Identity verification completed
export async function sendVerificationCompleteEmail(
  userEmail: string,
  userName: string,
  verificationLevel: string
) {
  const subject = '✅ Identity Verification Complete';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Identity Verification Complete! ✅</h2>
        <p>Hi ${userName},</p>
        <p>Your identity verification has been successfully completed.</p>
        <p><strong>Verification Level:</strong> ${verificationLevel}</p>
        <p>You can now issue verifiable credentials and access all platform features.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/verifiable-credentials" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Issue Your First Credential
        </a>
        <p>Best regards,<br>The Truly Imagined Team</p>
      </div>
    </body>
    </html>
  `;
  return await sendEmail(userEmail, subject, html);
}

// Credential issued notification
export async function sendCredentialIssuedEmail(
  userEmail: string,
  userName: string,
  credentialId: string
) {
  const subject = '🎫 Verifiable Credential Issued';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Verifiable Credential Issued! 🎫</h2>
        <p>Hi ${userName},</p>
        <p>A new W3C verifiable credential has been issued to your account.</p>
        <p><strong>Credential ID:</strong> <code>${credentialId}</code></p>
        <p>You can download this credential from your dashboard and share it with verifiers.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/verifiable-credentials" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          View Credential
        </a>
        <p>Best regards,<br>The Truly Imagined Team</p>
      </div>
    </body>
    </html>
  `;
  return await sendEmail(userEmail, subject, html);
}

// Consent request notification
export async function sendConsentRequestEmail(
  userEmail: string,
  userName: string,
  requesterName: string,
  purposes: string[]
) {
  const subject = '🔐 Consent Request Received';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New Consent Request 🔐</h2>
        <p>Hi ${userName},</p>
        <p><strong>${requesterName}</strong> has requested your consent to access your data for the following purposes:</p>
        <ul>
          ${purposes.map((p) => `<li>${p}</li>`).join('')}
        </ul>
        <p>Please review this request and grant or deny consent from your dashboard.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/consent-preferences" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Review Request
        </a>
        <p>You can revoke consent at any time from your dashboard.</p>
        <p>Best regards,<br>The Truly Imagined Team</p>
      </div>
    </body>
    </html>
  `;
  return await sendEmail(userEmail, subject, html);
}

export { sendEmail };
```

**Email Templates Location:**

```
apps/web/src/emails/
├── welcome.tsx (React Email template)
├── verification-complete.tsx
├── credential-issued.tsx
└── consent-request.tsx
```

**Verification:**

```bash
# Send test email
node -e "
const { sendWelcomeEmail } = require('./apps/web/src/lib/email');
sendWelcomeEmail('your@email.com', 'Test User').then(console.log);
"
```

---

### **6. shadcn/ui + Radix UI (Design System)** 🔴 CRITICAL

**Purpose:** Consistent, accessible UI components with proper UX

**Setup Steps:**

```bash
# 1. Initialize shadcn/ui (already done in v3, but for reference)
npx shadcn-ui@latest init

# This creates:
# - components.json (config)
# - components/ui/ (component library)
# - lib/utils.ts (utility functions)

# 2. Add required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add form
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add skeleton
```

**File: `components.json`** (Config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**File: `apps/web/tailwind.config.js`**

```javascript
const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

**shadcn MCP Integration (Optional):**

```bash
# Install shadcn MCP for component generation
pnpm add -w @shadcn/mcp

# This allows AI to:
# - Generate new components
# - Customize existing components
# - Ensure design system consistency
```

**Example Custom Component:**

**File: `apps/web/src/components/ActorProfileCard.tsx`**

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface ActorProfileCardProps {
  actorId: string;
  stageName: string;
  legalName: string;
  verificationLevel: 'low' | 'medium' | 'high' | 'very-high';
  isVerified: boolean;
  profileImageUrl?: string;
  onViewProfile: () => void;
}

export function ActorProfileCard({
  actorId,
  stageName,
  legalName,
  verificationLevel,
  isVerified,
  profileImageUrl,
  onViewProfile,
}: ActorProfileCardProps) {
  const initials = stageName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const verificationColor = {
    'very-high': 'bg-green-600',
    'high': 'bg-blue-600',
    'medium': 'bg-yellow-600',
    'low': 'bg-orange-600',
  }[verificationLevel];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profileImageUrl} alt={stageName} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center gap-2">
                {stageName}
                {isVerified && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </CardTitle>
              <CardDescription>{legalName}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className={verificationColor}>
            <Shield className="h-3 w-3 mr-1" />
            {verificationLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            ID: {actorId.slice(0, 8)}...
          </div>
          <Button onClick={onViewProfile} variant="default" size="sm">
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Verification:**

- All pages use consistent shadcn components
- Proper accessibility (aria-labels, keyboard navigation)
- Responsive design (mobile-first)
- Dark mode support (optional)

---

### **7. Snyk + GitHub Dependabot (Security Scanning)** 🔴 CRITICAL

**Purpose:** Automated vulnerability scanning for dependencies

**Setup Steps:**

```bash
# 1. Enable GitHub Dependabot (FREE - included with GitHub)
# GitHub repo > Settings > Security & Analysis
# Enable:
#   - Dependency graph
#   - Dependabot alerts
#   - Dependabot security updates

# 2. Configure Dependabot
```

**File: `.github/dependabot.yml`**

```yaml
version: 2
updates:
  # Enable version updates for npm
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
    open-pull-requests-limit: 10
    reviewers:
      - 'yourusername'
    labels:
      - 'dependencies'
      - 'automated'
    commit-message:
      prefix: 'chore'
      include: 'scope'
    # Auto-merge minor and patch updates
    # (requires GitHub Actions workflow)

  # Check GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

**Step 3: Add Snyk (FREE for open source, or 200 tests/month)**

```bash
# 1. Sign up at https://snyk.io with GitHub account

# 2. Connect repository
# Snyk Dashboard > Add project > GitHub > Select repo

# 3. Get API token
# Snyk Dashboard > Settings > API Token

# 4. Add to GitHub Secrets
# GitHub repo > Settings > Secrets > New secret
# Name: SNYK_TOKEN
# Value: your-snyk-api-token

# 5. Snyk will auto-scan on every PR
```

**File: `.github/workflows/security-scan.yml`**

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run weekly on Mondays at 9am UTC
    - cron: '0 9 * * 1'

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --file=package.json

      - name: Upload result to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: snyk.sarif

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true
```

**Verification:**

```bash
# Local security check
pnpm audit

# Check for high/critical vulnerabilities
pnpm audit --audit-level=high

# Fix automatically (if possible)
pnpm audit fix
```

---

### **8. PostHog (Product Analytics)** 🟠 HIGH PRIORITY

**Purpose:** User behavior tracking, session replay, feature flags

**Setup Steps:**

```bash
# 1. Install PostHog
pnpm add -w posthog-js posthog-node

# 2. Sign up at https://app.posthog.com/signup

# 3. Create project: "Truly Imagined"

# 4. Get API keys
# PostHog Dashboard > Settings > Project API Key
# Save: NEXT_PUBLIC_POSTHOG_KEY, POSTHOG_API_KEY
```

**File: `apps/web/src/lib/posthog.ts`** (Client)

```typescript
'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
const ENABLED = process.env.POSTHOG_ENABLED !== 'false';

// Initialize PostHog
if (typeof window !== 'undefined' && ENABLED && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.debug(); // Debug mode in development
      }
    },
    capture_pageview: false, // We'll capture manually
    capture_pageleave: true,
    autocapture: false, // Manual event tracking for better control
  });
}

// Hook to track page views
export function usePostHog() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && ENABLED) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);
}

// Identify user (call after login)
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!ENABLED) return;

  posthog.identify(userId, {
    ...properties,
    $set: {
      ...properties,
      last_seen: new Date().toISOString(),
    },
  });
}

// Track event
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!ENABLED) return;

  posthog.capture(eventName, properties);
}

// Feature flags
export function isFeatureEnabled(flagKey: string): boolean {
  if (!ENABLED) return false;
  return posthog.isFeatureEnabled(flagKey) || false;
}

export { posthog };
```

**File: `apps/web/src/app/providers.tsx`** (Add PostHog Provider)

```typescript
'use client';

import { ReactNode } from 'react';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { usePostHog } from '@/lib/posthog';

export function Providers({ children }: { children: ReactNode }) {
  // Track page views
  usePostHog();

  return (
    <UserProvider>
      {children}
    </UserProvider>
  );
}
```

**Track Key Events:**

**File: `apps/web/src/app/api/identity/register/route.ts`**

```typescript
import { trackEvent } from '@/lib/posthog';

export async function POST(request: Request) {
  // ... registration logic ...

  // Track registration
  trackEvent('user_registered', {
    user_id: userId,
    role: role,
    email_domain: email.split('@')[1],
  });

  return Response.json({ success: true });
}
```

**Track Verification:**

```typescript
// Track identity verification started
trackEvent('verification_started', {
  user_id: userId,
  provider: 'stripe_identity',
});

// Track verification completed
trackEvent('verification_completed', {
  user_id: userId,
  provider: 'stripe_identity',
  verification_level: 'high',
  time_to_complete_seconds: 120,
});
```

**Track Credential Issuance:**

```typescript
trackEvent('credential_issued', {
  user_id: userId,
  credential_type: 'ActorCredential',
  verification_level: 'high',
});
```

**Verification:**

```bash
# Check PostHog dashboard:
# https://app.posthog.com/project/YOUR_PROJECT/events

# Should see events:
# - $pageview
# - user_registered
# - verification_started
# - verification_completed
# - credential_issued
```

---

### **9. Notion (Documentation)** 🟡 MEDIUM PRIORITY

**Purpose:** Internal wiki, runbooks, system architecture docs

**Setup Steps:**

```bash
# 1. Sign up at https://notion.so (FREE Personal plan)

# 2. Create workspace: "Truly Imagined"

# 3. Create page structure:

📁 Truly Imagined Workspace
├── 🏗️ System Architecture
│   ├── Infrastructure Overview
│   ├── Database Schema
│   ├── API Endpoints
│   └── Service Dependencies
│
├── 🔧 Runbooks
│   ├── Deployment Checklist
│   ├── Incident Response
│   ├── Database Backup & Restore
│   └── Rollback Procedure
│
├── 📊 Metrics Dashboard
│   ├── Monthly Active Users
│   ├── Error Rate
│   ├── Verification Success Rate
│   └── Revenue Tracking
│
├── 📝 Weekly Notes
│   ├── Week of Mar 25, 2026
│   └── (template for weekly updates)
│
├── 🐛 Known Issues
│   ├── Current Bugs
│   └── Technical Debt Tracker
│
├── 🚀 Product Roadmap
│   ├── Q2 2026 Goals
│   ├── Feature Requests
│   └── User Feedback
│
└── 🔐 Security & Compliance
    ├── GDPR Compliance Checklist
    ├── Security Audit Findings
    └── Incident Post-Mortems
```

**Optional: Notion MCP Integration**

```bash
# If you want AI to read/write Notion docs

# 1. Create Notion integration
# Notion Settings > Integrations > New Integration
# Name: Truly Imagined MCP
# Type: Internal integration
# Capabilities: Read content, Update content, Insert content

# 2. Share workspace with integration
# Workspace Settings > Connections > Add integration

# 3. Get integration token
# Save as: NOTION_API_KEY

# 4. Install Notion SDK
pnpm add -w @notionhq/client

# 5. Use Notion MCP to auto-document
# AI can create database entries, update runbooks, etc.
```

**Verification:**

- Create sample runbook
- Test: Can you find deployment steps quickly?
- Test: Can you update metrics dashboard from Stripe/AWS data?

---

## 🎲 Mock Data Strategy

### **Purpose**

Provide realistic mock data for development so you can:

- Test UI/UX without hitting real APIs
- Develop offline
- Avoid API rate limits
- Speed up development cycle

### **Mock Data Configuration**

**File: `apps/web/.env.local`** (Development)

```bash
# Enable mock data in development
USE_MOCK_DATA=true

# Mock user configuration
MOCK_USER_EMAIL=test@trulyimagined.com
MOCK_USER_NAME=Test Actor
MOCK_USER_STAGE_NAME=The Mock Performer

# Mock counts (for generating bulk test data)
MOCK_ACTOR_COUNT=10
MOCK_AGENT_COUNT=5
MOCK CREDENTIAL_COUNT=3

# Service mocks
USE_MOCK_S3=true
USE_MOCK_STRIPE=true
USE_MOCK_EMAILS=true
MOCK_S3_DIRECTORY=./mock-s3-storage
```

---

### **Mock Data Implementation**

**File: `apps/web/src/lib/mocks/index.ts`**

```typescript
export const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';
export const USE_MOCK_S3 = process.env.USE_MOCK_S3 === 'true';
export const USE_MOCK_STRIPE = process.env.USE_MOCK_STRIPE === 'true';
export const USE_MOCK_EMAILS = process.env.USE_MOCK_EMAILS === 'true';

export * from './actors';
export * from './credentials';
export * from './verification';
export * from './consent';
```

**File: `apps/web/src/lib/mocks/actors.ts`**

```typescript
export const MOCK_ACTORS = [
  {
    id: 'actor-1',
    auth0_user_id: 'auth0|mock001',
    email: 'actor1@test.com',
    username: 'actor-emma',
    first_name: 'Emma',
    last_name: 'Thompson',
    stage_name: 'Emma T.',
    legal_name: 'Emma Jane Thompson',
    date_of_birth: '1990-05-15',
    nationality: 'GB',
    profile_completed: true,
    verification_level: 'high',
    profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    bio: 'Professional actor with 10+ years experience in theatre and film.',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-03-20T14:30:00Z',
  },
  {
    id: 'actor-2',
    auth0_user_id: 'auth0|mock002',
    email: 'actor2@test.com',
    username: 'actor-james',
    first_name: 'James',
    last_name: 'Mitchell',
    stage_name: 'James Mitchell',
    legal_name: 'James Robert Mitchell',
    date_of_birth: '1988-08-22',
    nationality: 'US',
    profile_completed: true,
    verification_level: 'very-high',
    profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    bio: 'Award-winning actor specializing in dramatic roles.',
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-03-25T11:00:00Z',
  },
  {
    id: 'actor-3',
    auth0_user_id: 'auth0|mock003',
    email: 'actor3@test.com',
    username: 'actor-sophia',
    first_name: 'Sophia',
    last_name: 'Chen',
    stage_name: 'Sophia C.',
    legal_name: 'Sophia Li Chen',
    date_of_birth: '1995-03-10',
    nationality: 'CA',
    profile_completed: false, // Incomplete profile (for testing)
    verification_level: 'low',
    profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
    bio: null,
    created_at: '2026-03-15T16:00:00Z',
    updated_at: '2026-03-15T16:05:00Z',
  },
];

export function getMockActorById(id: string) {
  return MOCK_ACTORS.find((actor) => actor.id === id) || null;
}

export function getMockActorByEmail(email: string) {
  return MOCK_ACTORS.find((actor) => actor.email === email) || null;
}

export function getMockActorByAuth0Id(auth0UserId: string) {
  return MOCK_ACTORS.find((actor) => actor.auth0_user_id === auth0UserId) || null;
}
```

**File: `apps/web/src/lib/mocks/credentials.ts`**

```typescript
export const MOCK_CREDENTIALS = [
  {
    id: 'cred-1',
    user_profile_id: 'actor-1',
    credential_type: 'ActorCredential',
    credential_id: 'urn:uuid:credential-actor-1-001',
    issuer_did: 'did:web:trulyimagined.com',
    holder_did: 'did:web:trulyimagined.com:users:actor-1',
    issued_at: '2026-03-20T14:30:00Z',
    expires_at: '2027-03-20T14:30:00Z',
    is_revoked: false,
    revoked_at: null,
    verification_method: 'did:web:trulyimagined.com#key-1',
    proof_type: 'Ed25519Signature2020',
    credential_json: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://trulyimagined.com/contexts/v1',
      ],
      type: ['VerifiableCredential', 'ActorCredential'],
      issuer: 'did:web:trulyimagined.com',
      issuanceDate: '2026-03-20T14:30:00Z',
      expirationDate: '2027-03-20T14:30:00Z',
      credentialSubject: {
        id: 'did:web:trulyimagined.com:users:actor-1',
        type: 'Actor',
        email: 'actor1@test.com',
        legalName: 'Emma Jane Thompson',
        professionalName: 'Emma T.',
        verificationLevel: 'high',
        nationality: 'GB',
      },
      credentialStatus: {
        id: 'https://trulyimagined.com/status/1#0',
        type: 'BitstringStatusListEntry',
        statusPurpose: 'revocation',
        statusListIndex: '0',
        statusListCredential: 'https://trulyimagined.com/status/1',
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: '2026-03-20T14:30:00Z',
        verificationMethod: 'did:web:trulyimagined.com#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z5Vx...MockSignature...',
      },
    },
  },
  {
    id: 'cred-2',
    user_profile_id: 'actor-2',
    credential_type: 'ActorCredential',
    credential_id: 'urn:uuid:credential-actor-2-001',
    issuer_did: 'did:web:trulyimagined.com',
    holder_did: 'did:web:trulyimagined.com:users:actor-2',
    issued_at: '2026-03-22T10:15:00Z',
    expires_at: null, // No expiration
    is_revoked: true, // Revoked (for testing)
    revoked_at: '2026-03-25T09:00:00Z',
    verification_method: 'did:web:trulyimagined.com#key-1',
    proof_type: 'Ed25519Signature2020',
    credential_json: {
      /* Similar structure */
    },
  },
];

export function getMockCredentialsByUserId(userId: string) {
  return MOCK_CREDENTIALS.filter((cred) => cred.user_profile_id === userId);
}
```

**File: `apps/web/src/lib/mocks/verification.ts`**

```typescript
export const MOCK_VERIFICATION_SESSIONS = [
  {
    id: 'vs_mock_001',
    user_profile_id: 'actor-1',
    provider: 'stripe_identity',
    session_id: 'vs_mock_stripe_001',
    status: 'verified',
    verification_level: 'high',
    assurance_level: 'high',
    document_type: 'passport',
    document_country: 'GB',
    verified_at: '2026-03-20T13:00:00Z',
    created_at: '2026-03-20T12:45:00Z',
  },
  {
    id: 'vs_mock_002',
    user_profile_id: 'actor-2',
    provider: 'stripe_identity',
    session_id: 'vs_mock_stripe_002',
    status: 'verified',
    verification_level: 'very-high',
    assurance_level: 'high',
    document_type: 'drivers_license',
    document_country: 'US',
    verified_at: '2026-03-22T09:30:00Z',
    created_at: '2026-03-22T09:15:00Z',
  },
  {
    id: 'vs_mock_003',
    user_profile_id: 'actor-3',
    provider: 'mock_kyc',
    session_id: 'vs_mock_kyc_003',
    status: 'requires_input', // Pending (for testing)
    verification_level: 'low',
    assurance_level: 'low',
    document_type: null,
    document_country: null,
    verified_at: null,
    created_at: '2026-03-23T14:00:00Z',
  },
];
```

**File: `apps/web/src/lib/mocks/consent.ts`**

```typescript
export const MOCK_CONSENT_LOGS = [
  {
    id: 'consent-1',
    user_id: 'actor-1',
    purpose: 'Profile sharing with Agent',
    data_categories: ['profile', 'contact', 'verification_status'],
    granted: true,
    granted_at: '2026-03-21T10:00:00Z',
    expires_at: '2027-03-21T10:00:00Z',
    requester: 'agent@agency.com',
    revoked: false,
    revoked_at: null,
  },
  {
    id: 'consent-2',
    user_id: 'actor-1',
    purpose: 'Usage tracking for analytics',
    data_categories: ['usage_data', 'page_views'],
    granted: true,
    granted_at: '2026-03-15T09:00:00Z',
    expires_at: null, // Indefinite
    requester: 'platform',
    revoked: false,
    revoked_at: null,
  },
  {
    id: 'consent-3',
    user_id: 'actor-2',
    purpose: 'Marketing communications',
    data_categories: ['email', 'preferences'],
    granted: true,
    granted_at: '2026-03-10T11:00:00Z',
    expires_at: null,
    requester: 'platform',
    revoked: true, // Revoked (for testing)
    revoked_at: '2026-03-20T15:00:00Z',
  },
];
```

---

### **Using Mock Data in APIs**

**File: `apps/web/src/app/api/credentials/list/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { USE_MOCK_DATA, getMockCredentialsByUserId } from '@/lib/mocks';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use mock data in development
  if (USE_MOCK_DATA) {
    const mockCredentials = getMockCredentialsByUserId('actor-1');
    return NextResponse.json({
      success: true,
      credentials: mockCredentials,
    });
  }

  // Real implementation
  const result = await query('SELECT * FROM verifiable_credentials WHERE user_profile_id = $1', [
    user.profileId,
  ]);

  return NextResponse.json({
    success: true,
    credentials: result.rows,
  });
}
```

---

### **Mock S3 Storage**

**File: `apps/web/src/lib/storage.ts`**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

const USE_MOCK = process.env.USE_MOCK_S3 === 'true';
const MOCK_DIR = process.env.MOCK_S3_DIRECTORY || './mock-s3-storage';

// Real S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  if (USE_MOCK) {
    // Mock: Save to local file system
    const filePath = path.join(MOCK_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    console.log(`📁 [MOCK S3] Uploaded: ${key}`);
    return { key, url: `file://${filePath}` };
  }

  // Real S3 upload
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return {
    key,
    url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

export async function downloadFile(key: string): Promise<Buffer> {
  if (USE_MOCK) {
    // Mock: Read from local file system
    const filePath = path.join(MOCK_DIR, key);
    const buffer = await fs.readFile(filePath);
    console.log(`📁 [MOCK S3] Downloaded: ${key}`);
    return buffer;
  }

  // Real S3 download
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });
  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

---

### **Mock Stripe Webhooks**

**File: `apps/web/src/lib/stripe-mock.ts`**

```typescript
export function createMockVerificationSession(userId: string) {
  return {
    id: `vs_mock_${Date.now()}`,
    object: 'identity.verification_session',
    client_secret: `vs_mock_secret_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    metadata: { user_id: userId },
    status: 'requires_input',
    type: 'document',
    url: `http://localhost:3000/mock-stripe-identity?session_id=vs_mock_${Date.now()}`,
    verified_outputs: null,
    last_error: null,
  };
}

export function createMockVerificationCompletedEvent(sessionId: string) {
  return {
    id: `evt_mock_${Date.now()}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: 'identity.verification_session',
        status: 'verified',
        verified_outputs: {
          address: null,
          dob: { day: 15, month: 5, year: 1990 },
          id_number: 'GB123456',
          name: 'Emma Jane Thompson',
          nationality: 'GB',
        },
        last_verification_report: {
          id: `vr_mock_${Date.now()}`,
          document: {
            type: 'passport',
            country: 'GB',
            expiration_date: { day: 1, month: 1, year: 2030 },
            first_name: 'Emma',
            last_name: 'Thompson',
            status: 'verified',
          },
          selfie: {
            status: 'verified',
          },
        },
      },
    },
    livemode: false,
    type: 'identity.verification_session.verified',
  };
}
```

---

### **Mock Data Seeder Script**

**File: `scripts/seed-mock-data.js`**

```javascript
/**
 * Seed mock data into development database
 *
 * Usage: node scripts/seed-mock-data.js
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MOCK_ACTORS = [
  {
    auth0_user_id: 'auth0|mock001',
    email: 'actor1@test.com',
    username: 'actor-emma',
    role: 'Actor',
    first_name: 'Emma',
    last_name: 'Thompson',
    stage_name: 'Emma T.',
    legal_name: 'Emma Jane Thompson',
    date_of_birth: '1990-05-15',
    nationality: 'GB',
    profile_completed: true,
  },
  {
    auth0_user_id: 'auth0|mock002',
    email: 'actor2@test.com',
    username: 'actor-james',
    role: 'Actor',
    first_name: 'James',
    last_name: 'Mitchell',
    stage_name: 'James Mitchell',
    legal_name: 'James Robert Mitchell',
    date_of_birth: '1988-08-22',
    nationality: 'US',
    profile_completed: true,
  },
  {
    auth0_user_id: 'auth0|mock003',
    email: 'actor3@test.com',
    username: 'actor-sophia',
    role: 'Actor',
    first_name: 'Sophia',
    last_name: 'Chen',
    stage_name: 'Sophia C.',
    legal_name: 'Sophia Li Chen',
    date_of_birth: '1995-03-10',
    nationality: 'CA',
    profile_completed: false,
  },
];

async function seedActors() {
  console.log('🌱 Seeding mock actors...');

  for (const actor of MOCK_ACTORS) {
    try {
      // Insert user_profile
      const profileResult = await pool.query(
        `INSERT INTO user_profiles (
          auth0_user_id, email, username, role, profile_completed
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (auth0_user_id) DO NOTHING
        RETURNING id`,
        [actor.auth0_user_id, actor.email, actor.username, actor.role, actor.profile_completed]
      );

      if (profileResult.rows.length === 0) {
        console.log(`  ⏭️  Skipping ${actor.email} (already exists)`);
        continue;
      }

      const profileId = profileResult.rows[0].id;

      // Insert actor details
      await pool.query(
        `INSERT INTO actors (
          user_profile_id, first_name, last_name, stage_name, legal_name,
          date_of_birth, nationality
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_profile_id) DO NOTHING`,
        [
          profileId,
          actor.first_name,
          actor.last_name,
          actor.stage_name,
          actor.legal_name,
          actor.date_of_birth,
          actor.nationality,
        ]
      );

      console.log(`  ✅ Created: ${actor.email} (${actor.stage_name})`);

      // Add identity link if profile completed
      if (actor.profile_completed) {
        await pool.query(
          `INSERT INTO identity_links (
            user_profile_id, provider, provider_user_id, provider_type,
            verification_level, assurance_level, is_active, verified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (user_profile_id, provider, provider_user_id) DO NOTHING`,
          [profileId, 'Mock KYC', `mock-${actor.username}`, 'kyc', 'high', 'high', true]
        );
        console.log(`     🔗 Added identity link`);
      }
    } catch (error) {
      console.error(`  ❌ Error creating ${actor.email}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting mock data seeder...\n');

  await seedActors();

  console.log('\n✅ Mock data seeding complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Seeder failed:', error);
  process.exit(1);
});
```

**Run seeder:**

```bash
node scripts/seed-mock-data.js
```

---

## 📊 Database Schema & Migrations

### **Current Schema (From V3 - Keep This)**

Your v3 schema is solid. Keep these tables:

```sql
-- Core identity tables
user_profiles
actors
agents
identity_links
verifiable_credentials
consent_log

-- Supporting tables
usage_tracking
licensing_requests
audit_log
status_lists
status_list_bits
```

### **No Schema Changes Needed for V4**

Your database schema is already production-ready. Focus on:

1. ✅ Keep existing migrations
2. ✅ Add indexes for performance (if missing)
3. ✅ Test backup/restore procedures

### **Recommended Indexes (If Not Already Present)**

**File: `infra/database/migrations/005_add_performance_indexes.sql`**

```sql
-- Performance indexes for common queries

-- User lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_auth0_id
ON user_profiles(auth0_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_email
ON user_profiles(email);

-- Actor lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actors_user_profile_id
ON actors(user_profile_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actors_stage_name
ON actors(stage_name);

-- Credential queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_user_profile
ON verifiable_credentials(user_profile_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_issued_at
ON verifiable_credentials(issued_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_not_revoked
ON verifiable_credentials(user_profile_id)
WHERE is_revoked = FALSE;

-- Identity links
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_identity_links_active
ON identity_links(user_profile_id)
WHERE is_active = TRUE;

-- Consent log (audit trail)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consent_log_user
ON consent_log(user_id, granted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consent_log_not_revoked
ON consent_log(user_id)
WHERE revoked = FALSE;

-- Usage tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_tracking_timestamp
ON usage_tracking(timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_tracking_user
ON usage_tracking(user_id, timestamp DESC);
```

**Run migration:**

```bash
psql $DATABASE_URL -f infra/database/migrations/005_add_performance_indexes.sql
```

---

## 🚀 API Endpoints Specification

### **Authentication Endpoints**

```
GET  /api/auth/login       - Auth0 login redirect
GET  /api/auth/callback    - Auth0 callback handler
GET  /api/auth/logout      - Logout and clear session
GET  /api/auth/me          - Get current user info
```

### **Identity Endpoints**

```
POST /api/identity/register                - Register new user profile
GET  /api/identity/profile                 - Get user profile
PUT  /api/identity/profile                 - Update profile
GET  /api/identity/resolution              - Get identity confidence score
POST /api/identity/link                    - Link identity provider
GET  /api/identity/links                   - List identity links
```

### **Verification Endpoints**

```
POST /api/verification/start               - Start identity verification
GET  /api/verification/session/:id         - Get verification session status
POST /api/webhooks/stripe                  - Stripe Identity webhook handler
```

### **Credential Endpoints**

```
POST /api/credentials/issue                - Issue W3C verifiable credential
GET  /api/credentials/list                 - List user's credentials
GET  /api/credentials/:id                  - Get specific credential
POST /api/credentials/revoke               - Revoke credential
GET  /api/credentials/status/:id           - Check revocation status
```

### **Consent Endpoints**

```
POST /api/consent/request                  - Request consent from user
POST /api/consent/grant                    - Grant consent
POST /api/consent/revoke                   - Revoke consent
GET  /api/consent/list                     - List user's consents
POST /api/consent/proof                    - Generate JWT consent proof
```

### **Usage Tracking Endpoints**

```
POST /api/usage/track                      - Track usage event (internal)
GET  /api/usage/stats                      - Get usage statistics (admin)
```

---

## 🧪 Testing Strategy

### **Unit Tests**

```bash
# Test individual functions
pnpm test

# Coverage report
pnpm test --coverage
```

### **Integration Tests**

```bash
# Test API endpoints
pnpm test:integration

# Example: Test credential issuance flow
node tests/integration/credentials.test.js
```

### **E2E Tests**

```bash
# Test full user journeys with Playwright
pnpm test:e2e

# Example: Register → Verify → Issue Credential
```

### **Load Testing**

```bash
# Simulate 100 concurrent users
pnpm test:load
```

---

## 🚢 Deployment Procedures

### **Development to Staging**

```bash
# 1. Merge feature branch to develop
git checkout develop
git merge feature/your-feature
git push origin develop

# 2. GitHub Actions automatically deploys to Vercel (Preview)
# Wait for green checkmark

# 3. Test preview URL
# https://trulyimagined-git-develop-yourorg.vercel.app
```

### **Staging to Production**

```bash
# 1. Create release PR
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags

# 2. GitHub Actions runs:
#    - Tests
#    - Security scan
#    - Build
#    - Deploy to Vercel Production

# 3. Verify production deployment
curl https://trulyimagined.com/api/health

# 4. Monitor Sentry for errors
# https://sentry.io/organizations/YOUR_ORG/issues/

# 5. Check PostHog for usage
# https://app.posthog.com
```

---

## 📊 Monitoring & Observability

### **Error Tracking (Sentry)**

- **Dashboard:** https://sentry.io/organizations/YOUR_ORG/issues/
- **Alerts:** Email when error rate > 1% or new error types
- **Check:** Daily review of errors

### **Product Analytics (PostHog)**

- **Dashboard:** https://app.posthog.com/project/YOUR_PROJECT
- **Key Metrics:**
  - Daily/Monthly Active Users
  - Verification completion rate
  - Credential issuance rate
  - User journey drop-off points
- **Check:** Weekly review

### **Infrastructure (AWS CloudWatch)**

- **RDS Metrics:** CPU, connections, storage
- **Lambda Metrics:** Invocations, errors, duration
- **S3 Metrics:** Storage usage, request count
- **Check:** Weekly review

---

## 🔒 Security & Compliance

### **Security Checklist**

- ✅ HTTPS everywhere (Vercel auto-provides)
- ✅ Auth0 JWT validation on all protected routes
- ✅ Database field encryption (AES-256-GCM)
- ✅ Secrets in AWS Secrets Manager (not env vars)
- ✅ Snyk + Dependabot vulnerability scanning
- ✅ Rate limiting on API endpoints
- ✅ Input validation with Zod schemas
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React auto-escapes)
- ✅ CSRF protection (Auth0 SDK handles)

### **GDPR Compliance**

- ✅ Consent logs (append-only audit trail)
- ✅ Right to access (API to export user data)
- ✅ Right to erasure (soft delete user records)
- ✅ Data minimization (only collect necessary fields)
- ✅ Encryption at rest and in transit
- ✅ Audit trail for all data access
- ✅ Privacy policy & ToS links

---

## ✅ Launch Checklist

### **Week 1: Core Infrastructure** 🔴

- [ ] Set up all required accounts (GitHub, Auth0, Stripe, AWS, Vercel, Sentry, Resend, Snyk)
- [ ] Configure `.env.local` with all environment variables
- [ ] Install and configure Sentry for error tracking
- [ ] Set up GitHub Actions for CI/CD
- [ ] Configure AWS MCP with least-privilege IAM policy
- [ ] Set up Vercel project and link repository
- [ ] Configure Resend and verify domain (DNS records)
- [ ] Enable Dependabot and Snyk security scanning
- [ ] Implement shadcn/ui components across all pages
- [ ] Test mock data in development environment

### **Week 2: Analytics & Documentation** 🟠

- [ ] Set up PostHog Cloud Free account
- [ ] Implement event tracking (registration, verification, credentials)
- [ ] Create Notion workspace with page structure
- [ ] Write deployment runbook in Notion
- [ ] Write incident response plan
- [ ] Document API endpoints
- [ ] Test CloudWatch logs and metrics

### **Week 3: Testing & Security** 🟡

- [ ] Run full test suite (unit + integration + E2E)
- [ ] Run Snyk security scan (no high/critical vulnerabilities)
- [ ] Test all email templates (Resend)
- [ ] Load test with 100 concurrent users
- [ ] Test Stripe Identity verification flow
- [ ] Test credential issuance and revocation
- [ ] Test consent management flow
- [ ] Verify database backups work
- [ ] Verify rollback procedure works

### **Week 4: Production Prep & Launch** 🚀

- [ ] Migrate environment variables to Vercel (production)
- [ ] Rotate all API keys/secrets
- [ ] Enable Sentry in production
- [ ] Enable PostHog in production
- [ ] Deploy to production (Vercel)
- [ ] Smoke test production deployment
- [ ] Set up CloudWatch alarms
- [ ] Configure Sentry alerts (email/Slack)
- [ ] Monitor for 24 hours (check errors, performance)
- [ ] Announce launch to first 10 beta users
- [ ] Collect feedback and iterate

---

## 📞 Support & Escalation

### **When Things Go Wrong**

**Error Spike Detected:**

1. Check Sentry dashboard for recent errors
2. Check CloudWatch logs for Lambda errors
3. Check Vercel deployment status
4. If database issue: Check RDS metrics (CPU, connections)
5. Roll back if necessary: `vercel rollback`

**Database Down:**

1. Check AWS RDS console (status, events)
2. Check VPC security groups (allow traffic)
3. Check database credentials (rotate if needed)
4. Failover to read replica if available
5. Restore from backup if corrupted

**Deployment Failed:**

1. Check GitHub Actions logs
2. Check Vercel build logs
3. Verify environment variables set correctly
4. Check for TypeScript errors: `pnpm type-check`
5. Revert to last known good commit

---

## 📚 Additional Resources

### **Documentation Links**

- [Sentry Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [PostHog Docs](https://posthog.com/docs)
- [Resend Docs](https://resend.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [AWS SDK Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [shadcn/ui Docs](https://ui.shadcn.com/)

### **Your Internal Docs**

- [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
- [Production Readiness](PRODUCTION_READINESS_ASSESSMENT.md)
- [MCP Feasibility Assessment](MCP_FEASIBILITY_ASSESSMENT.md)

---

**END OF V4 IMPLEMENTATION BIBLE**

This document should be kept up-to-date as implementation progresses. Update revision date at top when making changes.

**Next Action:** Begin Week 1 implementation (Core Infrastructure setup)
