# Secret Rotation Schedule & Calendar
## HDICR + TI Production

---

## Rotation Cycles

### 90-Day Cycle (Database Passwords, API Keys, OAuth Secrets)
- Database passwords (HDICR RDS, TI RDS)
- Auth0 client secrets (HDICR, TI)
- AWS S3 access keys (TI)
- HDICR → TI service-to-service (M2M) credentials

### 180-Day Cycle (Signing Keys, Provider API Keys)
- JWT signing keys (HDICR & TI)
- Stripe API keys (HDICR Identity, TI Payments)
- Resend API key

---

## Master Rotation Calendar

**Starting point:** Assume all secrets were last rotated on **2024-04-01** (adjust to your actual date)

| Cycle | Due Date | Secret(s) | System(s) | Owner | Status |
|-------|----------|-----------|-----------|-------|--------|
| 90-day | **2024-07-01** | RDS passwords | HDICR, TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-07-01** | Auth0 client secrets | HDICR, TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-07-01** | AWS S3 access keys | TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-07-01** | HDICR → TI M2M creds | TI | DevOps | ⏳ Scheduled |
| **180-day** | **2024-10-01** | JWT signing keys | HDICR, TI | Security | ⏳ Scheduled |
| **180-day** | **2024-10-01** | Stripe API keys | HDICR, TI | DevOps | ⏳ Scheduled |
| **180-day** | **2024-10-01** | Resend API key | TI | DevOps | ⏳ Scheduled |
| — | — | — | — | — | — |
| 90-day | **2024-10-01** | RDS passwords | HDICR, TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-10-01** | Auth0 client secrets | HDICR, TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-10-01** | AWS S3 access keys | TI | DevOps | ⏳ Scheduled |
| 90-day | **2024-10-01** | HDICR → TI M2M creds | TI | DevOps | ⏳ Scheduled |

---

## Quarterly Rotation Schedule (Recommended)

Pick **one day per quarter** to batch all 90-day rotations:

### Q2 2024 (April 1 – June 30)
**Rotation Window:** June 20 – June 30
- [ ] RDS passwords (HDICR, TI)
- [ ] Auth0 client secrets (HDICR, TI)
- [ ] AWS S3 access keys (TI)
- [ ] HDICR → TI M2M credentials (TI)

**Preparation (June 15):**
1. Schedule maintenance window (1-2 hours)
2. Notify stakeholders
3. Pre-generate new secrets
4. Prepare rollback plan

**Execution (June 28, 2:00 PM UTC):**
1. Create new secrets in source systems (RDS, Auth0, AWS IAM, Secrets Manager)
2. Update all storage locations (Secrets Manager, Parameter Store, Vercel)
3. Redeploy HDICR and TI
4. Monitor for 2 hours for errors

**Post-rotation (June 29):**
1. Revoke old secrets in source systems
2. Verify audit logs
3. Update documentation with new dates

---

### Q3 2024 (July 1 – September 30)
**Rotation Window:** September 15 – September 30
- [ ] RDS passwords (HDICR, TI)
- [ ] Auth0 client secrets (HDICR, TI)
- [ ] AWS S3 access keys (TI)
- [ ] HDICR → TI M2M credentials (TI)
- [ ] **JWT signing keys (HDICR, TI)** ← 180-day marker
- [ ] **Stripe API keys (HDICR, TI)** ← 180-day marker
- [ ] **Resend API key (TI)** ← 180-day marker

---

### Q4 2024 (October 1 – December 31)
**Rotation Window:** December 15 – December 30
- [ ] RDS passwords (HDICR, TI)
- [ ] Auth0 client secrets (HDICR, TI)
- [ ] AWS S3 access keys (TI)
- [ ] HDICR → TI M2M credentials (TI)

---

### Q1 2025 (January 1 – March 31)
**Rotation Window:** March 15 – March 30
- [ ] RDS passwords (HDICR, TI)
- [ ] Auth0 client secrets (HDICR, TI)
- [ ] AWS S3 access keys (TI)
- [ ] HDICR → TI M2M credentials (TI)
- [ ] **JWT signing keys (HDICR, TI)** ← 180-day marker
- [ ] **Stripe API keys (HDICR, TI)** ← 180-day marker
- [ ] **Resend API key (TI)** ← 180-day marker

