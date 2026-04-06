import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
}));

vi.mock('@/lib/hdicr/representation-client', () => ({
  endRelationship: vi.fn(),
  getActorByAuth0UserId: vi.fn(),
  getAgentByAuth0UserId: vi.fn(),
  getRelationshipById: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  endRelationship,
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRelationshipById,
} from '@/lib/hdicr/representation-client';

describe('DELETE /api/representation/[id] - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    expect(response.status).toBe(401);
  });

  it('requires Actor or Agent role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Viewer']);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    expect(response.status).toBe(403);
  });

  it('returns 404 when relationship is not found', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce(null);
    vi.mocked(getRelationshipById).mockResolvedValueOnce(null);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    expect(response.status).toBe(404);
  });

  it('returns 409 when relationship is already ended', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce(null);
    vi.mocked(getRelationshipById).mockResolvedValueOnce({
      id: 'rel-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      ended_at: new Date().toISOString(),
    } as any);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    expect(response.status).toBe(409);
  });

  it('returns 403 when caller is not party to the relationship', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'other-actor' } as any);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce(null);
    vi.mocked(getRelationshipById).mockResolvedValueOnce({
      id: 'rel-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      ended_at: null,
    } as any);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    expect(response.status).toBe(403);
  });

  it('actor can end their own relationship and returns success shape', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce(null);
    vi.mocked(getRelationshipById).mockResolvedValueOnce({
      id: 'rel-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      ended_at: null,
    } as any);
    vi.mocked(endRelationship).mockResolvedValueOnce({
      id: 'rel-123',
      ended_at: new Date().toISOString(),
    } as any);

    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'rel-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('relationship');
    expect(endRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ relationshipId: 'rel-123', endedBy: 'actor' })
    );
  });
});
