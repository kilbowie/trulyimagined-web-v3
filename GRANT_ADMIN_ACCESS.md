# Quick Guide: Grant Admin Access to adam@kilbowieconsulting.com

**⚠️ DEPRECATED - USE DATABASE ROLES INSTEAD**

**New Method:** See [DATABASE_ROLES_COMPLETE.md](DATABASE_ROLES_COMPLETE.md)

**Quick Command:**
```bash
node assign-admin-role.js
```

---

## This Guide is Deprecated

The platform now uses **database-based role checking** instead of Auth0 JWT roles.

**Old Method (This Guide):** 
- Assign roles in Auth0 Dashboard
- Add roles to JWT tokens via Auth0 Actions
- Check `session.user['https://trulyimagined.com/roles']` in API routes

**New Method (Current):**
- Store roles in PostgreSQL `user_profiles` table
- Run `node assign-admin-role.js` to assign Admin role
- Check roles via `isAdmin()` function (queries database)

**See:**
- [DATABASE_ROLES_COMPLETE.md](DATABASE_ROLES_COMPLETE.md) - Complete migration documentation
- [assign-admin-role.js](assign-admin-role.js) - Script to assign admin role
- [test-database-roles.js](test-database-roles.js) - Verify role assignment

---

# Original Guide (Kept for Reference)

**Goal:** Enable access to `/usage` dashboard for testing Step 12 implementation

---

## Prerequisites Check

Before starting, verify these are complete:

1. ✅ Roles exist in Auth0 (Admin, Actor, Agent, Enterprise)
2. ✅ Auth0 Action "Add Roles to Token" is deployed and added to Login flow
3. ✅ User adam@kilbowieconsulting.com exists in Auth0

---

## Step-by-Step Instructions

### 1. Log into Auth0 Dashboard

Go to: https://manage.auth0.com/

Navigate to your tenant (likely "trulyimagined" or similar)

### 2. Find Your User

1. Click **User Management** in left sidebar
2. Click **Users**
3. Search for: `adam@kilbowieconsulting.com`
4. Click on the user to open their profile

### 3. Assign Admin Role

On the user's profile page:

1. Click the **Roles** tab
2. Click **Assign Roles** button
3. Check the box next to **Admin**
4. Click **Assign** button

You should now see "Admin" listed under the user's roles.

### 4. Verify the Token Action (One-Time Setup)

**If you haven't done this already**, you need to ensure roles are added to JWT tokens:

1. Go to **Actions** → **Flows** in left sidebar
2. Click **Login**
3. Check if "Add Roles to Token" action is in the flow (between Start and Complete)

**If the action is NOT there:**

1. Go to **Actions** → **Library**
2. Find "Add Roles to Token" action
3. If it doesn't exist, create it:
   - Click **+ Build Custom**
   - Name: `Add Roles to Token`
   - Trigger: **Login / Post Login**
   - Runtime: **Node 18**
   - Paste the code below:

```javascript
/**
 * Add user roles to JWT tokens
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://trulyimagined.com';

  if (event.authorization) {
    const roles = event.authorization.roles || [];
    
    // Add to both ID token and Access token
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
  }
};
```

4. Click **Deploy**
5. Go back to **Actions** → **Flows** → **Login**
6. Drag "Add Roles to Token" into the flow
7. Click **Apply**

### 5. Test Access

1. **Log out completely** from your app:
   ```
   http://localhost:3000/api/auth/logout
   ```

2. **Log back in**:
   ```
   http://localhost:3000/api/auth/login
   ```

3. **Navigate to usage dashboard**:
   ```
   http://localhost:3000/usage
   ```

4. You should now see the Usage Analytics dashboard with:
   - Metric cards (Voice Minutes, Images, Actors, Records)
   - Usage by Type table
   - Top 10 Actors leaderboard
   - Recent Activity (last 30 days)

---

## Troubleshooting

### Issue: Still getting "403 Forbidden" error

**Solution:** Check if roles are in the JWT token

1. Navigate to: `http://localhost:3000/api/auth/me`
2. Look for the roles in the response:
   ```json
   {
     "https://trulyimagined.com/roles": ["Admin"]
   }
   ```

3. If roles are missing:
   - Verify "Add Roles to Token" Action is deployed
   - Verify Action is in the Login flow
   - Log out and log back in to get fresh token

### Issue: User doesn't exist

**Solution:** Create the user

1. In Auth0 Dashboard, go to **User Management** → **Users**
2. Click **+ Create User**
3. Email: `adam@kilbowieconsulting.com`
4. Password: (set a temporary password)
5. Connection: `Username-Password-Authentication`
6. Click **Create**
7. Follow steps above to assign Admin role

### Issue: Roles don't appear in token

**Solution:** Check Auth0 Action logs

1. Go to **Monitoring** → **Logs** in Auth0 Dashboard
2. Filter by "Add Roles to Token" action
3. Check for errors
4. Common issues:
   - Action not deployed
   - Action not in Login flow
   - Syntax error in Action code

### Issue: "Cannot read property 'roles' of undefined"

**Solution:** Session not loaded properly

Check that `auth0.getSession()` is working in the API route:

```typescript
const session = await auth0.getSession();
console.log('Session:', session);
console.log('User:', session?.user);
console.log('Roles:', session?.user?.['https://trulyimagined.com/roles']);
```

---

## Verification Checklist

After completing the steps above, verify:

- [ ] User adam@kilbowieconsulting.com has Admin role in Auth0 Dashboard
- [ ] Auth0 Action "Add Roles to Token" exists and is deployed
- [ ] Action is added to Login flow (between Start and Complete)
- [ ] Logged out and logged back in to get fresh token
- [ ] Can access http://localhost:3000/usage without 403 error
- [ ] Dashboard displays metrics and data correctly
- [ ] API endpoint `/api/usage/stats` returns data (not 403)

---

## Quick Copy-Paste Commands

### Check your roles via API
```bash
curl http://localhost:3000/api/auth/me
```

### Test stats endpoint directly
```bash
curl http://localhost:3000/api/usage/stats \
  -H "Cookie: appSession=<your-session-cookie>"
```

---

## Additional Admin Users (Optional)

To add more admins in the future:

1. Go to **User Management** → **Users**
2. Click on the user
3. Go to **Roles** tab
4. Click **Assign Roles**
5. Select **Admin**
6. Click **Assign**

User will need to log out and back in to see changes.

---

## What Happens After This

Once you have admin access, you can:

1. **View Platform Stats**
   - Total voice minutes generated
   - Total images created
   - Number of actors with usage
   - Total usage records

2. **See Top Actors**
   - Ranked by voice minutes
   - See breakdown by usage type
   - View total events per actor

3. **Monitor Recent Activity**
   - Last 30 days of usage
   - Daily quantities and record counts
   - Grouped by usage type

4. **Test Usage Tracking**
   - Use POST /api/usage/track to log test usage
   - Verify it appears in dashboard
   - Check actor detail pages work

---

## Need Help?

If you encounter issues:

1. Check Auth0 Dashboard → Monitoring → Logs for errors
2. Check browser console for JavaScript errors
3. Check Next.js terminal for API errors
4. Verify DATABASE_URL is set correctly in .env.local
5. Ensure PostgreSQL database is running and accessible

---

**Next Steps After Access Granted:**

1. Navigate to http://localhost:3000/usage
2. Test the dashboard UI
3. Try POST /api/usage/track to log test usage events
4. Verify stats update correctly
5. Test actor detail pages at /usage/actor/[actorId]

---

**Created:** March 24, 2026  
**For:** Step 12 Usage Tracking Testing  
**User:** adam@kilbowieconsulting.com
