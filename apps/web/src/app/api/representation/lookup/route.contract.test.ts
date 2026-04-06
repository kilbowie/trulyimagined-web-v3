import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
}));

vi.mock('@/lib/hdicr/representation-client', () => ({
  getAgentByRegistryId: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByRegistryId } from '@/lib/hdicr/representation-client';

describe('GET /api/representation/lookup - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/lookup?registryId=AGENT-001'
    );

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('requires Actor role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/lookup?registryId=AGENT-001'
    );

    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it('requires registryId query param', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);

    const request = new NextRequest('http://localhost:3000/api/representation/lookup');

    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when agent is not found', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getAgentByRegistryId).mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/lookup?registryId=AGENT-001'
    );

    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it('returns 409 when agent profile is incomplete', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getAgentByRegistryId).mockResolvedValueOnce({
      id: 'agent-123',
      registry_id: 'AGENT-001',
      profile_completed: false,
    } as any);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/lookup?registryId=AGENT-001'
    );

    const response = await GET(request);
    expect(response.status).toBe(409);
  });

  it('returns agent payload on success', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getAgentByRegistryId).mockResolvedValueOnce({
      id: 'agent-123',
      registry_id: 'AGENT-001',
      agency_name: 'Test Agency',
      profile_completed: true,
    } as any);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/lookup?registryId=AGENT-001'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('agent');
    expect(data.agent).toHaveProperty('id', 'agent-123');
  });
});
