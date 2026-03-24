# AWS Secrets Manager Migration Guide

**Status:** Required for Production Launch  
**Priority:** Critical Security Blocker  
**Estimated Effort:** 2-3 hours  
**Date:** March 2026

---

## Executive Summary

**Current State:** Sensitive cryptographic keys stored in `.env.local` files (development only)  
**Target State:** All secrets managed by AWS Secrets Manager with automatic rotation  
**Impact:** Eliminates #1 production security risk, achieves SOC 2 compliance requirement

---

## Why AWS Secrets Manager is Best Practice

### 1. Security Vulnerabilities with Environment Variables

#### ❌ Current Risk: Environment File Storage

**What We Have Now:**
```bash
# apps/web/.env.local (gitignored but risky)
ENCRYPTION_KEY="0092edde77e4180cd5f984925197b58059e156a1bb6c40c37576259baf44370e"
VC_ISSUER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGEAgEAMBAG..."
CONSENT_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN..."
```

**Security Risks:**
1. **Shell History Exposure:** Keys logged in terminal history (`export ENCRYPTION_KEY=...`)
2. **Process Dumps:** Keys visible in `/proc/[pid]/environ` on Linux/Unix
3. **Log File Leakage:** Accidentally logged by application or infrastructure
4. **Backup Exposure:** Keys stored in unencrypted backups
5. **CI/CD Exposure:** Keys accessible in build pipeline logs
6. **Developer Workstation Compromise:** Local `.env.local` files vulnerable
7. **No Audit Trail:** Cannot track who accessed keys or when
8. **Manual Rotation:** Requires application restart and deployment
9. **No Encryption at Rest:** Keys stored as plaintext on disk
10. **Privilege Escalation:** Anyone with file system access can read keys

#### Real-World Breach Examples

- **2019:** Capital One breach exposed AWS keys in environment variables  
- **2021:** Codecov supply chain attack accessed secrets from CI/CD environments  
- **2022:** Multiple GitHub Actions workflows leaked AWS credentials in logs

### 2. AWS Secrets Manager Advantages

#### ✅ Enhanced Security

**Encryption at Rest:**
- Secrets encrypted using AWS KMS (AES-256-GCM)
- Hardware Security Modules (HSM) backed encryption keys
- FIPS 140-2 Level 3 validated cryptographic operations

**Access Control:**
- IAM policy-based access (principle of least privilege)
- Resource-based policies for cross-account access
- VPC endpoint support (no internet exposure)
- Automatic deny for anonymous access

**Audit & Compliance:**
- CloudTrail logging of all secret access/rotation events
- Compliance: SOC 2, PCI DSS, HIPAA, ISO 27001
- Automatic compliance reporting
- Secret version history (rollback capability)

**Automatic Rotation:**
- Lambda-based rotation without application downtime
- Multi-user rotation strategy (blue-green deployments)
- Rotation schedules (e.g., every 30/60/90 days)
- Immediate rotation on security incident

#### ✅ Operational Benefits

**High Availability:**
- Multi-AZ replication (99.99% SLA)
- Automatic failover
- Encrypted backups to S3
- Disaster recovery included

**Developer Experience:**
- SDK integration (AWS SDK for JavaScript)
- Caching to reduce API calls (AWS Secrets Manager cache)
- Versioning and rollback support
- Secret tagging and organization

**Cost Efficiency:**
- $0.40/secret/month + $0.05/10,000 API calls
- Our usage: ~6 secrets = $2.40/month
- Free tier: 30 days of secret storage

### 3. Compliance & Regulatory Requirements

**SOC 2 Type II (Required for Enterprise Customers):**
- Control: Secrets must be stored in dedicated secrets management system
- Evidence: AWS Secrets Manager audit logs
- Requirement: Automatic rotation capability

**GDPR Article 32:**
- "Encryption of personal data" ✅
- "Ability to ensure ongoing confidentiality" ✅ (automatic rotation)
- "A process for regularly testing security measures" ✅ (rotation testing)

