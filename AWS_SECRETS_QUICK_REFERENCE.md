# AWS Secrets Manager Quick Reference

**Purpose:** Quick commands and configuration for AWS Secrets Manager integration

---

## Installation

```bash
# Install AWS SDK dependency
cd c:\Users\adamr\OneDrive\Desktop\KilbowieConsulting\002-TrulyImagined\trulyimagined-web-v3
pnpm install
```

---

## Migration Steps

### 1. Configure AWS CLI

```bash
# Configure AWS credentials (one-time setup)
aws configure

# Enter:
# - AWS Access Key ID: [your-key]
# - AWS Secret Access Key: [your-secret]
# - Default region: us-east-1
# - Default output format: json

# Verify configuration
aws sts get-caller-identity
```

### 2. Run Migration Script

```bash
# Production environment
node scripts/migrate-secrets-to-aws.js prod

# Staging environment
node scripts/migrate-secrets-to-aws.js staging
```

**What the script does:**
- Reads secrets from `apps/web/.env.local`
- Creates 6 secrets in AWS Secrets Manager:
  - `prod/encryption-key` (AES-256 for database encryption)
  - `prod/vc-issuer-key` (Ed25519 for W3C VCs)
  - `prod/consent-key` (RSA-2048 for consent proofs)
  - `prod/auth0-client-secret`
  - `prod/stripe-secret-key`
  - `prod/stripe-webhook-secret`
- Adds tags (Environment, Application, ManagedBy, RotationDays)
- Prints ARNs for Vercel configuration

### 3. Test Secret Retrieval

```bash
# Test production secrets
AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=... node scripts/test-secrets-manager.js prod

# Test staging secrets
AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=... node scripts/test-secrets-manager.js staging
```

**What the test script does:**
- Validates AWS credentials
- Tests retrieval of all 6 secrets
- Measures performance (should be <100ms per secret)
- Estimates monthly cost (~$3.52/month)

### 4. Configure Vercel Environment Variables

**Option A: Vercel Dashboard**
1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add:
   ```
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```
3. Select environment: Production
4. Save

**Option B: Vercel CLI**
```bash
vercel env add AWS_REGION production
# Enter: us-east-1

vercel env add AWS_ACCESS_KEY_ID production
# Enter: AKIA...

vercel env add AWS_SECRET_ACCESS_KEY production
# Enter: (paste secret key)
```

### 5. Deploy Application

```bash
# Deploy to production
vercel --prod

# Verify deployment
curl https://yourdomain.com/api/health
```

---

## Usage in Code

### Basic Usage

```typescript
import { getSecret } from '@trulyimagined/utils';

// Get encryption key
const encryptionKey = await getSecret('prod/encryption-key');

// Use key
const encrypted = encryptField('sensitive-data', encryptionKey);
```

### In API Routes (Next.js App Router)

```typescript
// apps/web/src/app/api/example/route.ts
import { getSecret } from '@trulyimagined/utils';
import { encryptJSON } from '@trulyimagined/utils';

export async function POST(req: Request) {
  // Get secret (cached for 5 minutes)
  const key = await getSecret('prod/encryption-key');
  
  // Use secret
  const data = await req.json();
  const encrypted = encryptJSON(data, key);
  
  // ... rest of route handler
}
```

### Environment-Specific Secrets

```typescript
// Automatic environment detection
const env = process.env.VERCEL_ENV === 'production' ? 'prod' : 'staging';
const key = await getSecret(`${env}/encryption-key`);
```

### Development Mode

In development (`NODE_ENV=development`), secrets automatically fall back to `.env.local`:

```typescript
// In development:
const key = await getSecret('prod/encryption-key');
// Returns: process.env.ENCRYPTION_KEY (from .env.local)

// In production:
const key = await getSecret('prod/encryption-key');
// Returns: Secret from AWS Secrets Manager
```

### Validate Secrets at Startup

```typescript
// apps/web/src/app/layout.tsx or middleware.ts
import { validateSecrets } from '@trulyimagined/utils';

// Validate required secrets during app initialization
await validateSecrets([
  'prod/encryption-key',
  'prod/vc-issuer-key',
  'prod/consent-key',
]);

// App will fail fast if any secret is missing
```

### Cache Management

```typescript
import { clearSecretCache, getSecretCacheStats } from '@trulyimagined/utils';

// Clear all cached secrets (force refresh)
clearSecretCache();

// Clear specific secret
clearSecretCache('prod/encryption-key');

// Get cache statistics
const stats = getSecretCacheStats();
console.log(`Cache: ${stats.active} active, ${stats.expired} expired`);
```

---

## AWS CLI Commands

### List Secrets

```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1

# List production secrets only
aws secretsmanager list-secrets --filters Key=tag-key,Values=Environment --region us-east-1
```

### Get Secret Value

