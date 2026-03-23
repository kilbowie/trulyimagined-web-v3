# ✅ Database Setup Complete

## What Was Done

### 1. Architecture Decision ✅

**Kept tables separate** (best practice):

- **user_profiles**: Base table for ALL users (Actor, Agent, Enterprise, Admin)
- **actors**: Extended profile ONLY for users with role='Actor'
- **Relationship**: Added `user_profile_id` foreign key in actors table (migration 003)

### 2. Environment Configuration ✅

- ✅ Added `DATABASE_URL` to `apps/web/.env.local`
- ✅ PostgreSQL credentials configured for RDS

### 3. Database Migrations ✅

All migrations executed successfully:

- ✅ `001_initial_schema.sql` - Actors, consent_log, licensing_requests, usage_tracking, audit_log
- ✅ `002_user_profiles.sql` - Created user_profiles table with role, username, legal_name, professional_name, spotlight_id
- ✅ `003_link_actors_to_user_profiles.sql` - Linked actors table to user_profiles

**Tables Created:**

```
- actors (existing, with new user_profile_id column)
- audit_log
- consent_log
- licensing_requests
- usage_tracking
- user_profiles (NEW)
```

### 4. Dependencies Installed ✅

- ✅ `pg` - PostgreSQL client for Node.js
- ✅ `@types/pg` - TypeScript types

### 5. Database Client Created ✅

- ✅ `apps/web/src/lib/db.ts` - Connection pool with query logging

### 6. API Routes Connected ✅

Updated to use real PostgreSQL queries (no more mocks):

**`/api/profile` (GET)**

- Fetches user profile from database
- Returns `needsSetup: true` if no profile exists

**`/api/profile` (POST)**

- Creates user profile in database
- Validates username format (3-50 chars, alphanumeric, \_, -)
- Validates Spotlight ID format (URL)
- Checks uniqueness: username, professional_name, spotlight_id
- Returns 409 if duplicate found

**`/api/profile/check-availability` (GET)**

- Real-time uniqueness validation
- Checks username, professionalName, or spotlightId

### 7. Auth Helpers Connected ✅

**`apps/web/src/lib/auth.ts`** now queries PostgreSQL:

- `getUserRoles()` - Queries user_profiles.role
- `getUserProfile()` - Fetches full profile from database

## Database Schema

### user_profiles Table

```sql
id                        UUID PRIMARY KEY
auth0_user_id            VARCHAR(255) UNIQUE NOT NULL
email                    VARCHAR(255) NOT NULL
role                     VARCHAR(50) NOT NULL (Actor, Agent, Enterprise, Admin)
username                 VARCHAR(100) UNIQUE NOT NULL (3-50 chars, alphanumeric, _, -)
legal_name               VARCHAR(255) NOT NULL
professional_name        VARCHAR(255) UNIQUE NOT NULL
use_legal_as_professional BOOLEAN DEFAULT FALSE
spotlight_id             VARCHAR(500) UNIQUE (optional URL)
profile_completed        BOOLEAN DEFAULT TRUE
created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**Indexes:**

- `idx_user_profiles_auth0_user_id`
- `idx_user_profiles_email`
- `idx_user_profiles_username`
- `idx_user_profiles_role`

**Constraints:**

- Username format: `^[a-zA-Z0-9_-]{3,50}$`
- Spotlight ID format: `^https?://`
- Role CHECK: Actor, Agent, Enterprise, Admin

### actors Table (Updated)

Now includes:

- `user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE`
- Unique constraint on `user_profile_id`

## Testing the Flow

### Expected User Journey

1. **New User Login**

   ```
   User logs in via Auth0
   → Redirect to /select-role (no profile exists)
   → Step 1: Select role (Actor, Agent, or Enterprise)
   → Step 2: Fill profile form:
      - Username (required, unique, 3-50 chars)
      - Legal Name (required)
      - Professional Name (required, unique, with "same as legal" checkbox)
      - Spotlight ID (optional URL)
   → Submit → Profile created in database
   → Redirect to /dashboard
   ```

2. **Returning User Login**
   ```
   User logs in via Auth0
   → Profile exists in database
   → Redirect directly to /dashboard
   → Dashboard shows: username, professional_name, role
   ```

### Test on localhost:3000

1. **Clear existing session:**
   - Visit: `http://localhost:3000/auth/logout`

2. **Test new profile creation:**
   - Visit: `http://localhost:3000/auth/login`
   - Should redirect to `/select-role`
   - Fill out both steps
   - Submit and verify profile created
   - Check dashboard shows correct data

3. **Test returning user:**
   - Log out
   - Log in again
   - Should skip profile setup and go directly to `/dashboard`

4. **Verify in database:**

   ```bash
   psql -h trimg-db-v3.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com -U trimg_admin -d trulyimagined_v3

   # Check profiles
   SELECT * FROM user_profiles;

   # Check specific user
   SELECT * FROM user_profiles WHERE username = 'your_username';
   ```

## Dev Server Status

✅ Running on: `http://localhost:3000`

## API Endpoints Ready

- `GET /api/profile` - Fetch user profile
- `POST /api/profile` - Create profile
- `GET /api/profile/check-availability?type=username&value=test` - Check availability

## Files Modified/Created

### Created

- `apps/web/src/lib/db.ts` - Database client
- `infra/database/migrations/002_user_profiles.sql` - User profiles table
- `infra/database/migrations/003_link_actors_to_user_profiles.sql` - Foreign key relationship
- `apps/web/src/app/api/profile/route.ts` - Profile CRUD API
- `apps/web/src/app/api/profile/check-availability/route.ts` - Availability check API

### Modified

- `apps/web/.env.local` - Added DATABASE_URL
- `apps/web/src/lib/auth.ts` - Connected to PostgreSQL
- `apps/web/src/app/select-role/page.tsx` - Two-step profile form

## Next Steps

1. ✅ **Server is running** - Visit `http://localhost:3000`
2. 🔍 **Test profile creation** - Log in and complete profile setup
3. 🔍 **Verify database** - Check user_profiles table
4. 🔍 **Test returning user** - Log in again (should skip setup)

## Troubleshooting

If you encounter issues:

1. **Database connection errors:**
   - Check DATABASE_URL in `apps/web/.env.local`
   - Verify RDS security group allows connections
   - Test connection: `psql -h trimg-db-v3.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com -U trimg_admin -d trulyimagined_v3`

2. **Profile not creating:**
   - Check browser console for errors
   - Check server logs (terminal where `pnpm dev` is running)
   - Verify form validation requirements

3. **Duplicate key errors:**
   - Username must be unique
   - Professional name must be unique
   - Spotlight ID must be unique (if provided)

## Success Criteria

- ✅ Database migrations completed
- ✅ Tables created (user_profiles)
- ✅ Foreign key relationship established
- ✅ API routes connected to database
- ✅ Auth helpers connected to database
- ✅ Dev server running
- 🔍 Pending: User test of profile creation flow
- 🔍 Pending: Verify profile stored in database
- 🔍 Pending: Confirm returning user flow works

---

**Ready for testing at http://localhost:3000!** 🚀