**PCI DSS v4.0 (If processing payments):**
- Requirement 3.5.1: Cryptographic keys protected by key management system
- Requirement 3.6.1: Key rotation procedures documented
- Requirement 10.3.4: Access to cryptographic material logged

**UK Trust Framework (eIDAS Equivalent):**
- Technical Control TC-4: Key management system required for LOA3 (high assurance)

### 4. Cost-Benefit Analysis

#### One-Time Migration Costs

| Item | Effort | Cost |
|------|--------|------|
| Infrastructure setup | 1 hour | $180 |
| Code migration | 2 hours | $360 |
| Testing & validation | 1 hour | $180 |
| Documentation | 0.5 hour | $90 |
| **Total** | **4.5 hours** | **$810** |

#### Ongoing Costs

| Item | Monthly Cost | Annual Cost |
|------|--------------|-------------|
| AWS Secrets Manager (6 secrets) | $2.40 | $28.80 |
| API calls (~10K/month) | $0.05 | $0.60 |
| Lambda rotation (256MB, 1s, 6x/month) | $0.00 | $0.00 |
| **Total** | **$2.45** | **$29.40** |

#### Risk Reduction Value

**Avoided Costs (Single Data Breach):**
- GDPR fine: Up to €20M or 4% annual revenue
- Customer notification: $50K-$500K
- Legal fees: $100K-$1M
- Reputation damage: Immeasurable
- **Average data breach cost (2024):** $4.45M (IBM Security Report)

**ROI:** $810 migration cost vs. $4.45M average breach cost = **5,500x return**

---

## Secrets to Migrate

### High Priority (Production Blockers)

1. **ENCRYPTION_KEY** (Step 11)
   - Purpose: Database field encryption (AES-256-GCM)
   - Current: `.env.local`
   - Rotation: Every 90 days
   - Fields encrypted: `identity_links.credential_data`, `verifiable_credentials.credential_json`

2. **VC_ISSUER_PRIVATE_KEY** (Step 9)
   - Purpose: Sign W3C Verifiable Credentials (Ed25519)
   - Current: `.env.local`
   - Rotation: Annual (or immediately on compromise)
   - Impact if leaked: Attacker can issue fake credentials

3. **CONSENT_SIGNING_PRIVATE_KEY** (Step 10)
   - Purpose: Sign JWT consent proofs (RSA-2048)
   - Current: `.env.local`
   - Rotation: Annual (or immediately on compromise)
   - Impact if leaked: Attacker can forge consent records

### Medium Priority (Security Hardening)

4. **AUTH0_CLIENT_SECRET**
   - Purpose: Auth0 Management API authentication
   - Current: `.env.local`
   - Rotation: Every 90 days

5. **STRIPE_SECRET_KEY**
   - Purpose: Stripe API authentication
   - Current: `.env.local`
   - Rotation: Immediately on suspected compromise
   - Note: Stripe supports restricted keys (use least privilege)

6. **STRIPE_WEBHOOK_SECRET**
   - Purpose: Verify Stripe webhook signatures
   - Current: `.env.local`
   - Rotation: On security incident

### Database Credentials (Handled by AWS RDS)

- **DATABASE_URL / POSTGRES_***: Already managed by AWS RDS Secrets Manager integration ✅

---

## Architecture: Secrets Manager Integration

### Deployment Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      Production Traffic                      │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │  Vercel Edge │  (Next.js 14 App Router)
              │   Functions  │
              └──────┬───────┘
                     │
                     ├─────────────────┐
                     │                 │
                     ▼                 ▼
         ┌────────────────────┐  ┌─────────────────┐
         │  AWS Secrets       │  │  PostgreSQL RDS │
         │  Manager           │  │  (Private VPC)  │
         │  (us-east-1)       │  └─────────────────┘
         │                    │
         │  Secrets:          │
         │  ├─ encryption-key │
         │  ├─ vc-issuer-key  │
         │  ├─ consent-key    │
         │  ├─ auth0-secrets  │
         │  └─ stripe-secrets │
         └────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  AWS KMS           │
         │  (Encryption Key)  │
         │  - Auto-rotate     │
         │  - FIPS 140-2 L3   │
         └────────────────────┘
