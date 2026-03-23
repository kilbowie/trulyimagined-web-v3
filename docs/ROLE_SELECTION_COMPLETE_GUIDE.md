# 🎯 Role-Based Access Setup - Complete Guide

## ✅ What I've Built

I've created a complete role-based access system with first-login role selection:

### New Files Created:

1. **`/select-role` page** - Beautiful role selection UI for new users
   - Users choose: Actor, Agent, or Enterprise
   - Automatically shown on first login when no role is assigned
2. **`/api/user/assign-role`** - API endpoint to assign roles
   - Calls Auth0 Management API to assign the selected role
   - Validates role selection
   - Returns success/error responses

3. **Updated homepage** - Checks for roles and redirects
   - If logged in without role → redirect to `/select-role`
   - If logged in with role → show homepage normally

4. **`/docs/AUTH0_ROLE_SETUP.md`** - Complete setup guide for Auth0 Dashboard

---

## 🚀 Required Steps in Auth0 Dashboard

### Step 1: Create Roles

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **User Management** → **Roles**
3. Click **+ Create Role** for each:

   **Role 1: Admin**
   - Name: `Admin`
   - Description: `System administrators with full access`

   **Role 2: Actor**
   - Name: `Actor`
   - Description: `Performers and talent`

   **Role 3: Agent**
   - Name: `Agent`
   - Description: `Talent agents and representatives`

   **Role 4: Enterprise**
   - Name: `Enterprise`
   - Description: `Corporate and enterprise users`

---

### Step 2: Assign Admin Role to Your User

1. Go to **User Management** → **Users**
2. Find **adam@kilbowieconsulting.com**
3. Go to **Roles** tab
4. Click **Assign Roles**
5. Select **Admin**
6. Click **Assign**

---

### Step 3: Enable Management API Access

Your app needs permission to assign roles via API.

