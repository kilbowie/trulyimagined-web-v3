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

vi.mock('@/lib/representation-termination', () => ({
  getTerminationNotificationContext: vi.fn(),
  scheduleRepresentationTermination: vi.fn(),
  TerminationHttpError: class extends Error {
    status: number;
    payload: Record<string, unknown>;

    constructor(status: number, payload: Record<string, unknown>) {
      super(String(payload.error || 'Termination failed'));
      this.status = status;
      this.payload = payload;
    }
  },
}));

vi.mock('@/lib/email', () => ({
  sendRepresentationTerminationNoticeEmail: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  scheduleRepresentationTermination,
  TerminationHttpError,
} from '@/lib/representation-termination';

describe('POST /api/representation/terminate - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/representation/terminate', {
      method: 'POST',
      body: JSON.stringify({ relationshipId: 'rel-123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('requires relationshipId', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/terminate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('creates termination notice', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(scheduleRepresentationTermination).mockResolvedValueOnce({
      alreadyPending: false,
      termination: {
        id: 'term-123',
        relationship_id: 'rel-123',
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/terminate', {
      method: 'POST',
      body: JSON.stringify({ relationshipId: 'rel-123', reason: 'Contract complete' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('termination');
    expect(scheduleRepresentationTermination).toHaveBeenCalledWith(
      expect.objectContaining({
        relationshipId: 'rel-123',
        initiatedByAuth0UserId: 'user-123',
      })
    );
  });

  it('propagates termination http errors', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);
    vi.mocked(scheduleRepresentationTermination).mockRejectedValueOnce(
      new TerminationHttpError(409, { error: 'Already pending' })
    );

    const request = new NextRequest('http://localhost:3000/api/representation/terminate', {
      method: 'POST',
      body: JSON.stringify({ relationshipId: 'rel-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toHaveProperty('error', 'Already pending');
  });
});
