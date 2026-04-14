# Environment Variable Audit & Rotation Framework
## HDICR + TI Production Deployment

---

## Overview

This document inventories **every environment variable** required by HDICR and TI, specifies where they live, how to update them, and provides a rotation strategy for secrets.

**Key principles:**
- **Never** commit secrets to version control (use `.env.example` with placeholders)
- **Separate by system:** HDICR secrets in AWS Systems Manager Parameter Store; TI secrets in Vercel & AWS Systems Manager
- **Shared secrets** (e.g., Auth0, JWT signing keys) stored once, referenced by both systems
- **Rotation:** Implement with zero downtime by supporting multiple versions temporarily

---

## 1. HDICR Environment Variables (AWS Lambda + SAM)

### 1.1 Runtime Environment Variables (Lambda Execution Environment)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `NODE_ENV` | String | Public | SAM template (samconfig.toml or --parameter-overrides) | Yes | Set to `production` in prod | `production` |
| `AWS_REGION` | String | Public | Lambda auto-set | Yes | AWS region for Lambda | `eu-west-1` |
| `STAGE` | String | Public | SAM template | Yes | Environment stage (dev/staging/prod) | `prod` |
| `LOG_LEVEL` | String | Public | Parameter Store or SAM | No | Logging verbosity | `info` (or `debug` for troubleshooting) |

**Where to update:** SAM template (`template.yaml`) under `Globals.Function.Environment.Variables` or AWS Lambda console

---

### 1.2 Database (RDS PostgreSQL)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `DB_HOST` | String | Sensitive | AWS Systems Manager Parameter Store | Yes | RDS endpoint | `/hdicr/prod/db/host` (Parameter Store path) |
| `DB_PORT` | String | Public | SAM/Parameter Store | Yes | PostgreSQL port | `5432` |
| `DB_NAME` | String | Sensitive | AWS Systems Manager Parameter Store | Yes | Database name | `/hdicr/prod/db/name` |
| `DB_USER` | String | Sensitive | AWS Secrets Manager | Yes | RDS master user | `/hdicr/prod/db/user` |
| `DB_PASSWORD` | String | **Secret** | AWS Secrets Manager | Yes | RDS master password | `/hdicr/prod/db/password` (Secrets Manager) |
| `DB_SSL` | String | Public | SAM | Yes | Enforce SSL to RDS | `true` (confirmed active on trimg-db-v3) |
| `DB_POOL_MIN` | String | Public | SAM | No | Connection pool minimum | `2` (important for Lambda) |
| `DB_POOL_MAX` | String | Public | SAM | No | Connection pool maximum | `5` (Lambda concurrency consideration) |

**Where to update:**
- **DB_HOST, DB_PORT, DB_NAME:** AWS Systems Manager Parameter Store (Standard parameters, non-secret)
  - Path: `/hdicr/prod/db/{host,port,name}`
  - Update via: `aws ssm put-parameter --name /hdicr/prod/db/host --value "new-host" --type "String" --overwrite`
- **DB_USER, DB_PASSWORD:** AWS Secrets Manager (SecureString type)
  - Path: `/hdicr/prod/db/{user,password}` (or as JSON secret)
  - Update via: `aws secretsmanager update-secret --secret-id /hdicr/prod/db/password --secret-string "new-password"`
- **SAM references:** `template.yaml` retrieves these at deployment time

**Critical notes:**
- RDS instance `trimg-db-v3` currently has **storage encryption disabled** — this must be remediated before prod
- SSL enforcement is enabled (`rds.force_ssl=1`) — good
- Multi-AZ is off, deletion protection is off — consider for prod readiness

---

### 1.3 Authentication (Auth0)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `AUTH0_DOMAIN` | String | Public | Auth0 dashboard (Tenant Settings) | Yes | Auth0 tenant domain | `your-tenant.eu.auth0.com` |
| `AUTH0_CLIENT_ID` | String | Sensitive | Auth0 → Applications | Yes | HDICR app client ID | `xxxxx` (from Auth0 Application settings) |
| `AUTH0_CLIENT_SECRET` | String | **Secret** | Auth0 → Applications | Yes | HDICR app client secret | Stored in Secrets Manager |
| `AUTH0_AUDIENCE` | String | Public | Auth0 → APIs | Yes | API identifier (for JWT validation) | `https://api.hdicr.trulyimagined.com` |

