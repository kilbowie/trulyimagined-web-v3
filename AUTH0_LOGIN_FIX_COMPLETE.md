# Auth0 Login Fix - Complete Resolution

## ✅ What Was Fixed

### 1. Database SSL Certificate Error (FIXED ✅)

**File:** `apps/web/src/lib/db.ts`

**Problem:** The `?sslmode=require` parameter in DATABASE_URL was conflicting with the `rejectUnauthorized: false` setting, causing "self-signed certificate in certificate chain" errors.

**Solution:** Updated database connection to:

- Parse the DATABASE_URL manually
- Remove the conflicting `?sslmode=` parameter
- Properly configure SSL with `rejectUnauthorized: false` for AWS RDS

**Result:** Database queries now work correctly without SSL errors.

---

## 🔧 What You Need to Do

### 2. Disable Google OAuth in Auth0 Dashboard

The "Continue with Google" button appears on Auth0's Universal Login page because Google OAuth is enabled as a social connection. You need to disable it in the Auth0 dashboard.

#### Steps to Disable Google OAuth:

1. **Go to Auth0 Dashboard**
   - URL: https://manage.auth0.com/
   - Log in with your Auth0 account

2. **Select Your Tenant**
   - Choose: `kilbowieconsulting.uk.auth0.com`

3. **Navigate to Social Connections**
   - In the left sidebar, click **Authentication**
   - Click **Social**
   - Or direct link: https://manage.auth0.com/dashboard/us/kilbowieconsulting/connections/social

4. **Disable or Delete Google**
   - Find **Google** in the list
   - **Option A (Recommended):** Toggle the switch to **OFF** (keeps configuration for later)
   - **Option B:** Click the **⋯** (three dots) menu → **Delete** (removes completely)

5. **Verify in Your Application**
   - Click on **"Truly Imagined - Development"** application in Auth0
   - Go to **Connections** tab
   - Ensure **Google** is unchecked/disabled

---

## 🧪 Testing Instructions

### Step 1: Restart Development Server

```powershell
# Stop the current server (Ctrl+C if running)
# Then restart:
cd apps/web
pnpm dev
```

### Step 2: Clear Browser Session

```powershell
# In your browser:
# 1. Go to: http://localhost:3000/auth/logout
# 2. Press F12 → Application tab → Cookies
# 3. Right-click localhost:3000 → Clear
# 4. Close browser DevTools
```

### Step 3: Test adamrossgreene@gmail.com (Actor)

1. **Go to:** http://localhost:3000/auth/login

2. **Verify:** You should now see ONLY:
   - Email field
   - Password field
   - Continue button
   - ❌ NO "Continue with Google" button

3. **Log in with:**
   - Email: `adamrossgreene@gmail.com`
   - Password: Your Auth0 password (NOT your Gmail password)

4. **Expected Result:**
   - ✅ Login successful
   - ✅ Redirected directly to `/dashboard` (NOT `/select-role`)
   - ✅ Dashboard shows "Actor" badge
   - ✅ No errors in browser console
   - ✅ No errors in terminal

### Step 4: Test adam@kilbowieconsulting.com (Admin)

1. **Log out:** http://localhost:3000/auth/logout

2. **Clear cookies again** (F12 → Application → Cookies → Clear)

3. **Log in with:**
   - Email: `adam@kilbowieconsulting.com`
   - Password: Your Auth0 password

4. **Expected Result:**
   - ✅ Login successful
   - ✅ Redirected to `/dashboard`
   - ✅ Dashboard shows "Admin" badge
   - ✅ Access to admin menu items

---

## 🔍 Verification Checklist

After completing the above steps, verify the following:

### Database ✅

- [x] SSL certificate error fixed
- [x] adamrossgreene@gmail.com profile exists (Actor, completed)
- [x] adam@kilbowieconsulting.com profile exists (Admin, completed)
- [x] Both profiles linked to `auth0|...` user IDs (email/password)

### Auth0 Dashboard Configuration

- [ ] Google OAuth connection disabled/deleted
- [ ] "Truly Imagined - Development" app shows no Google connection
- [ ] Username-Password-Authentication enabled

### Login Flow

- [ ] Login page shows NO "Continue with Google" button
- [ ] Email/password login works
- [ ] Redirects to `/dashboard` (not `/select-role`)
- [ ] No "Internal server error" on profile page

### Both Test Users

- [ ] adamrossgreene@gmail.com logs in successfully (Actor)
- [ ] adam@kilbowieconsulting.com logs in successfully (Admin)
- [ ] Correct roles displayed in dashboard
- [ ] No SSL errors in browser console
- [ ] No database errors in server logs

---

## ❌ Troubleshooting

### If you still see "Continue with Google" button:

**Cause:** Auth0 connection not fully disabled or cached.

**Fix:**

1. Double-check Auth0 dashboard that Google is OFF
2. Clear browser cache completely (Ctrl+Shift+Delete)
3. Try in incognito/private browsing window
4. Wait 5 minutes for Auth0 to propagate changes

### If you get "Invalid email or password":

**Cause:** You're using your Gmail password instead of Auth0 password.

**Fix:**

1. Click "Forgot password?" on Auth0 login page
2. Reset your password for adamrossgreene@gmail.com
3. Check your email for reset link
4. Set a new password
5. Try logging in again

### If you still see "Internal server error":

**Cause:** Database connection issue or profile not found.

**Fix:**

```powershell
# Test database connection:
node check-database-state.js

# Should show both profiles exist
# If not, there's a database connectivity issue
```

### If redirected to `/select-role`:

**Cause:** Logging in with wrong Auth0 connection or profile not found.

**Fix:**

1. Check which Auth0 ID you're using:
   - Go to: http://localhost:3000/auth/profile
   - Look at `"sub"` field
   - Should be: `auth0|69c0a8726e8cd2f46877d134` (for adamrossgreene)
   - Should be: `auth0|69c0ac1acad23b46b85d6a2f` (for adam@kilbowie)
   - If different: You're using wrong login method

2. Log out completely and try again with email/password

---

## 📋 Summary

### What was fixed in code:

- ✅ `apps/web/src/lib/db.ts` - SSL certificate configuration
- ✅ Database connection now parses URL correctly

### What you need to do:

1. ✅ Disable Google OAuth in Auth0 dashboard
2. ✅ Restart dev server
3. ✅ Test login for both users
4. ✅ Verify dashboard access

### Expected outcome:

- ✅ No SSL errors
- ✅ No "Continue with Google" button
- ✅ Both users log in successfully
- ✅ Correct roles displayed
- ✅ Dashboard accessible

---

## 🎯 Next Steps (After Login Works)

Once both users can log in successfully:

1. **Test Dashboard Features:**
   - Actor profile management
   - Media upload
   - Credential issuance
   - Consent management

2. **Test Admin Dashboard:**
   - User management
   - System settings
   - Admin-only features

3. **Optional: Re-enable Google OAuth (Later):**
   - Implement Auth0 Account Linking first
   - See: `AUTH0_ACCOUNT_LINKING_GUIDE.md`
   - Then re-enable Google OAuth
   - Users can use either method to log in

---

**Need Help?**

If any step fails, check:

1. Server logs in terminal (look for errors)
2. Browser console (F12 → Console tab)
3. Run: `node check-database-state.js` to verify DB state
4. Check Auth0 logs: https://manage.auth0.com/dashboard/us/kilbowieconsulting/logs
