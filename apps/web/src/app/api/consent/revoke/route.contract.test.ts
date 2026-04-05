import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/consent-client', () => ({
  revokeConsent: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { revokeConsent } from '@/lib/hdicr/consent-client';

describe('POST /api/consent/revoke - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require authentication', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentId: 'consent-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
  });

  it('should validate required actorId', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({
        // missing actorId
        consentId: 'consent-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should validate identifier (consentId, consentType, or projectId required)', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        // missing consentId, consentType, projectId
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should revoke consent and return valid response shape', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockRevokeConsent = vi.mocked(revokeConsent);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const revocationRecord = {
      id: 'revoke-123',
      actor_id: 'actor-123',
      action: 'revoked',
      consent_type: 'voice_synthesis',
      created_at: new Date().toISOString(),
    };

    mockRevokeConsent.mockResolvedValueOnce({
      notFound: false,
      record: revocationRecord,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentId: 'consent-123',
        reason: 'Project cancelled',
      }),
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('revocation');
    expect(data.revocation).toHaveProperty('revocationId');
    expect(data.revocation).toHaveProperty('actorId', 'actor-123');
    expect(data.revocation).toHaveProperty('action', 'revoked');
    expect(data.revocation).toHaveProperty('revokedAt');
  });

  it('should return 404 when consent not found', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockRevokeConsent = vi.mocked(revokeConsent);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockRevokeConsent.mockResolvedValueOnce({
      notFound: true,
      record: null,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentId: 'nonexistent-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty('error');
  });
});
