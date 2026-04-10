import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('identity-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('createActorRegistration calls remote identity endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'actor-123' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { createActorRegistration } = await import('@/lib/hdicr/identity-client');

    const result = await createActorRegistration({
      auth0UserId: 'auth0|123',
      email: 'actor@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/identity/register',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toHaveProperty('id', 'actor-123');
  });

  it('fails closed at call time when remote base URL is missing', async () => {
    const { actorExistsByAuth0UserId } = await import('@/lib/hdicr/identity-client');

    await expect(actorExistsByAuth0UserId('auth0|123')).rejects.toThrow('fail-closed');
  });

  it('actorExistsByAuth0UserId remains remote-only even with local mode env', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ exists: true }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { actorExistsByAuth0UserId } = await import('@/lib/hdicr/identity-client');

    await expect(actorExistsByAuth0UserId('auth0|123')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/identity/actors/exists?auth0UserId=auth0%7C123',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('listAdminUsers calls remote identity endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ users: [{ id: 'user-1', role: 'Actor' }], total: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { listAdminUsers } = await import('@/lib/hdicr/identity-client');

    await expect(listAdminUsers()).resolves.toEqual({
      users: [{ id: 'user-1', role: 'Actor' }],
      total: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/identity/admin/users',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
