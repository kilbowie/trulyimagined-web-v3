import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_shared', () => ({
  getConnectActorContext: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  createConnectOnboardingLink: vi.fn(),
}));

import { createConnectOnboardingLink } from '@/lib/stripe';
import { getConnectActorContext } from '../_shared';
import { POST } from './route';

describe('POST /api/stripe/connect/onboarding - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no Stripe account exists for actor context', async () => {
    vi.mocked(getConnectActorContext).mockResolvedValueOnce({
      ok: true,
      context: {
        stripeAccountId: null,
      },
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('No Stripe Connect account found');
    expect(createConnectOnboardingLink).not.toHaveBeenCalled();
  });

  it('returns onboarding link response shape', async () => {
    vi.mocked(getConnectActorContext).mockResolvedValueOnce({
      ok: true,
      context: {
        stripeAccountId: 'acct_123',
      },
    } as never);
    vi.mocked(createConnectOnboardingLink).mockResolvedValueOnce({
      url: 'https://connect.stripe.com/setup/s/acct_123',
      expires_at: 1_776_400_000,
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      accountId: 'acct_123',
      onboardingUrl: 'https://connect.stripe.com/setup/s/acct_123',
      expiresAt: 1_776_400_000,
    });
  });
});