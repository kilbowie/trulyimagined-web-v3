import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/credentials-client', () => ({
  allocateRevocationStatusForCredential: vi.fn(),
  createCredentialPlaceholderRecord: vi.fn(),
  finalizeIssuedCredentialRecord: vi.fn(),
  getIssuanceProfileByAuth0UserId: vi.fn(),
  listActiveIdentityLinksByUserProfileId: vi.fn(),
}));

vi.mock('@/lib/verifiable-credentials', async () => {
  const { z } = await import('zod');
  return {
    issueCredential: vi.fn(),
    getCredentialTypeForUser: vi.fn(() => 'IdentityCredential'),
    CredentialTypeSchema: z.string().min(1),
  };
});

import { auth0 } from '@/lib/auth0';
import {
  allocateRevocationStatusForCredential,
  createCredentialPlaceholderRecord,
  finalizeIssuedCredentialRecord,
  getIssuanceProfileByAuth0UserId,
  listActiveIdentityLinksByUserProfileId,
} from '@/lib/hdicr/credentials-client';
import { issueCredential } from '@/lib/verifiable-credentials';
import { POST } from './route';

describe('POST /api/credentials/issue contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null as never);

    const request = new Request('http://localhost/api/credentials/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialType: 'IdentityCredential' }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('returns issued credential contract fields', async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: 'auth0|issuer' } } as never);
    vi.mocked(getIssuanceProfileByAuth0UserId).mockResolvedValue({
      id: 'profile-issuer',
      email: 'issuer@example.com',
      username: 'issuer',
      legal_name: 'Issuer Name',
      professional_name: 'Issuer Pro',
      role: 'Actor',
      profile_completed: true,
      is_verified: true,
      actor_id: null,
      actor_verification_status: null,
      actor_verified_at: null,
    } as never);
    vi.mocked(listActiveIdentityLinksByUserProfileId).mockResolvedValue([
      {
        provider: 'IAM Verification',
        verification_level: 'high',
        assurance_level: 'high',
        verified_at: '2026-01-01T00:00:00.000Z',
        is_active: true,
      },
    ] as never);
    vi.mocked(createCredentialPlaceholderRecord).mockResolvedValue('credential-db-1' as never);
    vi.mocked(allocateRevocationStatusForCredential).mockResolvedValue({
      id: 'status-entry-1',
      type: 'BitstringStatusListEntry',
    } as never);
    vi.mocked(issueCredential).mockResolvedValue({
      id: 'urn:uuid:credential-1',
      type: ['VerifiableCredential', 'IdentityCredential'],
      validUntil: '2027-01-01T00:00:00.000Z',
    } as never);
    vi.mocked(finalizeIssuedCredentialRecord).mockResolvedValue(undefined as never);

    const request = new Request('http://localhost/api/credentials/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialType: 'IdentityCredential', expiresInDays: 365 }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      credentialId: 'credential-db-1',
      downloadUrl: '/api/credentials/credential-db-1',
      message: 'Verifiable Credential issued successfully (with revocation status)',
    });

    expect(body.credential).toMatchObject({
      id: 'urn:uuid:credential-1',
    });
  });
});
