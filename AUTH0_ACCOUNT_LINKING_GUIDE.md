# Auth0 Account Linking Implementation Guide

## Overview

Account linking allows Auth0 to automatically merge multiple authentication methods (email/password, Google OAuth, Facebook, etc.) into a single user account when they share the same email address.

**Why you need this:**

- Prevents duplicate profiles when users log in with different methods
- Provides seamless user experience across authentication providers
- Maintains single source of truth for user data

---

## Current State ✅

**Fixed**: Duplicate profile for adamrossgreene@gmail.com has been deleted.

**Profiles Merged:**

- Identity link from Agent profile → Actor profile
- Only one profile remains: `auth0|69c0a8726e8cd2f46877d134` (Actor)

---

## Implementation Options

### Option 1: Auth0 Actions (Recommended - Modern)

Auth0 Actions replaced Rules in 2021 and are the current recommended approach.

#### Step 1: Create Account Linking Action

1. Go to **Auth0 Dashboard** → **Actions** → **Flows**
2. Select **Login** flow
3. Click **+** (Add Action) → **Build Custom**

**Action Name:** `Link Accounts with Same Email`
**Trigger:** Login / Post Login

**Code:**

```javascript
/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {
  const ManagementClient = require('auth0').ManagementClient;

  // Only run for non-primary accounts
  if (!event.user.email || event.user.email_verified !== true) {
    return;
  }

  const management = new ManagementClient({
    domain: event.secrets.AUTH0_DOMAIN,
    clientId: event.secrets.AUTH0_CLIENT_ID,
    clientSecret: event.secrets.AUTH0_CLIENT_SECRET,
  });

  try {
    // Search for all users with this email
    const users = await management.users.getAll({
      q: `email:"${event.user.email}"`,
      search_engine: 'v3',
    });

    if (users.data.length <= 1) {
      // No other accounts to link
      return;
    }

    // Find the primary account (earliest created)
    const sortedUsers = users.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const primaryUser = sortedUsers[0];
    const currentUser = event.user;

    // If current user is not primary, link to primary
    if (currentUser.user_id !== primaryUser.user_id) {
      const secondaryProvider = currentUser.user_id.split('|')[0];
      const secondaryUserId = currentUser.user_id.split('|')[1];

      await management.users.link(primaryUser.user_id, {
        provider: secondaryProvider,
        user_id: secondaryUserId,
      });

      console.log(`Linked ${currentUser.user_id} to ${primaryUser.user_id}`);

      // Update session to use primary user
      api.user.setAppMetadata('primary_user_id', primaryUser.user_id);
    }
  } catch (error) {
    console.error('Account linking error:', error);
    // Don't block login on linking errors
  }
};
```

#### Step 2: Add Secrets to Action

In the Action editor, add secrets (left sidebar → Secrets):

- `AUTH0_DOMAIN`: `kilbowieconsulting.uk.auth0.com`
- `AUTH0_CLIENT_ID`: Your Auth0 client ID
- `AUTH0_CLIENT_SECRET`: Your Auth0 client secret

#### Step 3: Add Dependencies

In the Action editor, add dependency (left sidebar → Dependencies):

- **Module:** `auth0`
- **Version:** `4.0.0` (or latest)

#### Step 4: Deploy and Test

1. Click **Deploy** in Action editor
2. Go back to **Login** flow
3. **Drag the action** from Custom tab into the flow (between Start and Complete)
4. Click **Apply**

---

### Option 2: Auth0 Rule (Legacy - Still Works)

Rules are the older approach but still functional.

#### Create Account Linking Rule

1. Go to **Auth0 Dashboard** → **Auth Pipeline** → **Rules**
2. Click **Create Rule**
3. Select **Empty rule** template

**Rule Name:** `Link accounts with same email`

**Code:**

