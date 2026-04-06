import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('billing-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_BILLING_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('getBillingProfileByAuth0UserId uses local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({
      rows: [{ id: 'profile-123', role: 'Actor', email: 'actor@example.com', username: 'actor' }],
    });
    vi.doMock('@/lib/db', () => ({ query: mockQuery }));

    const { getBillingProfileByAuth0UserId } = await import('@/lib/hdicr/billing-client');

    const result = await getBillingProfileByAuth0UserId('auth0|123');
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 'profile-123');
  });

  it('getBillingProfileByAuth0UserId fails closed in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { getBillingProfileByAuth0UserId } = await import('@/lib/hdicr/billing-client');

    await expect(getBillingProfileByAuth0UserId('auth0|123')).rejects.toThrow('fail-closed');
  });

  it('domain override enforces remote mode over global local', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_BILLING_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { getBillingProfileByAuth0UserId } = await import('@/lib/hdicr/billing-client');

    await expect(getBillingProfileByAuth0UserId('auth0|123')).rejects.toThrow('fail-closed');
  });
});