1. Go to **Applications** → **Applications**
2. Find **"Auth0 Management API"** (it's a default machine-to-machine app)
3. Go to **APIs** tab
4. Find your application: **"Truly Imagined - Development"**
5. Click **Authorize**
6. Grant these permissions (scopes):
   - `read:roles`
   - `read:users`
   - `update:users`
   - `create:role_members`
7. Click **Update**

**OR** use your existing app credentials:

Your current app (`kxYtdJFVLVarzYxyxGCigPAAKaAExFNk`) will use its own credentials to get a Management API token. This should work automatically if the app has the right grant types enabled.

---

### Step 4: Create "Add Roles to Token" Action

This ensures roles appear in the JWT token.

1. Go to **Actions** → **Library**
2. Click **+ Build Custom**
3. **Name:** `Add Roles to Token`
4. **Trigger:** Login / Post Login
5. **Runtime:** Node 18
6. Click **Create**

**Add this code:**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://trulyimagined.com';

  if (event.authorization) {
    const roles = event.authorization.roles || [];

    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
    api.idToken.setCustomClaim(`${namespace}/hasRole`, roles.length > 0);
  }
};
```

7. Click **Deploy**
8. Go to **Actions** → **Flows** → **Login**
9. Drag **"Add Roles to Token"** into the flow (between Start and Complete)
10. Click **Apply**

---

## 🧪 Testing the Complete Flow

### Test 1: Admin User (You)

1. **Log out:** http://localhost:3000/auth/logout
2. **Log in:** http://localhost:3000/auth/login
3. Use: **adam@kilbowieconsulting.com** / **BonitaKilbowie11!**
4. You should go straight to homepage (Admin role already assigned)
5. Check profile: http://localhost:3000/auth/profile
6. Should see:
   ```json
   {
     "email": "adam@kilbowieconsulting.com",
     "https://trulyimagined.com/roles": ["Admin"],
     "https://trulyimagined.com/hasRole": true
   }
   ```

---

### Test 2: New User Role Selection

1. **Create a new user** in Auth0:
   - Go to **User Management** → **Users**
   - Click **+ Create User**
   - Email: `test@example.com`
   - Password: `TestPass123!`
   - Click **Create**
   - **DO NOT assign any role** (leave it empty)

2. **Log in as new user:**
   - Log out if logged in: http://localhost:3000/auth/logout
   - Log in: http://localhost:3000/auth/login
   - Use: `test@example.com` / `TestPass123!`

3. **You should be redirected to:** http://localhost:3000/select-role

4. **Select a role:**
   - Click on **Actor**, **Agent**, or **Enterprise**
   - Click **"Continue to Dashboard"**

5. **Verify role assigned:**
   - Should redirect to `/dashboard`
   - Check profile: http://localhost:3000/auth/profile
   - Should see the selected role in the JSON

---

## 🎨 What the Role Selection Page Looks Like

Beautiful, modern card-based UI with:

- 🎭 **Actor** - For performers and talent
- 👔 **Agent** - For talent representatives
- 🏢 **Enterprise** - For production companies

Users click their role and click "Continue to Dashboard" - the role is automatically assigned via the Auth0 Management API.

---

## 🔧 How It Works

### Flow for New Users Without Roles:

1. User logs in for the first time
2. Homepage checks: "Does this user have any roles?"
3. If NO → Redirect to `/select-role`
4. User selects a role
5. Frontend calls `/api/user/assign-role` with selected role
6. API gets Management API token
7. API calls Auth0 to assign role to user
8. Frontend redirects to `/dashboard`
9. User logs out and back in → roles now in JWT token
10. Future logins → homepage doesn't redirect (user has role)

### Flow for Existing Users With Roles:

1. User logs in
2. Homepage checks: "Does this user have any roles?"
3. If YES → Show homepage normally
4. User can access dashboard and other protected routes

---

## 📝 Environment Variables Required

Already set in `apps/web/.env.local`:

```bash
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=kxYtdJFVLVarzYxyxGCigPAAKaAExFNk
AUTH0_CLIENT_SECRET=In7JW6zaLJ2kkwIKd8RxXdg1BIvtECQWqGRdBJdlP2dL6AqOut8o4WY6NxfZ19Iz
AUTH0_SECRET=330c7535fecc9b9622664dc11368a2263055261c2fa3b4658b87ef096e0a9010
AUTH0_AUDIENCE=https://api.trulyimagined.com
```

---

## ✅ Success Checklist

Complete these in order:

- [ ] **Step 1:** Create 4 roles in Auth0 (Admin, Actor, Agent, Enterprise)
- [ ] **Step 2:** Assign Admin role to adam@kilbowieconsulting.com
- [ ] **Step 3:** Enable Management API access for your app (grant scopes)
- [ ] **Step 4:** Create "Add Roles to Token" Action
- [ ] **Step 5:** Deploy Action and add to Login Flow
- [ ] **Step 6:** Restart dev server: `cd apps/web && pnpm dev`
- [ ] **Step 7:** Test admin login (should go to homepage)
- [ ] **Step 8:** Test new user login (should see role selection page)
- [ ] **Step 9:** Verify role appears in `/auth/profile`
- [ ] **Step 10:** Verify `/dashboard` shows user roles

---

## 🚨 Troubleshooting

### Issue: "Failed to assign role"

**Cause:** Management API not authorized

**Solution:**

1. Go to Applications → APIs tab of your dev app
2. Make sure Auth0 Management API is authorized
3. Grant these scopes: `read:roles`, `read:users`, `update:users`, `create:role_members`

---

### Issue: Roles show in Auth0 but not in JWT

**Cause:** "Add Roles to Token" Action not deployed or not in flow

**Solution:**

1. Go to Actions → Library → "Add Roles to Token"
2. Click **Deploy** (top right)
3. Go to Actions → Flows → Login
4. Make sure action is in the flow diagram
5. Click **Apply**
6. Log out and log back in

---

### Issue: Role selection page doesn't appear

**Cause:** User already has a role

**Solution:**

1. Create a brand new user without any roles
2. Or go to existing user in Auth0 → Roles tab → Remove all roles
3. Log in again

---

## 🎯 Next Steps

Once role selection is working:

1. **Build Actor Registration Form** (Step 5 of roadmap)
   - Only accessible to Actor role
   - Form fields: name, email, stage name, industry role, region
   - Calls `/identity/register` API

2. **Build Agent Dashboard** (Step 6 of roadmap)
   - Only accessible to Agent role
   - View represented actors
   - Manage consent on their behalf

3. **Build Enterprise Dashboard** (Step 7 of roadmap)
   - Only accessible to Enterprise role
   - Request license usage
   - View compliance status

---

## 📚 Files Modified/Created

### Created:

- ✅ `apps/web/src/app/select-role/page.tsx` - Role selection UI
- ✅ `apps/web/src/app/api/user/assign-role/route.ts` - Role assignment API
- ✅ `docs/AUTH0_ROLE_SETUP.md` - Setup guide

### Modified:

- ✅ `apps/web/src/app/page.tsx` - Added role check and redirect
- ✅ `apps/web/src/lib/auth.ts` - Already had role helper functions

---

**The role-based access system is complete!** 🚀

Just complete the Auth0 Dashboard steps and test the flow!