**Where to update:**
- **AUTH0_DOMAIN, AUTH0_CLIENT_ID:** AWS Systems Manager Parameter Store
  - Path: `/hdicr/prod/auth0/{domain,client_id}`
  - Update via: AWS Systems Manager Parameter Store console or CLI
- **AUTH0_CLIENT_SECRET:** AWS Secrets Manager
  - Path: `/hdicr/prod/auth0/client_secret`
  - Update via: AWS Secrets Manager console (or CLI)
- **AUTH0_AUDIENCE:** SAM template (static, public)

**Shared with TI:** Auth0_DOMAIN and AUTH0_AUDIENCE are shared; Auth0_CLIENT_ID and AUTH0_CLIENT_SECRET are different per app (HDICR vs TI)

---

### 1.4 Stripe Identity (KYC/AML)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `STRIPE_SECRET_KEY` | String | **Secret** | Stripe Dashboard → API Keys | Yes | Stripe Secret API Key (Live or Test) | Stored in Secrets Manager |
| `STRIPE_PUBLISHABLE_KEY` | String | Sensitive | Stripe Dashboard → API Keys | Yes | Stripe Publishable Key | Stored in Parameter Store (not truly public, but less sensitive than secret) |
| `STRIPE_WEBHOOK_SECRET` | String | **Secret** | Stripe Dashboard → Webhooks | Yes | Webhook signing secret for Stripe → Lambda | Stored in Secrets Manager |

**Where to update:**
- **STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET:** AWS Secrets Manager
  - Path: `/hdicr/prod/stripe/{secret_key,webhook_secret}`
  - Update via: AWS Secrets Manager console
- **STRIPE_PUBLISHABLE_KEY:** AWS Systems Manager Parameter Store
  - Path: `/hdicr/prod/stripe/publishable_key`

**Stripe-specific:**
- Webhook secret is critical — if Stripe calls Lambda with an invalid signature, reject it
- Rotate API keys in Stripe dashboard; update Secrets Manager immediately after

---

### 1.5 JWT Signing Keys (Shared with TI)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `JWT_SIGNING_KEY` | String | **Secret** | AWS Secrets Manager | Yes | Private key for signing JWTs (HDICR generates tokens) | Stored in Secrets Manager (PEM format) |
| `JWT_SIGNING_KEY_ID` | String | Public | AWS Systems Manager Parameter Store | Yes | Key ID/version for key rotation | Incremented on rotation (v1, v2, etc.) |
| `JWT_PUBLIC_KEY` | String | Public | AWS Systems Manager Parameter Store | Yes | Public key for TI to verify HDICR JWTs | Stored in Parameter Store (PEM format) |

**Where to update:**
- **JWT_SIGNING_KEY:** AWS Secrets Manager
  - Path: `/hdicr/prod/jwt/signing_key`
- **JWT_SIGNING_KEY_ID:** AWS Systems Manager Parameter Store
  - Path: `/hdicr/prod/jwt/signing_key_id`
- **JWT_PUBLIC_KEY:** AWS Systems Manager Parameter Store (also replicated to TI)
  - Path: `/hdicr/prod/jwt/public_key`

**Key rotation strategy (see Section 4):**
- Generate new keypair
- Store private key in Secrets Manager with versioned key ID
- Publish public key to Parameter Store
- Update both HDICR and TI to accept new key ID
- Keep old public key for 30+ days for verification of existing tokens

---

### 1.6 API Gateway & Lambda

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `API_GATEWAY_ENDPOINT` | String | Public | CloudFormation/SAM output | Yes | Base URL for HDICR API | `https://xxxxx.execute-api.eu-west-1.amazonaws.com/prod` (auto-set) |
| `LAMBDA_TIMEOUT` | Number | Public | SAM template | Yes | Lambda execution timeout (seconds) | `30` (or higher if Stripe calls are slow) |
| `LAMBDA_MEMORY` | Number | Public | SAM template | Yes | Lambda memory allocation (MB) | `512` or `1024` (affects CPU & cost) |

**Where to update:**
- **SAM template** (`template.yaml`): `Timeout`, `MemorySize` under `Globals.Function` or per-function

**Lambda considerations:**
- Cold start time matters if HDICR is called frequently
- RDS connection pooling is critical (Lambdas are ephemeral)
- Stripe Identity calls can be slow; ensure timeout is high enough

---

### 1.7 Logging & Monitoring

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `CLOUDWATCH_LOG_GROUP` | String | Public | CloudFormation/SAM (auto-set) | No | CloudWatch log group name | `/aws/lambda/hdicr-prod` (auto-created) |
| `SENTRY_DSN` | String | Sensitive | Sentry → Projects | No | Sentry error tracking endpoint | `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx` (optional, TI uses this; HDICR can too) |

