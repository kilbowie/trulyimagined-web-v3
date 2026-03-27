/**
 * Shared Middleware for Truly Imagined v3
 *
 * Auth0 JWT validation and role extraction
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { AuthUser } from '@trulyimagined/types';

// ==================== JWKS CLIENT ====================

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// ==================== AUTH0 JWT VALIDATION ====================

export async function validateAuth0Token(event: APIGatewayProxyEvent): Promise<AuthUser | null> {
  const authHeader = event.headers.Authorization || event.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[AUTH] Missing or invalid authorization header');
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT with Auth0's public key
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        }
      );
    });

    if (!decoded || !decoded.sub || !decoded.email) {
      console.error('[AUTH] Invalid token structure');
      return null;
    }

    const user: AuthUser = {
      sub: decoded.sub,
      email: decoded.email,
      emailVerified: decoded.email_verified || false,
      name: decoded.name,
      picture: decoded.picture,
      roles: decoded['https://trulyimagined.com/roles'] || [],
    };

    console.log(
      `[AUTH] User authenticated: ${user.email} (roles: ${(user.roles || []).join(', ')})`
    );
    return user;
  } catch (error) {
    console.error('[AUTH] Token validation failed:', error);
    return null;
  }
}

// ==================== AUTHORIZATION HELPERS ====================

/**
 * Require authentication - throws if user is null
 */
export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require specific role(s) - throws if user doesn't have any of the allowed roles
 */
export function requireRole(user: AuthUser, allowedRoles: string[]) {
  const userRoles = user.roles || [];
  const hasRole = userRoles.some((role) => allowedRoles.includes(role));

  if (!hasRole) {
    throw new Error('Forbidden: Insufficient permissions');
  }
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: AuthUser | null, role: string): boolean {
  if (!user) return false;
  return (user.roles || []).includes(role);
}

/**
 * Check if user is an Actor
 */
export function isActor(user: AuthUser | null): boolean {
  return hasRole(user, 'Actor');
}

/**
 * Check if user is an Agent
 */
export function isAgent(user: AuthUser | null): boolean {
  return hasRole(user, 'Agent');
}

/**
 * Check if user is an Admin
 */
export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'Admin');
}

/**
 * Check if user is Enterprise
 */
export function isEnterprise(user: AuthUser | null): boolean {
  return hasRole(user, 'Enterprise');
}

/**
 * Check if user can access actor's resources
 * - User must be the actor themselves, their agent, or an admin
 */
export function canAccessActorResources(user: AuthUser, actorAuth0Id: string): boolean {
  // User is the actor themselves
  if (user.sub === actorAuth0Id) {
    return true;
  }

  // User is an agent or admin (can access any actor)
  if (isAgent(user) || isAdmin(user)) {
    return true;
  }

  return false;
}

/**
 * Require access to actor's resources - throws if not allowed
 */
export function requireActorAccess(user: AuthUser, actorAuth0Id: string) {
  if (!canAccessActorResources(user, actorAuth0Id)) {
    throw new Error("Forbidden: Cannot access this actor's resources");
  }
}

// ==================== REQUEST UTILITIES ====================

export function extractRequestIP(event: APIGatewayProxyEvent): string {
  return (
    event.requestContext?.identity?.sourceIp ||
    event.headers['X-Forwarded-For'] ||
    event.headers['x-forwarded-for'] ||
    'unknown'
  );
}

export function extractUserAgent(event: APIGatewayProxyEvent): string {
  return event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown';
}

// ==================== CONSENT ENFORCEMENT ====================

/**
 * Require consent for actor identity usage
 *
 * Checks if active consent exists for the specified actor and consent type.
 * Throws an error if consent is not granted or has been revoked/expired.
 *
 * @param actorId - The actor's database ID
 * @param consentType - Type of consent required (e.g., 'voice_synthesis', 'image_usage')
 * @param projectId - Optional project ID to scope the consent check
 *
 * @example
 * await requireConsent('actor-123', 'voice_synthesis', 'project-456');
 */
export async function requireConsent(
  actorId: string,
  consentType: string,
  projectId?: string
): Promise<void> {
  try {
    // Build query string
    const queryParams = new URLSearchParams({
      actorId,
      consentType,
      ...(projectId && { projectId }),
    });

    // Call consent check API
    const consentServiceUrl = process.env.CONSENT_SERVICE_URL || 'http://localhost:3001';
    const url = `${consentServiceUrl}/consent/check?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as { error?: string; isGranted: boolean; latestAction?: { reason?: string } };

    if (!response.ok) {
      throw new Error(`Consent check failed: ${data.error || 'Unknown error'}`);
    }

    // Check if consent is granted
    if (!data.isGranted) {
      const reason = data.latestAction?.reason || 'Consent not granted';
      throw new Error(`Consent required: ${reason}`);
    }

    console.log(`[CONSENT] Active consent verified for actor ${actorId}, type: ${consentType}`);
  } catch (error: any) {
    console.error('[CONSENT] Enforcement failed:', error);
    throw new Error(`Consent validation failed: ${error.message}`);
  }
}

/**
 * Check if consent exists (without throwing)
 *
 * @param actorId - The actor's database ID
 * @param consentType - Type of consent to check
 * @param projectId - Optional project ID
 * @returns boolean indicating if consent is granted
 */
export async function hasConsent(
  actorId: string,
  consentType: string,
  projectId?: string
): Promise<boolean> {
  try {
    await requireConsent(actorId, consentType, projectId);
    return true;
  } catch {
    return false;
  }
}
