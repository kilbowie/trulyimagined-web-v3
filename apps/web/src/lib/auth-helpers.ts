import { auth0 } from './auth0';

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  try {
    const session = await auth0.getSession();
    return session?.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get user roles from the session
 */
export async function getUserRoles(): Promise<string[]> {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return [];

    // Roles are stored in a custom claim
    const roles = session.user['https://trulyimagined.com/roles'];
    return Array.isArray(roles) ? roles : [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Check if user has any role assigned
 */
export async function hasAnyRole(): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.length > 0;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes(role);
}

/**
 * Check if user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('Admin');
}

/**
 * Check if user is an actor
 */
export async function isActor(): Promise<boolean> {
  return hasRole('Actor');
}

/**
 * Check if user is an agent
 */
export async function isAgent(): Promise<boolean> {
  return hasRole('Agent');
}

/**
 * Check if user is an enterprise user
 */
export async function isEnterprise(): Promise<boolean> {
  return hasRole('Enterprise');
}

/**
 * Require authentication - redirect to login if not authenticated
 * Usage: const user = await requireAuth();
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('REDIRECT_TO_LOGIN');
  }
  return user;
}

/**
 * Require specific role - throw error if user doesn't have it
 */
export async function requireRole(role: string) {
  const user = await requireAuth();
  const roles = await getUserRoles();

  if (!roles.includes(role)) {
    throw new Error(`INSUFFICIENT_PERMISSIONS: Role "${role}" required`);
  }

  return user;
}
