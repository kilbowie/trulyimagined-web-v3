# Session Summary: PostgreSQL Role System Implementation

**Date:** Current Session  
**Focus:** Replace Auth0 RBAC with PostgreSQL-backed role system

## Problem Statement

Auth0 RBAC approach was causing persistent issues:
- Roles assigned in Auth0 but not appearing in JWT tokens
- Login loop: users required to select role on every login
- Auth0 Action for adding roles to JWT never successfully deployed

## Solution

Pivot to PostgreSQL-backed role system with extended user profile fields.

## Changes Made

### 1. Database Layer

**Created:** `infra/database/migrations/002_user_profiles.sql`
- New `user_profiles` table with role, username, legal_name, professional_name, spotlight_id
- Unique constraints on username, professional_name, spotlight_id
- Format validation (username regex, URL format for spotlight_id)
- Indexes for performance
- Auto-update trigger for updated_at timestamp

**Updated:** `infra/database/src/queries-v3.ts`
- Added `userProfiles` query object with 10 methods
- Queries for create, read, update, availability checks

**Created:** `apps/web/src/lib/db.ts`
- PostgreSQL connection pool
- Query execution with logging
- Connection testing utility

### 2. API Endpoints

**Created:** `apps/web/src/app/api/profile/route.ts`
- GET /api/profile - Fetch user profile
- POST /api/profile - Create user profile with validation

**Created:** `apps/web/src/app/api/profile/check-availability/route.ts`
- GET /api/profile/check-availability - Check username/professional name/spotlight ID uniqueness

Both endpoints have TODO comments for database integration and currently return mock data.

### 3. User Interface

**Updated:** `apps/web/src/app/select-role/page.tsx`
- Transformed into two-step profile creation flow
- Step 1: Role selection (Actor, Agent, Enterprise)
- Step 2: Profile details form (username, legal name, professional name with "same as legal" checkbox, optional Spotlight ID)
- Form validation for username format and Spotlight ID URL
- Success state with redirect to dashboard

### 4. Authentication Helpers

**Updated:** `apps/web/src/lib/auth.ts`
- Changed `getUserRoles()` to query PostgreSQL instead of JWT custom claims
- Added `getUserProfile()` function to fetch full user profile
- Updated `requireRole()` to use database-backed roles
- All functions have TODO comments for database integration

### 5. Documentation

**Created:** `POSTGRESQL_IMPLEMENTATION.md`
- Comprehensive overview of implementation
- What has been done vs. what's pending
- Comparison table: Auth0 RBAC vs. PostgreSQL
- Migration checklist
- Benefits of new approach

**Created:** `SETUP_POSTGRESQL.md`
- Step-by-step setup guide
- How to install pg client
- How to add DATABASE_URL
- How to run migration
- Code examples for database integration
- Troubleshooting section

## File Tree of Changes

```
trulyimagined-web-v3/
├── POSTGRESQL_IMPLEMENTATION.md          [NEW]
├── SETUP_POSTGRESQL.md                   [NEW]
├── apps/web/
│   └── src/
│       ├── lib/
│       │   ├── auth.ts                   [UPDATED - Query PostgreSQL]
│       │   └── db.ts                     [NEW - Database client]
│       └── app/
│           ├── select-role/
│           │   └── page.tsx              [UPDATED - Two-step form]
│           └── api/
│               └── profile/
│                   ├── route.ts          [NEW - Profile CRUD]
│                   └── check-availability/
│                       └── route.ts      [NEW - Uniqueness checks]
└── infra/database/
    ├── migrations/
    │   └── 002_user_profiles.sql         [NEW - Schema migration]
    └── src/
        └── queries-v3.ts                 [UPDATED - Added userProfiles queries]
```

## Current State

### ✅ Completed (Development Ready)
- Database schema designed and migration script created
- Queries written for all CRUD operations
- API endpoints created with validation
- Profile setup UI with two-step form
- Auth helpers updated to use database

