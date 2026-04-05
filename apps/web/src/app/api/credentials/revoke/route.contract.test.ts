import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/credentials-client', () => ({
  getCredentialById: vi.fn(),
  getUserProfileByAuth0UserId: vi.fn(),
  revokeCredentialById: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import {
  getCredentialById,
  getUserProfileByAuth0UserId,
  revokeCredentialById,
} from '@/lib/hdicr/credentials-client';
import { POST } from './route';

describe('POST /api/credentials/revoke contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when user is not owner/admin', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|viewer' } } as never);
    vi.mocked(getUserProfileByAuth0UserId).mockResolvedValue({ id: 'profile-viewer', role: 'Actor' } as never);
    vi.mocked(getCredentialById).mockResolvedValue({
      user_profile_id: 'profile-owner',
      is_revoked: false,
    } as never);

    const request = new Request('http://localhost/api/credentials/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: 'be43b97f-a35b-45f3-a2c8-9871f7ff36a2' }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Forbidden: You do not have permission to revoke this credential',
    });
  });

  it('returns revoke success contract for owner', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|owner' } } as never);
    vi.mocked(getUserProfileByAuth0UserId).mockResolvedValue({ id: 'profile-owner', role: 'Actor' } as never);
    vi.mocked(getCredentialById).mockResolvedValue({
      user_profile_id: 'profile-owner',
      is_revoked: false,
    } as never);
    vi.mocked(revokeCredentialById).mockResolvedValue({
      found: true,
      alreadyRevoked: false,
      hasStatusEntry: true,
      revokedAt: '2026-04-06T00:00:00.000Z',
      ownerUserProfileId: 'profile-owner',
    } as never);

    const request = new Request('http://localhost/api/credentials/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: 'be43b97f-a35b-45f3-a2c8-9871f7ff36a2',
        reason: 'Security incident',
      }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      credentialId: 'be43b97f-a35b-45f3-a2c8-9871f7ff36a2',
      legacy: false,
      reason: 'Security incident',
    });
  });
});