```javascript
function linkAccountsWithSameEmail(user, context, callback) {
  const request = require('request');

  // Skip if user email is not verified
  if (!user.email || !user.email_verified) {
    return callback(null, user, context);
  }

  const auth0Domain = 'https://' + configuration.AUTH0_DOMAIN;

  // Get Management API token
  const options = {
    method: 'POST',
    url: auth0Domain + '/oauth/token',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: configuration.AUTH0_CLIENT_ID,
      client_secret: configuration.AUTH0_CLIENT_SECRET,
      audience: auth0Domain + '/api/v2/',
      grant_type: 'client_credentials',
    }),
  };

  request(options, function (err, response, body) {
    if (err) {
      console.error('Token request error:', err);
      return callback(null, user, context);
    }

    const accessToken = JSON.parse(body).access_token;

    // Search for users with same email
    const searchOptions = {
      method: 'GET',
      url: auth0Domain + '/api/v2/users',
      headers: {
        authorization: 'Bearer ' + accessToken,
      },
      qs: {
        search_engine: 'v3',
        q: 'email:"' + user.email + '"',
      },
    };

    request(searchOptions, function (searchErr, searchResponse, searchBody) {
      if (searchErr) {
        console.error('User search error:', searchErr);
        return callback(null, user, context);
      }

      const users = JSON.parse(searchBody);

      if (users.length <= 1) {
        // No duplicates to link
        return callback(null, user, context);
      }

      // Sort by created date to find primary account
      users.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const primaryUser = users[0];

      // If current user is not primary, link it
      if (user.user_id !== primaryUser.user_id) {
        const secondaryProvider = user.user_id.split('|')[0];
        const secondaryUserId = user.user_id.split('|')[1];

        const linkOptions = {
          method: 'POST',
          url: auth0Domain + '/api/v2/users/' + primaryUser.user_id + '/identities',
          headers: {
            authorization: 'Bearer ' + accessToken,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            provider: secondaryProvider,
            user_id: secondaryUserId,
          }),
        };

        request(linkOptions, function (linkErr) {
          if (linkErr) {
            console.error('Link error:', linkErr);
          } else {
            console.log('Successfully linked:', user.user_id, 'to', primaryUser.user_id);
          }

          // Continue login even if linking fails
          return callback(null, user, context);
        });
      } else {
        return callback(null, user, context);
      }
    });
  });
}
```

#### Add Configuration Variables

In Rule Settings (bottom of editor):

```
AUTH0_DOMAIN=kilbowieconsulting.uk.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
```

---

### Option 3: Manual Account Linking Prompt (User-Initiated)

Create a UI that prompts users when duplicate accounts are detected.

#### Implementation

1. **Detect Duplicates on Login:**

   ```typescript
   // In your login callback (e.g., /api/auth/callback)
   const existingProfiles = await query('SELECT * FROM user_profiles WHERE email = $1', [
     user.email,
   ]);

   if (existingProfiles.rows.length > 1) {
     // Redirect to account linking page
     return res.redirect('/link-accounts');
   }
   ```

2. **Create Account Linking Page:**

   ```typescript
   // app/link-accounts/page.tsx
   export default function LinkAccountsPage() {
     return (
       <div>
         <h1>Multiple Accounts Detected</h1>
         <p>
           It looks like you've logged in before with a different method.
           Would you like to link your accounts?
         </p>
         <button onClick={linkAccounts}>Yes, Link Accounts</button>
         <button onClick={continueWithCurrent}>No, Use Current Account</button>
       </div>
     );
   }
   ```

3. **Handle Linking:**
   ```typescript
   async function linkAccounts() {
     // Call Auth0 Management API to link identities
     await fetch('/api/user/link-accounts', {
       method: 'POST',
     });
   }
   ```

---

## Testing Account Linking

### Test Scenario 1: New User with Multiple Methods

1. **Create Test User (Email/Password):**

   ```
   Email: test-linking@example.com
   Password: Test1234!
   ```

2. **Log Out**

3. **Sign Up with Google OAuth:**
   - Use "Continue with Google"
   - Use same email: test-linking@example.com

4. **Verify Linking:**

   ```sql
   SELECT auth0_user_id, email, role, username
   FROM user_profiles
   WHERE email = 'test-linking@example.com';
   ```

   **Expected:** Only 1 profile (accounts automatically linked)

### Test Scenario 2: Check Auth0 Dashboard

1. **Go to:** Auth0 Dashboard → User Management → Users
2. **Search for:** test-linking@example.com
3. **Click on user**
4. **Check Identities tab:**
   - Should see both `auth0` and `google-oauth2` connections
   - Primary identity will be the first one created

---

## Current Setup Requirements

Before implementing account linking, ensure:

1. ✅ **Auth0 Application configured**
   - Client ID and Secret available
   - Management API access enabled

2. ✅ **Database Connection enabled**
   - Email/Password authentication working

3. ✅ **Social Connections configured**
   - Google OAuth enabled
   - Correct callback URLs set

