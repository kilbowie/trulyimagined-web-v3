import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_shared', () => ({
  getConnectActorContext: vi.fn(),
  updateActorConnectStatus: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  createConnectExpressAccount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  queryTi: vi.fn(),
}));

import { queryTi } from '@/lib/db';
import { createConnectExpressAccount } from '@/lib/stripe';
import { getConnectActorContext } from '../_shared';
import { POST } from './route';

describe('POST /api/stripe/connect/create - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the expected response shape when creating a new Connect account', async () => {
    vi.mocked(getConnectActorContext).mockResolvedValueOnce({
      ok: true,
      context: {
        auth0UserId: 'auth0|actor-123',
        userProfileId: 'profile-123',
        email: 'actor@example.com',
        role: 'Actor',
        actorId: 'actor-123',
        stripeAccountId: null,
      },
    } as never);
    vi.mocked(createConnectExpressAccount).mockResolvedValueOnce({ id: 'acct_123' } as never);
    vi.mocked(queryTi).mockResolvedValueOnce({ rowCount: 1, rows: [] } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createConnectExpressAccount).toHaveBeenCalledWith({
      email: 'actor@example.com',
      metadata: {
        actor_id: 'actor-123',
        user_profile_id: 'profile-123',
        auth0_user_id: 'auth0|actor-123',
        role: 'Actor',
      },
    });
    expect(data).toEqual({
      success: true,
      accountId: 'acct_123',
      onboardingComplete: false,
      created: true,
    });
  });
});
