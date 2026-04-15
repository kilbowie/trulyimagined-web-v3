import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('stripe-webhook-client - verify-confirmed behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifyStripeIdentityConfirmed delegates to identity-client verifyIdentityConfirmed', async () => {
    const verifyIdentityConfirmed = vi.fn().mockResolvedValue({ success: true });

    vi.doMock('@/lib/hdicr/identity-client', () => ({
      verifyIdentityConfirmed,
    }));

    const { verifyStripeIdentityConfirmed } = await import('@/lib/hdicr/stripe-webhook-client');

    await verifyStripeIdentityConfirmed({
      tiUserId: 'profile-123',
      verificationSessionId: 'vs_123',
      verifiedAt: '2026-04-15T12:00:00.000Z',
      assuranceLevel: 'high',
    });

    expect(verifyIdentityConfirmed).toHaveBeenCalledWith({
      tiUserId: 'profile-123',
      verificationSessionId: 'vs_123',
      verifiedAt: '2026-04-15T12:00:00.000Z',
      assuranceLevel: 'high',
    });
  });
});