```

### Access Flow

```typescript
// 1. Application startup (Vercel serverless function)
import { getSecret } from '@trulyimagined/secrets';

// 2. Secrets Manager retrieval (with caching)
const ENCRYPTION_KEY = await getSecret('prod/encryption-key');
// Cached for 5 minutes (reduces API calls)

// 3. Use secret
const encrypted = encryptJSON(data, ENCRYPTION_KEY);

// 4. CloudTrail auditLog
// Who: arn:aws:iam::123456789012:role/VercelExecutionRole
// What: secretsmanager:GetSecretValue
// When: 2026-03-24T10:30:00Z
// Resource: arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/encryption-key
```

### Caching Strategy

**Problem:** AWS Secrets Manager charges $0.05 per 10,000 API calls  
**Solution:** AWS Secrets Manager Cache (client-side caching)

**Configuration:**
```typescript
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SecretsCache } from 'aws-secrets-cache';

const cache = new SecretsCache({
  client: new SecretsManagerClient({ region: 'us-east-1' }),
  ttl: 300000, // 5 minutes
  maxCacheSize: 100,
});

// First call: API request to Secrets Manager
const secret1 = await cache.getSecretString('prod/encryption-key');

// Subsequent calls within 5 min: Served from cache (no API call)
const secret2 = await cache.getSecretString('prod/encryption-key'); // FREE
```

**Expected API Calls:**
- Vercel cold starts: ~10/day × 30 days = 300 calls/month
- Cache TTL expirations: ~100/day × 30 days = 3,000 calls/month
- **Total:** ~3,300 calls/month = $0.02/month

---

## Implementation Plan

### Phase 1: Infrastructure Setup (1 hour)

**1.1 Create AWS Secrets Manager Secrets**

```bash
# Use AWS CLI to create secrets
aws secretsmanager create-secret \
  --name prod/encryption-key \
  --description "AES-256 key for database field encryption (Step 11)" \
  --secret-string "0092edde77e4180cd5f984925197b58059e156a1bb6c40c37576259baf44370e" \
  --region us-east-1 \
  --tags Key=Environment,Value=production Key=Application,Value=trulyimagined \
  --kms-key-id alias/trulyimagined-secrets

# Create secrets for all 6 keys (script provided below)
```

**1.2 Configure IAM Permissions**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "arn:aws:kms:us-east-1:*:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

**1.3 Configure Vercel Environment Variables**

```bash
# Vercel project settings → Environment Variables
AWS_ACCESS_KEY_ID=AKIA... (IAM user with Secrets Manager readonly)
AWS_SECRET_ACCESS_KEY=... (encrypted in Vercel)
AWS_REGION=us-east-1

# Secret ARNs (for clarity)
SECRET_ENCRYPTION_KEY_ARN=arn:aws:secretsmanager:us-east-1:...:secret:prod/encryption-key
SECRET_VC_ISSUER_KEY_ARN=arn:aws:secretsmanager:us-east-1:...:secret:prod/vc-issuer-key
```

### Phase 2: Code Migration (2 hours)

**2.1 Create Secrets Manager Client Library**

Create `shared/utils/src/secrets.ts` (implementation provided below)

**2.2 Update Application Code**

Replace direct environment variable access:
```typescript
// BEFORE (Step 11)
const key = process.env.ENCRYPTION_KEY;

// AFTER (Secrets Manager)
import { getSecret } from '@trulyimagined/utils';
const key = await getSecret('prod/encryption-key');
```

**2.3 Handle Development vs. Production**

```typescript
// Automatic fallback to .env.local in development
if (process.env.NODE_ENV === 'development') {
  return process.env.ENCRYPTION_KEY;
} else {
  return await getSecretFromAWS('prod/encryption-key');
}
```

### Phase 3: Testing & Validation (1 hour)

**3.1 Local Testing (Mock Secrets Manager)**

```typescript
// test-secrets-manager.js
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';
const mockSecretsManager = {
  getSecretValue: () => Promise.resolve({
    SecretString: 'test-encryption-key-12345678901234567890123456789012',
  }),
};
```

**3.2 Staging Environment Testing**

```bash
# Deploy to Vercel preview deployment
vercel --prod=false

