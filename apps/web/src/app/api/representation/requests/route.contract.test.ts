import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
  getAgentTeamMembership: vi.fn(),
}));

vi.mock('@/lib/hdicr/representation-client', () => ({
  getActorByAuth0UserId: vi.fn(),
  getAgentByAuth0UserId: vi.fn(),
  listIncomingRequests: vi.fn(),
  listOutgoingRequests: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getAgentTeamMembership, getUserRoles } from '@/lib/auth';
import {
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  listIncomingRequests,
  listOutgoingRequests,
} from '@/lib/hdicr/representation-client';

describe('GET /api/representation/requests - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns agent incoming requests when user has Agent role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce({ id: 'agent-123' } as any);
    vi.mocked(listIncomingRequests).mockResolvedValueOnce([
      { id: 'req-1', status: 'pending' },
    ] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('perspective', 'agent');
    expect(Array.isArray(data.requests)).toBe(true);
    expect(data.requests[0]).toHaveProperty('id', 'req-1');
  });

  it('returns actor outgoing requests when user has Actor role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getAgentTeamMembership).mockResolvedValueOnce(null as any);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(listOutgoingRequests).mockResolvedValueOnce([
      { id: 'req-2', status: 'pending' },
    ] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('perspective', 'actor');
    expect(Array.isArray(data.requests)).toBe(true);
    expect(data.requests[0]).toHaveProperty('id', 'req-2');
  });

  it('returns 403 for users with insufficient permissions', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Viewer']);
    vi.mocked(getAgentTeamMembership).mockResolvedValueOnce(null as any);

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