**Where to update:**
- **SAM template** or Lambda console (env variable)
- **Sentry DSN:** If integrated, store in Secrets Manager

---

## 2. TI Environment Variables (Vercel + Next.js)

### 2.1 Runtime Environment Variables (Vercel)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `NODE_ENV` | String | Public | Vercel auto-set | Yes | `production` on prod | Auto-set by Vercel |
| `NEXT_PUBLIC_APP_URL` | String | Public | Vercel dashboard | Yes | Frontend base URL | `https://trulyimagined.com` (public, used in client-side code) |
| `NEXT_PUBLIC_API_URL` | String | Public | Vercel dashboard | Yes | Backend API base URL (same as NEXT_PUBLIC_APP_URL if same domain) | `https://trulyimagined.com/api` |

**Where to update:** Vercel Project Settings → Environment Variables (separate configs for dev/staging/prod)

---

### 2.2 Database (RDS PostgreSQL — TI's own instance)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `DATABASE_URL` | String | **Secret** | AWS Secrets Manager or .env.local | Yes | PostgreSQL connection string (full URL) | `postgresql://user:pass@host:5432/db_name` |
| `DB_HOST` | String | Sensitive | AWS Systems Manager Parameter Store | Yes | RDS endpoint | `/ti/prod/db/host` |
| `DB_PORT` | String | Public | SAM/Parameter Store | Yes | PostgreSQL port | `5432` |
| `DB_NAME` | String | Sensitive | AWS Systems Manager Parameter Store | Yes | Database name | `/ti/prod/db/name` |
| `DB_USER` | String | Sensitive | AWS Secrets Manager | Yes | RDS user | `/ti/prod/db/user` |
| `DB_PASSWORD` | String | **Secret** | AWS Secrets Manager | Yes | RDS password | `/ti/prod/db/password` |
| `DB_SSL` | String | Public | .env | Yes | Enforce SSL to RDS | `true` |

**Where to update:**
- **Vercel dashboard:** Environment Variables tab (for DATABASE_URL or individual components)
- **AWS Systems Manager Parameter Store:** `/ti/prod/db/{host,port,name}`
- **AWS Secrets Manager:** `/ti/prod/db/{user,password}`
- **Migration strategy:** If using Prisma or Drizzle ORM, migrations run on deployment

**Important:** TI's RDS instance is separate from HDICR's; do not mix credentials.

---

### 2.3 Authentication (Auth0 — Shared with HDICR)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `NEXT_PUBLIC_AUTH0_DOMAIN` | String | Public | Auth0 dashboard | Yes | Auth0 tenant domain (public, used in client) | `your-tenant.eu.auth0.com` |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | String | Public | Auth0 → Applications | Yes | TI app client ID (public, used in client) | `xxxxx` |
| `AUTH0_CLIENT_SECRET` | String | **Secret** | Auth0 → Applications | Yes | TI app client secret (server-only) | Stored in Vercel env (not in git) |
| `AUTH0_BASE_URL` | String | Public | Vercel dashboard | Yes | Callback URL for Auth0 | `https://trulyimagined.com` |
| `AUTH0_ISSUER_BASE_URL` | String | Public | Auth0 → Settings | Yes | Auth0 issuer URL | `https://your-tenant.eu.auth0.com` |
| `AUTH0_SECRET` | String | **Secret** | Generated by you | Yes | Secret for Auth0 session encryption | Random 32+ character string |

**Where to update:** Vercel Project Settings → Environment Variables

