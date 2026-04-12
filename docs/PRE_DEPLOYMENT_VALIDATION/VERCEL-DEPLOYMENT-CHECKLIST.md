# SUPERSEDED DOCUMENT

This file is superseded for the implementation phase.

Use these files instead:
- `docs/PRE_DEPLOYMENT_VALIDATION/00-START-HERE.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/TI-REPO-SETUP.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/HDICR-REPO-SETUP.md`
- `PRODUCTION_READINESS_PLAN.md`

Reason: this runbook conflicts with the approved architecture (TI on Vercel, HDICR on AWS Lambda/SAM) and may cause operator confusion.

---

# Vercel Deployment Checklist - HDICR & TI Independent Services

**Status**: Ready for deployment after Copilot validation returns GO

---

## Pre-Deployment (Do These BEFORE Clicking "Deploy" in Vercel)

### ✅ Code & Repos Ready
- [ ] HDICR repo is on GitHub (separate from TI)
- [ ] TI repo is on GitHub (separate from HDICR)
- [ ] Both repos are pushed to `main` or `develop` branch
- [ ] Both repos have `.gitignore` with `.env.local` and `.env.production`
- [ ] No secrets appear in git history (check with `git log -p | grep -i secret`)
- [ ] Both repos have `package.json` with correct build scripts
- [ ] README.md exists in both repos with setup instructions

### ✅ Copilot Validation Complete
- [ ] Ran comprehensive pre-deployment validation prompt
- [ ] Got GO decision from Copilot (or fixed issues and re-validated)
- [ ] Documented any findings

### ✅ Databases Ready
- [ ] RDS instance `trimg-db-v3` exists for HDICR
  - [ ] Storage encryption enabled
  - [ ] `rds.force_ssl=1` set
  - [ ] HDICR schema created and migrated
  - [ ] Connection string available: `postgresql://user:password@host:5432/hdicr`
- [ ] RDS instance `trimg-db-ti` exists for TI
  - [ ] Storage encryption enabled
  - [ ] `rds.force_ssl=1` set
  - [ ] TI schema created and migrated
  - [ ] Connection string available: `postgresql://user:password@host:5432/ti`

### ✅ Auth0 Configuration
- [ ] M2M Application exists in Auth0
  - [ ] Client ID: __________ (save for Vercel)
  - [ ] Client Secret: __________ (save securely for Vercel)
  - [ ] Has API access to HDICR API with correct scopes
- [ ] HDICR API exists in Auth0
  - [ ] Identifier: `https://hdicr.trulyimagined.com`
  - [ ] Scopes defined: `read:actors`, `read:identities`, `read:consent`, etc.
- [ ] TI Auth0 App exists
  - [ ] Client ID: __________ (save for Vercel)
  - [ ] Client Secret: __________ (save securely for Vercel)
  - [ ] Redirect URIs include: `https://trulyimagined.com/api/auth/callback` ✅
  - [ ] Redirect URIs include: `http://localhost:3000/api/auth/callback` ✅ (for local dev)

### ✅ DNS Ready
- [ ] Domain `trulyimagined.com` is registered and accessible
- [ ] Domain `hdicr.trulyimagined.com` is registered (or will be added as subdomain)
- [ ] DNS is managed (GoDaddy, Namecheap, etc.) and you have access

### ✅ Local Testing Complete
- [ ] HDICR runs locally: `npm run dev` → http://localhost:4001 ✅
- [ ] TI runs locally: `npm run dev` → http://localhost:3000 ✅
- [ ] Can log in to TI and see dashboard ✅
- [ ] TI successfully calls HDICR and displays actor data ✅
- [ ] No database errors, no schema mismatches ✅

---

## Phase 1: Create Vercel Projects

### Create HDICR Vercel Project

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Create New Project**:
   - Click "New Project"
   - Select HDICR GitHub repo
   - Click "Import"

