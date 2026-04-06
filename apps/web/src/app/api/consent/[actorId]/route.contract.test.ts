import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/consent-client', () => ({
  listConsentRecords: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { listConsentRecords } from '@/lib/hdicr/consent-client';

describe('GET /api/consent/[actorId] - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require authentication', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/consent/actor-123', {
      method: 'GET',
    });

    const response = await GET(request, {
      params: Promise.resolve({ actorId: 'actor-123' }),
    } as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
  });

  it('should return empty consent list when no consents exist', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockListConsentRecords = vi.mocked(listConsentRecords);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockListConsentRecords.mockResolvedValueOnce({
      rows: [],
      totalCount: 0,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/actor-123', {
      method: 'GET',
    });

    const response = await GET(request, {
      params: Promise.resolve({ actorId: 'actor-123' }),
    } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('actorId', 'actor-123');
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('consents');
    expect(data).toHaveProperty('pagination');
  });

  it('should return valid response shape with consents grouped by status', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockListConsentRecords = vi.mocked(listConsentRecords);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    const consentRecords = [
      {
        id: 'consent-123',
        actor_id: 'actor-123',
        action: 'granted',
        consent_type: 'voice_synthesis',
        consent_scope: { projectId: 'proj-1' },
        project_name: 'Project 1',
        project_description: 'Test',
        created_at: new Date().toISOString(),
      },
    ];

    mockListConsentRecords.mockResolvedValueOnce({
      rows: consentRecords,
      totalCount: 1,
    } as any);

    const request = new NextRequest(
      'http://localhost:3000/api/consent/actor-123?limit=50&offset=0',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ actorId: 'actor-123' }),
    } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('actorId', 'actor-123');
    expect(data.summary).toHaveProperty('active');
    expect(data.summary).toHaveProperty('revoked');
    expect(data.consents).toHaveProperty('active');
    expect(data.consents).toHaveProperty('revoked');
    expect(data.pagination).toHaveProperty('limit', 50);
    expect(data.pagination).toHaveProperty('offset', 0);
    expect(data.pagination).toHaveProperty('total', 1);
  });

  it('should support action filter parameter', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockListConsentRecords = vi.mocked(listConsentRecords);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockListConsentRecords.mockResolvedValueOnce({
      rows: [],
      totalCount: 0,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent/actor-123?action=granted', {
      method: 'GET',
    });

    const response = await GET(request, {
      params: Promise.resolve({ actorId: 'actor-123' }),
    } as any);

    expect(response.status).toBe(200);
    expect(mockListConsentRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-123',
        action: 'granted',
      })
    );
  });
});
