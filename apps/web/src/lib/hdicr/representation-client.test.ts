import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('representation-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_REPRESENTATION_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('getActorByAuth0UserId calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ actor: { id: 'actor-123' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { getActorByAuth0UserId } = await import('@/lib/hdicr/representation-client');

    await expect(getActorByAuth0UserId('auth0|abc')).resolves.toEqual({ id: 'actor-123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/representation/actor?auth0UserId=auth0%7Cabc',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fails closed at call time when remote base URL is missing', async () => {
    const { getActorByAuth0UserId } = await import('@/lib/hdicr/representation-client');

    await expect(getActorByAuth0UserId('auth0|abc')).rejects.toThrow(/HDICR_API_URL is missing/i);
  });

  it('createRepresentationRequest remains remote-only even with local mode env', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ request: { id: 'req-123', status: 'pending' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { createRepresentationRequest } = await import('@/lib/hdicr/representation-client');

    await expect(
      createRepresentationRequest({
        actorId: 'actor-123',
        agentId: 'agent-123',
        message: 'Need representation',
      })
    ).resolves.toEqual({ id: 'req-123', status: 'pending' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/representation/request',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
