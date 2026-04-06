import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
}));

vi.mock('@/lib/hdicr/representation-client', () => ({
  createRepresentationRequest: vi.fn(),
  getActiveRepresentationForActor: vi.fn(),
  getActorByAuth0UserId: vi.fn(),
  getAgentByRegistryId: vi.fn(),
  hasPendingRequest: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  createRepresentationRequest,
  getActiveRepresentationForActor,
  getActorByAuth0UserId,
  getAgentByRegistryId,
  hasPendingRequest,
} from '@/lib/hdicr/representation-client';

describe('POST /api/representation/request - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/representation/request', {
      method: 'POST',
      body: JSON.stringify({ agentRegistryId: 'AGENT-001' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('requires Actor role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);

    const request = new NextRequest('http://localhost:3000/api/representation/request', {
      method: 'POST',
      body: JSON.stringify({ agentRegistryId: 'AGENT-001' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 404 when actor profile is missing', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/representation/request', {
      method: 'POST',
      body: JSON.stringify({ agentRegistryId: 'AGENT-001' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('creates request and returns success shape', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getActiveRepresentationForActor).mockResolvedValueOnce(null);
    vi.mocked(getAgentByRegistryId).mockResolvedValueOnce({
      id: 'agent-123',
      agency_name: 'Test Agency',
      profile_completed: true,
    } as any);
    vi.mocked(hasPendingRequest).mockResolvedValueOnce(false);
    vi.mocked(createRepresentationRequest).mockResolvedValueOnce({
      id: 'req-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      status: 'pending',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/request', {
      method: 'POST',
      body: JSON.stringify({ agentRegistryId: 'AGENT-001', message: 'Please represent me' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('request');
    expect(data.request).toHaveProperty('id', 'req-123');
    expect(data).toHaveProperty('message');
    expect(createRepresentationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-123',
        agentId: 'agent-123',
      })
    );
  });
});
