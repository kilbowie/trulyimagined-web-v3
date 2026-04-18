/**
 * Mock authentication for local development.
 *
 * Enabled when NEXT_PUBLIC_MOCK_AUTH=true is set in .env.local.
 * Provides four pre-configured test accounts that bypass Auth0:
 *   actor@test.com  / password  → Actor role
 *   agent@test.com  / password  → Agent role
 *   studio@test.com / password  → Studio role
 *   admin@test.com  / password  → Admin role
 *
 * All profiles are marked as fully verified.
 *
 * NEVER enable this in production.
 */

export const IS_MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';
export const MOCK_COOKIE_NAME = 'ti-mock-session';
export const MOCK_PASSWORD = 'password';

export interface MockUserProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
  /** Role surfaced under the Auth0 custom namespace claim */
  'https://trulyimagined.com/roles': string[];
  /** Index signature required for Auth0User compatibility */
  [key: string]: unknown;
}

export interface MockUser extends MockUserProfile {
  role: string;
}

export const MOCK_USERS: Record<string, MockUser> = {
  'actor@test.com': {
    sub: 'mock|actor',
    email: 'actor@test.com',
    name: 'Test Actor',
    email_verified: true,
    role: 'Actor',
    'https://trulyimagined.com/roles': ['Actor'],
  },
  'agent@test.com': {
    sub: 'mock|agent',
    email: 'agent@test.com',
    name: 'Test Agent',
    email_verified: true,
    role: 'Agent',
    'https://trulyimagined.com/roles': ['Agent'],
  },
  'studio@test.com': {
    sub: 'mock|studio',
    email: 'studio@test.com',
    name: 'Test Studio',
    email_verified: true,
    role: 'Studio',
    'https://trulyimagined.com/roles': ['Studio'],
  },
  'admin@test.com': {
    sub: 'mock|admin',
    email: 'admin@test.com',
    name: 'Test Admin',
    email_verified: true,
    role: 'Admin',
    'https://trulyimagined.com/roles': ['Admin'],
  },
};

export function getMockUserByEmail(email: string): MockUser | null {
  return MOCK_USERS[email.toLowerCase()] ?? null;
}

export function getMockRoles(email: string): string[] {
  return MOCK_USERS[email.toLowerCase()]?.['https://trulyimagined.com/roles'] ?? [];
}
