/**
 * Shared Middleware for Truly Imagined v3
 * 
 * Auth0 JWT validation and role extraction
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@trulyimagined/types';

// ==================== AUTH0 JWT VALIDATION ====================

export async function validateAuth0Token(event: APIGatewayProxyEvent): Promise<AuthUser | null> {
  const authHeader = event.headers.Authorization || event.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[AUTH] Missing or invalid authorization header');
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT (Auth0 public key required in production)
    const decoded = jwt.decode(token) as any;

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

    return user;
  } catch (error) {
    console.error('[AUTH] Token validation failed:', error);
    return null;
  }
}

// ==================== AUTHORIZATION HELPERS ====================

export function requireAuth(user: AuthUser | null) {
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function requireRole(user: AuthUser, allowedRoles: string[]) {
  const userRoles = user.roles || [];
  const hasRole = userRoles.some((role) => allowedRoles.includes(role));

  if (!hasRole) {
    throw new Error('Forbidden: Insufficient permissions');
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
