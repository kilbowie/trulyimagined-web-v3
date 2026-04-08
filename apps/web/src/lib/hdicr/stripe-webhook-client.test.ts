import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('stripe-webhook-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_PAYMENTS_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('looks up Stripe links through identity-client', async () => {
    const getIdentityLinkByProviderAndProviderUser = vi
      .fn()
      .mockResolvedValue({ id: 'link-123', user_profile_id: 'profile-123' });

    vi.doMock('@/lib/hdicr/identity-client', () => ({
      getIdentityLinkByProviderAndProviderUser,
      createIdentityLink: vi.fn(),
      reactivateIdentityLink: vi.fn(),
      unlinkIdentityById: vi.fn(),
    }));

    const { getStripeIdentityLinkBySessionId } = await import('@/lib/hdicr/stripe-webhook-client');

    const result = await getStripeIdentityLinkBySessionId('vs_123', 'profile-123');

    expect(getIdentityLinkByProviderAndProviderUser).toHaveBeenCalledWith(
      'profile-123',
      'stripe-identity',
      'vs_123'
    );
    expect(result).toHaveProperty('id', 'link-123');
  });

  it('createStripeIdentityLinkVerified delegates to identity-client create endpoint', async () => {
    const createIdentityLink = vi.fn().mockResolvedValue({ id: 'link-abc' });

    vi.doMock('@/lib/hdicr/identity-client', () => ({
      getIdentityLinkByProviderAndProviderUser: vi.fn(),
      createIdentityLink,
      reactivateIdentityLink: vi.fn(),
      unlinkIdentityById: vi.fn(),
    }));

    const { createStripeIdentityLinkVerified } = await import('@/lib/hdicr/stripe-webhook-client');

    const verifiedAt = new Date('2026-01-01T00:00:00.000Z');
    await createStripeIdentityLinkVerified({
      userProfileId: 'profile-123',
      sessionId: 'vs_123',
      verificationLevel: 'high',
      assuranceLevel: 'high',
      encryptedCredentialData: { encrypted: true },
      metadata: { source: 'test' },
      verifiedAt,
    });

    expect(createIdentityLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userProfileId: 'profile-123',
        provider: 'stripe-identity',
        providerUserId: 'vs_123',
        providerType: 'kyc',
        verificationLevel: 'high',
        assuranceLevel: 'high',
      })
    );
  });

  it('markStripeIdentityLinkCanceled requires successful identity-client unlink', async () => {
    const unlinkIdentityById = vi.fn().mockResolvedValue([{ id: 'link-123' }]);

    vi.doMock('@/lib/hdicr/identity-client', () => ({
      getIdentityLinkByProviderAndProviderUser: vi.fn(),
      createIdentityLink: vi.fn(),
      reactivateIdentityLink: vi.fn(),
      unlinkIdentityById,
    }));

    const { markStripeIdentityLinkCanceled } = await import('@/lib/hdicr/stripe-webhook-client');

    await markStripeIdentityLinkCanceled('link-123', { status: 'canceled' }, 'profile-123');

    expect(unlinkIdentityById).toHaveBeenCalledWith('link-123', 'profile-123');
  });
});
