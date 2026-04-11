import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('hdicr-http-client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.HDICR_REAL_TOKEN_IN_TEST = 'true';
  });

  afterEach(() => {
    delete process.env.HDICR_REMOTE_BASE_URL;
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    delete process.env.HDICR_M2M_AUDIENCE;
    delete process.env.TI_M2M_CLIENT_ID;
    delete process.env.TI_M2M_CLIENT_SECRET;
    delete process.env.HDICR_CLIENT_ID;
    delete process.env.HDICR_CLIENT_SECRET;
    delete process.env.HDICR_TEST_M2M_TOKEN;
    delete process.env.HDICR_REAL_TOKEN_IN_TEST;
    vi.restoreAllMocks();
  });

  it('attaches bearer token and uses 5m-safe cache window', async () => {
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
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
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

    const { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } =
      await import('@/lib/hdicr/hdicr-http-client');

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

  it('returns 503-class error when remote fetch fails at transport layer', async () => {
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
      .mockRejectedValueOnce(new TypeError('fetch failed'));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

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
        isHdicrHttpError(error) && error.statusCode === 503 && /network error/i.test(error.message)
    );
  });

  it('uses separate audience tokens for identity/consent versus licensing domains', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    process.env.AUTH0_DOMAIN = 'tenant.example.com';
    process.env.AUTH0_AUDIENCE = 'https://api.trulyimagined.com';
    process.env.HDICR_M2M_AUDIENCE = 'https://hdicr.trulyimagined.com';
    process.env.HDICR_CLIENT_ID = 'client-id';
    process.env.HDICR_CLIENT_SECRET = 'client-secret';
    process.env.TI_M2M_CLIENT_ID = 'ti-client-id';
    process.env.TI_M2M_CLIENT_SECRET = 'ti-client-secret';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-hdicr', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-ti', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { invokeHdicrRemote } = await import('@/lib/hdicr/hdicr-http-client');

    await invokeHdicrRemote({
      domain: 'identity',
      baseUrl: 'https://hdicr.example.com',
      path: '/v1/identity',
      method: 'GET',
      operation: 'identity-list',
    });

    await invokeHdicrRemote({
      domain: 'licensing',
      baseUrl: 'https://hdicr.example.com',
      path: '/v1/license/list',
      method: 'GET',
      operation: 'licensing-list',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://hdicr.example.com/v1/identity',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-hdicr' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://hdicr.example.com/v1/license/list',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-ti' }),
      })
    );

    const firstTokenBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const secondTokenBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);

    expect(firstTokenBody.audience).toBe('https://hdicr.trulyimagined.com');
    expect(firstTokenBody.client_id).toBe('client-id');
    expect(secondTokenBody.audience).toBe('https://api.trulyimagined.com');
    expect(secondTokenBody.client_id).toBe('ti-client-id');
  });
});