**Auth0 integration specifics:**
- `NEXT_PUBLIC_` prefix = client-side code (don't include secrets)
- `AUTH0_CLIENT_SECRET` and `AUTH0_SECRET` are server-side only (Vercel env, not in code)
- Both HDICR and TI authenticate users via Auth0, but have separate client IDs/secrets

---

### 2.4 Stripe Payments (TI's payment processing)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | String | Public | Stripe Dashboard → API Keys | Yes | Stripe publishable key (client-side, payment form) | `pk_live_xxxxx` (or `pk_test_xxxxx`) |
| `STRIPE_SECRET_KEY` | String | **Secret** | Stripe Dashboard → API Keys | Yes | Stripe secret key (server-side, API calls) | `sk_live_xxxxx` |
| `STRIPE_WEBHOOK_SECRET` | String | **Secret** | Stripe Dashboard → Webhooks | Yes | Webhook signing secret for Stripe → Vercel | `whsec_xxxxx` |

**Where to update:** Vercel Project Settings → Environment Variables

**Important:** 
- This is TI's Stripe account (for payments)
- HDICR has its own Stripe account (for Identity/KYC)
- Do **not** mix the two Stripe API keys

---

### 2.5 Resend (Transactional Email)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `RESEND_API_KEY` | String | **Secret** | Resend Dashboard → API Keys | Yes | Resend API key for sending emails | `re_xxxxx` |
| `RESEND_FROM_EMAIL` | String | Public | Resend domain config | Yes | Sender email (must be verified domain) | `noreply@trulyimagined.com` or `support@trulyimagined.com` |

**Where to update:** Vercel Project Settings → Environment Variables

**Email addresses (from memory):**
- `support@trulyimagined.com`
- `noreply@trulyimagined.com`
- `notification@trulyimagined.com`
All are configured in Resend with HTML templates.

---

### 2.6 AWS (S3 for Media Uploads)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `AWS_REGION` | String | Public | .env | Yes | AWS region for S3 | `eu-west-1` |
| `AWS_S3_BUCKET` | String | Public | .env | Yes | S3 bucket name for media uploads | `ti-media-prod` or similar |
| `AWS_ACCESS_KEY_ID` | String | Sensitive | AWS IAM | Yes | IAM access key for S3 uploads | Stored in Vercel env (not in git) |
| `AWS_SECRET_ACCESS_KEY` | String | **Secret** | AWS IAM | Yes | IAM secret access key for S3 uploads | Stored in Vercel env (not in git) |
| `AWS_S3_UPLOAD_URL_EXPIRY` | String | Public | .env | No | Presigned URL expiry (seconds) | `3600` (1 hour) |

**Where to update:** Vercel Project Settings → Environment Variables

**AWS IAM best practice:**
- Create a dedicated IAM user for TI (not root credentials)
- Scope permissions to the specific S3 bucket and `s3:PutObject`, `s3:GetObject` actions only
- Do **not** give `s3:DeleteObject` permissions (prevents accidental deletion)

---

### 2.7 JWT & Verifiable Credentials

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `JWT_PUBLIC_KEY` (from HDICR) | String | Public | AWS Systems Manager Parameter Store | Yes | Public key to verify HDICR-signed JWTs | Retrieved from `/hdicr/prod/jwt/public_key` |
| `JWT_SIGNING_KEY` (TI's own) | String | **Secret** | AWS Secrets Manager or generated at deployment | Yes | Private key for TI to sign W3C Verifiable Credentials | TI's own keypair (separate from HDICR) |
| `JWT_SIGNING_KEY_ID` | String | Public | .env | Yes | Key ID for TI's credential signing | Incremented on rotation |
| `W3C_CREDENTIAL_ISSUER` | String | Public | .env | Yes | Issuer identifier for W3C credentials | `https://trulyimagined.com` or similar |

**Where to update:**
- **Vercel dashboard** for runtime environment variables
- **Code** for W3C_CREDENTIAL_ISSUER (static)

**Credential issuance flow:**
1. Actor verifies identity with HDICR (Stripe Identity)
2. TI queries HDICR consent rules
3. TI issues W3C Verifiable Credential signed with TI's JWT_SIGNING_KEY
4. Credential can be verified by anyone using TI's JWT_PUBLIC_KEY

---

### 2.8 Sentry (Error Tracking)

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `NEXT_PUBLIC_SENTRY_DSN` | String | Public | Sentry → Projects | Yes | Sentry DSN (client-side error tracking) | `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx` |
| `SENTRY_AUTH_TOKEN` | String | **Secret** | Sentry → Auth Tokens | No | Auth token for Sentry releases (build integration) | Optional; for source map uploads |

**Where to update:** Vercel Project Settings → Environment Variables

---

### 2.9 HDICR API Integration

| Variable | Type | Classification | Source | Required? | Purpose | Example/Notes |
|----------|------|-----------------|--------|-----------|---------|----------------|
| `HDICR_API_URL` | String | Public | SAM output or .env | Yes | HDICR API endpoint (for TI to call) | `https://xxxxx.execute-api.eu-west-1.amazonaws.com/prod` |
| `HDICR_API_CLIENT_ID` | String | Sensitive | Auth0 (Machine-to-Machine) | Yes | Client ID for TI → HDICR service-to-service auth | Stored in Vercel env |
| `HDICR_API_CLIENT_SECRET` | String | **Secret** | Auth0 (Machine-to-Machine) | Yes | Client secret for TI → HDICR calls | Stored in Vercel env (not in git) |

**Where to update:** Vercel Project Settings → Environment Variables

**HDICR integration notes:**
- TI authenticates to HDICR using Auth0 Machine-to-Machine (M2M) flow
- M2M credentials must be separate from user-facing Auth0 credentials
- All HDICR API calls from TI should be authenticated and tracked

---

## 3. Summary Table: All Environment Variables by Location

| System | Variable | Storage Location | Update Method | Rotation Frequency | Critical? |
|--------|----------|-------------------|----------------|--------------------|-----------|
| **HDICR** | DB_HOST, DB_PORT, DB_NAME | AWS SSM Parameter Store | CLI or console | As needed | Yes |
| **HDICR** | DB_USER, DB_PASSWORD | AWS Secrets Manager | Console or CLI | Every 90 days | **Critical** |
| **HDICR** | AUTH0_DOMAIN, CLIENT_ID | AWS SSM Parameter Store | Console or CLI | As needed | Yes |
| **HDICR** | AUTH0_CLIENT_SECRET | AWS Secrets Manager | Console or CLI | Every 90 days | **Critical** |
| **HDICR** | STRIPE_SECRET_KEY | AWS Secrets Manager | Stripe → Secrets Manager | Every 180 days | **Critical** |
| **HDICR** | STRIPE_WEBHOOK_SECRET | AWS Secrets Manager | Stripe → Secrets Manager | Every 180 days | **Critical** |
| **HDICR** | JWT_SIGNING_KEY | AWS Secrets Manager | Rotation playbook | Every 180 days | **Critical** |
| **HDICR** | JWT_PUBLIC_KEY | AWS SSM Parameter Store | Rotation playbook | Every 180 days | Yes |
| **TI** | DATABASE_URL (or components) | Vercel Environment Variables | Vercel dashboard | Every 90 days | **Critical** |
| **TI** | NEXT_PUBLIC_AUTH0_DOMAIN, CLIENT_ID | Vercel Environment Variables | Vercel dashboard | As needed | Yes |
| **TI** | AUTH0_CLIENT_SECRET | Vercel Environment Variables | Vercel dashboard | Every 90 days | **Critical** |
| **TI** | STRIPE_PUBLISHABLE_KEY | Vercel Environment Variables | Vercel dashboard | Every 180 days | Yes |
| **TI** | STRIPE_SECRET_KEY | Vercel Environment Variables | Vercel dashboard | Every 180 days | **Critical** |
| **TI** | RESEND_API_KEY | Vercel Environment Variables | Vercel dashboard | Every 180 days | **Critical** |
| **TI** | AWS_S3 (keys) | Vercel Environment Variables | Vercel dashboard | Every 90 days | **Critical** |
| **TI** | JWT_PUBLIC_KEY (from HDICR) | Vercel Environment Variables or code | Vercel dashboard | Every 180 days | Yes |
| **TI** | JWT_SIGNING_KEY (own) | Vercel Environment Variables | Vercel dashboard | Every 180 days | **Critical** |
| **Shared** | AUTH0_DOMAIN | AWS SSM + Vercel | Both locations | As needed | Yes |
| **Shared** | JWT keys | AWS Secrets Manager + Vercel | Both locations | Every 180 days | **Critical** |
| **Shared** | HDICR_API credentials (Auth0 M2M) | Vercel only | Vercel dashboard | Every 90 days | **Critical** |

---

## 4. Secret Rotation Playbook

### 4.1 Database Password Rotation (RDS)

**Frequency:** Every 90 days

**Steps:**

1. **Create a new RDS password:**
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier trimg-db-v3 \
     --master-user-password "$(openssl rand -base64 32)" \
     --apply-immediately
   ```
   Save the new password securely.

2. **Update AWS Secrets Manager:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id /hdicr/prod/db/password \
     --secret-string "NEW_PASSWORD"
   ```

3. **Update TI's database password (separate RDS instance):**
   Same process for TI's RDS instance.

4. **Restart applications (zero-downtime):**
   - HDICR: New Lambda deployments pick up the new password on cold start. Existing connections will time out and reconnect.
   - TI: Redeploy on Vercel to pick up new DATABASE_URL.

5. **Monitor:** Check CloudWatch for connection errors. If old connections persist, do a Lambda alias switch or Vercel rollover.

---

### 4.2 Auth0 Client Secret Rotation

**Frequency:** Every 90 days

**Steps:**

1. **Generate a new client secret in Auth0:**
   - Auth0 Dashboard → Applications → HDICR (or TI) → Settings
   - Under "Client Credentials," click "Rotate" to generate a new secret
   - Auth0 will display both old and new secrets for a grace period

2. **Update Secrets Manager:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id /hdicr/prod/auth0/client_secret \
     --secret-string "NEW_SECRET"
   ```
   (Same for TI in Vercel)

3. **Redeploy immediately:**
   - HDICR: Deploy new Lambda version
   - TI: Redeploy on Vercel
   
4. **Wait 24 hours, then revoke the old secret in Auth0:**
   - This ensures all running instances have picked up the new secret
   - Only revoke in Auth0 after confirming deployments are live

---

### 4.3 Stripe API Key Rotation

**Frequency:** Every 180 days (or immediately if compromised)

**Steps:**

1. **Generate a new API key in Stripe:**
   - Stripe Dashboard → Developers → API Keys
   - Click "Create restricted key" (prefer restricted keys with scoped permissions)
   - Copy the new secret key

2. **Update Secrets Manager:**
   ```bash
   # For HDICR
   aws secretsmanager update-secret \
     --secret-id /hdicr/prod/stripe/secret_key \
     --secret-string "sk_live_xxxxx"
   
   # For TI
   # (via Vercel dashboard)
   ```

3. **For webhook secrets:**
   - Stripe Dashboard → Developers → Webhooks → your endpoint
   - Click the endpoint, scroll to "Signing secret," click "Reveal"
   - Copy the new secret
   - Update Secrets Manager

4. **Redeploy:**
   - HDICR: Deploy new Lambda version
   - TI: Redeploy on Vercel

5. **Delete old API key in Stripe (after 24 hours):**
   - Stripe Dashboard → Developers → API Keys
   - Click the old key, then "Delete"

---

### 4.4 JWT Signing Key Rotation (HDICR & TI)

**Frequency:** Every 180 days

**Context:** HDICR signs JWTs; TI verifies them. Both issue W3C Verifiable Credentials. Key rotation must be transparent to existing tokens.

**Strategy: Key Versioning**
- Keep two versions of keys in production temporarily
- HDICR signs new tokens with the new key, but verifies using both old and new
- TI verifies using both old and new keys
- After 30+ days (max token lifetime), deprecate the old key

**Steps:**

1. **Generate new keypair (outside of repos):**
   ```bash
   openssl genrsa -out private_key_v2.pem 4096
   openssl rsa -in private_key_v2.pem -pubout -out public_key_v2.pem
   ```

2. **Store new private key in AWS Secrets Manager (HDICR):**
   ```bash
   aws secretsmanager create-secret \
     --name /hdicr/prod/jwt/signing_key_v2 \
     --secret-string "$(cat private_key_v2.pem)"
   ```

3. **Publish new public key to Parameter Store (accessible by TI):**
   ```bash
   aws ssm put-parameter \
     --name /hdicr/prod/jwt/public_key_v2 \
     --value "$(cat public_key_v2.pem)" \
     --type "String" \
     --overwrite
   ```

4. **Update HDICR code:**
   - Read both `signing_key_v1` and `signing_key_v2` from Secrets Manager
   - Sign new JWTs with `signing_key_v2`
   - Update `JWT_SIGNING_KEY_ID` to `v2`
   - Deploy HDICR

5. **Update TI code:**
   - Read both `public_key_v1` and `public_key_v2` from Parameter Store
   - Verify JWTs against both keys (for compatibility with old tokens)
   - Update `JWT_PUBLIC_KEY` to include both
   - Deploy TI

6. **After 30+ days (max token lifetime):**
   - Remove `signing_key_v1` from HDICR (only sign with v2)
   - Remove `public_key_v1` from TI (only verify with v2)
   - Delete the old secrets from AWS Secrets Manager and Parameter Store

---

### 4.5 AWS S3 Access Key Rotation (TI)

**Frequency:** Every 90 days

**Steps:**

1. **Create new IAM access key:**
   ```bash
   aws iam create-access-key --user-name ti-s3-uploader
   ```
   Save the new Access Key ID and Secret Access Key.

2. **Update Vercel Environment Variables:**
   - Vercel Dashboard → Project Settings → Environment Variables
   - Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   - Redeploy to all environments

3. **Delete old IAM access key (after 24 hours):**
   ```bash
   aws iam delete-access-key \
     --user-name ti-s3-uploader \
     --access-key-id "OLD_KEY_ID"
   ```

---

### 4.6 Resend API Key Rotation

**Frequency:** Every 180 days

**Steps:**

1. **Generate new API key in Resend:**
   - Resend Dashboard → API Tokens
   - Click "Create New Token"
   - Copy the new token

2. **Update Vercel Environment Variables:**
   - Vercel Dashboard → Project Settings → Environment Variables
   - Update `RESEND_API_KEY`
   - Redeploy TI

3. **Delete old API key in Resend (after 24 hours):**
   - Resend Dashboard → API Tokens
   - Click the old token, then "Delete"

---

## 5. Secrets Management Best Practices

### 5.1 Do's
- ✅ Use AWS Secrets Manager for secrets that change frequently (passwords, API keys, JWT keys)
- ✅ Use AWS Systems Manager Parameter Store for non-secret config (hostnames, public keys, IDs)
- ✅ Rotate secrets every 90 days (passwords, API keys) or 180 days (signing keys)
- ✅ Use IAM roles instead of access keys where possible (HDICR Lambda has an execution role)
- ✅ Enable versioning on Secrets Manager secrets (allows rollback)
- ✅ Log all secret access to CloudTrail (audit trail)
- ✅ Use restricted Stripe API keys (scoped permissions, not full access)
- ✅ Store Vercel environment variables encrypted (Vercel does this by default)

### 5.2 Don'ts
- ❌ Commit secrets to version control (ever)
- ❌ Use .env files in production (use Vercel, Secrets Manager, or Parameter Store)
- ❌ Share AWS access keys between environments (dev, staging, prod need separate keys)
- ❌ Log secrets in CloudWatch or Sentry
- ❌ Use the same Stripe API key for test and live (separate credentials)
- ❌ Use the same JWT signing key between HDICR and TI (separate keypairs)
- ❌ Hardcode secret values in SAM templates or Next.js config files

### 5.3 Emergency Key Rotation (Compromised Secret)

If a secret is leaked:

1. **Immediately rotate in the source system:**
   - Auth0 Dashboard (revoke old client secret)
   - Stripe Dashboard (delete old API key)
   - AWS (create new access key, delete old)
   - Resend (delete old token)

2. **Immediately update all applications:**
   - HDICR: AWS Secrets Manager + Lambda redeployment
   - TI: Vercel environment variables + redeployment

3. **Monitor for unauthorized usage:**
   - Check CloudWatch for suspicious API calls
   - Check Stripe dashboard for unauthorized transactions
   - Check Auth0 logs for unusual logins

---

## 6. Environment Variable Checklist Before Production Deployment

Use this checklist to ensure all secrets are rotated and configured correctly:

### HDICR
- [ ] All RDS credentials rotated and stored in AWS Secrets Manager
- [ ] Auth0 client secret rotated and stored in AWS Secrets Manager
- [ ] Stripe API keys (Secret + Webhook) stored in AWS Secrets Manager
- [ ] JWT signing key generated, private key in Secrets Manager, public key in Parameter Store
- [ ] SAM template uses `!Sub` or parameter references (never hardcoded values)
- [ ] Lambda execution role has least-privilege IAM permissions
- [ ] Lambda timeout is appropriate for Stripe Identity calls (recommend 30+ seconds)
- [ ] Lambda memory is tuned (512 MB or higher)
- [ ] CloudWatch logging is enabled
- [ ] VPC configuration (if RDS is in private subnet) is correct
- [ ] API Gateway has CORS, rate limiting, and request validation enabled
- [ ] Webhook signature verification for Stripe is implemented

### TI
- [ ] DATABASE_URL (or components) stored in Vercel environment variables, never in .env.local
- [ ] Auth0 credentials stored in Vercel environment variables
- [ ] Stripe API keys (Publishable + Secret + Webhook) stored in Vercel environment variables
- [ ] Resend API key stored in Vercel environment variables
- [ ] AWS S3 credentials stored in Vercel environment variables (not in code)
- [ ] JWT public key (from HDICR) stored in Vercel environment variables
- [ ] JWT signing key (TI's own) stored in Vercel environment variables
- [ ] HDICR API credentials (Auth0 M2M) stored in Vercel environment variables
- [ ] .env.example file exists with placeholders (no actual secrets)
- [ ] .env.local is in .gitignore
- [ ] Sentry DSN configured for error tracking
- [ ] All API calls to HDICR are authenticated (M2M auth flow)
- [ ] Error messages do not leak secrets or internal details

---

## 7. Next Steps

1. **Audit current state:**
   - Run through Section 3 summary table
   - Identify which variables are still hardcoded or in .env.local
   - Plan rotation for all **Critical** items

2. **Implement secure storage:**
   - For HDICR: Migrate all secrets to AWS Secrets Manager
   - For TI: Migrate all secrets to Vercel environment variables
   - Test that applications read from these sources at runtime

3. **Schedule rotation:**
   - Database passwords: 90-day cycle
   - API keys (Auth0, Stripe, Resend, AWS): 90-day cycle
   - JWT signing keys: 180-day cycle with versioning

4. **Document runbooks:**
   - Create a runbook for each secret type (see Section 4)
   - Add to team wiki or README
   - Assign owner for each rotation cycle

5. **Monitor & audit:**
   - Enable CloudTrail for all AWS API calls
   - Set up alerts for suspicious secret access
   - Review audit logs monthly

---

## Appendix: Example .env.example Files

### HDICR/.env.example
```
# Database
DB_HOST=your-rds-endpoint.eu-west-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=hdicr_prod
DB_USER=postgres
DB_PASSWORD=***STORED_IN_SECRETS_MANAGER***
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=5

# Auth0
AUTH0_DOMAIN=your-tenant.eu.auth0.com
AUTH0_CLIENT_ID=***STORED_IN_PARAMETER_STORE***
AUTH0_CLIENT_SECRET=***STORED_IN_SECRETS_MANAGER***
AUTH0_AUDIENCE=https://api.hdicr.trulyimagined.com

# Stripe Identity
STRIPE_SECRET_KEY=***STORED_IN_SECRETS_MANAGER***
STRIPE_PUBLISHABLE_KEY=***STORED_IN_PARAMETER_STORE***
STRIPE_WEBHOOK_SECRET=***STORED_IN_SECRETS_MANAGER***

# JWT
JWT_SIGNING_KEY=***STORED_IN_SECRETS_MANAGER***
JWT_SIGNING_KEY_ID=v1
JWT_PUBLIC_KEY=***STORED_IN_PARAMETER_STORE***

# Lambda
NODE_ENV=production
STAGE=prod
LOG_LEVEL=info
LAMBDA_TIMEOUT=30
LAMBDA_MEMORY=512
```

### TI/.env.example
```
# Vercel
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://trulyimagined.com
NEXT_PUBLIC_API_URL=https://trulyimagined.com/api

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ti_prod
DB_SSL=true

# Auth0
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.eu.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=***PUBLIC_ID***
AUTH0_CLIENT_SECRET=***STORED_IN_VERCEL_ENV***
AUTH0_BASE_URL=https://trulyimagined.com
AUTH0_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
AUTH0_SECRET=***GENERATED_32_CHAR_STRING***

# Stripe Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_***
STRIPE_SECRET_KEY=***STORED_IN_VERCEL_ENV***
STRIPE_WEBHOOK_SECRET=***STORED_IN_VERCEL_ENV***

# Resend
RESEND_API_KEY=***STORED_IN_VERCEL_ENV***
RESEND_FROM_EMAIL=noreply@trulyimagined.com

# AWS S3
AWS_REGION=eu-west-1
AWS_S3_BUCKET=ti-media-prod
AWS_ACCESS_KEY_ID=***STORED_IN_VERCEL_ENV***
AWS_SECRET_ACCESS_KEY=***STORED_IN_VERCEL_ENV***
AWS_S3_UPLOAD_URL_EXPIRY=3600

# JWT & Credentials
JWT_PUBLIC_KEY=***FROM_HDICR_PARAMETER_STORE***
JWT_SIGNING_KEY=***TI_OWN_KEY_IN_VERCEL_ENV***
JWT_SIGNING_KEY_ID=v1
W3C_CREDENTIAL_ISSUER=https://trulyimagined.com

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://***@***.ingest.sentry.io/***

# HDICR API Integration
HDICR_API_URL=https://xxxxx.execute-api.eu-west-1.amazonaws.com/prod
HDICR_API_CLIENT_ID=***AUTH0_M2M_CLIENT_ID***
HDICR_API_CLIENT_SECRET=***STORED_IN_VERCEL_ENV***
```

---

## Document Version & Maintenance

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-04 | Generated | Initial comprehensive audit framework |

**Last reviewed:** 2024-04-13  
**Next review:** 2024-07-13 (quarterly)

