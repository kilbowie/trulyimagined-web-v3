# 🔧 CRITICAL FIX: Roles Not Appearing in JWT Token

## ⚠️ The Problem

You've enabled RBAC and assigned roles in Auth0, BUT roles aren't appearing in your JWT token. This is because:

**Enabling RBAC in Auth0 API only controls API authorization. It does NOT automatically add roles to JWT tokens.**

You MUST create an Auth0 Action to explicitly add roles to tokens.

---

## ✅ THE SOLUTION (Follow EXACTLY)

### STEP 1: Verify Roles Are Assigned in Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/) → **User Management** → **Users**
2. Click on **adam@kilbowieconsulting.com**
3. Click **Roles** tab
4. Confirm you see assigned roles (e.g., Admin)

✅ If you see roles here, continue to STEP 2.
❌ If no roles, assign one first.

---

### STEP 2: Create "Add Roles to Token" Action

#### A. Navigate to Actions

1. Go to **Actions** → **Library**
2. Click **"+ Build Custom"** (blue button, top right)

#### B. Configure Action

- **Name:** `Add Roles to Token`
- **Trigger:** `Login / Post Login` (IMPORTANT: Select this from dropdown)
- **Runtime:** `Node 18` (default is fine)
- Click **Create**

#### C. Replace Default Code

Delete ALL the default code and paste this EXACT code:

```javascript
/**
 * Add Roles to Token Action
 *
 * This adds user roles from Auth0 RBAC to the JWT token
 * so they can be read by your application.
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://trulyimagined.com';

  // Get roles from Auth0 RBAC
  const roles = event.authorization?.roles || [];

  console.log(`[Add Roles] User: ${event.user.email}`);
  console.log(`[Add Roles] Roles found: ${JSON.stringify(roles)}`);

  if (roles.length > 0) {
    // Add roles to ID token (used by frontend)
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);

    // Add roles to Access token (used by API)
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);

    // Add helper claim
    api.idToken.setCustomClaim(`${namespace}/hasRole`, true);

    console.log(`[Add Roles] Successfully added ${roles.length} roles to token`);
  } else {
    console.log(`[Add Roles] No roles found for user`);
    api.idToken.setCustomClaim(`${namespace}/hasRole`, false);
  }
};
```

#### D. Deploy Action

1. Click **Deploy** button (top right corner)
2. Wait for green "Deployed" confirmation
3. **IMPORTANT:** Make sure it says "Deployed" not "Draft"

---

### STEP 3: Add Action to Login Flow

#### A. Navigate to Login Flow

1. Go to **Actions** → **Flows** → **Login**
2. You should see a flow diagram with **Start** → **Complete**

#### B. Add Action to Flow

1. On the right side, click **Custom** tab
2. Find **"Add Roles to Token"** in the list
3. **DRAG** it into the flow between **Start** and **Complete**
4. The flow should now look like:
   ```
   Start → Add Roles to Token → Complete
   ```

#### C. Apply Changes

1. Click **Apply** button (top right)
2. Wait for "Flow updated successfully" message

---

### STEP 4: Verify API Settings

1. Go to **Applications** → **APIs**
2. Click on **"Truly Imagined API"** (or your API name with identifier `https://api.trulyimagined.com`)
3. Go to **Settings** tab
4. Scroll to **RBAC Settings**
5. Verify these are **ON** (green toggle):
   - ✅ **Enable RBAC**
   - ✅ **Add Permissions in the Access Token**
6. Click **Save** if you changed anything

---

### STEP 5: Test the Fix

#### A. Clear Your Session

1. Open your app: http://localhost:3000
2. Visit: http://localhost:3000/auth/logout
3. Wait for logout to complete

#### B. Log Back In

1. Visit: http://localhost:3000/auth/login
2. Enter credentials: **adam@kilbowieconsulting.com** / **BonitaKilbowie11!**
3. Complete login

#### C. Check Roles

1. Visit: http://localhost:3000/debug-roles
2. You should see: **✅ Roles Found!**
3. Should show your assigned roles (e.g., Admin)

