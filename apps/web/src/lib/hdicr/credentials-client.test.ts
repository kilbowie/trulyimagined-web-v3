import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('@/lib/status-list-manager', () => ({
  getStatusListCredential: vi.fn(),
  updateCredentialStatus: vi.fn(),
  allocateStatusIndex: vi.fn(),
}));

vi.mock('@trulyimagined/utils', () => ({
  encryptJSON: vi.fn((value) => value),
}));

import { pool } from '@/lib/db';
import {
  createCredentialPlaceholderRecord,
  finalizeIssuedCredentialRecord,
  listCredentialsByProfileId,
  revokeCredentialById,
} from './credentials-client';

describe('credentials adapter fail-closed remote writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_CREDENTIALS_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fails closed for revoke write when remote mode has no base url', async () => {
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';

    await expect(revokeCredentialById('cred-123')).rejects.toThrow(/fail-closed/i);
  });

  it('fails closed for create placeholder write when remote mode has no base url', async () => {
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';

    await expect(
      createCredentialPlaceholderRecord({
        userProfileId: 'profile-123',
        credentialType: 'VerifiableIdentityCredential',
        holderDid: 'did:web:example.com',
      })
    ).rejects.toThrow(/fail-closed/i);
  });

  it('fails closed for finalize write when remote mode has no base url', async () => {
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';

    await expect(
      finalizeIssuedCredentialRecord({
        credentialDbId: 'cred-db-123',
        credential: { id: 'vc-123', validUntil: null },
      })
    ).rejects.toThrow(/fail-closed/i);
  });

  it('fails closed when remote revoke responds with non-2xx', async () => {
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(revokeCredentialById('cred-123')).rejects.toThrow(/failed with status 500/i);
  });

  it('keeps read path fallback behavior in remote mode', async () => {
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const result = await listCredentialsByProfileId({
      userProfileId: 'profile-123',
      includeRevoked: false,
      includeExpired: false,
    });

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalled();
  });
});
