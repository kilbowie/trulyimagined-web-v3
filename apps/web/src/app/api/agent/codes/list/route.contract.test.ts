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

vi.mock('@/lib/representation', () => ({
  getAgentByAuth0Id: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByAuth0Id } from '@/lib/representation';
import { query } from '@/lib/db';

describe('GET /api/agent/codes/list - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);
    const response = (await GET())!;
    expect(response.status).toBe(401);
  });

  it('returns code list with derived statuses', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0Id).mockResolvedValueOnce({ id: 'agent-123' } as any);

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: 'code-1',
          code: 'ABCD1234',
          created_at: futureDate,
          expires_at: futureDate,
          used_by_actor_id: null,
          redeemed_at: null,
        },
        {
          id: 'code-2',
          code: 'WXYZ5678',
          created_at: pastDate,
          expires_at: pastDate,
          used_by_actor_id: null,
          redeemed_at: null,
        },
      ],
    } as any);

    const response = (await GET())!;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data.data).toHaveProperty('total', 2);
    expect(data.data.codes[0]).toHaveProperty('status');
    expect(data.data.codes[1]).toHaveProperty('status');
  });
});