3. **Configure Project**:
   - **Project Name**: `hdicr` (or `hdicr-service`)
   - **Framework Preset**: Next.js (if using Next.js) or Other (if Node.js)
   - **Root Directory**: `.` (or specify if monorepo)
   - **Build Command**: `npm run build` (leave default if correct)
   - **Output Directory**: `.next` (leave default)
   - Click "Deploy"

4. **Wait for initial deploy** (1-2 minutes)

5. **Note the Vercel URL**: `https://hdicr-xxx.vercel.app` (temporary)

### Create TI Vercel Project

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Create New Project**:
   - Click "New Project"
   - Select TI GitHub repo
   - Click "Import"

3. **Configure Project**:
   - **Project Name**: `trulyimagined-web` (or `ti`)
   - **Framework Preset**: Next.js (if using Next.js) or Other (if Node.js)
   - **Root Directory**: `.` (or specify if monorepo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - Click "Deploy"

4. **Wait for initial deploy** (1-2 minutes)

5. **Note the Vercel URL**: `https://trulyimagined-web-xxx.vercel.app` (temporary)

---

## Phase 2: Configure Environment Variables

### Configure HDICR Environment Variables

In Vercel, go to **HDICR Project → Settings → Environment Variables**:

| Variable | Value | Type |
|----------|-------|------|
| `HDICR_DATABASE_URL` | `postgresql://user:pass@host:5432/hdicr?sslmode=require` | Plaintext |
| `AUTH0_DOMAIN` | `your-tenant.auth0.com` | Plaintext |
| `AUTH0_AUDIENCE` | `https://hdicr.trulyimagined.com` | Plaintext |
| `NODE_ENV` | `production` | Plaintext |

**Add variables**:
1. Click "Add New..."
2. Name: `HDICR_DATABASE_URL`
3. Value: (your connection string)
4. Click "Save"
5. Repeat for each variable

**After adding all variables**:
- [ ] Redeploy HDICR to apply variables
  - Click "Deployments" tab
  - Click three dots on latest deployment
  - Click "Redeploy"
  - Wait for redeploy (1-2 minutes)

### Configure TI Environment Variables

In Vercel, go to **TI Project → Settings → Environment Variables**:

| Variable | Value | Type | Sensitive |
|----------|-------|------|-----------|
| `TI_DATABASE_URL` | `postgresql://user:pass@host:5432/ti?sslmode=require` | - | No |
| `HDICR_API_URL` | `https://hdicr-xxx.vercel.app` (temp) or staging | - | No |
| `AUTH0_M2M_CLIENT_ID` | (M2M client ID from Auth0) | - | **Yes** ✅ |
| `AUTH0_M2M_CLIENT_SECRET` | (M2M secret from Auth0) | - | **Yes** ✅ |
| `AUTH0_M2M_AUDIENCE` | `https://hdicr.trulyimagined.com` | - | No |
| `AUTH0_DOMAIN` | `your-tenant.auth0.com` | - | No |
| `AUTH0_CLIENT_ID` | (TI user auth client ID) | - | No |
| `AUTH0_CLIENT_SECRET` | (TI user auth secret) | - | **Yes** ✅ |
| `NODE_ENV` | `production` | - | No |

**Important Notes**:
- All `*_SECRET` variables must be marked as "Sensitive"
- `HDICR_API_URL` will change once custom domains are set up (update later)
- Copy M2M credentials from Auth0 (Auth0 Dashboard → Applications → M2M App → Settings)

**Add variables** (same process as HDICR):
1. For each variable, click "Add New..."
2. Enter Name and Value
3. For secrets, click "Sensitive" checkbox
4. Click "Save"

**After adding all variables**:
- [ ] Redeploy TI to apply variables
  - Click "Deployments" tab
  - Click three dots on latest deployment
  - Click "Redeploy"
  - Wait for redeploy (1-2 minutes)

---

## Phase 3: Configure Custom Domains

### Add HDICR Custom Domain

1. **In Vercel HDICR Project → Settings → Domains**:

2. **Add Domain**:
   - Click "Add..."
   - Enter: `hdicr.trulyimagined.com`
   - Click "Add"

3. **Configure DNS** (Vercel will show instructions):
   - Go to your DNS provider (GoDaddy, Namecheap, AWS Route53, etc.)
   - Add DNS record:
     - Type: `CNAME`
     - Name: `hdicr`
     - Value: `cname.vercel.com.` (or Vercel's suggested value)
     - TTL: 3600 (or default)
   - Wait 5-10 minutes for DNS to propagate

4. **Verify** (in Vercel):
   - Status should change to "Valid Configuration"
   - HTTPS should be enabled automatically

### Add TI Custom Domain

1. **In Vercel TI Project → Settings → Domains**:

2. **Add Domain**:
   - Click "Add..."
   - Enter: `trulyimagined.com`
   - Click "Add"

3. **Configure DNS** (same process as HDICR):
   - Go to DNS provider
   - Add CNAME record for `trulyimagined.com`
   - Wait 5-10 minutes

4. **Verify** (in Vercel):
   - Status should change to "Valid Configuration"
   - HTTPS should be enabled automatically

---

## Phase 4: Update Auth0 Redirect URIs

### Update TI Auth0 App Redirect URIs

1. **Go to Auth0 Dashboard → Applications → TI App → Settings**

2. **Update "Allowed Callback URLs"**:
   ```
   http://localhost:3000/api/auth/callback
   https://trulyimagined.com/api/auth/callback
   https://trulyimagined-web-xxx.vercel.app/api/auth/callback
   ```
   (Include both the custom domain and the temporary Vercel domain for safety)

3. **Update "Allowed Logout URLs"**:
   ```
   http://localhost:3000
   https://trulyimagined.com
   https://trulyimagined-web-xxx.vercel.app
   ```

4. **Save**

---

## Phase 5: Update TI Environment Variables (Final Step)

Once HDICR custom domain is configured and live, update TI's `HDICR_API_URL`:

1. **In Vercel TI Project → Settings → Environment Variables**:

2. **Update `HDICR_API_URL`**:
   - Old value: `https://hdicr-xxx.vercel.app` (temporary)
   - New value: `https://hdicr.trulyimagined.com` (custom domain)
   - Click "Save"

3. **Redeploy TI**:
   - Click "Deployments" tab
   - Click three dots on latest deployment
   - Click "Redeploy"
   - Wait for redeploy (1-2 minutes)

---

## Phase 6: Final Verification

### Test HDICR Service

1. **Visit HDICR in browser**:
   - Go to: `https://hdicr.trulyimagined.com/health` (or check logs)
   - Or check Vercel logs for startup messages
   - Should see service is running

2. **Check HDICR Logs**:
   - In Vercel HDICR Project → "Logs" tab
   - Look for:
     - "Server listening" or similar startup message
     - No errors about missing environment variables
     - No database connection errors

### Test TI Service

1. **Visit TI in browser**:
   - Go to: `https://trulyimagined.com`
   - Should load the TI homepage
   - HTTPS should be working

2. **Log in**:
   - Click "Log In"
   - Auth0 login should appear
   - Log in with test account
   - Should be redirected back to TI

3. **Navigate to Dashboard**:
   - Click "Dashboard"
   - Should see actor data
   - TI should call HDICR successfully
   - No "schema" errors, no "HDICR" errors

4. **Check Logs**:
   - In Vercel TI Project → "Logs" tab
   - Look for:
     - "Auth0 token fetched" (or similar)
     - "HDICR request successful" (or similar)
     - No errors about missing M2M credentials
     - No errors about HDICR unavailability

### Check Correlation IDs (for debugging)

1. **In browser, open DevTools → Network tab**

2. **Reload dashboard and watch network requests**:
   - Look for request to HDICR API
   - Check request headers for `X-Correlation-ID`
   - Check response headers same ID is returned

3. **In Vercel logs**:
   - Search for correlation ID from above
   - Should find both TI and HDICR logs for same ID
   - Should show end-to-end flow

---

## Phase 7: Monitoring & Alerts (Optional but Recommended)

### Set Up Basic Monitoring

1. **Check Vercel Deployment Status**:
   - Vercel Dashboard → HDICR → "Deployments" → all green ✅
   - Vercel Dashboard → TI → "Deployments" → all green ✅

2. **Check Function Execution**:
   - Vercel Dashboard → HDICR → "Analytics" tab
   - Should see requests coming in
   - Error rate should be near 0%
   - Response times should be <500ms

3. **Check Database Connectivity**:
   - In Vercel logs, search for database connection errors
   - Should see successful queries
   - No "connection timeout" errors

### Optional: Set Up Error Alerts

1. **In Vercel Dashboard → Settings → Git**:
   - Enable "Comments on Pull Requests" for visibility
   - Enable "Deploy Status Page" for transparency

2. **Monitor logs daily for first week**:
   - Watch for error spikes
   - Watch for performance degradation
   - Watch for auth failures

---

## Troubleshooting Checklist

### If HDICR fails to deploy:
- [ ] Check `NODE_ENV` is set to `production`
- [ ] Check `HDICR_DATABASE_URL` is correct format
- [ ] Check database connection works (ping from command line)
- [ ] Check Auth0 domain is correct in env var
- [ ] Check Vercel logs for specific error message

### If TI fails to deploy:
- [ ] Check all 8 environment variables are set
- [ ] Check `AUTH0_M2M_CLIENT_SECRET` is marked as "Sensitive"
- [ ] Check `HDICR_API_URL` points to correct HDICR endpoint
- [ ] Check TI database connection works
- [ ] Check Vercel logs for specific error message

### If TI can't call HDICR:
- [ ] Check `HDICR_API_URL` in TI env vars matches HDICR custom domain
- [ ] Check M2M credentials are correct (compare to Auth0 dashboard)
- [ ] Check HDICR is running (visit custom domain in browser)
- [ ] Check correlation ID appears in both TI and HDICR logs
- [ ] Check HDICR logs for token validation errors

### If dashboard loads but no actor data:
- [ ] Check TI logs for "HDICR request" errors
- [ ] Check HDICR logs for token validation errors (403)
- [ ] Check database queries are returning data
- [ ] Verify actor exists in HDICR database
- [ ] Check correlation ID in logs to trace flow

---

## Success Criteria

✅ **Deployment is successful when**:

1. [ ] Both services are deployed to Vercel
2. [ ] Custom domains are configured and HTTPS works
3. [ ] Can visit `https://trulyimagined.com` and see the app
4. [ ] Can log in via Auth0
5. [ ] Dashboard loads without errors
6. [ ] Actor data appears on dashboard (pulled from HDICR)
7. [ ] Vercel logs show no errors
8. [ ] Correlation IDs trace requests across services
9. [ ] Response times are acceptable (<1s end-to-end)
10. [ ] Error rates are near 0%

---

## Post-Deployment Monitoring (First 24 Hours)

- [ ] Check logs every hour for first 24 hours
- [ ] Monitor error rates (should be near 0%)
- [ ] Monitor response times (should be <1s)
- [ ] Test login/dashboard flow multiple times
- [ ] Check database backups are working
- [ ] Be ready to rollback if critical issues appear

---

## Rollback Plan (If Critical Issues)

If something goes wrong after deployment:

1. **In Vercel Dashboard**:
   - Go to HDICR Project → Deployments
   - Find the previous working deployment
   - Click "..." and "Promote to Production"
   - Wait for rollback (1-2 minutes)

2. **Repeat for TI** if needed

3. **Fix the issue** locally

4. **Re-deploy** once fixed

---

## Congratulations! 🎉

Once you get past Phase 6 successfully, you have:
- ✅ Two independent microservices deployed to Vercel
- ✅ M2M authentication working end-to-end
- ✅ Database separation configured correctly
- ✅ Custom domains set up with HTTPS
- ✅ Production-ready infrastructure

Next steps:
- Monitor for 24 hours
- Fix any minor issues that surface
- Continue feature development with confidence
- Plan for scaling as demand grows