```bash
# Get specific secret
aws secretsmanager get-secret-value --secret-id prod/encryption-key --region us-east-1

# Get secret value only (no metadata)
aws secretsmanager get-secret-value --secret-id prod/encryption-key --query SecretString --output text
```

### Update Secret

```bash
# Update secret value
aws secretsmanager update-secret \
  --secret-id prod/encryption-key \
  --secret-string "new-key-value-here" \
  --region us-east-1

# Update secret description
aws secretsmanager update-secret \
  --secret-id prod/encryption-key \
  --description "Updated description" \
  --region us-east-1
```

### Delete Secret

```bash
# Schedule deletion (30-day recovery window)
aws secretsmanager delete-secret \
  --secret-id prod/old-secret \
  --recovery-window-in-days 30 \
  --region us-east-1

# Immediate deletion (cannot be recovered)
aws secretsmanager delete-secret \
  --secret-id prod/old-secret \
  --force-delete-without-recovery \
  --region us-east-1
```

### Rotate Secret

```bash
# Trigger immediate rotation
aws secretsmanager rotate-secret \
  --secret-id prod/encryption-key \
  --region us-east-1

# Configure automatic rotation (every 90 days)
aws secretsmanager rotate-secret \
  --secret-id prod/encryption-key \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:RotateSecret \
  --rotation-rules AutomaticallyAfterDays=90 \
  --region us-east-1
```

### View Secret Metadata

```bash
# Get secret details (no secret value)
aws secretsmanager describe-secret --secret-id prod/encryption-key --region us-east-1

# Get rotation status
aws secretsmanager describe-secret \
  --secret-id prod/encryption-key \
  --query 'RotationEnabled' \
  --region us-east-1
```

### Audit Trail (CloudTrail)

```bash
# View recent secret access (requires CloudTrail)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=prod/encryption-key \
  --max-results 10 \
  --region us-east-1

# Filter by event name
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --max-results 50 \
  --region us-east-1
```

---

## IAM Policies

### Minimal Read-Only Policy (Production Use)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadProductionSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:prod/*"
    },
    {
      "Sid": "DecryptSecretsWithKMS",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

### Migration Policy (One-Time Setup)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:TagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EncryptWithKMS",
      "Effect": "Allow",
      "Action": "kms:Encrypt",
      "Resource": "*"
    }
  ]
}
```

### Full Management Policy (DevOps/Admin)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:*"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:*"
    },
    {
      "Sid": "ManageKMS",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Monitoring & Alerting

### CloudWatch Alarms

**1. Secret Access Failures**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-manager-get-secret-errors \
  --alarm-description "Alert on Secrets Manager API errors" \
  --metric-name Errors \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

**2. High API Call Volume (Cost Alert)**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-manager-high-api-calls \
  --metric-name CallCount \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 3600 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:cost-alerts
```

### CloudTrail Queries

**Who accessed a specific secret?**
```sql
SELECT 
  userIdentity.principalId,
  eventTime,
  sourceIPAddress,
  userAgent
FROM cloudtrail_logs
WHERE eventName = 'GetSecretValue'
  AND requestParameters.secretId = 'prod/encryption-key'
ORDER BY eventTime DESC
LIMIT 100
```

**All secret access in last 24 hours:**
```sql
SELECT 
  requestParameters.secretId AS secret_name,
  COUNT(*) AS access_count,
  userIdentity.principalId AS accessor
FROM cloudtrail_logs
WHERE eventName = 'GetSecretValue'
  AND eventTime > CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY secret_name, accessor
ORDER BY access_count DESC
```

---

## Troubleshooting

### Error: "ResourceNotFoundException: Secrets Manager can't find the specified secret"

**Cause:** Secret doesn't exist in AWS Secrets Manager  
**Solution:**
```bash
# Run migration script
node scripts/migrate-secrets-to-aws.js prod

# Or create manually
aws secretsmanager create-secret \
  --name prod/encryption-key \
  --secret-string "your-key-here" \
  --region us-east-1
```

### Error: "AccessDeniedException: User is not authorized to perform: secretsmanager:GetSecretValue"

**Cause:** IAM permissions not configured  
**Solution:**
1. Attach IAM policy to user/role (see IAM Policies section above)
2. Verify policy with:
   ```bash
   aws iam list-attached-user-policies --user-name YOUR_USERNAME
   ```

### Error: "The security token included in the request is invalid"

**Cause:** AWS credentials expired or incorrect  
**Solution:**
```bash
# Reconfigure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity
```

### High Latency (>500ms per secret)

**Cause:** No client-side caching  
**Solution:** Already implemented! Secrets are cached for 5 minutes. Verify:
```typescript
import { getSecretCacheStats } from '@trulyimagined/utils';
console.log(getSecretCacheStats());
```

### Secret Value Empty or Wrong

