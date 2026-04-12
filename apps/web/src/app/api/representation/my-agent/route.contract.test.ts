import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
}));

vi.mock('@/lib/hdicr/representation-client', () => ({
  getActiveRepresentationForActor: vi.fn(),
  getActorByAuth0UserId: vi.fn(),
}));

vi.mock('@/lib/representation-termination', () => ({
  getPendingTerminationByRelationshipId: vi.fn().mockResolvedValue(null),
}));

import { GET } from './route';

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  getActiveRepresentationForActor,
  getActorByAuth0UserId,
} from '@/lib/hdicr/representation-client';

describe('GET /api/representation/my-agent - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('requires Actor role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('returns null representation when actor profile is missing', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('representation', null);
  });

  it('returns active representation when found', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getActiveRepresentationForActor).mockResolvedValueOnce({
      id: 'rel-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      agency_name: 'Test Agency',
    } as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('representation');
    expect(data.representation).toHaveProperty('id', 'rel-123');
    expect(getActiveRepresentationForActor).toHaveBeenCalledWith('actor-123');
  });
});
