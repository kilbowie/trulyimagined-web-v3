import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('POST /api/stripe/identity/session - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null as never);

    const response = await POST({} as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(startStripeIdentitySession).not.toHaveBeenCalled();
  });

  it('returns 404 when the TI user profile cannot be resolved', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: {
        sub: 'auth0|user-123',
        email: 'actor@example.com',
        name: 'Ada Lovelace',
        nickname: 'Ada',
      },
    } as never);
    vi.mocked(startStripeIdentitySession).mockResolvedValueOnce(null);

    const response = await POST({} as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'User profile not found' });
  });

  it('returns the existing Stripe verification session response shape', async () => {
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

    const response = await POST({} as never);
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