# 🚨 CRITICAL: Create Separate Development Auth0 Application

## ⚠️ Current Issue: Shared Production App

**Problem:** Your development environment is sharing the same Auth0 application as production. This causes:

1. ❌ **Callback URL conflicts** - Production callbacks might not include `localhost:3000`
2. ❌ **Route structure mismatches** - If production uses `/auth/*` but dev uses `/api/auth/*`
3. ❌ **Testing causes production side effects** - Changes to app settings affect live users
4. ❌ **Security risks** - Exposing production credentials in local `.env.local`

---

## ✅ SOLUTION: Create a Development Auth0 Application

Follow these steps to create a dedicated dev application:

### Step 1: Create New Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → **Applications**
3. Click **+ Create Application**
4. Fill in:
   - **Name:** `Truly Imagined - Development`
   - **Type:** Select **Regular Web Applications**
5. Click **Create**

---

### Step 2: Configure Application Settings

On the **Settings** tab of your new application:

#### Basic Information

- **Name:** Truly Imagined - Development
- **Domain:** (will show your tenant domain - `kilbowieconsulting.uk.auth0.com`)
- **Client ID:** (copy this - you'll need it)
- **Client Secret:** Click "Show" and copy (you'll need it)

#### Application URIs

Scroll down to **Application URIs** section:

1. **Allowed Callback URLs:**

   ```
   http://localhost:3000/api/auth/callback
   ```

2. **Allowed Logout URLs:**

   ```
   http://localhost:3000
   ```

3. **Allowed Web Origins:**
   ```
   http://localhost:3000
   ```

#### Advanced Settings

Scroll to **Advanced Settings** → **Grant Types**

Ensure these are checked:

- ✅ Authorization Code
- ✅ Refresh Token

**Click "Save Changes"** at the bottom!

---

### Step 3: Connect to API

Your development app needs access to your API:

1. In your new application, go to **APIs** tab
2. Click **Authorize** next to your API (`https://api.trulyimagined.com`)
3. This allows the dev app to request tokens for your API

**Note:** The API itself (`https://api.trulyimagined.com`) can be shared between dev and production apps. Only the **application** needs to be separate.

---

### Step 4: Update `.env.local`

Update your `.env.local` file in the **project root** (not `apps/web`) with the new credentials:

```bash
# ========================================
# Frontend Environment Variables (.env.local)
# ========================================

# Auth0 Configuration (Next.js SDK)
AUTH0_SECRET=330c7535fecc9b9622664dc11368a2263055261c2fa3b4658b87ef096e0a9010
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=<YOUR_NEW_DEV_CLIENT_ID>        # ⬅️ REPLACE with new Client ID
AUTH0_CLIENT_SECRET=<YOUR_NEW_DEV_CLIENT_SECRET> # ⬅️ REPLACE with new Client Secret
AUTH0_AUDIENCE=https://api.trulyimagined.com

# Legacy Auth0 (for backward compatibility)
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
```

**Important:** The `AUTH0_SECRET` can stay the same - it's for local session encryption.

---

### Step 5: Verify API Settings (Shared with Production)

Your API configuration should already be correct, but verify:

1. Go to **Applications** → **APIs**
2. Click on your API (`https://api.trulyimagined.com` or similar)
3. Go to **Settings** tab
4. Verify:
   - ✅ **Enable RBAC:** ON
   - ✅ **Add Permissions in the Access Token:** ON

---

### Step 6: Restart Development Server

After updating `.env.local`:

```powershell
# Stop the current server (Ctrl+C)
cd apps/web
pnpm dev
```

---

### Step 7: Test Authentication

Visit the debug page to test:

```
http://localhost:3000/auth-debug
```

This page will:

- ✅ Test all auth endpoints
- ✅ Show configuration details
- ✅ Provide manual test buttons
- ✅ Display any errors clearly

Or test manually:

1. Go to http://localhost:3000
2. Click **Log In**
3. Should redirect to Auth0 Universal Login
4. Log in with test credentials
5. Should redirect back to http://localhost:3000/api/auth/callback
6. Then redirect to homepage with profile visible

---

## 🔍 Troubleshooting

### Issue: Still getting 500 error

**Check:**

1. ✅ New Client ID and Secret copied correctly (no extra spaces)
2. ✅ Callback URL exactly matches: `http://localhost:3000/api/auth/callback`
3. ✅ Application Type is "Regular Web Application"
4. ✅ Dev server restarted after `.env.local` changes

**Debug:**

- Check browser console (F12) for specific error
- Check terminal where `pnpm dev` is running for server errors
- Visit `/auth-debug` for automated diagnostics

---

### Issue: Redirect URI mismatch

**Error message:**

```
The redirect URI is wrong. You sent http://localhost:3000/api/auth/callback
but we expected http://localhost:3000/auth/callback
```

**Solution:**

1. Go to Auth0 Application Settings
2. Update **Allowed Callback URLs** to match **exactly** what the error says
3. Save changes
4. Try login again

---

### Issue: No user/session after login

**Possible causes:**

1. Roles not assigned to user
2. Action not deployed or not in Login flow
3. RBAC not enabled on API

**Solution:**
See [AUTH0_ENV_GUIDE.md](./AUTH0_ENV_GUIDE.md) sections:

- Creating Roles
- Creating Action
- Assigning Roles to Users

---

## 📊 Comparison: Before vs After

### Before (Shared App) ❌

```
Production App (ID: WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e)
├── Callback: https://trulyimagined.com/auth/callback
├── Callback: http://localhost:3000/api/auth/callback (?)
└── Settings might conflict between dev/prod
```

### After (Separate Apps) ✅

```
Production App (ID: WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e)
├── Callback: https://trulyimagined.com/auth/callback
└── Settings: Optimized for production

Development App (ID: <new-client-id>)
├── Callback: http://localhost:3000/api/auth/callback
└── Settings: Optimized for local development

Shared API (https://api.trulyimagined.com)
├── Used by: Production App
├── Used by: Development App
└── RBAC enabled, roles work for both
```

---

## 🎯 Why This Matters

**Separation of concerns:**

- ✅ Dev changes don't affect production
- ✅ Different callback routes possible
- ✅ Independent configuration
- ✅ Easier debugging
- ✅ Better security (no prod secrets in dev)

**Shared API is OK:**

- ✅ Roles/permissions defined in API (not app)
- ✅ Both apps can use same API audience
- ✅ JWT validation works the same way
- ✅ Easier to maintain role structure

---

## 📝 Next Steps After Setup

Once authentication works:

1. ✅ Verify roles appear in token at `/api/auth/me`
2. ✅ Test protected routes work correctly
3. ✅ Continue with Step 5 of ROADMAP (Identity Registry Frontend)
4. ✅ Keep prod app credentials secure (don't commit to git)

---

## 🆘 Still Having Issues?

If authentication still doesn't work after creating a separate dev app:

1. **Visit debug page:** http://localhost:3000/auth-debug
2. **Take screenshot** of the test results
3. **Check terminal output** where `pnpm dev` is running
4. **Share error messages** - exact error text helps pinpoint the issue

Common errors and their meanings:

- `500 Internal Server Error` → Environment variables missing/incorrect
- `Redirect URI mismatch` → Callback URL not configured in Auth0
- `Invalid client` → Client ID or Secret wrong
- `Unauthorized` → API not authorized for this app