4. ⚠️ **Management API Scopes**
   - Grant your Auth0 app these scopes:
     - `read:users`
     - `update:users`
     - `create:user_identities`

### Grant Management API Scopes

1. **Auth0 Dashboard** → **Applications** → **APIs**
2. Click **Auth0 Management API**
3. **Machine to Machine Applications** tab
4. Find your application, expand it
5. Enable these scopes:
   - ✅ `read:users`
   - ✅ `update:users`
   - ✅ `create:user_identities`
6. Click **Update**

---

## Database Implications

### What Happens with Linked Accounts

When Auth0 links accounts:

- **Auth0 side:** Creates a `user` with multiple `identities` array
- **Your database:** Still has ONE `user_profiles` record

**Example Auth0 user object after linking:**

```json
{
  "user_id": "auth0|69c0a8726e8cd2f46877d134",
  "email": "adamrossgreene@gmail.com",
  "identities": [
    {
      "connection": "Username-Password-Authentication",
      "provider": "auth0",
      "user_id": "69c0a8726e8cd2f46877d134",
      "isSocial": false
    },
    {
      "connection": "google-oauth2",
      "provider": "google-oauth2",
      "user_id": "102864749045087165048",
      "isSocial": true
    }
  ]
}
```

**Your database:**

- Keep using `auth0_user_id` as the foreign key
- It will always be the PRIMARY identity's user_id
- All linked accounts will reference the same profile

---

## Migration Plan

### Phase 1: Immediate (Done ✅)

- [x] Delete duplicate profile
- [x] Merge identity links
- [x] Verify single profile exists

### Phase 2: Implementation (Next 30 minutes)

- [ ] Choose implementation option (Actions recommended)
- [ ] Create Auth0 Action or Rule
- [ ] Configure secrets/variables
- [ ] Deploy to Auth0

### Phase 3: Testing (Next 15 minutes)

- [ ] Create test user with email/password
- [ ] Log in with Google OAuth using same email
- [ ] Verify automatic linking
- [ ] Check database for single profile

### Phase 4: Monitoring (Ongoing)

- [ ] Monitor Auth0 logs for linking events
- [ ] Check for duplicate profiles weekly
- [ ] Update documentation for users

---

## Quick Start (Recommended Path)

```bash
# 1. Clear your browser session
# DevTools (F12) → Application → Cookies → Delete all

# 2. Log in to Auth0 Dashboard
# https://manage.auth0.com/

# 3. Go to Actions → Flows → Login
# Click + → Build Custom

# 4. Paste the Action code from Option 1

# 5. Add secrets (left sidebar):
# - AUTH0_DOMAIN
# - AUTH0_CLIENT_ID
# - AUTH0_CLIENT_SECRET

# 6. Add dependency (left sidebar):
# - auth0@4.0.0

# 7. Deploy → Apply to Login flow

# 8. Test with a new user account
```

---

## Troubleshooting

### Action Not Running

**Check:**

1. Action is deployed (green dot in Auth0 dashboard)
2. Action is added to Login flow
3. Flow is applied (click Apply button)
4. Secrets are configured correctly

**Debug:**

```javascript
// Add console.log to Action
console.log('Account linking triggered for:', event.user.email);
```

View logs: Auth0 Dashboard → Monitoring → Logs

### Linking Fails

**Common Issues:**

1. **Management API scopes missing** - Add required scopes
2. **Email not verified** - Check conditional logic
3. **Rate limiting** - Auth0 has rate limits on API calls

### Multiple Profiles Still Created

**Possible Causes:**

1. Action not deployed to production tenant
2. Action has runtime error (check logs)
3. Email verification required but user's email not verified

---

## Security Considerations

1. **Email Verification Required:**
   - Only link accounts with verified emails
   - Prevents account takeover via unverified email

2. **Primary Account Selection:**
   - Use oldest account as primary
   - Maintains consistency and history

3. **Audit Trail:**
   - Log all linking events
   - Include user_id, timestamp, provider

4. **Error Handling:**
   - Never block login on linking errors
   - Fail open (allow login, log error)

---

## Next Steps

1. ✅ Duplicate profile deleted
2. ⏭️ **Implement Auth0 Action** (Option 1 - 15 minutes)
3. ⏭️ Test with new account
4. ⏭️ Clear browser session and log in with email/password
5. ⏭️ Verify Actor dashboard loads correctly

**Ready to implement?** Follow the Quick Start guide above.
