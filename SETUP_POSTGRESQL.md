# Quick Setup: Connect PostgreSQL to Next.js

Follow these steps to connect your AWS RDS PostgreSQL database to the Next.js application.

## Step 1: Install PostgreSQL Client

```bash
cd apps/web
pnpm add pg
pnpm add -D @types/pg
```

## Step 2: Add Database URL to Environment Variables

Edit `apps/web/.env.local` and add your PostgreSQL connection string:

```env
DATABASE_URL=postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/database_name
```

Replace:

- `username` - Your RDS database username
- `password` - Your RDS database password
- `your-rds-endpoint.region.rds.amazonaws.com` - Your RDS endpoint
- `database_name` - Your database name

## Step 3: Create Database Client

Create `apps/web/src/lib/db.ts`:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export default { query };
```

## Step 4: Run Database Migration

From the project root:

```bash
# If psql is not installed, install it first:
# On macOS: brew install postgresql
# On Windows: https://www.postgresql.org/download/windows/

psql -h your-rds-endpoint.region.rds.amazonaws.com -U your-username -d your-database -f infra/database/migrations/002_user_profiles.sql
```

Or copy the SQL content and run it directly in your database management tool (e.g., pgAdmin, DBeaver).

## Step 5: Import Database Client in API Routes

Update `apps/web/src/app/api/profile/route.ts`:

Add imports at the top:

```typescript
import { query } from '@/lib/db';
```

Then uncomment the TODO sections and replace mock data with actual database queries.

For example, in the GET handler:

```typescript
// Replace this mock:
return NextResponse.json({
  profile: null,
  needsSetup: true,
});

// With actual query:
const result = await query('SELECT * FROM user_profiles WHERE auth0_user_id = $1', [user.sub]);

const profile = result.rows[0] || null;
return NextResponse.json({
  profile,
  needsSetup: !profile,
});
```

And in the POST handler:

```typescript
// Check username availability
const usernameCheck = await query(
  'SELECT EXISTS(SELECT 1 FROM user_profiles WHERE username = $1)',
  [username]
);
if (usernameCheck.rows[0].exists) {
  return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
}

// Similar checks for professional name and spotlight ID...

// Create profile
const result = await query(
  `INSERT INTO user_profiles (
    auth0_user_id, email, role, username, legal_name, 
    professional_name, use_legal_as_professional, spotlight_id, profile_completed
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *`,
  [
    user.sub,
    user.email,
    role,
    username,
    legalName,
    finalProfessionalName,
    useLegalAsProfessional || false,
    spotlightId || null,
    true,
  ]
);

return NextResponse.json({
  success: true,
  profile: result.rows[0],
});
```

## Step 6: Update Auth Helpers

Update `apps/web/src/lib/auth.ts`:

Add imports:

```typescript
import { query } from '@/lib/db';
```

Update `getUserRoles()`:

```typescript
export async function getUserRoles(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const result = await query('SELECT role FROM user_profiles WHERE auth0_user_id = $1', [user.sub]);

  if (result.rows.length > 0 && result.rows[0].role) {
    return [result.rows[0].role];
  }
  return [];
}
```

Update `getUserProfile()`:

```typescript
export async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await query('SELECT * FROM user_profiles WHERE auth0_user_id = $1', [user.sub]);

  return result.rows[0] || null;
}
```

## Step 7: Update Dashboard

Update `apps/web/src/app/dashboard/page.tsx` to check profile completion:

```typescript
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/api/auth/login');
  }

  const profile = await getUserProfile();
  if (!profile) {
    redirect('/select-role');
  }

  // Rest of dashboard rendering...
  return (
    <div>
      <h1>Welcome, {profile.username}!</h1>
      <p>Professional Name: {profile.professional_name}</p>
      <p>Role: {profile.role}</p>
      {/* ... */}
    </div>
  );
}
```

## Step 8: Test the Flow

1. Clear any existing session: Visit `/auth/logout`
2. Log in: Visit `/auth/login`
3. Should redirect to `/select-role` (no profile yet)
4. Fill out the profile form
5. Submit - should create profile in database
6. Redirect to `/dashboard`
7. Log out and log back in - should go directly to dashboard (profile exists)

## Troubleshooting

### Connection Errors

If you get "Connection refused" or "SSL required":

- Verify your RDS security group allows inbound connections on port 5432
- Check that your DATABASE_URL is correct
- Ensure SSL is properly configured

### Migration Errors

If the migration fails:

- Check that you're connecting to the correct database
- Verify the user has permission to CREATE TABLE
- Check for existing tables that might conflict

### Profile Not Saving

If profile creation fails:

- Check browser console for errors
- Check server logs (terminal where Next.js is running)
- Verify database client is properly initialized
- Test database connection with a simple query first

## Verification Queries

After setup, you can verify everything works:

```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'user_profiles';

-- Check table structure
\d user_profiles

-- List all profiles
SELECT * FROM user_profiles;

-- Check a specific user
SELECT * FROM user_profiles WHERE auth0_user_id = 'auth0|xxx';
```

## Next Steps

Once database is connected and working:

1. Remove old Auth0 RBAC code:
   - Delete `apps/web/src/app/api/user/assign-role/route.ts`
   - Update or remove debug pages

2. Add more profile fields if needed (e.g., phone number, address)

3. Implement profile editing functionality

4. Add admin panel to manage users
