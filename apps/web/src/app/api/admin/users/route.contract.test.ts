import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/hdicr/identity-client', () => ({
  listAdminUsers: vi.fn(),
}));

import { isAdmin } from '@/lib/auth';
import { listAdminUsers } from '@/lib/hdicr/identity-client';

describe('GET /api/admin/users - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires admin role', async () => {
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });

  it('returns admin user listing in the existing response shape', async () => {
    vi.mocked(isAdmin).mockResolvedValueOnce(true);
    vi.mocked(listAdminUsers).mockResolvedValueOnce({
      users: [
        {
          id: 'user-1',
          email: 'actor@example.com',
          role: 'Actor',
          actor_id: 'actor-1',
          verification_status: 'verified',
          registry_id: 'ACT-001',
        },
      ],
      total: 1,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      data: {
        users: [
          {
            id: 'user-1',
            email: 'actor@example.com',
            role: 'Actor',
            actor_id: 'actor-1',
            verification_status: 'verified',
            registry_id: 'ACT-001',
          },
        ],
        total: 1,
      },
    });
  });
});