# Auth0 Testing & Troubleshooting Guide

## ✅ Pre-Flight Checklist

Before testing, verify these settings in Auth0 Dashboard:

### 1. Application Settings

- [ ] Go to Applications > Applications > Your App
- [ ] **Allowed Callback URLs** includes: `http://localhost:3000/api/auth/callback`
- [ ] **Allowed Logout URLs** includes: `http://localhost:3000`
- [ ] **Allowed Web Origins** includes: `http://localhost:3000`
- [ ] Application Type is "Regular Web Application"

### 2. API Settings

- [ ] Go to Applications > APIs > `https://api.trulyimagined.com`
- [ ] **Enable RBAC** is ON
- [ ] **Add Permissions in the Access Token** is ON
- [ ] API Identifier is exactly: `https://api.trulyimagined.com`

### 3. Roles Created

- [ ] Actor role exists
- [ ] Agent role exists
- [ ] Admin role exists
- [ ] Enterprise role exists

### 4. Action Deployed

- [ ] "Add Roles to Token" Action is created
- [ ] Action is added to the Login Flow
- [ ] Action is deployed (not just saved)

---

## 🧪 Step-by-Step Testing

### Step 1: Restart Dev Server

**Important:** Environment variables only load when the server starts.

```bash
# Press Ctrl+C in your terminal
cd apps/web
pnpm dev
```

Wait for: `✓ Ready in X.Xs`

---

### Step 2: Test Basic API

Open browser and navigate to:

```
http://localhost:3000/api/health
```

**Expected:** JSON response with status "ok"

**If you get 404:** The Next.js server isn't running properly. Check terminal for errors.

---

### Step 3: Check Server Logs

Look at your terminal where `pnpm dev` is running. You should see:

```
[AUTH0] Initializing with config: {
  domain: 'https://kilbowieconsulting.uk.auth0.com',
  clientId: '***AJ1e',
  audience: 'https://api.trulyimagined.com',
  baseUrl: 'http://localhost:3000',
  secret: 'SET (length: 64)'
}
```

**If you see "MISSING":** The environment variable isn't loaded. Restart the server.

---

### Step 4: Test Login Endpoint

Open browser DevTools (F12) > Console tab

Navigate to:

```
http://localhost:3000/api/auth/login
```

**Expected:**

- Terminal shows: `[AUTH] Handling route: /api/auth/login`
- Terminal shows: `[AUTH] Starting login flow...`
- Browser redirects to Auth0 login page

**If you get 404:**

- Check terminal for the route being called
- Verify the file exists at: `apps/web/src/app/api/auth/[auth0]/route.ts`

**If you get 500:**

- Check terminal for the exact error message
- Look for "Error handling route /api/auth/login"
- Common causes:
  - Missing AUTH0_SECRET
  - Missing AUTH0_AUDIENCE
  - Missing AUTH0_CLIENT_ID or AUTH0_CLIENT_SECRET
  - Wrong AUTH0_ISSUER_BASE_URL

---

### Step 5: Complete Login Flow

1. Click "Log In" button on homepage
2. Should redirect to Auth0
3. Enter credentials
4. Should redirect back to `http://localhost:3000`

**Terminal should show:**

```
[AUTH] Handling route: /api/auth/login
[AUTH] Starting login flow...
[AUTH] Login initiated, redirecting to Auth0
[AUTH] Handling route: /api/auth/callback
[AUTH] Callback processed
```

---

### Step 6: Verify Session

After logging in, navigate to:

```
http://localhost:3000/api/auth/me
```

**Expected:** JSON with your user profile including:

```json
{
  "sub": "auth0|...",
  "email": "your@email.com",
  "name": "Your Name",
  "https://trulyimagined.com/roles": ["Actor"]
}
```

**If roles array is empty:**

- The "Add Roles to Token" Action isn't working
- Assign a role to your user in Auth0 Dashboard
- Re-deploy the Action
- Log out and log in again

---

### Step 7: Test Dashboard

Navigate to:

```
http://localhost:3000/dashboard
```

**Expected:** See your profile with roles displayed

---

## 🐛 Common Errors & Solutions

### Error: "redirect_uri_mismatch"

**Cause:** Callback URL not registered in Auth0

**Fix:**

1. Go to Auth0 Dashboard > Applications > Your App
2. Add to "Allowed Callback URLs": `http://localhost:3000/api/auth/callback`
3. Save changes
4. Try again (no server restart needed)

---

### Error: "invalid_request" - The audience is invalid

**Cause:** AUTH0_AUDIENCE doesn't match API identifier

**Fix:**

1. Check `.env.local`: `AUTH0_AUDIENCE=https://api.trulyimagined.com`
2. Check Auth0 API identifier matches exactly
3. Restart dev server

---

### Error: "Unauthorized" or "access_denied"

**Cause:** User doesn't have permission to access the application

**Fix:**

1. Go to Auth0 Dashboard > User Management > Users
2. Find your user
3. Verify user is enabled (not blocked)
4. Try again

---

### Error: Session cookie errors / "Invalid session"

**Cause:** Invalid or expired AUTH0_SECRET

**Fix:**

1. Generate new secret: `openssl rand -hex 32` (or use the one in .env.local)
2. Update `.env.local` with new `AUTH0_SECRET`
3. Restart dev server
4. Clear browser cookies for localhost:3000
5. Try logging in again

---

### Error: 404 on /auth/profile

**Cause:** Client SDK looking for wrong route

**Fix:** Already fixed in [apps/web/src/components/Auth0Provider.tsx](apps/web/src/components/Auth0Provider.tsx)

Verify it shows:

```typescript
<AuthProvider
  loginUrl="/api/auth/login"
  profileUrl="/api/auth/me"
>
```

---

### Error: No roles in JWT token

**Cause:** Action not deployed or not in Login Flow

**Fix:**

1. Go to Auth0 Dashboard > Actions > Library
2. Find "Add Roles to Token"
3. Click Deploy (if showing "Save")
4. Go to Actions > Flows > Login
5. Ensure "Add Roles to Token" is in the flow (drag it in if not)
6. Click Apply
7. Assign a role to your test user
8. Log out and log in again

---

## 📊 Debug Checklist

If login still doesn't work, gather this info:

- [ ] **Terminal output** when clicking login (copy the [AUTH] logs)
- [ ] **Browser console errors** (F12 > Console tab)
- [ ] **Network tab errors** (F12 > Network tab, filter by "auth")
- [ ] **Environment variables loaded** (check terminal for [AUTH0] initialization log)
- [ ] **.env.local file** (verify all variables are set)
- [ ] **Auth0 Application settings** (callback URLs configured)
- [ ] **Auth0 API settings** (RBAC enabled)
- [ ] **Server restarted** after .env changes

---

## ✅ Confirmation Tests

Once working, verify:

1. ✅ Can log in
2. ✅ Can log out
3. ✅ `/dashboard` requires authentication
4. ✅ `/api/me` returns user profile
5. ✅ Roles appear in user profile
6. ✅ No errors in browser console
7. ✅ No errors in terminal

---

**Current Status:** Environment configured with:

- `AUTH0_SECRET`: ✅ Set (64 characters)
- `AUTH0_AUDIENCE`: ✅ Set (`https://api.trulyimagined.com`)
- `AUTH0_CLIENT_ID`: ✅ Set
- `AUTH0_CLIENT_SECRET`: ✅ Set
- `AUTH0_ISSUER_BASE_URL`: ✅ Set

**Next:** Restart dev server and follow Step 2 above.
