import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/credentials-client', () => ({
  getUserProfileByAuth0UserId: vi.fn(),
  listCredentialsByProfileId: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import {
  getUserProfileByAuth0UserId,
  listCredentialsByProfileId,
} from '@/lib/hdicr/credentials-client';
import { GET } from './route';

describe('GET /api/credentials/list contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null as never);

    const response = await GET(new Request('http://localhost/api/credentials/list') as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('returns credentials and metadata shape', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|abc' } } as never);
    vi.mocked(getUserProfileByAuth0UserId).mockResolvedValue({
      id: 'profile-1',
      role: 'Actor',
    } as never);
    vi.mocked(listCredentialsByProfileId).mockResolvedValue([
      {
        id: 'cred-1',
        credential_type: 'IdentityCredential',
        credential_json: { id: 'urn:uuid:test-credential', type: ['VerifiableCredential'] },
        issuer_did: 'did:web:trulyimagined.com',
        holder_did: 'did:web:trulyimagined.com:users:profile-1',
        issued_at: '2026-01-01T00:00:00.000Z',
        expires_at: null,
        is_revoked: false,
        revoked_at: null,
        revocation_reason: null,
        verification_method: 'did:web:trulyimagined.com#key-1',
        proof_type: 'Ed25519Signature2020',
      },
    ] as never);

    const response = await GET(
      new Request(
        'http://localhost/api/credentials/list?includeRevoked=true&includeExpired=true'
      ) as never
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      count: 1,
    });

    expect(body.credentials[0]).toMatchObject({
      credential: {
        id: 'urn:uuid:test-credential',
      },
      metadata: {
        id: 'cred-1',
        credentialType: 'IdentityCredential',
        isRevoked: false,
      },
    });
  });
});