### 🔄 Pending (Requires User Action)
- Install `pg` package in Next.js app
- Add DATABASE_URL to environment variables
- Run database migration on AWS RDS
- Uncomment TODO sections in API routes and auth helpers
- Test complete flow
- Remove old Auth0 RBAC code

### 🚀 Ready for Production After:
1. PostgreSQL client connected
2. Migration executed
3. Database queries uncommented
4. End-to-end testing completed

## Key Features of New System

### User Profile Fields
| Field | Type | Required | Unique | Validation |
|-------|------|----------|--------|------------|
| role | String | Yes | No | Actor, Agent, Enterprise, Admin |
| username | String | Yes | Yes | 3-50 chars, alphanumeric, _, - |
| legal_name | String | Yes | No | Full legal name |
| professional_name | String | Yes | Yes | Display name |
| spotlight_id | URL | No | Yes | Valid URL format |
| use_legal_as_professional | Boolean | No | No | Auto-fill checkbox |

### Flow Architecture

```
User logs in (Auth0)
    ↓
Check user_profiles table for auth0_user_id
    ↓
Profile exists?
    ├─ Yes → Redirect to /dashboard
    │          Show: username, professional_name, role
    │
    └─ No → Redirect to /select-role
              ↓
         Step 1: Choose role
              ↓
         Step 2: Fill profile details
              ↓
         Validate & create in database
              ↓
         Redirect to /dashboard
              ↓
         Subsequent logins → Direct to dashboard
```

## Migration from Auth0 RBAC

| What Changed | Before | After |
|--------------|--------|-------|
| **Role Storage** | JWT custom claims | PostgreSQL user_profiles.role |
| **Role Assignment** | Auth0 Management API | Direct DB insert via /api/profile |
| **Role Retrieval** | Parse JWT token | Query database by auth0_user_id |
| **Profile Fields** | Just role | Role + username + names + Spotlight ID |
| **Token Refresh** | Required logout/login | Not needed (database always fresh) |
| **One-time Setup** | No ❌ (re-prompted every login) | Yes ✅ (profile_completed flag) |

## Testing Checklist

After PostgreSQL connection is established:

- [ ] Database connection works (run testConnection())
- [ ] Migration creates table with correct schema
- [ ] New user login redirects to /select-role
- [ ] Role selection step works
- [ ] Profile details form validates correctly
- [ ] Username uniqueness check works
- [ ] Professional name uniqueness check works
- [ ] Spotlight ID validation works
- [ ] Profile creates in database successfully
- [ ] Redirect to dashboard works
- [ ] Dashboard shows correct profile data
- [ ] Second login skips profile setup
- [ ] Role-based access control works

## Next Steps for User

### Immediate (Required)
1. **Install PostgreSQL client**: `cd apps/web && pnpm add pg @types/pg`
2. **Add DATABASE_URL**: Update `apps/web/.env.local`
3. **Run migration**: Execute `002_user_profiles.sql` on AWS RDS

### Short-term (Core Functionality)
4. **Connect database**: Uncomment TODO sections in API routes
5. **Test flow**: Create test profile and verify
6. **Update dashboard**: Add profile completion check

### Clean-up (Remove Old Code)
7. **Delete**: `apps/web/src/app/api/user/assign-role/route.ts`
8. **Update/Delete**: Debug pages (debug-roles, super-debug)
9. **Remove**: Auth0 Management API dependencies

## Success Criteria

✅ New users complete profile setup once  
✅ Returning users go directly to dashboard  
✅ Roles stored in PostgreSQL, not JWT  
✅ Username, legal name, professional name, Spotlight ID all captured  
✅ No login loop issues  
✅ All validation works (uniqueness, format)  

## References

- [POSTGRESQL_IMPLEMENTATION.md](./POSTGRESQL_IMPLEMENTATION.md) - Full implementation details
- [SETUP_POSTGRESQL.md](./SETUP_POSTGRESQL.md) - Step-by-step setup guide
- [002_user_profiles.sql](./infra/database/migrations/002_user_profiles.sql) - Database migration
- [queries-v3.ts](./infra/database/src/queries-v3.ts) - Database queries
