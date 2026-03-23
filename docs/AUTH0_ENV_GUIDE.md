# Auth0 Environment Variables - Configuration Guide

This guide shows you where to find each Auth0 environment variable value in the Auth0 Dashboard.

## 🔐 Required Environment Variables

### 1. **AUTH0_DOMAIN** and **AUTH0_ISSUER_BASE_URL**

**Location:** Auth0 Dashboard → Applications → Applications → [Your Application Name] → Settings → Basic Information

- **Value:** Your tenant domain (e.g., `kilbowieconsulting.uk.auth0.com`)
- **Format for AUTH0_DOMAIN:** `kilbowieconsulting.uk.auth0.com`
- **Format for AUTH0_ISSUER_BASE_URL:** `https://kilbowieconsulting.uk.auth0.com`

**Screenshot location:** Top of Settings page, labeled as **Domain**

---

### 2. **AUTH0_CLIENT_ID**

**Location:** Auth0 Dashboard → Applications → Applications → [Your Application Name] → Settings → Basic Information

- **Label in dashboard:** "Client ID"
- **Example:** `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e`

**Screenshot location:** Below Domain, labeled as **Client ID**

---

### 3. **AUTH0_CLIENT_SECRET**

**Location:** Auth0 Dashboard → Applications → Applications → [Your Application Name] → Settings → Basic Information

- **Label in dashboard:** "Client Secret"
- **Security Note:** This is only shown once when created. If lost, you must rotate it.
- **Example:** `wkAn5Udz41vqashrfsYBzp42sleErL6Z0vN6IImV0KnZ7JhJC6UvuZIHPHndPdRa`

**Screenshot location:** Below Client ID, labeled as **Client Secret** (click "Show" to reveal)

---

### 4. **AUTH0_SECRET**

**This is NOT from Auth0 Dashboard** - you generate this yourself!

```powershell
# Generate using PowerShell (Windows)
-join ((0..63) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- **Length:** Must be at least 32 bytes (64 hex characters)
- **Current value:** `330c7535fecc9b9622664dc11368a2263055261c2fa3b4658b87ef096e0a9010`
- **Purpose:** Encrypts session cookies

---

### 5. **AUTH0_BASE_URL**

**This is YOUR application URL** (not from Auth0 Dashboard)

- **Development:** `http://localhost:3000`
- **Production:** `https://yourdomain.com`

**Important:** This must match one of the URLs in your Auth0 Application Settings → Application URIs → **Allowed Callback URLs**

---

### 6. **AUTH0_AUDIENCE**

**Location:** Auth0 Dashboard → Applications → APIs → [Your API Name] → Settings

- **Label in dashboard:** "Identifier"
- **Example:** `https://api.trulyimagined.com`
- **Note:** This is the API Identifier you set when creating the API (not a real URL)

**How to find it:**

1. Go to **Applications** → **APIs** in the left sidebar
2. Click on your API (e.g., "Truly Imagined API")
3. Go to **Settings** tab
4. Look for **Identifier** field at the top

---

## 🔧 Required Auth0 Dashboard Configuration

### Application Settings

**Location:** Auth0 Dashboard → Applications → Applications → [Your Application] → Settings

#### Application URIs Section:

1. **Allowed Callback URLs:**

   ```
   http://localhost:3000/api/auth/callback
   ```

   _(Add production URLs when deploying)_

2. **Allowed Logout URLs:**

   ```
   http://localhost:3000
   ```

3. **Allowed Web Origins:**
   ```
   http://localhost:3000
   ```

#### Application Properties:

- **Application Type:** Regular Web Application
- **Token Endpoint Authentication Method:** Post

**Save changes** after updating!

---

### API Settings (CRITICAL for roles/permissions)

**Location:** Auth0 Dashboard → Applications → APIs → [Your API] → Settings

#### Required Settings:

1. **Enable RBAC:** Toggle ON
2. **Add Permissions in the Access Token:** Toggle ON

**Save changes** after updating!

---

## 🎭 Creating Roles

**Location:** Auth0 Dashboard → User Management → Roles

Create these roles:

- **Actor** - For performers/talent
- **Agent** - For talent agents
- **Admin** - For system administrators
- **Enterprise** - For enterprise/corporate users

**Steps:**

