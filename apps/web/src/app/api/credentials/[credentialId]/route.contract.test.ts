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

vi.mock('@/lib/verifiable-credentials', () => ({
  verifyCredential: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import {
  getCredentialById,
  getUserProfileByAuth0UserId,
  revokeCredentialById,
} from '@/lib/hdicr/credentials-client';
import { verifyCredential } from '@/lib/verifiable-credentials';
import { DELETE, GET } from './route';

const credentialId = 'be43b97f-a35b-45f3-a2c8-9871f7ff36a2';

describe('GET/DELETE /api/credentials/[credentialId] contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null as never);

    const response = await GET(
      new Request(`http://localhost/api/credentials/${credentialId}`) as never,
      {
        params: Promise.resolve({ credentialId }),
      }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('GET returns credential payload with metadata and verification', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|owner' } } as never);
    vi.mocked(getUserProfileByAuth0UserId).mockResolvedValue({
      id: 'profile-owner',
      role: 'Actor',
    } as never);
    vi.mocked(getCredentialById).mockResolvedValue({
      id: credentialId,
      user_profile_id: 'profile-owner',
      credential_type: 'IdentityCredential',
      credential_json: {
        id: 'urn:uuid:credential-1',
        type: ['VerifiableCredential', 'IdentityCredential'],
      },
      issuer_did: 'did:web:trulyimagined.com',
      holder_did: 'did:web:trulyimagined.com:users:profile-owner',
      issued_at: '2026-01-01T00:00:00.000Z',
      expires_at: null,
      is_revoked: false,
      revoked_at: null,
      revocation_reason: null,
      verification_method: 'did:web:trulyimagined.com#key-1',
      proof_type: 'Ed25519Signature2020',
    } as never);
    vi.mocked(verifyCredential).mockResolvedValue({ verified: true } as never);

    const response = await GET(
      new Request(`http://localhost/api/credentials/${credentialId}?verify=true`) as never,
      {
        params: Promise.resolve({ credentialId }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      credential: {
        id: 'urn:uuid:credential-1',
      },
      metadata: {
        id: credentialId,
        credentialType: 'IdentityCredential',
        isRevoked: false,
      },
      verification: {
        verified: true,
      },
    });
  });

  it('DELETE enforces owner/admin and returns revocation contract', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|owner' } } as never);
    vi.mocked(getUserProfileByAuth0UserId).mockResolvedValue({
      id: 'profile-owner',
      role: 'Actor',
    } as never);
    vi.mocked(getCredentialById).mockResolvedValue({
      user_profile_id: 'profile-owner',
    } as never);
    vi.mocked(revokeCredentialById).mockResolvedValue({
      found: true,
      alreadyRevoked: false,
      hasStatusEntry: true,
      revokedAt: '2026-04-06T00:00:00.000Z',
    } as never);

    const response = await DELETE(
      new Request(`http://localhost/api/credentials/${credentialId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Compromised identity data' }),
      }) as never,
      {
        params: Promise.resolve({ credentialId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      credentialId,
      message: 'Credential revoked successfully',
      revokedAt: '2026-04-06T00:00:00.000Z',
    });
  });
});
