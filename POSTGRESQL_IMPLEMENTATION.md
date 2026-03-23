# PostgreSQL Role System Implementation

This document outlines the implementation of the PostgreSQL-backed role system, replacing Auth0 RBAC.

## What Has Been Implemented

### 1. Database Schema ✅

**File:** `infra/database/migrations/002_user_profiles.sql`

Created a new `user_profiles` table with the following structure:

- **id**: UUID primary key
- **auth0_user_id**: VARCHAR(255) UNIQUE - Links to Auth0 authentication
- **email**: VARCHAR(255) NOT NULL
- **role**: VARCHAR(50) NOT NULL - CHECK constraint (Actor, Agent, Enterprise, Admin)
- **username**: VARCHAR(100) UNIQUE NOT NULL - Regex validated ^[a-zA-Z0-9_-]{3,50}$
- **legal_name**: VARCHAR(255) NOT NULL
- **professional_name**: VARCHAR(255) UNIQUE NOT NULL
- **use_legal_as_professional**: BOOLEAN DEFAULT FALSE
- **spotlight_id**: VARCHAR(500) UNIQUE - Optional, URL format validation
- **profile_completed**: BOOLEAN DEFAULT FALSE
- **created_at**: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
- **updated_at**: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

**Indexes:**

- `idx_user_profiles_auth0_user_id` on auth0_user_id
- `idx_user_profiles_email` on email
- `idx_user_profiles_username` on username
- `idx_user_profiles_role` on role

**Trigger:**

- Auto-updates `updated_at` timestamp on record modification

### 2. Database Queries ✅

**File:** `infra/database/src/queries-v3.ts`

Added `userProfiles` query object with the following methods:

- **create**: Insert new user profile
- **getByAuth0Id**: Fetch profile by Auth0 user ID
- **getByUsername**: Fetch profile by username
- **getByProfessionalName**: Fetch profile by professional name
- **checkUsernameAvailable**: Check if username is available
- **checkProfessionalNameAvailable**: Check if professional name is available
- **checkSpotlightIdAvailable**: Check if Spotlight ID is available
- **update**: Update existing user profile
- **getRole**: Get user's role by Auth0 ID
- **listByRole**: List all users with a specific role

### 3. API Endpoints ✅

**File:** `apps/web/src/app/api/profile/route.ts`

- **GET /api/profile**: Fetch user profile (currently returns mock data)
- **POST /api/profile**: Create new user profile with validation
  - Validates role (Actor, Agent, Enterprise, Admin)
  - Validates username format (3-50 chars, alphanumeric, \_, -)
  - Validates Spotlight ID format (URL)
  - Handles "same as legal name" checkbox logic

**File:** `apps/web/src/app/api/profile/check-availability/route.ts`

- **GET /api/profile/check-availability**: Check uniqueness of username/professional name/Spotlight ID
  - Query parameters: `type` (username|professionalName|spotlightId) and `value`

### 4. Updated Profile Setup UI ✅

**File:** `apps/web/src/app/select-role/page.tsx`

Transformed into a two-step profile creation flow:

**Step 1: Role Selection**

- Choose from Actor, Agent, or Enterprise roles
- Visual cards with icons and descriptions

**Step 2: Profile Details**

- **Username**: Required, validated format (3-50 chars)
- **Legal Name**: Required
- **Professional Name**: Required, with "Same as legal name" checkbox
- **Spotlight ID**: Optional URL field

After submission, redirects to dashboard.

### 5. Updated Auth Helpers ✅

**File:** `apps/web/src/lib/auth.ts`

Updated to query PostgreSQL instead of JWT custom claims:

- `getUserRoles()`: Now queries database (currently returns mock data)
- `getUserProfile()`: New function to fetch full profile
- `requireRole()`: Updated to use database-backed roles
- All role check functions (isActor, isAgent, isAdmin) use database

## What Still Needs to Be Done

### 1. Database Connection 🔄

The API endpoints and auth helpers currently have TODO comments with mock implementations. You need to:

**a) Set up PostgreSQL client in the Next.js app**