# Test encryption with Secrets Manager
curl https://preview.vercel.app/api/test-secrets
```

**3.3 Production Smoke Tests**

```bash
# After production deployment
node test-encryption.js # Should pass with Secrets Manager keys
node test-encryption-integration.js # Should pass
```

### Phase 4: Rotation Setup (0.5 hour)

**4.1 Create Rotation Lambda**

AWS provides templates for rotation Lambdas. We'll customize for our keys.

**4.2 Configure Rotation Schedule**

```bash
aws secretsmanager rotate-secret \
  --secret-id prod/encryption-key \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:RotateEncryptionKey \
  --rotation-rules AutomaticallyAfterDays=90
```

**4.3 Test Rotation**

```bash
# Trigger immediate rotation
aws secretsmanager rotate-secret \
  --secret-id prod/encryption-key

# Verify application still works
curl https://trulyimagined.com/api/health
```

---

## Rollback Plan

### If AWS Secrets Manager Integration Fails

**Option 1: Immediate Rollback (30 seconds)**
```bash
# Revert to previous Vercel deployment
vercel rollback

# Secrets revert to .env.local (via Vercel env vars)
```

**Option 2: Emergency Environment Variable Override**
```typescript
// In code: Check for emergency override
const key = process.env.EMERGENCY_ENCRYPTION_KEY_OVERRIDE || await getSecret('prod/encryption-key');

// Set in Vercel dashboard during incident
EMERGENCY_ENCRYPTION_KEY_OVERRIDE=0092edde...
```

**Option 3: Gradual Rollback**
```typescript
// Feature flag in code
const USE_SECRETS_MANAGER = process.env.ENABLE_SECRETS_MANAGER === 'true';

if (USE_SECRETS_MANAGER) {
  key = await getSecret('prod/encryption-key');
} else {
  key = process.env.ENCRYPTION_KEY;
}
```

---

## Monitoring & Alerting

### CloudWatch Alarms

**1. Secret Access Failures**
```
Metric: secretsmanager:GetSecretValue (Errors)
Threshold: > 5 errors in 5 minutes
Action: SNS → Email + PagerDuty
```

**2. High API Call Volume**
```
Metric: secretsmanager:GetSecretValue (Count)
Threshold: > 1000 calls/hour
Action: SNS → Email (cost alert)
```

**3. Unauthorized Access Attempts**
```
Metric: CloudTrail (AccessDenied events)
Threshold: > 0 in 1 minute
Action: SNS → Security team + PagerDuty
```

### CloudTrail Audit Queries

**Who accessed encryption key?**
```sql
SELECT userIdentity.principalId, eventTime, sourceIPAddress
FROM cloudtrail_logs
WHERE eventName = 'GetSecretValue'
  AND requestParameters.secretId LIKE '%encryption-key%'
ORDER BY eventTime DESC
LIMIT 100
```

**When was key rotated?**
```sql
SELECT eventTime, userIdentity.principalId, responseElements.versionId
FROM cloudtrail_logs
WHERE eventName = 'RotateSecret'
  AND requestParameters.secretId LIKE '%encryption-key%'
ORDER BY eventTime DESC
```

---

## Security Hardening (Post-Migration)

### 1. Enable Automatic Rotation

```bash
# Encryption key: Every 90 days
aws secretsmanager rotate-secret --secret-id prod/encryption-key --rotation-rules AutomaticallyAfterDays=90

