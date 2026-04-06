import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from './route';

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
  actorHasActiveRelationship: vi.fn(),
  createActorAgentRelationship: vi.fn(),
  getActorByAuth0UserId: vi.fn(),
  getAgentByAuth0UserId: vi.fn(),
  getRepresentationRequestById: vi.fn(),
  updateRepresentationRequest: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getAgentTeamMembership, getUserRoles } from '@/lib/auth';
import {
  actorHasActiveRelationship,
  createActorAgentRelationship,
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRepresentationRequestById,
  updateRepresentationRequest,
} from '@/lib/hdicr/representation-client';

describe('PUT /api/representation/requests/[id] - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/representation/requests/req-123', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'req-123' }) });
    expect(response.status).toBe(401);
  });

  it('validates action input', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce({
      id: 'agent-123',
      profile_completed: true,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/requests/req-123', {
      method: 'PUT',
      body: JSON.stringify({ action: 'invalid' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'req-123' }) });
    expect(response.status).toBe(400);
  });

  it('rejects approve if actor already has active relationship', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce({
      id: 'agent-123',
      profile_completed: true,
    } as any);
    vi.mocked(getRepresentationRequestById).mockResolvedValueOnce({
      id: 'req-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      status: 'pending',
    } as any);
    vi.mocked(actorHasActiveRelationship).mockResolvedValueOnce(true);

    const request = new NextRequest('http://localhost:3000/api/representation/requests/req-123', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'req-123' }) });
    expect(response.status).toBe(409);
  });

  it('approves request and creates relationship', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0UserId).mockResolvedValueOnce({
      id: 'agent-123',
      profile_completed: true,
    } as any);
    vi.mocked(getRepresentationRequestById).mockResolvedValueOnce({
      id: 'req-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      status: 'pending',
    } as any);
    vi.mocked(actorHasActiveRelationship).mockResolvedValueOnce(false);
    vi.mocked(updateRepresentationRequest).mockResolvedValueOnce({
      id: 'req-123',
      status: 'approved',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/requests/req-123', {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve', responseNote: 'Approved' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'req-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data.request).toHaveProperty('status', 'approved');
    expect(createActorAgentRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-123',
        agentId: 'agent-123',
        representationRequestId: 'req-123',
      })
    );
  });

  it('supports actor withdrawing own request', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'actor-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(getAgentTeamMembership).mockResolvedValueOnce(null as any);
    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({ id: 'actor-123' } as any);
    vi.mocked(getRepresentationRequestById).mockResolvedValueOnce({
      id: 'req-123',
      actor_id: 'actor-123',
      agent_id: 'agent-123',
      status: 'pending',
    } as any);
    vi.mocked(updateRepresentationRequest).mockResolvedValueOnce({
      id: 'req-123',
      status: 'withdrawn',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/requests/req-123', {
      method: 'PUT',
      body: JSON.stringify({ action: 'withdraw' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'req-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data.request).toHaveProperty('status', 'withdrawn');
  });
});
