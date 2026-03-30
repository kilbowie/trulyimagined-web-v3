# Auth0 Callback URL Fix - URGENT ⚠️

**Error:** "Callback URL mismatch" when clicking Sign In or Get Started

**Cause:** Auth0 application settings don't include `http://localhost:3000/api/auth/callback` in Allowed Callback URLs

---

## Quick Fix (5 minutes)

### Step 1: Log into Auth0 Dashboard

1. Go to: https://manage.auth0.com/
2. Select your tenant: **kilbowieconsulting.uk.auth0.com**

### Step 2: Update Application Settings

1. Click **Applications** → **Applications** in left sidebar
2. Find and click your application (likely named "Truly Imagined - Development")
3. Go to **Settings** tab

### Step 3: Add Callback URLs

Find the **Allowed Callback URLs** field and add:

```
http://localhost:3000/api/auth/callback
```

**If you already have other URLs**, separate them with commas:

```
http://localhost:3000/api/auth/callback,
https://yourdomain.com/api/auth/callback
```

### Step 4: Add Logout URLs

Find the **Allowed Logout URLs** field and add:

```
http://localhost:3000
```

### Step 5: Add Web Origins

Find the **Allowed Web Origins** field and add:

```
http://localhost:3000
```

### Step 6: Save Changes

- Scroll to bottom
- Click **Save Changes** button
- Wait for confirmation

### Step 7: Test

1. Restart your dev server: `pnpm dev`
2. Go to http://localhost:3000
3. Click **Sign In** or **Get Started**
4. Should redirect to Auth0 login successfully

---

## Complete Configuration Reference

For a full production setup, here are all the URLs you should configure:

### Development:

```
Allowed Callback URLs:
http://localhost:3000/api/auth/callback

Allowed Logout URLs:
http://localhost:3000

Allowed Web Origins:
http://localhost:3000
```

### Production (when you deploy):

```
Allowed Callback URLs:
http://localhost:3000/api/auth/callback,
https://trulyimagined.com/api/auth/callback,
https://www.trulyimagined.com/api/auth/callback,
https://your-vercel-app.vercel.app/api/auth/callback

Allowed Logout URLs:
http://localhost:3000,
https://trulyimagined.com,
https://www.trulyimagined.com,
https://your-vercel-app.vercel.app

Allowed Web Origins:
http://localhost:3000,
https://trulyimagined.com,
https://www.trulyimagined.com,
https://your-vercel-app.vercel.app
```

---

## Troubleshooting

### Still Getting 404 Error?

1. **Verify the Route Handler Exists:**
   - File should exist at: `apps/web/src/app/api/auth/[auth0]/route.ts`
   - ✅ This file exists in your project

2. **Check Auth0 Domain:**
   - Environment variable: `AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com`
   - ✅ This is configured correctly

3. **Hard Refresh Browser:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

4. **Clear Browser Cookies:**
   - Settings → Privacy → Clear browsing data
   - Select "Cookies" only
   - Time range: "Last hour"

### Error: "Invalid state"

This means the OAuth state parameter doesn't match. Fix:

1. Clear all browser cookies for localhost:3000
2. Restart your dev server
3. Try login again in incognito/private window

### Error: "access_denied"

Check Auth0 Application settings:

1. **Grant Types** should include:
   - Authorization Code
   - Refresh Token
2. **Token Endpoint Authentication Method**: Post

---

## Why This Happened

Auth0 requires you to explicitly whitelist all callback URLs for security. When you:

1. Click "Sign In" → redirects to Auth0
2. User logs in → Auth0 redirects back to your app
3. The redirect URL must be in the **Allowed Callback URLs** list

Your current Auth0 app likely has this configured:

```
http://localhost:3000     ❌ Not the callback URL
```

But needs:

```
http://localhost:3000/api/auth/callback     ✅ Correct
```

The `/api/auth/callback` route is handled by the Next.js Auth0 SDK automatically through the `[auth0]` dynamic route.

---

## Environment Variables Reference

Your current `.env.local` configuration:

```bash
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=kxYtdJFVLVarzYxyxGCigPAAKaAExFNk
AUTH0_AUDIENCE=https://api.trulyimagined.com
AUTH0_POST_LOGIN_REDIRECT=/dashboard
APP_BASE_URL=http://localhost:3000
```

✅ All correct - no changes needed here.

---

## After Fixing

Once you've added the callback URL in Auth0:

1. ✅ Login will work
2. ✅ Users will be redirected to `/dashboard` after login
3. ✅ Logo clicks navigate to homepage with hover effect
4. ✅ Logo-only branding (no text) in navbar and sidebar

**Next time you deploy to production**, remember to add your production URLs to Auth0 settings!
