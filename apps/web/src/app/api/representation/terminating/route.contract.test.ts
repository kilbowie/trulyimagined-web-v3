import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  getActorByAuth0UserId: vi.fn(),
  getAgentByAuth0UserId: vi.fn(),
}));

vi.mock('@/lib/representation-termination', () => ({
  listPendingTerminations: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getActorByAuth0UserId, getAgentByAuth0UserId } from '@/lib/hdicr/representation-client';
import { listPendingTerminations } from '@/lib/representation-termination';

describe('GET /api/representation/terminating - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('requires Actor or Agent role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Viewer']);

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('returns pending terminations for actor', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce(null);
    vi.mocked(listPendingTerminations).mockResolvedValueOnce([
      { id: 'term-1', relationship_id: 'rel-1' },
    ] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('total', 1);
    expect(Array.isArray(data.terminations)).toBe(true);
  });
});
