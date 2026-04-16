import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/stripe/identity', () => ({
  getStripeIdentityStatus: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getStripeIdentityStatus } from '@/lib/stripe/identity';
import { GET } from './route';

describe('GET /api/verification/status - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null as never);

    const response = await GET({} as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('fixes forward to the Stripe identity status implementation', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'auth0|user-123' } } as never);
    vi.mocked(getStripeIdentityStatus).mockResolvedValueOnce({
      userId: 'profile-123',
      status: 'verified',
      verificationLevel: 'high',
      assuranceLevel: 'substantial',
      lastVerified: '2026-04-16T12:00:00.000Z',
      providers: [],
      summary: {
        overallStatus: 'verified',
        highestVerificationLevel: 'high',
        highestAssuranceLevel: 'substantial',
        lastVerified: '2026-04-16T12:00:00.000Z',
        totalProviders: 0,
        kycProviders: 0,
        governmentProviders: 0,
      },
    });

    const response = await GET({} as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getStripeIdentityStatus).toHaveBeenCalledWith('auth0|user-123');
    expect(data.status).toBe('verified');
    expect(data.summary.overallStatus).toBe('verified');
  });
});