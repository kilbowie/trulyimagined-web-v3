import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('billing-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_BILLING_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('getBillingProfileByAuth0UserId calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ profile: { id: 'profile-123' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { getBillingProfileByAuth0UserId } = await import('@/lib/hdicr/billing-client');

    const result = await getBillingProfileByAuth0UserId('auth0|123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/billing/profile?auth0UserId=auth0%7C123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toHaveProperty('id', 'profile-123');
  });

  it('fails closed at import when remote base URL is missing', async () => {
    await expect(import('@/lib/hdicr/billing-client')).rejects.toThrow('fail-closed');
  });

  it('ignores local mode env and still calls remote endpoint', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ profile: null }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { getBillingProfileByAuth0UserId } = await import('@/lib/hdicr/billing-client');

    await expect(getBillingProfileByAuth0UserId('auth0|123')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