#### D. Verify Raw Token

1. Visit: http://localhost:3000/auth/profile
2. Look for this in the JSON:
   ```json
   {
     "https://trulyimagined.com/roles": ["Admin"],
     "https://trulyimagined.com/hasRole": true
   }
   ```

---

## 🔍 Still Not Working? Debug Steps

### Debug Step 1: Check Action Logs

1. Go to **Monitoring** → **Logs** in Auth0 Dashboard
2. Look for recent login events
3. Check for Action execution logs
4. Look for console.log messages from your Action

### Debug Step 2: Verify Action is in Flow

1. Go to **Actions** → **Flows** → **Login**
2. Confirm "Add Roles to Token" is visible in the diagram
3. If not, repeat STEP 3

### Debug Step 3: Check Action Status

1. Go to **Actions** → **Library**
2. Find "Add Roles to Token"
3. Verify it says **"Deployed"** (not "Draft")
4. If it says "Draft", click into it and click **Deploy**

### Debug Step 4: Force Token Refresh

Sometimes Auth0 caches tokens. Force refresh:

1. In Auth0 Dashboard, go to **User Management** → **Users**
2. Click your user
3. Click **Actions** dropdown → **Block User** → **Block**
4. Wait 5 seconds
5. Click **Actions** dropdown → **Unblock User** → **Unblock**
6. Try logging in again

---

## 📋 Checklist (Complete in Order)

- [ ] **1.** Verified roles assigned to user in Auth0 Dashboard
- [ ] **2.** Created "Add Roles to Token" Action
- [ ] **3.** Pasted correct code into Action
- [ ] **4.** Clicked **Deploy** button (shows "Deployed", not "Draft")
- [ ] **5.** Opened Actions → Flows → Login
- [ ] **6.** Dragged Action into flow diagram
- [ ] **7.** Clicked **Apply** button
- [ ] **8.** Verified RBAC is enabled on API
- [ ] **9.** Logged out: http://localhost:3000/auth/logout
- [ ] **10.** Logged back in: http://localhost:3000/auth/login
- [ ] **11.** Checked http://localhost:3000/debug-roles
- [ ] **12.** Saw ✅ Roles Found! message

---

## 🎯 Expected Results

After completing all steps:

### On /debug-roles:

```
✅ Roles Found!
Your account has 1 role(s) assigned: Admin
```

### On /auth/profile:

```json
{
  "email": "adam@kilbowieconsulting.com",
  "https://trulyimagined.com/roles": ["Admin"],
  "https://trulyimagined.com/hasRole": true,
  ...
}
```

### On /dashboard:

```
Roles & Permissions
• Admin
```

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Action Created But Not Deployed

- **Symptom:** No roles in token
- **Fix:** Open Action, click Deploy button

### ❌ Mistake 2: Action Deployed But Not in Flow

- **Symptom:** No roles in token
- **Fix:** Go to Actions → Flows → Login, drag Action into flow, click Apply

### ❌ Mistake 3: Wrong Trigger Selected

- **Symptom:** Action never executes
- **Fix:** Delete Action, create new one with "Login / Post Login" trigger

### ❌ Mistake 4: Forgot to Log Out After Setup

- **Symptom:** Old token still in use
- **Fix:** Visit /auth/logout, then /auth/login again

### ❌ Mistake 5: Wrong Namespace in Action Code

- **Symptom:** Claims not visible
- **Fix:** Use `https://trulyimagined.com` (MUST be HTTPS URL format)

---

## 📞 Need Help?

If after following ALL steps roles still don't appear:

1. Check Auth0 Dashboard → Monitoring → Logs for errors
2. Look for Action execution logs
3. Check Real-time Webtask Logs if available
4. Review the Action code for typos
5. Verify the namespace matches exactly: `https://trulyimagined.com`

---

## ✅ Once This Works...

You can proceed to **Step 5: Actor Registration Form** 🎉

The registration form will check if user has "Actor" role before allowing registration.