---

## Pre-Rotation Checklist

**One week before rotation window:**

- [ ] Notify development and operations teams
- [ ] Check for any active incidents or deployments
- [ ] Prepare new secrets (generate, store securely in draft form)
- [ ] Verify access to all secret storage systems (AWS, Vercel, Auth0, Stripe, Resend)
- [ ] Draft rollback plan
- [ ] Prepare monitoring dashboards (CloudWatch, Sentry)

**24 hours before rotation:**

- [ ] Confirm maintenance window with stakeholders
- [ ] Have all new secrets ready and verified
- [ ] Test secret update process in dev/staging (if possible)
- [ ] Brief on-call engineer on rotation procedure

---

## During-Rotation Checklist

**In order of execution:**

### Step 1: Create New Secrets (30 min)

- [ ] Generate new RDS passwords (or let RDS generate them)
- [ ] Rotate Auth0 client secrets (click "Rotate" in Auth0 dashboard)
- [ ] Generate new AWS IAM access keys
- [ ] Generate new JWT keypair (if 180-day cycle)
- [ ] Rotate Stripe API keys and webhook secrets (if 180-day cycle)
- [ ] Rotate Resend API key (if 180-day cycle)

### Step 2: Update Secret Storage (30 min)

- [ ] Update AWS Secrets Manager:
  - `/hdicr/prod/db/password`
  - `/hdicr/prod/auth0/client_secret`
  - `/hdicr/prod/jwt/signing_key` (if 180-day)
  - `/hdicr/prod/stripe/secret_key` (if 180-day)
  - `/hdicr/prod/stripe/webhook_secret` (if 180-day)

- [ ] Update AWS Systems Manager Parameter Store:
  - `/hdicr/prod/jwt/public_key` (if 180-day)
  - `/hdicr/prod/stripe/publishable_key` (if 180-day)

- [ ] Update Vercel Environment Variables (TI):
  - `DATABASE_URL` (new RDS password)
  - `AUTH0_CLIENT_SECRET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `STRIPE_SECRET_KEY` (if 180-day)
  - `STRIPE_WEBHOOK_SECRET` (if 180-day)
  - `STRIPE_PUBLISHABLE_KEY` (if 180-day)
  - `RESEND_API_KEY` (if 180-day)
  - `JWT_SIGNING_KEY` (if 180-day)
  - `JWT_PUBLIC_KEY` (if 180-day)

### Step 3: Deploy Applications (30 min)

- [ ] Deploy HDICR Lambda (new SAM deployment)
  ```bash
  sam deploy --template-file template.yaml --stack-name hdicr-prod
  ```

- [ ] Redeploy TI on Vercel
  ```bash
  vercel deploy --prod
  ```

- [ ] Monitor deployments (CloudWatch, Vercel logs)

### Step 4: Verify (30 min)

- [ ] HDICR health check: `curl https://api.hdicr.trulyimagined.com/health`
- [ ] TI health check: `curl https://trulyimagined.com/api/health`
- [ ] Monitor CloudWatch for errors (RDS connection errors, 401 auth errors, etc.)
- [ ] Monitor Sentry for error spike
- [ ] Check Auth0 logs for failed authentications
- [ ] Test end-to-end flow: login → HDICR call → credential issuance

### Step 5: Revoke Old Secrets (24 hours after deployment)

**Only after confirming all systems are running smoothly:**

- [ ] Revoke old Auth0 client secret (Auth0 dashboard)
- [ ] Revoke old Stripe API key (Stripe dashboard)
- [ ] Revoke old Resend API token (Resend dashboard)
- [ ] Delete old AWS IAM access key (AWS console)
- [ ] Delete old RDS master password (RDS console, create new master user if needed)

---

## Post-Rotation Checklist

**24 hours after rotation:**

- [ ] Confirm no errors in CloudWatch logs
- [ ] Confirm no suspicious activity in audit logs (CloudTrail, Auth0, Stripe)
- [ ] Verify all applications are running normally
- [ ] Update rotation calendar with completion date
- [ ] Document any issues or surprises

