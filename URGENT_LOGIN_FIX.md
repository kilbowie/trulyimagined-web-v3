# 🔥 URGENT FIX: Login with Email/Password ONLY

## The Problem

You have a profile in the database linked to Email/Password login (`auth0|69c0a8726e8cd2f46877d134`), but you're trying to log in with **Google OAuth** (`google-oauth2|102...`).

Auth0 treats these as **completely different users**!

---

## ✅ IMMEDIATE FIX

### Step 1: Clear Browser Session

**Option A - DevTools:**

1. Press `F12` (Developer Tools)
2. Go to **Application** tab
3. Click **Cookies** → `http://localhost:3000`
4. Click "Clear all cookies" button
5. Close DevTools

**Option B - Incognito Window:**

1. Open new Incognito/Private window
2. Navigate to `http://localhost:3000`

### Step 2: Log In with Email/Password

1. Go to: `http://localhost:3000`
2. Click **"Sign In"**
3. **⚠️ CRITICAL: Enter email and password manually**
   - Email: `adamrossgreene@gmail.com`
   - Password: Your password
4. **❌ DO NOT click "Continue with Google"**
5. Click **"Continue"** or **"Log In"**

### Step 3: Verify Success

- Should redirect directly to `/dashboard` (NO role selection)
- Dashboard should show "Actor" role
- No errors in browser console

---

## 🔍 Why This Happened

### Auth0 Connection Types Create Different User IDs:

| Login Method   | Auth0 User ID                          | Status                     |
| -------------- | -------------------------------------- | -------------------------- |
| Email/Password | `auth0\|69c0a8726e8cd2f46877d134`      | ✅ Has profile in database |
| Google OAuth   | `google-oauth2\|102864749045087165048` | ❌ Profile deleted         |
| Facebook       | `facebook\|xxx`                        | ❌ No profile              |
| GitHub         | `github\|xxx`                          | ❌ No profile              |

When you log in with **Google OAuth**, Auth0 uses a different user ID. Your profile is linked to **Email/Password** only.

---

## 🎯 Permanent Solution: Account Linking

After you successfully log in with Email/Password, implement Auth0 account linking:

### Implementation (15 minutes):

1. **Read the guide:** `AUTH0_ACCOUNT_LINKING_GUIDE.md`
2. **Go to:** Auth0 Dashboard → Actions → Flows → Login
3. **Create Action** with the account linking code (from guide)
4. **Deploy and Apply** to Login flow

### What Account Linking Does:

- Automatically merges Google OAuth → Email/Password account
- User can log in with **either** method
- Both login methods use the **same profile**
- Prevents duplicate profile errors forever

---

## 🧪 Testing After Fix

### Test 1: Verify Current Login Works

```powershell
# Check your current session
# Go to: http://localhost:3000/auth/profile

# Should show:
{
  "sub": "auth0|69c0a8726e8cd2f46877d134",  // ← Email/Password ID
  "email": "adamrossgreene@gmail.com"
}
```

### Test 2: Check Database Profile

```powershell
# Run this to verify profile exists
$env:DATABASE_URL = "postgresql://trimg_admin:%5D0W%26%21%3DUewTBq-eo05%2B8pd5%3D%23N3eav%251t@trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com:5432/trulyimagined_v3?sslmode=require"
node .\check-profile-state.js

# Should show:
# Auth0 ID: auth0|69c0a8726e8cd2f46877d134
# Role: Actor
# Username: adamrossgreene
```

---

## ❌ DON'T Do This (Until Account Linking is Implemented)

- ❌ Don't click "Continue with Google"
- ❌ Don't use Facebook login
- ❌ Don't use GitHub login
- ❌ Don't use any social login buttons

**Only use:**

- ✅ Email field + Password field + "Continue" button

---

## 🔧 If You Still See Role Selection Page

This means you're logging in with the wrong method. Check:

1. **Check your Auth0 sub in browser:**
   - Go to: `http://localhost:3000/auth/profile`
   - Look at `"sub"` field
   - **Should be:** `auth0|69c0a8726e8cd2f46877d134`
   - **If different:** You used wrong login method

2. **Force logout and retry:**

   ```powershell
   # Go to:
   http://localhost:3000/auth/logout

   # Then clear cookies (F12 → Application → Cookies → Clear all)
   # Then log in with EMAIL/PASSWORD only
   ```

---

## 🎯 Next Steps (In Order)

1. ✅ **NOW:** Clear browser session
2. ✅ **NOW:** Log in with Email/Password ONLY
3. ✅ **NOW:** Verify dashboard loads (no role selection)
4. ⏭️ **NEXT:** Implement Auth0 account linking (see `AUTH0_ACCOUNT_LINKING_GUIDE.md`)
5. ⏭️ **THEN:** Test logging in with Google OAuth (should work after linking)

---

## 📞 Still Having Issues?

If you still can't log in after following these steps:

1. **Check Auth0 Dashboard:**
   - Go to: Auth0 Dashboard → User Management → Users
   - Search for: `adamrossgreene@gmail.com`
   - How many users do you see?
   - What are their user IDs (`auth0|xxx` or `google-oauth2|xxx`)?

2. **Check browser console:**
   - Press `F12`
   - Go to **Console** tab
   - Look for red errors
   - Share the error message

3. **Check server logs:**
   - Look at terminal running `pnpm dev`
   - Look for database connection errors
   - Look for "no profile found" errors

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ You log in with email/password
- ✅ You go **directly** to `/dashboard` (no role selection)
- ✅ Dashboard shows "Actor" badge
- ✅ `/auth/profile` shows `"sub": "auth0|69c0a8726e8cd2f46877d134"`
- ✅ No errors in browser console
- ✅ No errors in terminal

---

**TL;DR:**

1. Clear cookies
2. Log in with **Email + Password** (NOT Google button)
3. Should work immediately
4. Then implement account linking from `AUTH0_ACCOUNT_LINKING_GUIDE.md`