Create a database client utility in `apps/web/src/lib/db.ts`:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
```

**b) Add DATABASE_URL to environment variables**

In `apps/web/.env.local`:

```
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/database_name
```

**c) Import queries in API routes and auth helpers**

At the top of files:

```typescript
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';
```

Then uncomment and use the TODO sections.

### 2. Run Database Migration 🔄

Execute the migration script against your AWS RDS PostgreSQL database:

```bash
psql -h your-rds-endpoint -U your-username -d your-database -f infra/database/migrations/002_user_profiles.sql
```

### 3. Remove Auth0 RBAC Dependencies 🔄

**Files to clean up:**

- `apps/web/src/app/api/user/assign-role/route.ts` - Delete (replaced by /api/profile)
- `apps/web/src/app/debug-roles/page.tsx` - Delete or update
- `apps/web/src/app/super-debug/page.tsx` - Delete or update
- Remove Auth0 Management API role assignment logic

### 4. Update Dashboard Flow 🔄

**File:** `apps/web/src/app/dashboard/page.tsx`

Update to:

- Check if user has completed profile setup
- Redirect to `/select-role` if no profile exists
- Display username and professional name from database
- Show role from database (already done via `getUserRoles()`)

### 5. Add Profile Check Middleware 🔄

Create middleware to check if user has completed profile setup:

**File:** `apps/web/src/middleware.ts`

Add logic to redirect to `/select-role` if authenticated but no profile exists.

### 6. Test Complete Flow 🔄

Once database is connected, test:

1. New user logs in → redirected to `/select-role`
2. Selects role → fills out profile details
3. Submits → profile created in database
4. Redirected to `/dashboard`
5. Subsequent logins → dashboard loads directly (no profile setup prompt)
6. Dashboard shows correct role, username, professional name

## Key Differences from Auth0 RBAC

| Feature             | Auth0 RBAC (Old)      | PostgreSQL (New)                                                |
| ------------------- | --------------------- | --------------------------------------------------------------- |
| **Role Storage**    | JWT custom claims     | PostgreSQL database                                             |
| **Role Assignment** | Auth0 Management API  | Direct database insert                                          |
| **Role Retrieval**  | Parse JWT token       | Query database                                                  |
| **Token Refresh**   | Required logout/login | Not needed                                                      |
| **Profile Fields**  | Role only             | Role + username + legal name + professional name + Spotlight ID |
| **Setup Flow**      | Role selection only   | Two-step: role + profile details                                |
| **Debugging**       | Auth0 dashboard       | Database queries                                                |

## Environment Variables Required

### Current (Auth0 Authentication)

```
AUTH0_SECRET=...
AUTH0_BASE_URL=...
AUTH0_ISSUER_BASE_URL=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
APP_BASE_URL=...
```

### New (PostgreSQL)

```
DATABASE_URL=postgresql://username:password@endpoint:5432/database_name
```

## Benefits of PostgreSQL Approach

1. **Full Control**: No dependency on Auth0 Actions or JWT token structure
2. **Extended Profile**: Username, legal name, professional name, Spotlight ID
3. **Better Debugging**: Direct database queries to inspect data
4. **Flexibility**: Easy to add more profile fields in the future
5. **Performance**: No need to wait for token refresh or logout/login
6. **Validation**: Database-level constraints ensure data integrity

## Migration Checklist

- [ ] Run database migration (002_user_profiles.sql)
- [ ] Set up PostgreSQL client in Next.js app
- [ ] Add DATABASE_URL to environment variables
- [ ] Import and use database queries in API routes
- [ ] Update auth helpers to query database
- [ ] Update dashboard to check profile completion
- [ ] Add profile check middleware
- [ ] Remove Auth0 RBAC code (assign-role route, debug pages)
- [ ] Test complete flow from first login to dashboard
- [ ] Verify roles work correctly for protected routes

## Next Steps

1. **Connect to PostgreSQL**: Set up connection string and client
2. **Run Migration**: Execute 002_user_profiles.sql
3. **Uncomment TODO sections**: Enable database queries in API routes and auth helpers
4. **Test**: Create a new user profile and verify it works end-to-end
5. **Clean up**: Remove old Auth0 RBAC code
