# Auth0 Setup Guide — Step 4

This document guides you through configuring Auth0 for Truly Imagined v3 with role-based access control.

---

## 🎯 Overview

**Roles to Configure:**

- **Actor** — Individual performers (default for new registrations)
- **Agent** — Talent agents managing multiple actors
- **Admin** — Platform administrators
- **Enterprise** — Large-scale clients (future-ready)

**Current Auth0 Tenant:**

- Domain: `kilbowieconsulting.uk.auth0.com`
- Client ID: `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e`

---

## 📋 Step-by-Step Configuration

### Step 1: Create Roles in Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **User Management** > **Roles**
3. Click **+ Create Role**
4. Create each of the following roles:

#### Role: Actor

- **Name:** `Actor`
- **Description:** `Individual performer with identity registry access`
- **Permissions:** (We'll add these after creating the API)

#### Role: Agent

- **Name:** `Agent`
- **Description:** `Talent agent managing multiple actors`
- **Permissions:** (We'll add these after creating the API)

#### Role: Admin

- **Name:** `Admin`
- **Description:** `Platform administrator with full access`
- **Permissions:** (We'll add these after creating the API)

#### Role: Enterprise

- **Name:** `Enterprise`
- **Description:** `Enterprise client with licensing access`
- **Permissions:** (We'll add these after creating the API)

---

### Step 2: Create Auth0 API

1. Navigate to **Applications** > **APIs**
2. Click **+ Create API**
3. Configure:
   - **Name:** `Truly Imagined v3 API`
   - **Identifier:** `https://api.trulyimagined.com`
   - **Signing Algorithm:** `RS256`
4. Click **Create**

---

### Step 3: Define API Permissions (Scopes)

In your newly created API, go to **Permissions** and add:

| Permission         | Description                                 |
| ------------------ | ------------------------------------------- |
| `read:identity`    | Read own identity profile                   |
| `write:identity`   | Update own identity profile                 |
| `read:consent`     | Read own consent history                    |
| `write:consent`    | Log consent actions                         |
| `read:licenses`    | Read own licenses                           |
| `write:licenses`   | Submit license requests                     |
| `manage:actors`    | Manage actor profiles (Agents)              |
| `approve:licenses` | Approve/reject licenses (Agents/Enterprise) |
| `admin:all`        | Full admin access                           |

---

### Step 4: Assign Permissions to Roles

Go back to **User Management** > **Roles** and assign permissions:

#### Actor Role Permissions:

- `read:identity`
- `write:identity`
- `read:consent`
- `write:consent`
- `read:licenses`
- `write:licenses`

#### Agent Role Permissions:

- All Actor permissions, plus:
- `manage:actors`
- `approve:licenses`

#### Admin Role Permissions:

- `admin:all`

#### Enterprise Role Permissions:

- `read:licenses`
- `approve:licenses`

---

### Step 5: Create Auth0 Action (Add Roles to Token)

This is **CRITICAL** — it adds roles to the JWT token.

1. Navigate to **Actions** > **Library**
2. Click **+ Build Custom**
3. Name: `Add Roles to Token`
4. Trigger: `Login / Post Login`
5. Add this code:

```javascript
/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://trulyimagined.com';

  if (event.authorization) {
    const roles = event.authorization.roles || [];

    // Add roles to the token
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);

    // Add metadata
    api.idToken.setCustomClaim(`${namespace}/app_metadata`, event.user.app_metadata || {});
  }
};
```

6. Click **Deploy**

---

### Step 6: Add Action to Login Flow

1. Go to **Actions** > **Flows** > **Login**
2. Drag your **Add Roles to Token** action into the flow
3. Click **Apply**

---

### Step 7: Configure Application Settings

1. Go to **Applications** > **Applications**
2. Find your application (Client ID: `WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e`)
3. Update **Allowed Callback URLs:**
   ```
   http://localhost:3000/api/auth/callback,
   https://yourdomain.com/api/auth/callback
   ```
4. Update **Allowed Logout URLs:**
   ```
   http://localhost:3000,
   https://yourdomain.com
   ```
5. Update **Allowed Web Origins:**
   ```
   http://localhost:3000,
   https://yourdomain.com
   ```
6. Scroll to **Advanced Settings** > **Grant Types**
7. Ensure these are enabled:
   - ✓ Authorization Code
   - ✓ Refresh Token
   - ✓ Implicit (for development only)
8. Save Changes

---

### Step 8: Assign Default Role to New Users (Optional)

Create another Action to auto-assign "Actor" role:

1. **Actions** > **Library** > **+ Build Custom**
2. Name: `Auto-Assign Actor Role`
3. Trigger: `Login / Post Login`
4. Code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const ManagementClient = require('auth0').ManagementClient;

  const management = new ManagementClient({
    domain: event.secrets.domain,
    clientId: event.secrets.clientId,
    clientSecret: event.secrets.clientSecret,
  });

  // Check if user has any roles
  const currentRoles = event.authorization.roles || [];

  if (currentRoles.length === 0) {
    // User has no roles, assign "Actor" by default
    try {
      // Get the Actor role ID (you'll need to replace this with your actual role ID)
      const actorRoleId = 'rol_XXXXXXXXXX'; // ⚠️ REPLACE WITH YOUR ACTOR ROLE ID

      await management.assignRolestoUser({ id: event.user.user_id }, { roles: [actorRoleId] });

      console.log(`Assigned Actor role to new user: ${event.user.email}`);
    } catch (error) {
      console.error('Failed to assign default role:', error);
    }
  }
};
```

5. **Secrets** — Add these secrets:
   - `domain`: `kilbowieconsulting.uk.auth0.com`
   - `clientId`: Your Management API client ID
   - `clientSecret`: Your Management API client secret
6. **Deploy**
7. Add to **Login Flow**

---

### Step 9: Get Your Actor Role ID

To complete Step 8, you need the Actor role ID:

1. Go to **User Management** > **Roles**
2. Click on **Actor** role
3. Look at the URL, it will be: `https://manage.auth0.com/dashboard/.../roles/rol_XXXXXXXXXX`
4. Copy the `rol_XXXXXXXXXX` part
5. Update the Action code with this ID

---

## ✅ Verification Checklist

- [x] Created 4 roles: Actor, Agent, Admin, Enterprise
- [x] Created API with identifier `https://api.trulyimagined.com`
- [x] Defined 9 API permissions
- [x] Assigned permissions to roles
- [x] Created "Add Roles to Token" Action
- [x] Added Action to Login Flow
- [x] Updated Application callback URLs
- [ ] (Optional) Created auto-assign Actor role Action
- [ ] Tested login and verified JWT contains roles

---

## 🧪 Testing Your Setup

### Test 1: Login and Check JWT

1. Log in to your app
2. Copy the access token
3. Go to [jwt.io](https://jwt.io)
4. Paste the token
5. Verify you see:
   ```json
   {
     "https://trulyimagined.com/roles": ["Actor"],
     "sub": "auth0|...",
     "email": "test@example.com"
   }
   ```

### Test 2: Assign Different Roles

1. Go to **User Management** > **Users**
2. Select a test user
3. Click **Roles** tab
4. Assign/remove roles
5. Log out and log in again
6. Verify roles change in the JWT

---

## 🔐 Security Notes

1. **Never commit `.env.local`** — Contains secrets
2. **Use different Auth0 tenants** for dev/staging/prod
3. **Rotate secrets regularly**
4. **Enable MFA** for admin users
5. **Monitor Auth0 logs** for suspicious activity

---

## 📞 Need Help?

If you encounter issues:

1. Check Auth0 Logs: **Monitoring** > **Logs**
2. Verify Action is deployed and in flow
3. Check JWT at jwt.io
4. Ensure API identifier matches: `https://api.trulyimagined.com`
5. Verify callback URLs are correct

---

## 📚 Additional Resources

- [Auth0 Dashboard](https://manage.auth0.com/)
- [Auth0 Actions Documentation](https://auth0.com/docs/customize/actions)
- [Auth0 RBAC Guide](https://auth0.com/docs/manage-users/access-control/rbac)
- [Next.js Auth0 SDK](https://github.com/auth0/nextjs-auth0)

---

**Status:** Configuration Required  
**Next Step:** Complete Auth0 setup, then proceed to code integration