**1 week after rotation:**

- [ ] Review logs for any unusual patterns
- [ ] Confirm all old secrets have been revoked
- [ ] Brief team on any lessons learned

---

## Emergency Rotation (Compromised Secret)

If a secret is leaked or compromised:

1. **Immediately rotate in the source system:**
   - Auth0 → Revoke and rotate client secret (same day, no grace period)
   - Stripe → Delete API key (same day)
   - AWS IAM → Delete access key (same day)
   - Resend → Delete API token (same day)
   - RDS → Change password (same day)

2. **Immediately update all applications:**
   - HDICR → Deploy new Lambda version (minutes)
   - TI → Redeploy on Vercel (minutes)

3. **Monitor aggressively:**
   - CloudWatch logs for suspicious activity
   - Stripe logs for unauthorized transactions
   - AWS CloudTrail for unauthorized API calls
   - Auth0 logs for suspicious logins

4. **Post-mortem (24 hours later):**
   - How was the secret leaked?
   - How can we prevent it in the future?
   - Any evidence of misuse?

---

## Tools & Commands Quick Reference

### AWS Secrets Manager (HDICR Secrets)

**Update a secret:**
```bash
aws secretsmanager update-secret \
  --secret-id /hdicr/prod/db/password \
  --secret-string "NEW_PASSWORD"
```

**List all secrets:**
```bash
aws secretsmanager list-secrets --filters Key=name,Values=/hdicr/prod/
```

**Get a secret (view current value):**
```bash
aws secretsmanager get-secret-value --secret-id /hdicr/prod/db/password
```

### AWS Systems Manager Parameter Store (HDICR Public Config)

**Update a parameter:**
```bash
aws ssm put-parameter \
  --name /hdicr/prod/jwt/public_key \
  --value "$(cat public_key.pem)" \
  --type "String" \
  --overwrite
```

**List all parameters:**
```bash
aws ssm describe-parameters --filters Key=Name,Values=/hdicr/prod/
```

**Get a parameter:**
```bash
aws ssm get-parameter --name /hdicr/prod/jwt/public_key
```

### Vercel (TI Environment Variables)

**List environment variables:**
```bash
vercel env list
```

**Update an environment variable:**
```bash
vercel env set STRIPE_SECRET_KEY "sk_live_xxxxx"
```

**Redeploy with new env vars:**
```bash
vercel deploy --prod
```

### AWS RDS (Database Password)

**Modify RDS password (generates new one automatically):**
```bash
aws rds modify-db-instance \
  --db-instance-identifier trimg-db-v3 \
  --master-user-password "$(openssl rand -base64 32)" \
  --apply-immediately
```

### Auth0 (Client Secrets)

**Rotate client secret (via Dashboard):**
1. Applications → Select app (HDICR or TI)
2. Settings → Client Credentials → Rotate

### Stripe (API Keys & Webhook Secrets)

**Rotate API key (via Dashboard):**
1. Developers → API Keys
2. Click old key → Delete

**Rotate webhook secret (via Dashboard):**
1. Developers → Webhooks
2. Click endpoint → Signing secret → Reveal & copy

### Generate JWT Keypair

```bash
# Generate private key
openssl genrsa -out private_key.pem 4096

# Extract public key
openssl rsa -in private_key.pem -pubout -out public_key.pem

# View private key (for copying to Secrets Manager)
cat private_key.pem

# View public key (for copying to Parameter Store)
cat public_key.pem
```

---

## Reminder: Why Rotation Matters

1. **Security:** If a key is leaked or guessed, rotation limits exposure window
2. **Compliance:** Most security standards (SOC 2, ISO 27001) require periodic key rotation
3. **Least privilege:** Regular rotation enforces that secrets are used only when needed
4. **Audit trail:** Rotation creates a timestamp for when keys changed (useful for investigations)

---

## Document Version

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-04-13 | Generated | Initial rotation schedule |

**Last updated:** 2024-04-13  
**Next review:** 2024-07-01 (before first rotation cycle)