1. Click **+ Create Role**
2. Enter role name (e.g., "Actor")
3. Enter description
4. Click **Create**

---

## 🔌 Creating Action to Add Roles to Token

**Location:** Auth0 Dashboard → Actions → Library → Build Custom

1. Click **+ Build Custom**
2. Name: `Add Roles to Token`
3. Trigger: **Login / Post Login**
4. Runtime: **Node 18**
5. Click **Create**

**Code:**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://trulyimagined.com';

  if (event.authorization) {
    // Add roles to both ID token and Access token
    const roles = event.authorization.roles || [];
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
  }
};
```

6. Click **Deploy**
7. Go to **Actions → Flows → Login**
8. Click **Custom** tab
9. Drag **Add Roles to Token** action into the flow (between Start and Complete)
10. Click **Apply**

---

## 👤 Assigning Roles to Users

**Location:** Auth0 Dashboard → User Management → Users

1. Click on a user
2. Go to **Roles** tab
3. Click **Assign Roles**
4. Select role(s) (e.g., "Actor")
5. Click **Assign**

---

## ✅ Verification Checklist

Before testing login:

- [ ] All 6 environment variables are set in `.env.local` (root of project)
- [ ] Application Type is "Regular Web Application"
- [ ] Callback URL includes `http://localhost:3000/api/auth/callback`
- [ ] API has RBAC enabled
- [ ] API has "Add Permissions in the Access Token" enabled
- [ ] Roles created (Actor, Agent, Admin, Enterprise)
- [ ] "Add Roles to Token" Action created and deployed
- [ ] Action added to Login flow
- [ ] Test user has at least one role assigned
- [ ] Dev server restarted after `.env.local` changes

---

## 🚨 Common Issues

### Issue: 500 Error on Login

**Causes:**

- Missing or incorrect environment variables
- Application Type not set to "Regular Web Application"
- Client Secret incorrect or expired

**Solution:**

1. Verify all environment variables in `.env.local`
2. Check Application Type in Auth0 Dashboard
3. Restart dev server: `cd apps/web && pnpm dev`

---

### Issue: No roles in token

**Causes:**

- RBAC not enabled on API
- "Add Permissions in the Access Token" not enabled
- Action not deployed or not in Login flow
- User doesn't have roles assigned

**Solution:**

1. Enable RBAC + permissions in API Settings
2. Deploy Action and add to Login flow
3. Assign role to user
4. Clear cookies and re-login

---

### Issue: Redirect URI mismatch

**Cause:** Callback URL not configured in Auth0

**Solution:**

1. Go to Application Settings → Allowed Callback URLs
2. Add: `http://localhost:3000/api/auth/callback`
3. Save changes
4. Try login again

---

## 📝 Current Configuration Summary

Based on your `.env.local`:

```bash
AUTH0_SECRET=330c7535fecc9b9622664dc11368a2263055261c2fa3b4658b87ef096e0a9010
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e
AUTH0_CLIENT_SECRET=wkAn5Udz41vqashrfsYBzp42sleErL6Z0vN6IImV0KnZ7JhJC6UvuZIHPHndPdRa
AUTH0_AUDIENCE=https://api.trulyimagined.com
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
```

**Application Name in Auth0:** Look for application with Client ID `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e`

**API Name in Auth0:** Look for API with Identifier `https://api.trulyimagined.com`

---

## 🔄 Next Steps

1. **Restart dev server** to load updated Auth0 configuration:

   ```powershell
   cd apps/web
   pnpm dev
   ```

2. **Test login flow:**
   - Go to http://localhost:3000
   - Click "Log In"
   - Should redirect to Auth0 Universal Login
   - Enter credentials
   - Should redirect back to homepage
   - Profile should appear in navigation

3. **Verify session:**
   - Navigate to http://localhost:3000/api/auth/me
   - Should see JSON with user data including roles

4. **Test protected route:**
   - Navigate to http://localhost:3000/dashboard
   - Should show user profile and roles

---

## 📚 Additional Resources

- [Auth0 Next.js SDK Docs](https://auth0.com/docs/quickstart/webapp/nextjs)
- [Auth0 Dashboard](https://manage.auth0.com/)
- [RBAC Configuration Guide](https://auth0.com/docs/manage-users/access-control/rbac)
