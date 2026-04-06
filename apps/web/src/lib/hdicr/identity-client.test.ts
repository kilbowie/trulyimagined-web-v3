import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('identity-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('createActorRegistration uses local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'actor-123',
          registry_id: 'REG-123',
          first_name: 'Ada',
          last_name: 'Lovelace',
        },
      ],
    });

    vi.doMock('@/lib/db', () => ({ query: mockQuery }));
    vi.doMock('@/lib/identity-resolution', () => ({ resolveIdentity: vi.fn() }));
    vi.doMock('@/lib/registry-id', () => ({
      createUniqueRegistryId: vi.fn().mockResolvedValue('REG-123'),
      ensureActorRegistryId: vi.fn().mockResolvedValue('REG-123'),
    }));
    vi.doMock('@trulyimagined/utils', () => ({ encryptJSON: vi.fn((value) => value) }));

    const { createActorRegistration } = await import('@/lib/hdicr/identity-client');

    const result = await createActorRegistration({
      auth0UserId: 'auth0|123',
      email: 'actor@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 'actor-123');
  });

  it('createActorRegistration fails closed in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/identity-resolution', () => ({ resolveIdentity: vi.fn() }));
    vi.doMock('@/lib/registry-id', () => ({
      createUniqueRegistryId: vi.fn(),
      ensureActorRegistryId: vi.fn(),
    }));
    vi.doMock('@trulyimagined/utils', () => ({ encryptJSON: vi.fn((value) => value) }));

    const { createActorRegistration } = await import('@/lib/hdicr/identity-client');

    await expect(
      createActorRegistration({
        auth0UserId: 'auth0|123',
        email: 'actor@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
    ).rejects.toThrow('fail-closed');
  });

  it('domain override enforces remote mode over global local', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_IDENTITY_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/identity-resolution', () => ({ resolveIdentity: vi.fn() }));
    vi.doMock('@/lib/registry-id', () => ({
      createUniqueRegistryId: vi.fn(),
      ensureActorRegistryId: vi.fn(),
    }));
    vi.doMock('@trulyimagined/utils', () => ({ encryptJSON: vi.fn((value) => value) }));

    const { actorExistsByAuth0UserId } = await import('@/lib/hdicr/identity-client');

    await expect(actorExistsByAuth0UserId('auth0|123')).rejects.toThrow('fail-closed');
  });
});
