# Quick Reference: Environment Variables, Storage & Rotation
## HDICR + TI Production

---

## Storage Locations at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         HDICR                                    │
├──────────────────────────────┬──────────────────────────────────┤
│ AWS Systems Manager          │ AWS Secrets Manager              │
│ Parameter Store              │ (Encrypted secrets)              │
├──────────────────────────────┼──────────────────────────────────┤
│ • DB_HOST                    │ • DB_PASSWORD                    │
│ • DB_PORT                    │ • DB_USER (sometimes)            │
│ • DB_NAME                    │ • AUTH0_CLIENT_SECRET            │
│ • AUTH0_DOMAIN               │ • STRIPE_SECRET_KEY              │
│ • AUTH0_CLIENT_ID            │ • STRIPE_WEBHOOK_SECRET          │
│ • STRIPE_PUBLISHABLE_KEY     │ • JWT_SIGNING_KEY                │
│ • JWT_PUBLIC_KEY             │ • (Any other secret)             │
│ • (Any public value)         │                                  │
└──────────────────────────────┴──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TI (Vercel Environment)                       │
├──────────────────────────────┬──────────────────────────────────┤
│ Vercel Dashboard             │ Vercel Dashboard                 │
│ Environment Variables        │ (Encrypted by default)           │
├──────────────────────────────┼──────────────────────────────────┤
│ • NEXT_PUBLIC_APP_URL        │ • DATABASE_URL                   │
│ • NEXT_PUBLIC_API_URL        │ • DB_PASSWORD                    │
│ • NEXT_PUBLIC_AUTH0_DOMAIN   │ • AUTH0_CLIENT_SECRET            │
│ • NEXT_PUBLIC_AUTH0_CLIENT   │ • STRIPE_SECRET_KEY              │
│ • NODE_ENV                   │ • STRIPE_WEBHOOK_SECRET          │
│ • NEXT_PUBLIC_STRIPE_PUB_KEY │ • RESEND_API_KEY                 │
│ • NEXT_PUBLIC_SENTRY_DSN     │ • AWS_ACCESS_KEY_ID              │
│ • HDICR_API_URL              │ • AWS_SECRET_ACCESS_KEY          │
│ • JWT_SIGNING_KEY_ID         │ • AUTH0_SECRET                   │
│ • W3C_CREDENTIAL_ISSUER      │ • HDICR_API_CLIENT_SECRET        │
│ • (Any public value)         │ • JWT_SIGNING_KEY                │
│                              │ • (Any secret value)             │
└──────────────────────────────┴──────────────────────────────────┘
```

---

## Rotation Frequency Matrix

| Secret Type | Frequency | Last Rotated | Next Rotation | Owner |
|-------------|-----------|--------------|---------------|-------|
| **RDS Passwords** (HDICR, TI) | 90 days | — | **Q2 2024** | DevOps |
| **Auth0 Client Secrets** | 90 days | — | **Q2 2024** | DevOps |
| **AWS S3 Access Keys** (TI) | 90 days | — | **Q2 2024** | DevOps |
| **HDICR → TI M2M Creds** | 90 days | — | **Q2 2024** | DevOps |
| **JWT Signing Keys** | 180 days | — | **Q3 2024** | Security |
| **Stripe API Keys** | 180 days | — | **Q3 2024** | DevOps |
| **Resend API Key** | 180 days | — | **Q3 2024** | DevOps |

---

## Critical Paths (Services That Must Work)

```
┌──────────────────────────────────────────────────────────────┐
│ User Authentication Flow                                      │
├──────────────────────────────────────────────────────────────┤
│ User → Auth0 (shared) ← HDICR & TI                           │
│ • If Auth0 down: Both systems down                           │
│ • Secret: AUTH0_CLIENT_SECRET (separate per app)             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Identity Verification (HDICR → Stripe)                       │
├──────────────────────────────────────────────────────────────┤
│ Actor → HDICR → Stripe Identity (KYC/AML) → HDICR            │
│ • Secret: STRIPE_SECRET_KEY (HDICR only)                     │
│ • Webhook secret: STRIPE_WEBHOOK_SECRET (HDICR only)         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Consent & Verification Check (TI → HDICR)                    │
├──────────────────────────────────────────────────────────────┤
│ TI → HDICR API (service-to-service auth)                     │
│ • Secret: HDICR_API_CLIENT_SECRET (Auth0 M2M)                │
│ • If HDICR down: TI cannot verify or issue credentials       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Credential Issuance (TI signs W3C credentials)                │
├──────────────────────────────────────────────────────────────┤
│ TI → Signs credential with JWT_SIGNING_KEY                   │
│ • Secret: JWT_SIGNING_KEY (TI's own keypair)                 │
│ • Verification: Uses JWT_PUBLIC_KEY (from HDICR)             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Transactional Email (TI → Resend)                            │
├──────────────────────────────────────────────────────────────┤
│ TI → Sends email via Resend                                  │
│ • Secret: RESEND_API_KEY                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Media Upload (TI → AWS S3)                                   │
├──────────────────────────────────────────────────────────────┤
│ TI → Uploads media to S3                                     │
│ • Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY          │
└──────────────────────────────────────────────────────────────┘
```

---

## Rotation Checklist (One Page)

### Before Rotation (1 week ahead)
- [ ] Schedule 2-hour maintenance window
- [ ] Notify stakeholders
- [ ] Pre-generate new secrets
- [ ] Prepare rollback plan
- [ ] Test in dev/staging

### During Rotation (Day 1)
- [ ] Create new secrets in source systems (RDS, Auth0, Stripe, AWS IAM, etc.)
- [ ] Update AWS Secrets Manager (`aws secretsmanager update-secret ...`)
- [ ] Update AWS Parameter Store (`aws ssm put-parameter ...`)
- [ ] Update Vercel environment variables (Vercel dashboard)
- [ ] Redeploy HDICR (SAM deploy)
- [ ] Redeploy TI (Vercel deploy)
- [ ] Monitor CloudWatch, Sentry for errors (2 hours)

### Post-Rotation (Day 2+)
- [ ] Revoke old secrets in source systems (don't do immediately)
- [ ] Confirm no errors in logs
- [ ] Verify end-to-end flows work
- [ ] Update calendar

---

## AWS CLI Shortcuts

### Update Secrets Manager
```bash
# Database password
aws secretsmanager update-secret --secret-id /hdicr/prod/db/password --secret-string "NEW_PASS"

# Auth0 client secret
aws secretsmanager update-secret --secret-id /hdicr/prod/auth0/client_secret --secret-string "NEW_SECRET"

# Stripe API key
aws secretsmanager update-secret --secret-id /hdicr/prod/stripe/secret_key --secret-string "sk_live_xxxxx"

# JWT signing key
aws secretsmanager update-secret --secret-id /hdicr/prod/jwt/signing_key --secret-string "$(cat private_key.pem)"
```

### Update Parameter Store
```bash
# Database host
aws ssm put-parameter --name /hdicr/prod/db/host --value "new-host.rds.amazonaws.com" --type String --overwrite

# JWT public key
aws ssm put-parameter --name /hdicr/prod/jwt/public_key --value "$(cat public_key.pem)" --type String --overwrite
```

### Verify Secrets
```bash
# Check what's in Secrets Manager
aws secretsmanager list-secrets --filters Key=name,Values=/hdicr/prod/

# Check what's in Parameter Store
aws ssm describe-parameters --filters Key=Name,Values=/hdicr/prod/
```

---

## Vercel CLI Shortcuts

```bash
# List environment variables
vercel env list

# Update an env var
vercel env set STRIPE_SECRET_KEY "sk_live_xxxxx"

# Redeploy prod
vercel deploy --prod

# Check deployment status
vercel list
```

---

## Emergency Contacts (Document These)

| System | Emergency | Contact | Escalation |
|--------|-----------|---------|------------|
| Auth0 | Outage | auth0.com/status | Support ticket |
| Stripe | Fraud/Dispute | stripe.com/support | Stripe Support |
| AWS | Service issue | AWS Support Console | Premium support |
| Resend | Email delivery | resend.com/support | Support email |
| Vercel | Deployment | vercel.com/support | Support tickets |

---

## Secret Checklist (Print & Pin)

**Before production, verify:**

### HDICR
- [ ] No hardcoded secrets in `template.yaml`
- [ ] No `.env` files in git
- [ ] All RDS credentials in Secrets Manager
- [ ] All Auth0 secrets in Secrets Manager
- [ ] All Stripe secrets in Secrets Manager
- [ ] JWT keys in Secrets Manager (private) & Parameter Store (public)
- [ ] Lambda IAM role has access to Secrets Manager & Parameter Store

### TI
- [ ] No hardcoded secrets in Next.js config or `.env.local`
- [ ] No `.env` files in git
- [ ] All database credentials in Vercel env
- [ ] All API keys in Vercel env
- [ ] `.env.example` exists with placeholders only
- [ ] Vercel preview deployments don't have prod secrets

### Shared
- [ ] Auth0 domain is public (non-secret), client IDs are public, client secrets are secret
- [ ] JWT public key is in Parameter Store (non-secret)
- [ ] JWT private key is in Secrets Manager (secret)
- [ ] M2M credentials for TI → HDICR are secret

---

## Key Numbers to Remember

| Metric | Value | Why |
|--------|-------|-----|
| RDS Rotation Frequency | 90 days | Industry standard |
| Auth0 Secret Rotation | 90 days | Industry standard |
| JWT Key Rotation | 180 days | Longer lived than auth tokens |
| Stripe API Key Rotation | 180 days | Lower risk, less frequent |
| Lambda Timeout (HDICR) | 30+ seconds | Stripe Identity can be slow |
| Lambda Memory (HDICR) | 512 MB minimum | Better cold start & CPU |
| RDS Connection Pool Max | 5-10 | Lambda is ephemeral |
| Stripe Webhook Retention | 24 hours | Resend after 24h if no ACK |
| JWT Token Expiry | 1 hour | Standard for auth tokens |
| W3C Credential Expiry | TBD | Define your TTL |

---

## Version & Last Updated

| Item | Version | Date |
|------|---------|------|
| This reference card | 1.0 | 2024-04-13 |
| Copilot prompt | 1.0 | 2024-04-13 |
| Env var audit | 1.0 | 2024-04-13 |
| Rotation schedule | 1.0 | 2024-04-13 |

---

**Print this page. Laminate it. Pin it to your desk. Update monthly.**
