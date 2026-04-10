import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  queryHdicr: vi.fn(),
}));

import { GET } from './route';
import { auth0 } from '@/lib/auth0';
import { queryHdicr } from '@/lib/db';

describe('GET /api/onboarding/status - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns onboarding status shape for actor', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({
      user: { sub: 'auth0|actor-1' },
    } as any);

    const mockQuery = vi.mocked(queryHdicr);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'profile-1', role: 'Actor', profile_completed: true }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ id: 'actor-1', registry_id: 'reg-1', verification_status: 'pending' }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ has_active_consent: false }] } as any)
      .mockResolvedValueOnce({ rows: [{ has_manual_verification_request: true }] } as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('currentStep');
    expect(data.data.steps).toHaveLength(5);
    expect(data.data.currentStep).toBe('consent');
    expect(data.data.canProfileGoLive).toBe(false);
  });
});
