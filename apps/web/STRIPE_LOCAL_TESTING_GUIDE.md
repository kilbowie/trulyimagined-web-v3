# Stripe Local Development Testing - Complete Guide

This guide covers testing all Stripe components for Truly Imagined in local development.

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Test vs Live Modes](#test-vs-live-modes)
3. [Identity Verification Testing](#identity-verification-testing)
4. [Webhook Testing](#webhook-testing)
5. [Future: Billing & Subscriptions](#future-billing--subscriptions)
6. [Common Issues](#common-issues)

---

## Environment Setup

### 1. Use Test Mode Keys for Local Development

Update your `apps/web/.env.local` to use **test mode** keys:

```bash
# Auth0
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=your_32_char_secret
AUTH0_AUDIENCE=https://api.trulyimagined.com

# Stripe - TEST MODE (sk_test_ / pk_test_)
STRIPE_SECRET_KEY=sk_test_...your_test_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...your_test_publishable_key

# Webhook secret from Stripe CLI (see Webhook Testing section)
STRIPE_WEBHOOK_SECRET=whsec_...from_stripe_listen

# Database
DATABASE_URL=postgresql://...your_local_or_dev_db

# Encryption (generate with: node scripts/generate-encryption-key.js)
ENCRYPTION_KEY=your_64_char_hex_key
```

### 2. Get Your Test Keys

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (starts with `pk_test_`)
3. Reveal and copy **Secret key** (starts with `sk_test_`)
4. Add to `.env.local`

**⚠️ Important:** Test mode keys are safe to use in development. They NEVER charge real money.

---

## Test vs Live Modes

### Test Mode (Local Development)

```bash
# Test keys - safe for development, no real charges
STRIPE_SECRET_KEY=sk_test_51SlJYRFa07CvMgcY...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SlJYRFa07CvMgcY...
```

**Features:**
- ✅ Free to use
- ✅ Unlimited test verifications
- ✅ Special test documents work
- ✅ No real data processed
- ✅ Can test all failure scenarios

### Live Mode (Production Only)

```bash
# Live keys - ONLY for production, charges real money
STRIPE_SECRET_KEY=sk_live_51SlJYRFa07CvMgcY...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SlJYRFa07CvMgcY...
```

**Features:**
- ⚠️ Charges real money ($1.50-$3.00 per verification)
- ⚠️ Processes real customer data
- ✅ Production-ready
- ⚠️ Requires verified Stripe account

---

## Identity Verification Testing

### Step 1: Start Your Dev Environment

```powershell
# Terminal 1: Start Next.js dev server
cd apps/web
pnpm dev
```

Your app will be running at http://localhost:3000

### Step 2: Test Verification Session Creation

#### Option A: Via Dashboard UI

1. Open http://localhost:3000/dashboard/verify-identity
2. Click "Start Identity Verification"
3. You'll be redirected to Stripe's hosted verification page

#### Option B: Via API (cURL)

```powershell
# Get your JWT token from browser cookies after logging in
# Open DevTools → Application → Cookies → appSession

curl -X POST http://localhost:3000/api/verification/start `
  -H "Content-Type: application/json" `
  -H "Cookie: appSession=YOUR_SESSION_COOKIE" `
  -d '{\"provider\": \"stripe\"}'
```

**Expected Response:**
```json
{
  "success": true,
  "provider": "stripe",
  "verificationId": "vs_1Abc2Def3Ghi...",
  "status": "requires_input",
  "url": "https://verify.stripe.com/start/test_YWNj...",
  "clientSecret": "vs_1Abc2Def3Ghi_secret_xxx...",
  "message": "Please complete the verification process..."
}
```

### Step 3: Complete Verification with Test Documents

1. **Click the `url` from the response** - Opens Stripe-hosted verification page

2. **Upload Test Documents:**

   Stripe provides special test documents that simulate different scenarios:

   **✅ Test Document for SUCCESS:**
   - Download: https://stripe.com/docs/identity/test-documents
   - Use the "Test document front" and "Test document back" images
   - Or use File ID: `file_identity_document_success`

   **❌ Test Document for FAILURE:**
   - Use File ID: `file_identity_document_failure`

   **⏳ Test Document for REQUIRES_INPUT:**
   - Use File ID: `file_identity_document_requires_input`

3. **Test Selfie (Liveness Check):**
   - Upload any selfie for test mode
   - Test mode accepts any image

### Step 4: Test Different Verification Outcomes

#### Test Successful Verification

```powershell
# Trigger verified webhook manually
stripe trigger identity.verification_session.verified
```

**Check Database:**
```sql
SELECT * FROM identity_links WHERE provider = 'stripe-identity' ORDER BY created_at DESC LIMIT 1;
```

Expected: New record with `verification_level = 'high'`

#### Test Requires Input

```powershell
stripe trigger identity.verification_session.requires_input
```

Expected: Record with `verification_level = 'medium'`

#### Test Canceled Verification

```powershell
stripe trigger identity.verification_session.canceled
```

Expected: Existing record updated with `is_active = false`

### Step 5: Verify Confidence Score

After successful verification, check the identity resolution score:

```powershell
curl http://localhost:3000/api/identity/resolution `
  -H "Cookie: appSession=YOUR_SESSION_COOKIE"
```

**Expected Response:**
```json
{
  "confidenceScore": 95,
  "verificationLevel": "high",
  "assuranceLevel": "high",
  "identityLinks": [
    {
      "provider": "stripe-identity",
      "verificationLevel": "high",
      "gpg45": "high",
      "eidas": "high"
    }
  ]
}
```

---

## Webhook Testing

See [TEST_STRIPE_WEBHOOK.md](./TEST_STRIPE_WEBHOOK.md) for complete webhook testing guide.

**Quick Reference:**

```powershell
# Terminal 2: Start Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the whsec_ secret to .env.local and restart dev server

# Terminal 3: Trigger test events
stripe trigger identity.verification_session.verified
stripe trigger identity.verification_session.requires_input
stripe trigger identity.verification_session.processing
stripe trigger identity.verification_session.canceled
```

---

## Future: Billing & Subscriptions

*Note: Billing features are planned for Phase 2. This section will be updated when implemented.*

### Test Card Numbers (Future Use)

When billing is implemented, use these test cards:

```bash
# Successful payment
Card: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)

# Payment requires authentication (3D Secure 2)
Card: 4000 0025 0000 3155

# Card declined
Card: 4000 0000 0000 0002

# Insufficient funds
Card: 4000 0000 0000 9995
```

**Full list:** https://stripe.com/docs/testing#cards

### Test Subscriptions (Future)

```powershell
# Create test customer
stripe customers create --email="test@example.com" --name="Test User"

# Create test subscription
stripe subscriptions create \
  --customer=cus_xxx \
  --items[0][price]=price_xxx
```

---

## Common Issues

### Issue 1: "STRIPE_SECRET_KEY environment variable is not set"

**Solution:**
```powershell
# Check .env.local exists
ls .env.local

# Verify it contains STRIPE_SECRET_KEY
cat .env.local | Select-String "STRIPE_SECRET_KEY"

# Restart dev server
cd apps/web
pnpm dev
```

### Issue 2: Verification Session Immediately Expires

**Cause:** Using live keys in test mode or vice versa

**Solution:**
- Ensure `STRIPE_SECRET_KEY` starts with `sk_test_` for local dev
- Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`

### Issue 3: Webhook Events Not Arriving

**Checklist:**
```powershell
# 1. Is Stripe CLI running?
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 2. Is the webhook secret in .env.local?
cat .env.local | Select-String "STRIPE_WEBHOOK_SECRET"

# 3. Did you restart dev server after adding secret?
cd apps/web
pnpm dev

# 4. Check Next.js terminal for webhook logs
# Should see: [STRIPE WEBHOOK] Received event: { type: '...', id: '...' }
```

### Issue 4: Database Connection Failed During Webhook

**Solution:**
```powershell
# Test database connection
cd apps/web
node -e "const {query} = require('./src/lib/db.ts'); query('SELECT 1').then(console.log)"

# Check DATABASE_URL in .env.local
cat .env.local | Select-String "DATABASE_URL"
```

### Issue 5: "Cannot read property 'first_name' of undefined"

**Cause:** Webhook received before verification completed

**Solution:** This is expected for `processing` or `requires_input` events. Only `verified` events have `verified_outputs`.

---

## Testing Checklist

Before pushing code, verify:

- [ ] Verification session creation works via UI
- [ ] Verification session creation works via API
- [ ] Can complete verification with test documents
- [ ] Webhook receives `verified` event
- [ ] Database updates with new `identity_links` record
- [ ] Encrypted data is stored correctly
- [ ] Identity resolution score calculates correctly
- [ ] All 4 webhook events handled without errors
- [ ] Test mode keys are used (not live keys)

---

## Resources

- **Stripe Identity Docs:** https://stripe.com/docs/identity
- **Test Documents:** https://stripe.com/docs/identity/test-documents
- **Webhook Events:** https://stripe.com/docs/identity/verification-sessions#events
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli
- **Test Mode vs Live Mode:** https://stripe.com/docs/keys#test-live-modes

---

## Quick Commands Reference

```powershell
# Start dev server
cd apps/web && pnpm dev

# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test verification
stripe trigger identity.verification_session.verified

# View recent events
stripe events list --limit 10

# View specific session
stripe identity verification_sessions retrieve vs_xxx

# Check database
psql $DATABASE_URL -c "SELECT * FROM identity_links WHERE provider = 'stripe-identity';"
```

---

## Local Development Workflow

1. **Morning Setup** (once per day):
   ```powershell
   # Terminal 1: Start dev server
   cd apps/web
   pnpm dev
   
   # Terminal 2: Start webhook forwarding
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

2. **Testing New Features**:
   - Make code changes
   - Test via UI or API
   - Trigger test webhooks
   - Verify database updates
   - Check logs for errors

3. **Before Committing**:
   - Run full test suite
   - Verify no test-mode keys in committed code
   - Update documentation if needed

---

**Need Help?** Check the [troubleshooting section](#common-issues) or Stripe's support docs.
