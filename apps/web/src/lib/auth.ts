import { auth0 } from '@/lib/auth0';

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
 * Get user roles from session
 * 
 * @returns Array of role names
 */
export async function getUserRoles(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  
  return user['https://trulyimagined.com/roles'] || [];
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
  const userRoles = user['https://trulyimagined.com/roles'] || [];
  
  const hasRequiredRole = userRoles.some((role: string) => allowedRoles.includes(role));
  
  if (!hasRequiredRole) {
    throw new Error(`Forbidden: Required roles: ${allowedRoles.join(', ')}`);
  }
  
  return user;
}
