import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_shared', () => ({
  getConnectActorContext: vi.fn(),
  updateActorConnectStatus: vi.fn(),
}));

import { getConnectActorContext, updateActorConnectStatus } from '../_shared';
import { GET } from './route';

describe('GET /api/stripe/connect/status - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns disconnected shape when actor has no connected account', async () => {
    vi.mocked(getConnectActorContext).mockResolvedValueOnce({
      ok: true,
      context: {
        stripeAccountId: null,
      },
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      connected: false,
      onboardingComplete: false,
    });
    expect(updateActorConnectStatus).not.toHaveBeenCalled();
  });

  it('returns connected status shape when account exists', async () => {
    vi.mocked(getConnectActorContext).mockResolvedValueOnce({
      ok: true,
      context: {
        stripeAccountId: 'acct_123',
      },
    } as never);
    vi.mocked(updateActorConnectStatus).mockResolvedValueOnce({
      onboardingComplete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDue: [],
      disabledReason: null,
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      connected: true,
      accountId: 'acct_123',
      onboardingComplete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDue: [],
      disabledReason: null,
    });
  });
});
