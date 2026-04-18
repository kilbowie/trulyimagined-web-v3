import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock Auth0
vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

// Mock consent-client
vi.mock('@/lib/hdicr/consent-client', () => ({
  grantConsent: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { grantConsent } from '@/lib/hdicr/consent-client';

describe('POST /api/consent/grant - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require authentication', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/consent/grant', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Unauthorized');
  });

  it('should validate required fields', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce({
      user: {
        sub: 'user-123',
        'https://trulyimagined.com/role': 'actor',
      },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/grant', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        // missing consentType
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should grant consent and return valid response shape', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockGrantConsent = vi.mocked(grantConsent);

    mockGetSession.mockResolvedValueOnce({
      user: {
        sub: 'user-123',
        'https://trulyimagined.com/role': 'actor',
      },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const consentRecord = {
      id: 'consent-123',
      actor_id: 'actor-123',
      action: 'granted',
      consent_type: 'voice_synthesis',
      consent_scope: { projectName: 'Test Project' },
      project_name: 'Test Project',
      project_description: 'A test project',
      created_at: new Date().toISOString(),
    };

    mockGrantConsent.mockResolvedValueOnce(consentRecord as any);

    const request = new NextRequest('http://localhost:3000/api/consent/grant', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        scope: {
          projectName: 'Test Project',
          projectDescription: 'A test project',
        },
      }),
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('consent');

    // Validate consent response shape
    expect(data.consent).toHaveProperty('consentId');
    expect(data.consent).toHaveProperty('actorId', 'actor-123');
    expect(data.consent).toHaveProperty('action', 'granted');
    expect(data.consent).toHaveProperty('consentType', 'voice_synthesis');
    expect(data.consent).toHaveProperty('grantedAt');
  });

  it('should pass request metadata to adapter', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockGrantConsent = vi.mocked(grantConsent);

    mockGetSession.mockResolvedValueOnce({
      user: {
        sub: 'user-123',
        'https://trulyimagined.com/role': 'actor',
      },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockGrantConsent.mockResolvedValueOnce({
      id: 'consent-123',
      actor_id: 'actor-123',
      action: 'granted',
      consent_type: 'voice_synthesis',
      consent_scope: {},
      project_name: 'Test Project',
      project_description: null,
      created_at: new Date().toISOString(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/grant', {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
      }),
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    await POST(request);

    expect(mockGrantConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        requesterId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      }),
      undefined
    );
  });
});
