# Quick Testing Guide: Stripe Identity & Confidence Scoring

**Implementation**: Steps 7 & 8 ✅ Complete  
**Testing Status**: Ready for user testing

---

## Prerequisites

✅ Schema bug fixed (legal_name/professional_name)  
✅ Stripe SDK installed  
✅ All TypeScript errors resolved  
✅ Dev server ready to start

---

## Step 1: Test Mock Verification (Immediate Testing)

**Purpose**: Verify schema fix and confidence scoring without Stripe API keys

### Instructions

1. **Start dev server**:

   ```powershell
   pnpm dev
   ```

2. **Login as Actor**:
   - Go to http://localhost:3000
   - Login with Auth0 credentials
   - Ensure you have "Actor" role

3. **Check initial confidence**:
   - Visit http://localhost:3000/dashboard
   - Look for "Verify Identity" card
   - Should show: **0% Confidence** ⚪ Gray badge

4. **Start mock verification**:
   - Click "Verify Identity" card
   - Redirected to `/dashboard/verify-identity`
   - Scroll to "Development & Testing Options"
   - Click **"Start Mock"** button
   - Should see success message: "Mock verification completed successfully"

5. **Verify results**:
   - Page should reload and show:
     - **Current Verification Status**: VERIFIED
     - **Verification Level**: HIGH
     - **Assurance Level**: HIGH
   - **Linked Providers** section should show:
     - Provider: `mock-kyc`
     - Type: KYC
     - Verification: HIGH
   - Return to `/dashboard`
   - Confidence badge should now show: **85% Confidence** 🔵 Blue

6. **Test confidence API**:

   ```powershell
   # Open browser dev tools and run:
   fetch('/api/identity/resolution').then(r => r.json()).then(console.log)

   # Expected output:
   # {
   #   "confidencePercentage": 85,
   #   "assuranceLevel": "high",
   #   "linkedProvidersCount": 1,
   #   "hasGovernmentId": false,  // Mock doesn't set this
   #   "hasLivenessCheck": true,
   #   "recommendations": [...],
   #   ...
   # }
   ```

### Expected Results

✅ Mock verification creates identity_link in database  
✅ Confidence score updates to 85%  
✅ Dashboard badge shows blue (High)  
✅ No database errors about schema mismatch  
✅ GET /api/identity/resolution returns valid JSON

---

## Step 2: Test Stripe Identity (Requires API Keys)

**Purpose**: Test full Stripe Identity integration with real verification

### Setup Stripe Test Keys

1. **Get Stripe test keys**:
   - Go to https://dashboard.stripe.com/
   - Toggle to **Test mode** (switch in sidebar)
   - Navigate to **Developers > API keys**
   - Copy **Publishable key** (starts with `pk_test_`)
   - Reveal and copy **Secret key** (starts with `sk_test_`)

2. **Create .env.local**:

   ```bash
   # In apps/web/.env.local
   STRIPE_SECRET_KEY=sk_test_51ABCdef...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABCdef...

   # Database (if not already set)
   DATABASE_HOST=your-rds-endpoint.region.rds.amazonaws.com
   DATABASE_NAME=trulyimagined
   DATABASE_USER=postgres
   DATABASE_PASSWORD=your_password_here
   DATABASE_PORT=5432
   DATABASE_SSL=true

   # Auth0 (if not already set)
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_CLIENT_ID=your_client_id
   AUTH0_CLIENT_SECRET=your_client_secret
   AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
   AUTH0_SECRET=your_auth0_secret
   AUTH0_BASE_URL=http://localhost:3000
   ```

3. **Restart dev server**:
   ```powershell
   # Stop current server (Ctrl+C)
   pnpm dev
   ```

### Test Stripe Verification

1. **Start Stripe verification**:
   - Go to http://localhost:3000/dashboard/verify-identity
   - Under "Start New Verification"
   - Click **"Start Verification"** (Stripe Identity - blue button)
   - Should redirect to Stripe-hosted verification page

2. **Complete verification on Stripe**:
   - Stripe will ask you to upload government ID
   - **For testing**, use Stripe test documents:
     - Any valid image file can be uploaded
     - Stripe test mode will simulate verification
     - Real ID not required in test mode

3. **Wait for webhook** (Development limitation):
   - ⚠️ **Issue**: Webhooks don't work on localhost without Stripe CLI
   - **Workaround**: Manually simulate webhook result

4. **Verify redirection**:
   - After Stripe completes, you should be redirected back to:
     - `http://localhost:3000/dashboard/verify-identity?session_id=vs_1ABC...`

### Expected Results (with webhook setup)

✅ Redirects to Stripe hosted page  
✅ Can upload document and complete verification  
✅ Redirects back to verify-identity page  
⚠️ Webhook creates identity_link (requires Stripe CLI or production)

---

## Step 3: Test Confidence Calculation

**Purpose**: Verify confidence scoring algorithm with multiple providers

### Scenario: Multiple Provider Links

If you've completed both mock and Stripe verification:

