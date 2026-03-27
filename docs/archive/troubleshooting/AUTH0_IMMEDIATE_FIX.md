# 🚀 IMMEDIATE FIX: Auth0 Login Issues

## 🔴 CRITICAL ACTION REQUIRED

Your authentication isn't working because **production and development are sharing the same Auth0 application**. This is causing callback URL and configuration conflicts.

---

## ✅ QUICK FIX (5 minutes)

### Option A: Add Localhost to Production App (Quick but not recommended)

**If you want to test immediately:**

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → **Applications**
3. Find the app with Client ID: `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e`
4. Go to **Settings** tab
5. Find **Application URIs** section
6. **Allowed Callback URLs** - Add (separated by comma):
   ```
   <your-existing-production-callback>,http://localhost:3000/api/auth/callback
   ```
   Example:
   ```
   https://trulyimagined.com/auth/callback,http://localhost:3000/api/auth/callback
   ```
7. **Allowed Logout URLs** - Add:
   ```
   <your-existing-production-logout>,http://localhost:3000
   ```
8. **Allowed Web Origins** - Add:
   ```
   <your-existing-production-origin>,http://localhost:3000
   ```
9. Click **Save Changes**
10. Try login again at http://localhost:3000

**⚠️ WARNING:** This mixes dev and production. Not recommended for long-term use!

---

### Option B: Create Separate Dev App (Recommended - 10 minutes)

Follow the complete guide: **[CREATE_DEV_AUTH0_APP.md](./CREATE_DEV_AUTH0_APP.md)**

**Quick steps:**

1. Create new Auth0 application named "Truly Imagined - Development"
2. Set callback URL to `http://localhost:3000/api/auth/callback`
3. Copy new Client ID and Client Secret
4. Update `.env.local` with new credentials
5. Restart dev server
6. Test login

---

## 🔍 DIAGNOSE THE ISSUE

Visit this diagnostic page (server must be running):

```
http://localhost:3000/auth-debug
```

This will:

- ✅ Test all auth endpoints automatically
- ✅ Show you exactly what's failing
- ✅ Provide specific error messages
- ✅ Give you manual test buttons

---

## 📋 Current Configuration Check

Your current `.env.local` has:

```bash
AUTH0_CLIENT_ID=WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e  # ⚠️ This is likely your PRODUCTION app
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://kilbowieconsulting.uk.auth0.com
AUTH0_AUDIENCE=https://api.trulyimagined.com
```

**Issue:** If the production app with ID `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e` doesn't have `http://localhost:3000/api/auth/callback` in its allowed callbacks, login will fail with:

- 500 Internal Server Error
- Redirect URI mismatch error
- Invalid callback URL error

---

## 🧪 TEST ENDPOINTS MANUALLY

### 1. Test Health (should return JSON)

```
http://localhost:3000/api/health
```

**Expected:** `{"status": "ok"}`

### 2. Test Login (should redirect to Auth0)

```
http://localhost:3000/api/auth/login
```

**Expected:** Redirects to `https://kilbowieconsulting.uk.auth0.com/...`

### 3. Test Session (should return 401 when not logged in)

```
http://localhost:3000/api/auth/me
```

**Expected:** `{"error": "Not authenticated"}` or similar

---

## 🐛 Common Errors and Solutions

### Error: "Redirect URI mismatch"

**What you'll see:**

```
The redirect URI is wrong. You sent http://localhost:3000/api/auth/callback
and we expected http://localhost:3000/auth/callback
```

**Solution:**

1. The Auth0 app is configured for `/auth/callback` but your app uses `/api/auth/callback`
2. Either:
   - Add `http://localhost:3000/api/auth/callback` to Auth0 allowed callbacks
   - OR change your app to use `/auth/callback` (not recommended with Next.js App Router)

---

### Error: "500 Internal Server Error" on /api/auth/login

**What you'll see:**

```
GET http://localhost:3000/api/auth/login net::ERR_HTTP_RESPONSE_CODE_FAILURE 500
```

**Possible causes:**

1. ❌ Missing AUTH0_CLIENT_SECRET
2. ❌ Wrong AUTH0_CLIENT_ID
3. ❌ Invalid AUTH0_SECRET (must be 32+ bytes)
4. ❌ Callback URL not in Auth0 allowed list

**Solution:**

1. Check `.env.local` has all variables set
2. Verify Client ID matches your Auth0 app
3. Make sure AUTH0_SECRET is at least 64 characters (hex)
4. Add callback URL to Auth0 dashboard
5. **Restart dev server** after changes

---

### Error: "No user information" after login

**What you'll see:**

- Login succeeds
- Redirect back to homepage
- But no profile appears

**Possible causes:**

1. ❌ Session not being saved
2. ❌ Cookie not being set
3. ❌ AUTH0_SECRET missing or wrong

**Solution:**

1. Check browser cookies (F12 → Application → Cookies)
2. Should see `appSession` cookie
3. Verify AUTH0_SECRET is set
4. Clear cookies and try again

---

## 🔧 Files Created/Modified in This Session

### New Files

- ✅ `apps/web/src/app/auth-debug/page.tsx` - Diagnostic dashboard
- ✅ `docs/CREATE_DEV_AUTH0_APP.md` - Step-by-step guide for creating dev app
- ✅ `docs/AUTH0_ENV_GUIDE.md` - Where to find all environment variables

### Modified Files

- ✅ `apps/web/src/lib/auth0.ts` - Auth0Client configuration
- ✅ `apps/web/src/app/api/auth/[auth0]/route.ts` - Auth route handler
- ✅ `apps/web/src/components/Auth0Provider.tsx` - Client provider

---

## 📞 Next Steps

1. **Choose your option:**
   - Option A: Add localhost to production app (quick test)
   - Option B: Create separate dev app (proper solution)

2. **Make the changes** in Auth0 Dashboard

3. **Restart dev server:**

   ```powershell
   # Press Ctrl+C to stop current server
   cd apps/web
   pnpm dev
   ```

4. **Visit debug page:**

   ```
   http://localhost:3000/auth-debug
   ```

5. **Test login:**
   - Click "Test Login Flow" button
   - Should redirect to Auth0
   - Log in with credentials
   - Should redirect back to homepage

6. **If still not working:**
   - Take screenshot of `/auth-debug` results
   - Check terminal output for errors
   - Share the specific error message

---

## ✅ Success Criteria

Authentication is working when:

- ✅ Clicking "Log In" redirects to Auth0 Universal Login
- ✅ After login, redirects back to localhost:3000
- ✅ User profile appears in navigation
- ✅ `/api/auth/me` returns user JSON with roles
- ✅ `/auth-debug` shows all green checkmarks

---

## 📚 Additional Resources

- [Auth0 Dashboard](https://manage.auth0.com/)
- [Create Dev App Guide](./CREATE_DEV_AUTH0_APP.md)
- [Environment Variables Guide](./AUTH0_ENV_GUIDE.md)
- [Auth0 Next.js Docs](https://auth0.com/docs/quickstart/webapp/nextjs)
