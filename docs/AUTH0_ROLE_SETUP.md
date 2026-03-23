# Auth0 Role Setup Guide

## Step 1: Create Roles in Auth0 Dashboard

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **User Management** → **Roles**
3. Click **+ Create Role**

### Create these 4 roles:

#### Role 1: Admin

- **Name:** `Admin`
- **Description:** `System administrators with full access`
- Click **Create**

#### Role 2: Actor

- **Name:** `Actor`
- **Description:** `Performers and talent`
- Click **Create**

#### Role 3: Agent

- **Name:** `Agent`
- **Description:** `Talent agents and representatives`
- Click **Create**

#### Role 4: Enterprise

- **Name:** `Enterprise`
- **Description:** `Corporate and enterprise users`
- Click **Create**

---

## Step 2: Assign Admin Role to Your User

1. In Auth0 Dashboard, go to **User Management** → **Users**
2. Find and click on user: **adam@kilbowieconsulting.com**
3. Go to the **Roles** tab
4. Click **Assign Roles**
5. Select **Admin**
6. Click **Assign**

---

## Step 3: Create Action to Add Roles to Token

This ensures roles appear in the JWT token.

1. Go to **Actions** → **Library**
2. Click **+ Build Custom**
3. Name: `Add Roles to Token`
4. Trigger: **Login / Post Login**
5. Runtime: **Node 18**
6. Click **Create**

### Add this code:

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
    // Get user's roles
    const roles = event.authorization.roles || [];

    // Add roles to both ID token and Access token
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);

    // Also add role count for easy checking
    api.idToken.setCustomClaim(`${namespace}/hasRole`, roles.length > 0);
  }
};
```

7. Click **Deploy**
8. Go to **Actions** → **Flows** → **Login**
9. Click **Custom** tab on the right
10. **Drag** the "Add Roles to Token" action into the flow (between Start and Complete)
11. Click **Apply**

---

## Step 4: Test Role Assignment

1. Log out of your app: http://localhost:3000/auth/logout
2. Log back in: http://localhost:3000/auth/login
3. Check your profile: http://localhost:3000/auth/profile
4. You should see:
   ```json
   {
     "email": "adam@kilbowieconsulting.com",
     "https://trulyimagined.com/roles": ["Admin"],
     "https://trulyimagined.com/hasRole": true
   }
   ```

---

## ✅ Checklist

- [ ] Created 4 roles: Admin, Actor, Agent, Enterprise
- [ ] Assigned Admin role to adam@kilbowieconsulting.com
- [ ] Created "Add Roles to Token" Action
- [ ] Deployed the Action
- [ ] Added Action to Login Flow
- [ ] Applied the Login Flow
- [ ] Tested by logging out and back in
- [ ] Verified roles appear in /auth/profile

Once these are complete, move on to implementing the role selection UI!