1. **Expected calculation**:
   - Mock KYC: weight 0.05, level high (0.85) → 0.05 × 0.85 = 0.0425
   - Stripe Identity: weight 0.4, level high (0.85) → 0.4 × 0.85 = 0.34
   - Total weight: 0.05 + 0.4 = 0.45
   - **Confidence: (0.0425 + 0.34) / 0.45 = 0.85 (85%)**

2. **Check API response**:

   ```javascript
   fetch('/api/identity/resolution')
     .then((r) => r.json())
     .then((data) => {
       console.log('Confidence:', data.confidencePercentage);
       console.log('Level:', data.assuranceLevel);
       console.log('Providers:', data.linkedProvidersCount);
       console.log('Breakdown:', data.providerBreakdown);
     });
   ```

3. **Expected output**:
   - `linkedProvidersCount`: 2 (if both mock and Stripe)
   - `confidencePercentage`: 85
   - `assuranceLevel`: "high"
   - `hasGovernmentId`: true (if Stripe verification completed)
   - `providerBreakdown`: Array with calculations for each provider

---

## Step 4: Test Unlinking Provider

**Purpose**: Verify unlinking reduces confidence score

1. **Go to verification page**:
   - http://localhost:3000/dashboard/verify-identity

2. **Find linked provider**:
   - In "Linked Identity Providers" section
   - Click **"Unlink"** button next to any provider

3. **Confirm action**:
   - Click "OK" in confirmation dialog

4. **Verify results**:
   - Provider removed from list
   - Confidence score recalculated
   - Dashboard badge updated

---

## Known Limitations

### Development Environment

❌ **Webhooks don't work on localhost**

- Stripe webhooks require publicly accessible URL
- **Workaround**: Use Stripe CLI for local webhook testing:
  ```powershell
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```
- Or deploy to production/staging

❌ **Mock verification doesn't set hasGovernmentId**

- Mock verification is for schema testing only
- Doesn't represent real identity verification
- **Workaround**: Test with Stripe Identity in production

### Stripe Test Mode

✅ **Test documents work**

- Stripe test mode accepts any document image
- Verification will succeed/fail based on test data
- No real identity verification in test mode

⚠️ **No real liveness check in test**

- Selfie upload simulated in test mode
- Real liveness detection only in production
- **Workaround**: Deploy to production for real testing

---

## Troubleshooting

### Error: "Column 'first_name' does not exist"

✅ **Fixed** - This was the schema bug, now resolved

If you still see this:

1. Clear browser cache
2. Restart dev server: `pnpm dev`
3. Check that verification/start/route.ts uses `legal_name`, `professional_name`

### Error: "STRIPE_SECRET_KEY environment variable is not set"

Solution:

1. Create `apps/web/.env.local`
2. Add Stripe keys from dashboard
3. Restart dev server

### Confidence score shows 0% after mock verification

Check:

1. Browser dev tools > Network tab
2. POST /api/verification/start should return success
3. GET /api/identity/links should show mock-kyc provider
4. GET /api/identity/resolution should return confidence data

If still 0%:

- Check database: `SELECT * FROM identity_links WHERE user_profile_id = '<your_id>';`
- Verify is_active = true

### Dashboard badge not updating

Solution:

1. Hard refresh page (Ctrl+Shift+R)
2. Check browser console for fetch errors
3. Verify GET /api/identity/resolution returns valid data

---

## Success Criteria

After completing all tests, you should have:

✅ Mock verification working without schema errors  
✅ Confidence score displays correctly (85% with mock)  
✅ Dashboard badge shows color-coded confidence  
✅ GET /api/identity/resolution returns valid JSON  
✅ Linked providers list displays correctly  
✅ Unlinking provider updates confidence score  
✅ (Optional) Stripe verification redirects to hosted page

---

## Next Steps After Testing

Once testing is complete:

1. **If all tests pass**:
   - Mark Steps 7 & 8 as complete ✅
   - Move to Step 9: Verifiable Credentials Issuance
   - See `TECHNICAL_ARCHITECTURE.md` for Step 9 details

2. **If Stripe verification needed**:
   - Set up Stripe CLI for local webhook testing
   - Or deploy to staging/production environment
   - Configure production webhook in Stripe Dashboard

3. **For production deployment**:
   - Use production Stripe keys (`sk_live_...`)
   - Configure webhook: https://yourdomain.com/api/webhooks/stripe
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`
   - Test with real government ID (costs $1.50-$3.00)

---

## Quick Reference Commands

```powershell
# Start dev server
pnpm dev

# Check database identity links
psql $DATABASE_URL -c "SELECT * FROM identity_links;"

# Test API endpoints (in browser console)
fetch('/api/identity/resolution').then(r => r.json()).then(console.log)
fetch('/api/identity/links').then(r => r.json()).then(console.log)
fetch('/api/verification/status').then(r => r.json()).then(console.log)

# Stripe CLI (for webhook testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

**Document Status**: Ready for testing  
**Last Updated**: March 2026  
**Testing Estimated Time**: 15-30 minutes
