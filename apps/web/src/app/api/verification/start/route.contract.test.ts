import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/stripe/identity', () => ({
  startStripeIdentitySession: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { startStripeIdentitySession } from '@/lib/stripe/identity';
import { POST } from './route';

describe('POST /api/verification/start - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 410 for deprecated non-Stripe providers instead of using legacy implementations', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: { sub: 'auth0|user-123', email: 'actor@example.com', name: 'Ada', nickname: 'Ada' },
    } as never);

    const request = new NextRequest('http://localhost:3000/api/verification/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'mock' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.supported).toEqual(['stripe']);
    expect(startStripeIdentitySession).not.toHaveBeenCalled();
  });

  it('fixes forward to the Stripe identity namespace behavior', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: {
        sub: 'auth0|user-123',
        email: 'actor@example.com',
        name: 'Ada Lovelace',
        nickname: 'Ada',
      },
    } as never);
    vi.mocked(startStripeIdentitySession).mockResolvedValueOnce({
      provider: 'stripe',
      verificationId: 'vs_123',
      status: 'requires_input',
      clientSecret: 'vs_secret_123',
      url: 'https://verify.stripe.com/session/vs_123',
      expiresAt: '2026-04-16T12:00:00.000Z',
      message: 'Please complete the verification process using the provided URL or client secret',
      nextSteps: ['redirect-to-stripe'],
    });

    const request = new NextRequest('http://localhost:3000/api/verification/start', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(startStripeIdentitySession).toHaveBeenCalledWith({
      auth0UserId: 'auth0|user-123',
      email: 'actor@example.com',
      legalName: 'Ada Lovelace',
      professionalName: 'Ada',
    });
    expect(data).toEqual({
      success: true,
      provider: 'stripe',
      verificationId: 'vs_123',
      status: 'requires_input',
      clientSecret: 'vs_secret_123',
      url: 'https://verify.stripe.com/session/vs_123',
      expiresAt: '2026-04-16T12:00:00.000Z',
      message: 'Please complete the verification process using the provided URL or client secret',
      nextSteps: ['redirect-to-stripe'],
    });
  });
});
