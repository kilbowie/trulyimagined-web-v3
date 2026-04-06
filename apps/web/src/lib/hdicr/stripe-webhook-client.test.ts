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

  it('getStripeIdentityLinkBySessionId uses local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'link-123' }] });
    vi.doMock('@/lib/db', () => ({ query: mockQuery }));

    const { getStripeIdentityLinkBySessionId } = await import('@/lib/hdicr/stripe-webhook-client');

    const result = await getStripeIdentityLinkBySessionId('vs_123');

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 'link-123');
  });

  it('createStripeIdentityLinkVerified fails closed in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { createStripeIdentityLinkVerified } = await import('@/lib/hdicr/stripe-webhook-client');

    await expect(
      createStripeIdentityLinkVerified({
        userProfileId: 'profile-123',
        sessionId: 'vs_123',
        verificationLevel: 'high',
        assuranceLevel: 'high',
        encryptedCredentialData: { encrypted: true },
        metadata: { source: 'test' },
        verifiedAt: new Date(),
      })
    ).rejects.toThrow('fail-closed');
  });

  it('domain override enforces remote mode over global local', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_PAYMENTS_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { markStripeIdentityLinkCanceled } = await import('@/lib/hdicr/stripe-webhook-client');

    await expect(
      markStripeIdentityLinkCanceled('link-123', { status: 'canceled' })
    ).rejects.toThrow('fail-closed');
  });
});