**Cause:** Wrong environment or secret not updated  
**Solution:**
```bash
# Check secret value
aws secretsmanager get-secret-value --secret-id prod/encryption-key

# Update if wrong
aws secretsmanager update-secret \
  --secret-id prod/encryption-key \
  --secret-string "correct-value"
```

---

## Cost Optimization

### Current Costs

| Item | Usage | Cost |
|------|-------|------|
| Secret storage | 6 secrets × $0.40/month | $2.40/month |
| API calls | ~3,300/month with caching | $0.02/month |
| KMS encryption | 1 key × $1.00/month | $1.00/month |
| **Total** | | **$3.42/month** |

### Optimization Strategies

**1. Aggressive Caching (Implemented)**
- 5-minute TTL = 99% cache hit rate
- Reduces API calls from ~300K/month → 3.3K/month
- Savings: $1.48/month

**2. Batch Secret Retrieval**
```typescript
// Instead of multiple calls:
const key1 = await getSecret('prod/encryption-key');
const key2 = await getSecret('prod/vc-issuer-key');

// Use Promise.all:
const [key1, key2] = await Promise.all([
  getSecret('prod/encryption-key'),
  getSecret('prod/vc-issuer-key'),
]);
```

**3. Lazy Loading**
```typescript
// Don't load secrets until actually needed
let cachedKey: string | null = null;

async function getEncryptionKey() {
  if (!cachedKey) {
    cachedKey = await getSecret('prod/encryption-key');
  }
  return cachedKey;
}
```

**4. Secret Replication (Multi-Region)**
Only enable if disaster recovery required (adds cost):
```bash
aws secretsmanager replicate-secret-to-regions \
  --secret-id prod/encryption-key \
  --add-replica-regions Region=us-west-2  # Adds $0.40/month
```

---

## Security Best Practices

### ✅ Implemented

- [x] Encryption at rest (AWS KMS)
- [x] IAM-based access control
- [x] Automatic caching (cost optimization)
- [x] Environment-specific secrets (prod/staging)
- [x] Development fallback (.env.local)

### 🔲 Recommended (Post-Deployment)

- [ ] **Enable Automatic Rotation (90 days)**
  ```bash
  aws secretsmanager rotate-secret \
    --secret-id prod/encryption-key \
    --rotation-rules AutomaticallyAfterDays=90
  ```

- [ ] **Enable CloudWatch Alarms (access failures)**
  ```bash
  # See Monitoring & Alerting section above
  ```

- [ ] **Enable VPC Endpoint** (maximum security)
  ```bash
  aws ec2 create-vpc-endpoint \
    --vpc-id vpc-12345678 \
    --service-name com.amazonaws.us-east-1.secretsmanager
  ```

- [ ] **Enable Secret Replication** (multi-region DR)
  ```bash
  aws secretsmanager replicate-secret-to-regions \
    --secret-id prod/encryption-key \
    --add-replica-regions Region=us-west-2
  ```

- [ ] **Configure IP Restrictions** (IAM condition)
  ```json
  {
    "Condition": {
      "IpAddress": {
        "aws:SourceIp": ["76.76.21.21/32", "76.76.21.98/32"]
      }
    }
  }
  ```

---

## Rollback Plan

### Option 1: Immediate Rollback (Emergency)

```bash
# Revert Vercel deployment
vercel rollback

# Secrets automatically revert to .env.local (via Vercel env vars)
```

### Option 2: Environment Variable Override

```typescript
// Add emergency override in code
const key = process.env.EMERGENCY_ENCRYPTION_KEY_OVERRIDE 
  || await getSecret('prod/encryption-key');

// Set in Vercel during incident
vercel env add EMERGENCY_ENCRYPTION_KEY_OVERRIDE production
# Paste value from .env.local
```

### Option 3: Feature Flag

```typescript
// Add feature flag
const USE_SECRETS_MANAGER = process.env.ENABLE_SECRETS_MANAGER !== 'false';

if (USE_SECRETS_MANAGER) {
  key = await getSecret('prod/encryption-key');
} else {
  key = process.env.ENCRYPTION_KEY;
}

// Disable Secrets Manager if needed
vercel env add ENABLE_SECRETS_MANAGER production
# Enter: false
```

---

## Summary

**Quick Start:**
1. `pnpm install` (install AWS SDK)
2. `aws configure` (configure AWS CLI)
3. `node scripts/migrate-secrets-to-aws.js prod` (migrate secrets)
4. `node scripts/test-secrets-manager.js prod` (test retrieval)
5. Configure Vercel env vars (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
6. `vercel --prod` (deploy)

**Cost:** $3.42/month  
**Security:** FIPS 140-2, SOC 2, GDPR, PCI DSS compliant  
**Performance:** <100ms per secret (cached)  
**Availability:** 99.99% SLA

**Status:** ✅ Ready for production deployment
