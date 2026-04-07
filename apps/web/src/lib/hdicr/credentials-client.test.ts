import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('credentials-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_CREDENTIALS_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('fails closed at import time without remote base URL', async () => {
    await expect(import('@/lib/hdicr/credentials-client')).rejects.toThrow(/fail-closed/i);
  });

  it('listCredentialsByProfileId calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [] }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { listCredentialsByProfileId } = await import('@/lib/hdicr/credentials-client');

    await expect(
      listCredentialsByProfileId({
        userProfileId: 'profile-123',
        includeRevoked: false,
        includeExpired: false,
      })
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/credentials/list?userProfileId=profile-123&includeRevoked=false&includeExpired=false',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('revokeCredentialById calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        alreadyRevoked: false,
        hasStatusEntry: true,
        revokedAt: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { revokeCredentialById } = await import('@/lib/hdicr/credentials-client');

    await expect(revokeCredentialById('cred-123', 'rotation')).resolves.toMatchObject({
      found: true,
      hasStatusEntry: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/credentials/revoke',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
