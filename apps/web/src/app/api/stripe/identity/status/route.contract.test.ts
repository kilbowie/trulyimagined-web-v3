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

describe('GET /api/stripe/identity/status - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null as never);

    const response = await GET({} as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(getStripeIdentityStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the TI user profile cannot be resolved', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: {
        sub: 'auth0|user-123',
      },
    } as never);
    vi.mocked(getStripeIdentityStatus).mockResolvedValueOnce(null);

    const response = await GET({} as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'User profile not found' });
  });

  it('returns the existing verification status response shape', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: {
        sub: 'auth0|user-123',
      },
    } as never);
    vi.mocked(getStripeIdentityStatus).mockResolvedValueOnce({
      userId: 'profile-123',
      status: 'verified',
      verificationLevel: 'high',
      assuranceLevel: 'substantial',
      lastVerified: '2026-04-16T12:00:00.000Z',
      providers: [
        {
          provider: 'stripe',
          providerType: 'kyc',
          verificationLevel: 'high',
          assuranceLevel: 'substantial',
          verifiedAt: '2026-04-16T12:00:00.000Z',
        },
      ],
      summary: {
        overallStatus: 'verified',
        highestVerificationLevel: 'high',
        highestAssuranceLevel: 'substantial',
        lastVerified: '2026-04-16T12:00:00.000Z',
        totalProviders: 1,
        kycProviders: 1,
        governmentProviders: 0,
      },
    });

    const response = await GET({} as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getStripeIdentityStatus).toHaveBeenCalledWith('auth0|user-123');
    expect(data).toEqual({
      userId: 'profile-123',
      status: 'verified',
      verificationLevel: 'high',
      assuranceLevel: 'substantial',
      lastVerified: '2026-04-16T12:00:00.000Z',
      providers: [
        {
          provider: 'stripe',
          providerType: 'kyc',
          verificationLevel: 'high',
          assuranceLevel: 'substantial',
          verifiedAt: '2026-04-16T12:00:00.000Z',
        },
      ],
      summary: {
        overallStatus: 'verified',
        highestVerificationLevel: 'high',
        highestAssuranceLevel: 'substantial',
        lastVerified: '2026-04-16T12:00:00.000Z',
        totalProviders: 1,
        kycProviders: 1,
        governmentProviders: 0,
      },
    });
  });
});