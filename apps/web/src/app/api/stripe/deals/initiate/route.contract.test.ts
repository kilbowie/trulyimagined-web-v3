import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  queryTi: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe/platformFee', () => ({
  calculateDealBreakdown: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserProfile } from '@/lib/auth';
import { queryTi } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { calculateDealBreakdown } from '@/lib/stripe/platformFee';
import { POST } from './route';

describe('POST /api/stripe/deals/initiate - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the deal initiation shape with a clientSecret', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: { sub: 'auth0|studio-123' },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValueOnce({
      id: 'studio-profile-123',
      role: 'Enterprise',
    } as never);
    vi.mocked(calculateDealBreakdown).mockReturnValueOnce({
      dealValueCents: 10000,
      platformFeeCents: 1500,
      actorPayoutCents: 8500,
      platformFeeBps: 1500,
    } as never);
    vi.mocked(queryTi)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'actor-123',
            user_profile_id: '11111111-1111-1111-1111-111111111111',
            stripe_account_id: 'acct_123',
            stripe_onboarding_complete: true,
            verification_status: 'verified',
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'deal-123' }] } as never);
    vi.mocked(stripe.paymentIntents.create).mockResolvedValueOnce({
      id: 'pi_123',
      client_secret: 'pi_secret_123',
    } as never);

    const request = new NextRequest('http://localhost:3000/api/stripe/deals/initiate', {
      method: 'POST',
      body: JSON.stringify({
        actorUserProfileId: '11111111-1111-1111-1111-111111111111',
        dealValueCents: 10000,
        currency: 'gbp',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      deal: {
        id: 'deal-123',
        stripePaymentIntentId: 'pi_123',
        clientSecret: 'pi_secret_123',
        status: 'pending',
        dealValueCents: 10000,
        platformFeeCents: 1500,
        actorPayoutCents: 8500,
        platformFeeBps: 1500,
      },
    });
  });
});
