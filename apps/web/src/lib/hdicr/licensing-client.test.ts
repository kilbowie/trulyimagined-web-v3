import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('licensing-client - HDICR flag-awareness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_LICENSING_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('applyLicensingDecision calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ decision: { id: 'req-123', status: 'approved' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { applyLicensingDecision } = await import('@/lib/hdicr/licensing-client');

    const result = await applyLicensingDecision('req-123', 'actor-123', 'approve');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/licensing/decision',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toHaveProperty('status', 'approved');
  });

  it('fails closed at call time when remote base URL is missing', async () => {
    const { listActorLicensingRequests } = await import('@/lib/hdicr/licensing-client');

    await expect(listActorLicensingRequests('actor-123')).rejects.toThrow(
      /HDICR_API_URL is missing/i
    );
  });

  it('listActorLicensingRequests remains remote-only even with local mode env', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ requests: [], pendingCount: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { listActorLicensingRequests } = await import('@/lib/hdicr/licensing-client');

    await expect(listActorLicensingRequests('actor-123')).resolves.toEqual({
      requests: [],
      pendingCount: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/licensing/actor-requests?actorId=actor-123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
