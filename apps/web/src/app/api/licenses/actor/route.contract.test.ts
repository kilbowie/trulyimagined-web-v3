import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/licensing-client', () => ({
  getActorLicensesAndStats: vi.fn(),
  resolveActorIdByAuth0UserId: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import {
  getActorLicensesAndStats,
  resolveActorIdByAuth0UserId,
} from '@/lib/hdicr/licensing-client';

describe('GET /api/licenses/actor - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require authentication', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/licenses/actor');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
  });

  it('should return empty licenses when actor not found', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorId = vi.mocked(resolveActorIdByAuth0UserId);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorId.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/licenses/actor');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('licenses');
    expect(Array.isArray(data.licenses)).toBe(true);
    expect(data.licenses).toHaveLength(0);
    expect(data.stats).toEqual({
      total: 0,
      active: 0,
      revoked: 0,
      expired: 0,
      suspended: 0,
    });
  });

  it('should return valid response shape with licenses', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorId = vi.mocked(resolveActorIdByAuth0UserId);
    const mockGetLicenses = vi.mocked(getActorLicensesAndStats);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorId.mockResolvedValueOnce('actor-123');

    mockGetLicenses.mockResolvedValueOnce({
      licenses: [
        {
          id: 'license-1',
          actor_id: 'actor-123',
          title: 'Film License',
          status: 'active',
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          mediaUsage: ['film'],
          territories: ['US', 'UK'],
        },
      ],
      stats: {
        total: 1,
        active: 1,
        revoked: 0,
        expired: 0,
        suspended: 0,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/licenses/actor');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('licenses');
    expect(Array.isArray(data.licenses)).toBe(true);
    expect(data.licenses).toHaveLength(1);
    expect(data.licenses[0]).toHaveProperty('id', 'license-1');
    expect(data.licenses[0]).toHaveProperty('status', 'active');
    expect(data).toHaveProperty('stats');
    expect(data.stats).toHaveProperty('total', 1);
    expect(data.stats).toHaveProperty('active', 1);
    expect(data).toHaveProperty('actorId', 'actor-123');
  });

  it('should support status filter parameter', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorId = vi.mocked(resolveActorIdByAuth0UserId);
    const mockGetLicenses = vi.mocked(getActorLicensesAndStats);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorId.mockResolvedValueOnce('actor-123');

    mockGetLicenses.mockResolvedValueOnce({
      licenses: [],
      stats: {
        total: 1,
        active: 0,
        revoked: 1,
        expired: 0,
        suspended: 0,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/licenses/actor?status=revoked');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetLicenses).toHaveBeenCalledWith('actor-123', 'revoked');
    expect(data.stats).toHaveProperty('revoked', 1);
  });

  it('should return correct stats aggregation', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorId = vi.mocked(resolveActorIdByAuth0UserId);
    const mockGetLicenses = vi.mocked(getActorLicensesAndStats);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorId.mockResolvedValueOnce('actor-123');

    mockGetLicenses.mockResolvedValueOnce({
      licenses: [
        {
          id: 'license-1',
          actor_id: 'actor-123',
          title: 'Film License',
          status: 'active',
        },
        {
          id: 'license-2',
          actor_id: 'actor-123',
          title: 'TV License',
          status: 'expired',
        },
        {
          id: 'license-3',
          actor_id: 'actor-123',
          title: 'Streaming License',
          status: 'suspended',
        },
      ],
      stats: {
        total: 3,
        active: 1,
        revoked: 0,
        expired: 1,
        suspended: 1,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/licenses/actor');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stats.total).toBe(3);
    expect(data.stats.active).toBe(1);
    expect(data.stats.expired).toBe(1);
    expect(data.stats.suspended).toBe(1);
  });
});
