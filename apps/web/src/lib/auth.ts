import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

async function resolveUserProfileByAuth0Identity(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null;

  const directMatch = await query('SELECT * FROM user_profiles WHERE auth0_user_id = $1', [
    user.sub,
  ]);
  if (directMatch.rows[0]) {
    return directMatch.rows[0];
  }

  if (!user.email || user.email_verified !== true) {
    return null;
  }

  const emailMatch = await query(
    'SELECT * FROM user_profiles WHERE LOWER(email) = LOWER($1) LIMIT 2',
    [user.email]
  );

  if (emailMatch.rows.length !== 1) {
    if (emailMatch.rows.length > 1) {
      console.error('[AUTH] Refusing to reconcile profile: duplicate email matches found', {
        email: user.email,
        count: emailMatch.rows.length,
      });
    }
    return null;
  }

  const profile = emailMatch.rows[0];
  const rebound = await query(
    `UPDATE user_profiles
        SET auth0_user_id = $1
      WHERE id = $2
      RETURNING *`,
    [user.sub, profile.id]
  );

  console.log('[AUTH] Reconciled user_profiles.auth0_user_id from verified email match', {
    email: user.email,
    profileId: profile.id,
  });

  return rebound.rows[0] || profile;
}

/**
 * Get the current user session (server-side only)
 *
 * @returns User session or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const session = await auth0.getSession();
    return session?.user || null;
  } catch (error) {
    console.error('[AUTH] Failed to get session:', error);
    return null;
  }
}

/**
 * Get user roles from PostgreSQL database
 *
 * @returns Array of role names
 */
export async function getUserRoles(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const profile = await resolveUserProfileByAuth0Identity(user);

    if (profile?.role) {
      return [profile.role];
    }
    return [];
  } catch (error) {
    console.error('[AUTH] Failed to get user roles:', error);
    return [];
  }
}

/**
 * Get user profile from PostgreSQL database
 *
 * @returns User profile or null
 */
export async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    return await resolveUserProfileByAuth0Identity(user);
  } catch (error) {
    console.error('[AUTH] Failed to get user profile:', error);
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes(role);
}

/**
 * Check if user is an Actor
 */
export async function isActor(): Promise<boolean> {
  return await hasRole('Actor');
}

/**
 * Check if user is an Agent
 */
export async function isAgent(): Promise<boolean> {
  return await hasRole('Agent');
}

/**
 * Check if user is an Admin
 */
export async function isAdmin(): Promise<boolean> {
  return await hasRole('Admin');
}

/**
 * Require authentication (for Server Components)
 * Throws error if user is not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Require specific role (for Server Components)
 * Throws error if user doesn't have the required role
 */
export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  const userRoles = await getUserRoles(); // Now queries PostgreSQL

  const hasRequiredRole = userRoles.some((role: string) => allowedRoles.includes(role));

  if (!hasRequiredRole) {
    throw new Error(`Forbidden: Required roles: ${allowedRoles.join(', ')}`);
  }

  return user;
}
