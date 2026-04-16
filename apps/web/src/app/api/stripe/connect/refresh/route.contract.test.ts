import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../_shared', () => ({
  getConnectActorContext: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  createConnectOnboardingLink: vi.fn(),
}));

import { createConnectOnboardingLink } from '@/lib/stripe';
import { getConnectActorContext } from '../_shared';
import { GET } from './route';

describe('GET /api/stripe/connect/refresh - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to onboarding URL when accept header prefers HTML', async () => {
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

    const request = new NextRequest('http://localhost:3000/api/stripe/connect/refresh', {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://connect.stripe.com/setup/s/acct_123');
  });

  it('returns JSON payload when request is not HTML', async () => {
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

    const request = new NextRequest('http://localhost:3000/api/stripe/connect/refresh', {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const response = await GET(request);
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