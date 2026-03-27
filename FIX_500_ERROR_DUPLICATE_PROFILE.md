# 500 Error Fix: Duplicate User Profile Issue

## Problem Identified ✅

You're getting a 500 error because **adamrossgreene@gmail.com has TWO user profiles** in the database:

### Profile 1 (Created First)

- **Auth0 ID:** `auth0|69c0a8726e8cd2f46877d134`
- **Login Method:** Email/Password (Auth0 Database)
- **Role:** Actor
- **Username:** `adamrossgreene`
- **Professional Name:** Adam Ross Greene

### Profile 2 (Duplicate)

- **Auth0 ID:** `google-oauth2|102864749045087165048`
- **Login Method:** "Continue with Google" (Google OAuth)
- **Role:** Agent
- **Username:** `agent-adam`
- **Professional Name:** Agent Adam

## Why This Causes 500 Error

When you log in, Auth0 assigns a different `user_id` depending on login method:

- Email/Password → `auth0|xxx`
- Google OAuth → `google-oauth2|xxx`

The system sees a "new" user and tries to create a profile, but:

1. Email `adamrossgreene@gmail.com` already exists → **Database constraint violation**
2. Username might already exist → **Duplicate key error**
3. Server returns **500 Internal Server Error**

---

## Solutions

### ✅ Solution 1: Delete Duplicate Profile (RECOMMENDED)

**Step 1: Run Fix Script**

```powershell
node fix-duplicate-profile.js
```

This will:

- Show both profiles
- Check for dependencies (identity_links, credentials, consent records)
- Confirm it's safe to delete

**Step 2: Confirm Deletion**

```powershell
node fix-duplicate-profile.js --confirm
```

This will delete the **Agent** profile (keeps **Actor** profile).

**Step 3: Clear Browser Session**

- **Chrome/Edge:** DevTools (F12) → Application → Cookies → Delete all for `localhost:3000`
- **Or:** Use Incognito/Private window
- **Or:** Clear all browsing data

**Step 4: Log In Correctly**

1. Go to http://localhost:3000
2. Click "Sign In"
3. **Use Email/Password login** (enter adamrossgreene@gmail.com + password)
4. **DO NOT click "Continue with Google"**
5. You should now see the Actor dashboard

---

### 🛠️ Solution 2: Manual Database Delete

If you prefer manual control:

```powershell
# Set password
$env:PGPASSWORD = "]0W&!=UewTBq-eo05+8pd5=#N3eav%1t"

# Connect to database
psql -h trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com `
     -U trimg_admin `
     -d trulyimagined_v3
```

```sql
-- Delete the Google OAuth profile (Agent)
DELETE FROM user_profiles
WHERE email = 'adamrossgreene@gmail.com'
  AND auth0_user_id = 'google-oauth2|102864749045087165048';

-- Verify only one profile remains
SELECT id, auth0_user_id, role, username
FROM user_profiles
WHERE email = 'adamrossgreene@gmail.com';
```

Then follow Step 3 & 4 from Solution 1.

---

### 🔧 Solution 3: Keep Both Profiles (Not Recommended)

If you want to keep both profiles:

1. **Change email** on one profile
2. **Update username** on one profile
3. **Use different login methods** consistently

```sql
-- Rename Agent profile email
UPDATE user_profiles
SET email = 'adamrossgreene+agent@gmail.com',
    username = 'adamrossgreene-agent'
WHERE auth0_user_id = 'google-oauth2|102864749045087165048';
```

Then:

- **Actor account:** Use Email/Password login
- **Agent account:** Use Google OAuth login

---

## Prevention: Avoid Future Duplicates

### Option A: Stick to One Login Method

Always use **Email/Password** OR always use **Google OAuth** for the same email.

### Option B: Implement Auth0 Account Linking (Advanced)

Configure Auth0 to automatically link accounts with the same email:

1. **Auth0 Dashboard** → Authentication → Database → Connections
2. Enable "Automatic Account Linking" (requires Rules or Actions)
3. Create linking logic:
   ```javascript
   // Auth0 Rule: Link accounts with same email
   function linkAccounts(user, context, callback) {
     const request = require('request');

     // Check if user has multiple accounts
     const searchParams = {
       url: auth0.baseUrl + '/users',
       headers: {
         Authorization: 'Bearer ' + auth0.accessToken,
       },
       qs: {
         search_engine: 'v3',
         q: `email:"${user.email}"`,
       },
     };

     request(searchParams, function (err, response, body) {
       if (err) return callback(err);

       const users = JSON.parse(body);
       if (users.length > 1) {
         // Link secondary account to primary
         const primaryUser = users[0];
         const secondaryUser = users[1];

         // Linking logic here...
       }

       callback(null, user, context);
     });
   }
   ```

