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

vi.mock('@/lib/representation', () => ({
  getAgentByAuth0Id: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/manual-verification', () => ({
  writeAuditLog: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByAuth0Id } from '@/lib/representation';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/manual-verification';

describe('POST /api/agent/codes/generate - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/agent/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ batchSize: 1 }),
    });

    const response = (await POST(request))!;
    expect(response.status).toBe(401);
  });

  it('requires Agent role', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Actor']);

    const request = new NextRequest('http://localhost:3000/api/agent/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ batchSize: 1 }),
    });

    const response = (await POST(request))!;
    expect(response.status).toBe(403);
  });

  it('generates requested number of codes', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0Id).mockResolvedValueOnce({
      id: 'agent-123',
      tenant_id: 'tenant-1',
    } as any);

    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: 'code-1', code: 'ABCD1234', expires_at: new Date().toISOString() }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ id: 'code-2', code: 'EFGH5678', expires_at: new Date().toISOString() }],
      } as any);

    const request = new NextRequest('http://localhost:3000/api/agent/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ batchSize: 2 }),
    });

    const response = (await POST(request))!;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data.data).toHaveProperty('generated', 2);
    expect(Array.isArray(data.data.codes)).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent.invitation_codes.generated',
        userType: 'agent',
      })
    );
  });
});
