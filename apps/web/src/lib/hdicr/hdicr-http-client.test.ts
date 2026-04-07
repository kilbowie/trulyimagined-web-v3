import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('hdicr-http-client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.HDICR_REMOTE_BASE_URL;
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    delete process.env.HDICR_CLIENT_ID;
    delete process.env.HDICR_CLIENT_SECRET;
    delete process.env.HDICR_TEST_M2M_TOKEN;
    vi.restoreAllMocks();
  });

  it('attaches bearer token and uses 30s-safe cache window', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    process.env.AUTH0_DOMAIN = 'tenant.example.com';
    process.env.AUTH0_AUDIENCE = 'https://api.trulyimagined.com';
    process.env.HDICR_CLIENT_ID = 'client-id';
    process.env.HDICR_CLIENT_SECRET = 'client-secret';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-abc', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } = await import(
      '@/lib/hdicr/hdicr-http-client'
    );

    const baseUrl = getHdicrRemoteBaseUrlOrThrow('identity', 'client-initialization');

    await invokeHdicrRemote({
      domain: 'identity',
      baseUrl,
      path: '/v1/identity',
      method: 'GET',
      operation: 'identity-list',
    });

    await invokeHdicrRemote({
      domain: 'identity',
      baseUrl,
      path: '/v1/identity',
      method: 'GET',
      operation: 'identity-list-2',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://hdicr.example.com/v1/identity',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://hdicr.example.com/v1/identity',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
      })
    );
  });

  it('returns 503-class error when token acquisition configuration is missing', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';

    const { invokeHdicrRemote, isHdicrHttpError } = await import('@/lib/hdicr/hdicr-http-client');

    await expect(
      invokeHdicrRemote({
        domain: 'identity',
        baseUrl: 'https://hdicr.example.com',
        path: '/v1/identity',
        method: 'GET',
        operation: 'identity-list',
      })
    ).rejects.toSatisfy(
      (error: unknown) =>
        isHdicrHttpError(error) && error.statusCode === 503 && /token/i.test(error.message)
    );
  });
});
