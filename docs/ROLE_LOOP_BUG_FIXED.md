# 🔧 Role Selection Loop Bug - FIXED

## The Problem

You were experiencing an infinite loop where:
1. You log in → prompted to select a role
2. You select a role (e.g., Actor)
3. Role gets assigned in Auth0 ✅
4. You're redirected to dashboard
5. Next time you visit the site → prompted to select a role again ❌

**Root Cause:** After assigning a role in Auth0, your current JWT token still has no roles. JWT tokens only update when you log out and log back in. So the homepage kept seeing "no roles" and redirecting you to role selection.

---

## The Solution

### What Changed

1. **Automatic Token Refresh Flow:**
   - After you select a role, it's assigned in Auth0 ✅
   - Then you see a success message: "Role Assigned Successfully!"
   - After 2 seconds, you're automatically logged out
   - You log back in → Auth0 issues a fresh JWT with your new role
   - Now your role appears everywhere! 🎉

2. **Better User Experience:**
   - Clear success message shows your selected role
   - "Logging you out to refresh your session..." message explains what's happening
   - Automatic redirect - no manual steps needed
   - One-time setup - never prompted again after role is assigned

---

## How It Works Now

### First-Time User Flow:

```
1. Visit site → Not logged in
   ↓
2. Click "Login" → Authenticate with Auth0
   ↓
3. Logged in successfully → JWT has no roles (new user)
   ↓
4. Homepage checks roles → Sees 0 roles
   ↓
5. **Redirected to /select-role** (only happens once!)
   ↓
6. Select role: Actor / Agent / Enterprise
   ↓
7. Role assigned in Auth0 ✅
   ↓
8. Success message shown (2 seconds)
   ↓
9. **Automatically logged out**
   ↓
10. **Automatically redirected to /auth/login**
    ↓
11. Log in again (same credentials)
    ↓
12. Auth0 issues **NEW JWT with your role** ✅
    ↓
13. Homepage checks roles → Finds your role!
    ↓
14. **No redirect! You're done!** 🎉
```

### Returning User Flow:

```
1. Visit site → Not logged in
   ↓
2. Click "Login" → Authenticate with Auth0
   ↓
3. Logged in successfully → JWT has your role ✅
   ↓
4. Homepage checks roles → Finds your role!
   ↓
5. **No redirect! Go straight to dashboard** 🎉
```

---

## Testing the Fix

### Test 1: New User First Login

1. **Create a test user in Auth0:**
   - Go to Auth0 Dashboard → User Management → Users
   - Click **+ Create User**
   - Email: `test-user@example.com`
   - Password: `TestPass123!`
   - **DO NOT assign any role**

2. **Test the flow:**
   - Visit http://localhost:3000
   - Click "Login"
   - Enter: `test-user@example.com` / `TestPass123!`
   - **Expected:** Redirected to /select-role
   - Select a role (e.g., Actor)
   - Click "Continue"
   - **Expected:** Success message appears
   - **Expected:** After 2 seconds, automatically logged out
   - **Expected:** Automatically redirected to login
   - Log in again with same credentials
   - **Expected:** Homepage loads normally (no redirect!)

3. **Verify role is showing:**
   - Visit http://localhost:3000/dashboard
   - **Expected:** See your role badge (e.g., 🎭 Actor)
   - Visit http://localhost:3000/debug-roles
   - **Expected:** See ✅ Roles Found! with your role

---

### Test 2: Returning User (Has Role)

1. **Use your main account:**
   - Make sure your account has a role assigned in Auth0
   - Make sure Auth0 Action is deployed and in Login Flow

2. **Test the flow:**
   - Log out: http://localhost:3000/auth/logout
   - Visit http://localhost:3000
   - Click "Login"
   - Enter your credentials
   - **Expected:** Logged in directly to homepage
   - **Expected:** NO redirect to /select-role
   - **Expected:** Can access dashboard and see your role

---

## What Was Fixed

### Files Modified:

1. **`apps/web/src/app/select-role/page.tsx`**
   - Added success state UI
   - After role assignment succeeds:
     - Show success message
     - Wait 2 seconds
     - Redirect to `/auth/logout`
   - This forces JWT token refresh

2. **`apps/web/src/app/api/user/has-role/route.ts`** (NEW)
   - API endpoint to check if user has roles in Auth0
   - Can be used to prevent edge cases
   - Checks Auth0 directly, not just JWT token

### Files NOT Modified (Already Working):

- ✅ `apps/web/src/app/page.tsx` - Homepage role check is correct
- ✅ `apps/web/src/app/dashboard/page.tsx` - Dashboard displays roles correctly
- ✅ `apps/web/src/app/api/user/assign-role/route.ts` - Role assignment works correctly
- ✅ `docs/FIX_ROLES_NOT_IN_JWT.md` - Auth0 Action instructions are correct

---

## Key Insights

### Why JWT Tokens Need Refresh

**JWT tokens are immutable.** Once issued, they contain fixed claims until they expire. 

When you:
- Assign a role in Auth0 ✅
- The role is saved in Auth0's database ✅
- But your current JWT token doesn't change ❌

You need to:
- Log out (destroys current JWT)
- Log in again (Auth0 issues new JWT)
- New JWT includes the updated roles ✅

### Why Automatic Logout is Better

**Before (Manual):**
- User selects role → "Role assigned! Now log out and log back in"
- Confusing - why do I need to log out?
- Extra steps - user might forget
- Poor UX

**After (Automatic):**
- User selects role → Success message → Auto logout → Auto redirect to login
- Clear explanation of what's happening
- No manual steps
- Seamless UX

---

## Expected Behavior Summary

### ✅ Correct Behavior (After Fix):

- First login → Select role → Auto logout → Log in again → Role shows everywhere
- Second+ logins → Role already in JWT → No role selection prompt
- Dashboard shows role badges with emojis
- /debug-roles shows ✅ Roles Found!
- No infinite loops
- No repeated role selection prompts

### ❌ Old Buggy Behavior (Before Fix):

- Every login → Prompted to select role
- Dashboard shows no roles
- /debug-roles shows ❌ No Roles Found
- Infinite redirect loop to /select-role
- Role assigned in Auth0 but not visible in app

---

## Troubleshooting

### Still Being Prompted for Role Every Time?

1. **Check Auth0 Action is deployed:**
   - Go to Auth0 Dashboard → Actions → Library
   - Find "Add Roles to Token"
   - Make sure it says **"Deployed"** not "Draft"
   - Go to Actions → Flows → Login
   - Make sure action is in the flow diagram
   - Click **Apply** if needed

2. **Check role is assigned in Auth0:**
   - Go to User Management → Users
   - Find your user
   - Click Roles tab
   - Verify role is listed there

3. **Force token refresh:**
   - Visit http://localhost:3000/auth/logout
   - Clear browser cookies
   - Log in again
   - Check http://localhost:3000/debug-roles

---

## Still Having Issues?

If the fix doesn't work:

1. **Check the browser console for errors**
2. **Check Auth0 Dashboard → Monitoring → Logs** for errors
3. **Visit http://localhost:3000/debug-roles** to see exactly what's in your JWT
4. **Make sure you completed BOTH logout and login** after selecting a role

---

## Success Criteria ✅

You'll know it's working when:

- ✅ First-time users select role once and never again
- ✅ Returning users go straight to dashboard
- ✅ /dashboard shows role badges
- ✅ /debug-roles shows ✅ Roles Found!
- ✅ No redirect loops
- ✅ Roles persist across sessions

---

**The bug is fixed!** The role selection now works as intended - first-time setup only, with automatic token refresh.
