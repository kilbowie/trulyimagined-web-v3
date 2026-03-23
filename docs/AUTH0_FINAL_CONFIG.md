# ✅ FINAL CONFIGURATION - Auth0 Dashboard Setup

## 🎯 What Was Changed in the Code

I've updated your codebase to match the **official Auth0 Next.js SDK** exactly:

### ✅ Changes Made:

1. **Environment Variables** (`.env.local`)
   - Changed `AUTH0_BASE_URL` → `APP_BASE_URL`
   - Changed `AUTH0_ISSUER_BASE_URL` → Removed (uses `AUTH0_DOMAIN` instead)
   - Updated to use new Dev App Client ID: `kxYtdJFVLVarzYxyxGCigPAAKaAExFNk`

2. **Auth0 Client** (`apps/web/src/lib/auth0.ts`)
   - Simplified to `new Auth0Client()` with minimal config
   - Auto-reads environment variables

3. **Middleware** (`apps/web/src/middleware.ts`)
   - Replaced with official SDK middleware pattern
   - Now calls `auth0.middleware(request)` which handles OAuth flow automatically

4. **Route Changes**
   - Changed ALL routes from `/api/auth/*` to `/auth/*`
   - Updated: AuthNav.tsx, dashboard/page.tsx, auth-debug/page.tsx

### ✅ Auth Routes Now Auto-Mounted:

The SDK automatically creates these routes:

- ✅ `/auth/login` - Redirects to Auth0 login page
- ✅ `/auth/logout` - Logs out the user
- ✅ `/auth/callback` - Handles the OAuth callback
- ✅ `/auth/profile` - Returns the user profile as JSON
- ✅ `/auth/access-token` - Returns the access token

---

## 🔧 REQUIRED: Auth0 Dashboard Configuration

### Step 1: Configure Callback URL

**CRITICAL:** You must add the callback URL to your Auth0 application!

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → **Applications**
3. Click on **"Truly Imagined - Development"** (Client ID: `kxYtdJFVLVarzYxyxGCigPAAKaAExFNk`)
4. Go to **Settings** tab
5. Scroll to **Application URIs** section

**Add these values:**

**Allowed Callback URLs:**

```
http://localhost:3000/auth/callback
```

