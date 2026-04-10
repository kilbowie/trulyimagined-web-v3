import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('usage-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_USAGE_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('actorExistsById calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ exists: true }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { actorExistsById } = await import('@/lib/hdicr/usage-client');

    const result = await actorExistsById('actor-123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/usage/actor/exists?actorId=actor-123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toBe(true);
  });

  it('fails closed at call time when remote base URL is missing', async () => {
    const { actorExistsById } = await import('@/lib/hdicr/usage-client');

    await expect(actorExistsById('actor-123')).rejects.toThrow('fail-closed');
  });

  it('getGlobalUsageStats remains remote-only even with local mode env', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ stats: [], recentActivity: [], topActors: [], totals: null }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { getGlobalUsageStats } = await import('@/lib/hdicr/usage-client');

    await expect(getGlobalUsageStats()).resolves.toEqual({
      stats: [],
      recentActivity: [],
      topActors: [],
      totals: null,
    });
  });
});
