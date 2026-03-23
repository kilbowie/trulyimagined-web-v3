# Testing Instructions for Step 7 (Identity Verification) & Step 6 (Consent)

## ✅ Stage 1: Database Migration - COMPLETE
- Migration 004_identity_links.sql executed successfully
- `identity_links` table created in database

---

## 🧪 Stage 2: Test Identity Verification Flow

### Test Environment:
- Dev Server: http://localhost:3000 (RUNNING ✅)
- Database: Connected to trulyimagined_v3 (RDS)

### Test Plan:

#### 1. Test Verification Status Page
**URL**: http://localhost:3000/dashboard/verify-identity

**Expected Results**:
- [ ] Page loads without errors
- [ ] Shows "UNVERIFIED" status initially  
- [ ] Displays three verification options (Mock, Onfido, Yoti)
- [ ] Shows empty "Linked Identity Providers" section

#### 2. Test Mock Verification
**Action**: Click "Start Mock" button

**Expected Results**:
- [ ] Success message appears instantly
- [ ] Status updates to "VERIFIED" or "FULLY-VERIFIED"
- [ ] Verification Level shows "HIGH"
- [ ] Assurance Level shows "HIGH"
- [ ] Provider "mock-kyc" appears in linked providers list
- [ ] Linked provider shows badges: "kyc" type, "HIGH" level

#### 3. Test API Endpoints
**Direct API Access** (while logged in):

`GET /api/verification/status`
- [ ] Returns JSON with overall status
- [ ] Shows highestVerificationLevel and highestAssuranceLevel
- [ ] Lists all linked providers

`GET /api/identity/links`
- [ ] Returns JSON with links array
- [ ] Includes summary object with statistics

#### 4. Test Unlink Functionality
**Action**: Click "Unlink" button on mock-kyc provider

**Expected Results**:
- [ ] Confirmation dialog appears
- [ ] Provider removed from list after confirmation
- [ ] Status resets to "UNVERIFIED"
- [ ] Verification level resets to "None"

---

## 🎯 Stage 3: Test Consent Flow (Step 6)

### Test Consents Dashboard

#### 1. Test Page Load
**URL**: http://localhost:3000/dashboard/consents

**Expected Results**:
- [ ] Page loads without 500 error (THIS WAS THE BUG WE FIXED)
- [ ] Shows empty state or existing consents
- [ ] Summary cards display counts (Active, Revoked, Expired)

#### 2. Test API Endpoints
**Direct API Access**:

`GET /api/consent/[your-actor-id]`
- [ ] Returns JSON with actorId
- [ ] Includes summary object
- [ ] Contains consents arrays (active, revoked, expired)

`POST /api/consent/grant`
- [ ] Can manually test with fetch or Postman
- [ ] Creates consent record in database

`POST /api/consent/revoke`
- [ ] Can manually test with fetch or Postman
- [ ] Creates revocation record in database

---

## 🔍 Database Verification

Run this query to see created identity_links:

```sql
SELECT 
  il.id,
  up.email,
  il.provider,
  il.provider_type,
  il.verification_level,
  il.assurance_level,
  il.is_active,
  il.verified_at,
  il.created_at
FROM identity_links il
JOIN user_profiles up ON il.user_profile_id = up.id
ORDER BY il.created_at DESC;
```

Run this query to see consent logs:

```sql
SELECT 
  cl.id,
  cl.actor_id,
  cl.action,
  cl.consent_type,
  cl.project_name,
  cl.created_at
FROM consent_log cl
ORDER BY cl.created_at DESC
LIMIT 10;
```

---

## ✨ Success Criteria

### Step 7 (Identity Verification):
- [x] Database migration completed
- [ ] Verification page loads correctly
- [ ] Mock verification creates identity link
- [ ] Status updates properly
- [ ] API endpoints respond correctly
- [ ] Unlink functionality works

### Step 6 (Consent):
- [x] Database tables exist (from previous steps)
- [ ] Consents page loads without 500 error
- [ ] Empty state or existing consents display
- [ ] API endpoints respond correctly

---

## 🏃 Quick Start Testing

1. **Open browser and log in**:
   - Go to: http://localhost:3000
   - Click "Log In" (Auth0)
   - Ensure you have Actor role

2. **Navigate to Dashboard**:
   - Go to: http://localhost:3000/dashboard
   - You should see 3 cards for Actors:
     * Register Identity
     * Manage Consents
     * Verify Identity 🔐 (NEW!)

3. **Test Verification Flow**:
   - Click "Verify Identity" card
   - Click "Start Mock" button
   - Observe status change
   - Try unlinking the provider

4. **Test Consent Flow**:
   - Click "Manage Consents" card
   - Confirm page loads (no 500 error)
   - View empty state or existing consents

---

## ⚠️ Authentication Required

All tests must be performed while logged in with an account that has the "Actor" role assigned in Auth0.

If you encounter authentication issues:
- Visit: http://localhost:3000/debug-roles
- Verify your JWT token contains roles
- Check Auth0 Action is configured correctly