**Allowed Logout URLs:** (already set, verify it's correct)

```
http://localhost:3000
```

**Allowed Web Origins:**

```
http://localhost:3000
```

6. **Click "Save Changes"** at the bottom!

---

### Step 2: Connect Application to API

Your development app needs permission to request tokens for your API:

1. In the same Application settings, go to **APIs** tab
2. Find your API: `Truly Imagined v3 API` (Identifier: `https://api.trulyimagined.com`)
3. Click **Authorize** or ensure it's connected
4. This allows the dev app to request access tokens for your API

---

### Step 3: Verify API Settings

1. Go to **Applications** → **APIs**
2. Click on **"Truly Imagined v3 API"**
3. Go to **Settings** tab
4. Verify:
   - ✅ **Enable RBAC:** ON
   - ✅ **Add Permissions in the Access Token:** ON
5. Save if you made changes

---

## 🚀 Testing Instructions

### 1. Restart Development Server

**Important:** Environment variables only load on server start!

```powershell
# Press Ctrl+C to stop current server
cd apps/web
pnpm dev
```

### 2. Test the Login Flow

1. Open browser: **http://localhost:3000**
2. Click **"Log In"** button
3. Should redirect to: `https://kilbowieconsulting.uk.auth0.com/authorize?...`
4. Log in with your Auth0 credentials
5. Should redirect to: `http://localhost:3000/auth/callback`
6. Then redirect to: `http://localhost:3000` (homepage)
7. You should see your profile in the navigation

### 3. Verify Session

Visit: **http://localhost:3000/auth/profile**

Should return JSON:

```json
{
  "sub": "auth0|...",
  "email": "your@email.com",
  "name": "Your Name",
  "https://trulyimagined.com/roles": ["Actor"]
}
```

### 4. Use Debug Dashboard

Visit: **http://localhost:3000/auth-debug**

This will automatically test:

- ✅ Health endpoint
- ✅ Login endpoint (should show redirect status)
- ✅ Session endpoint

---

## ✅ Success Criteria

Authentication is working when:

- [x] Clicking "Log In" redirects to Auth0 Universal Login
- [x] After login, you're redirected back to localhost:3000
- [x] User profile appears in navigation (top right)
- [x] `/auth/profile` returns user JSON with roles
- [x] `/auth-debug` shows green checkmarks

---

## 🔧 Current Environment Configuration

Your `.env.local` now has:

```bash
APP_BASE_URL=http://localhost:3000                    # Changed from AUTH0_BASE_URL
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com         # Replaces AUTH0_ISSUER_BASE_URL
AUTH0_CLIENT_ID=kxYtdJFVLVarzYxyxGCigPAAKaAExFNk   # NEW Dev App
AUTH0_CLIENT_SECRET=In7JW6zaLJ2kkwIKd8RxXdg1BIvtECQWqGRdBJdlP2dL6AqOut8o4WY6NxfZ19Iz
AUTH0_SECRET=330c7535fecc9b9622664dc11368a2263055261c2fa3b4658b87ef096e0a9010
AUTH0_AUDIENCE=https://api.trulyimagined.com
```

---

## 🚨 Common Issues & Solutions

### Issue: "Callback URL mismatch"

**Error:**

```
The redirect URI is wrong. You sent http://localhost:3000/auth/callback
```

**Solution:**

- Go to Auth0 Application Settings
- Add EXACT URL to **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
- Save changes
- Try login again

---

### Issue: 500 Error on Login

**Possible Causes:**

1. Missing AUTH0_CLIENT_SECRET
2. AUTH0_SECRET too short (must be 64+ characters)
3. Server not restarted after .env.local changes

**Solution:**

1. Verify all environment variables are set in `.env.local`
2. Restart dev server: `cd apps/web && pnpm dev`
3. Clear browser cookies
4. Try login again

---

### Issue: Routes still showing 404

**Possible Cause:**

- Old server still running with cached routes

**Solution:**

```powershell
# Kill all node processes
Get-Process node | Stop-Process -Force

# Restart server
cd apps/web
pnpm dev
```

---

## 📝 What You Need to Do

### Immediate Actions:

1. **✅ Go to Auth0 Dashboard** → Applications → "Truly Imagined - Development"
2. **✅ Add Callback URL**: `http://localhost:3000/auth/callback`
3. **✅ Verify Logout URL**: `http://localhost:3000`
4. **✅ Save Changes**
5. **✅ Restart dev server**: `cd apps/web && pnpm dev`
6. **✅ Test login**: Click "Log In" at http://localhost:3000

### After Login Works:

1. **Optional:** Set up roles and permissions (see [AUTH0_ENV_GUIDE.md](./AUTH0_ENV_GUIDE.md))
2. **Continue with roadmap:** Step 5 - Identity Registry MVP Frontend

---

## 🎯 What's Different from Before

| Before                  | After                                |
| ----------------------- | ------------------------------------ |
| `/api/auth/login`       | `/auth/login`                        |
| `/api/auth/logout`      | `/auth/logout`                       |
| `/api/auth/callback`    | `/auth/callback`                     |
| `/api/auth/me`          | `/auth/profile`                      |
| Custom route handler    | SDK middleware handles automatically |
| `AUTH0_BASE_URL`        | `APP_BASE_URL`                       |
| `AUTH0_ISSUER_BASE_URL` | `AUTH0_DOMAIN`                       |
| Production app ID       | New dev app ID                       |

---

## 📚 Files Changed

### Modified:

- ✅ `.env.local` - Updated environment variable names and dev app credentials
- ✅ `apps/web/src/lib/auth0.ts` - Simplified to match official SDK
- ✅ `apps/web/src/middleware.ts` - Uses official SDK middleware pattern
- ✅ `apps/web/src/components/AuthNav.tsx` - Updated to use `/auth/*` routes
- ✅ `apps/web/src/app/dashboard/page.tsx` - Updated to use `/auth/login`
- ✅ `apps/web/src/app/auth-debug/page.tsx` - Updated to test `/auth/*` endpoints

### Can Be Deleted (Optional):

- `apps/web/src/app/api/auth/[auth0]/route.ts` - No longer needed (SDK handles via middleware)

---

## 🆘 If Still Not Working

1. Take screenshot of http://localhost:3000/auth-debug
2. Check browser console (F12) for errors
3. Check terminal where `pnpm dev` is running for server errors
4. Share the error message and I'll help debug

---

## ✅ Once Working

After successful login, proceed to **Step 5** of the roadmap:

- Build Identity Registry MVP frontend
- Create Actor registration form
- Connect to `/identity/register` API endpoint

---

**The code is now 100% aligned with the official Auth0 Next.js SDK!** 🚀

Just add the callback URL in Auth0 Dashboard and restart the server.