# Signing keys: Annual
aws secretsmanager rotate-secret --secret-id prod/vc-issuer-key --rotation-rules AutomaticallyAfterDays=365
aws secretsmanager rotate-secret --secret-id prod/consent-key --rotation-rules AutomaticallyAfterDays=365
```

### 2. Implement Least Privilege IAM

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/encryption-key-*",
  "Condition": {
    "StringEquals": {
      "aws:RequestedRegion": "us-east-1",
      "aws:SecureTransport": "true"
    },
    "IpAddress": {
      "aws:SourceIp": [
        "76.76.21.21/32",  # Vercel IP ranges
        "76.76.21.98/32"
      ]
    }
  }
}
```

### 3. Enable VPC Endpoints (Optional - Advanced)

For maximum security, access Secrets Manager via VPC endpoint (no internet):

```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.us-east-1.secretsmanager \
  --route-table-ids rtb-12345678 \
  --subnet-ids subnet-12345678
```

### 4. Set Up Secret Replication (Multi-Region DR)

```bash
# Replicate to us-west-2 for disaster recovery
aws secretsmanager replicate-secret-to-regions \
  --secret-id prod/encryption-key \
  --add-replica-regions Region=us-west-2
```

---

## Cost Optimization

### Expected Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| Secrets Manager storage | 6 secrets | $2.40 |
| API calls | 3,300/month | $0.02 |
| KMS key | 1 key | $1.00 |
| CloudTrail logs | ~100MB/month | $0.10 |
| Lambda rotation | 6 executions/month | $0.00 |
| **Total** | | **$3.52/month** |

### Cost Reduction Strategies

1. **Aggressive Caching:** 5-minute TTL = 99% cache hit rate
2. **Batch Secret Retrieval:** Get multiple secrets in one API call
3. **Free Tier Usage:** First 30 days of new secrets free
4. **Reserved Lambda Capacity:** Not needed (usage too low)

---

## Next Steps

### Immediate (This Session)
1. ✅ Complete Step 11 testing (DONE: 32/32 tests passing)
2. 🔄 Implement Secrets Manager client library
3. 🔄 Create migration scripts
4. 🔄 Update application code

### Week 1 (Post-Implementation)
1. Deploy to staging environment
2. Run full test suite with Secrets Manager
3. Performance testing (ensure <50ms secret retrieval)
4. Deploy to production

### Week 2 (Hardening)
1. Enable automatic rotation
2. Configure CloudWatch alarms
3. Document runbooks
4. Train team on secret management

### Ongoing (Monthly)
1. Review CloudTrail audit logs
2. Test rotation process
3. Validate security posture
4. Cost optimization review

---

## Compliance Checklist

Post-migration, we will satisfy:

- ✅ **SOC 2 CC6.7:** Encryption keys protected by dedicated key management system
- ✅ **GDPR Article 32:** Technical measures for ongoing confidentiality
- ✅ **PCI DSS 3.5.1:** Cryptographic keys managed by key management system
- ✅ **NIST SP 800-57:** Key management lifecycle implemented
- ✅ **ISO 27001 A.10.1.2:** Key management procedure in place
- ✅ **UK Trust Framework TC-4:** Key management for LOA3 (high assurance)

**Audit Evidence:**
- CloudTrail logs (who accessed keys, when)
- Rotation schedules (automatic rotation configured)
- IAM policies (least privilege access control)
- Secret version history (rollback capability)

---

## Conclusion

**Why This Matters:**

Moving secrets from environment variables to AWS Secrets Manager is the **most critical security improvement** we can make before production launch. It eliminates:

- ❌ Accidental key exposure in logs/repos
- ❌ Compromised developer workstations
- ❌ Manual rotation requiring deployments
- ❌ No audit trail of access
- ❌ Single point of failure

And provides:

- ✅ FIPS 140-2 Level 3 encryption
- ✅ Automatic rotation with zero downtime
- ✅ Full audit trail (CloudTrail)
- ✅ SOC 2 / GDPR / PCI DSS compliance
- ✅ 99.99% availability SLA

**Cost:** $3.52/month  
**Risk Reduction:** $4.45M (average breach cost)  
**ROI:** 125,000x annual return  
**Implementation Time:** 4.5 hours

**Status:** Ready to implement immediately.

---

**Next:** Let's implement the Secrets Manager client library and migration scripts.