---

## Verification Steps

After fixing, verify everything works:

### 1. Check Database

```powershell
$env:PGPASSWORD = "]0W&!=UewTBq-eo05+8pd5=#N3eav%1t"
psql -h trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com `
     -U trimg_admin -d trulyimagined_v3 `
     -c "SELECT auth0_user_id, role, username FROM user_profiles WHERE email = 'adamrossgreene@gmail.com';"
```

**Expected Output:**

```
auth0_user_id                    | role  | username
---------------------------------+-------+----------------
auth0|69c0a8726e8cd2f46877d134   | Actor | adamrossgreene
(1 row)
```

### 2. Test Login Flow

1. Open http://localhost:3000 in **Incognito window**
2. Click "Sign In"
3. Enter: adamrossgreene@gmail.com + password
4. Should redirect to `/dashboard` (NOT role selection)
5. Dashboard should show **Actor** role
6. No 500 errors in browser console or terminal

### 3. Check Server Logs

```powershell
# Watch dev server terminal for:
# ✅ [PROFILE] Profile exists: adamrossgreene@gmail.com
# ❌ Should NOT see: [PROFILE] Error: duplicate key value violates unique constraint
```

---

## Quick Commands Reference

```powershell
# Analyze issue
node fix-duplicate-profile.js

# Fix issue (deletes Agent profile)
node fix-duplicate-profile.js --confirm

# Manual database check
$env:PGPASSWORD = "]0W&!=UewTBq-eo05+8pd5=#N3eav%1t"
psql -h trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com `
     -U trimg_admin -d trulyimagined_v3

# Clear cookies (Chrome/Edge)
# DevTools (F12) → Application → Storage → Cookies → localhost:3000 → Delete All

# Start fresh dev server
cd apps/web
pnpm dev
```

---

## Root Cause Analysis

### How This Happened

1. **First Login (Email/Password):**
   - Auth0 creates: `auth0|69c0a8726e8cd2f46877d134`
   - System creates Actor profile
   - Username: `adamrossgreene`

2. **Second Login (Google OAuth):**
   - Auth0 creates NEW ID: `google-oauth2|102864749045087165048`
   - System doesn't recognize this as same user
   - System creates Agent profile
   - Username: `agent-adam`

3. **Third Login Attempt (Either Method):**
   - System tries to create profile AGAIN
   - Email `adamrossgreene@gmail.com` already exists
   - **Database constraint violation → 500 error**

### Why Auth0 Creates Different IDs

Auth0 treats each authentication method (connection) as a separate identity:

- `auth0|xxx` = Auth0 Database (email/password)
- `google-oauth2|xxx` = Google OAuth
- `facebook|xxx` = Facebook
- `github|xxx` = GitHub

To Auth0, these are **different users** unless you explicitly link them.

---

## Recommended Next Steps

1. ✅ **Run fix script:** `node fix-duplicate-profile.js --confirm`
2. ✅ **Clear browser session**
3. ✅ **Log in with Email/Password ONLY**
4. ✅ **Test Actor dashboard features**
5. ⚠️ **Remember:** Always use same login method
6. 📝 **Future:** Implement Auth0 account linking to prevent this

---

## If You Still Get Errors

### Check Dev Server Logs

Look for specific error messages:

```
[PROFILE] Error: duplicate key value violates unique constraint "user_profiles_email_key"
[PROFILE] Error: duplicate key value violates unique constraint "user_profiles_username_key"
[PROFILE] Error: duplicate key value violates unique constraint "user_profiles_professional_name_key"
```

### Check Browser Console (F12)

Look for:

```
POST http://localhost:3000/api/profile 500 (Internal Server Error)
```

### Increase Logging

Add to `apps/web/src/app/api/profile/route.ts`:

```typescript
console.log('[PROFILE] Auth0 User ID:', user.sub);
console.log('[PROFILE] Email:', user.email);
console.log('[PROFILE] Checking existing profile...');
```

---

## Need Help?

If the fix script doesn't work or you see other errors:

1. **Share the exact error message** from terminal
2. **Share browser console errors** (F12 → Console)
3. **Confirm which login method** you're using
4. **Check database** for current profile count

---

**Summary:** Delete the duplicate Agent profile, clear your session, and always use Email/Password login for adamrossgreene@gmail.com.
