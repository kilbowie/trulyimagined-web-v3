import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockHeaders, mockConstructEvent, mockQueryTi } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockQueryTi: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
  mapConnectAccountStatus: vi.fn(() => ({
    accountId: 'acct_123',
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    onboardingComplete: true,
    requirementsDue: [],
    disabledReason: null,
  })),
  mapStripeStatusToVerificationLevel: vi.fn(() => ({
    verification_level: 'high',
    assurance_level: 'high',
    gpg45_confidence: 'high',
    eidas_level: 'high',
  })),
  getVerifiedIdentityData: vi.fn(async () => ({ verified: true })),
}));

vi.mock('@/lib/db', () => ({
  queryTi: mockQueryTi,
}));

vi.mock('@/lib/hdicr/stripe-webhook-client', () => ({
  createStripeIdentityLinkRequiresInput: vi.fn(),
  createStripeIdentityLinkVerified: vi.fn(),
  getStripeIdentityLinkBySessionId: vi.fn(),
  markStripeIdentityLinkCanceled: vi.fn(),
  updateStripeIdentityLinkRequiresInput: vi.fn(),
  updateStripeIdentityLinkVerified: vi.fn(),
}));

vi.mock('@trulyimagined/utils', () => ({
  encryptJSON: vi.fn((value: unknown) => value),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

import { POST } from './route';

describe('POST /api/webhooks/stripe - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHeaders.mockResolvedValue({
      get: vi.fn((name: string) => (name === 'stripe-signature' ? 'sig_test' : null)),
    });

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY = 'price_actor_professional_monthly_test';
  });

  it('acknowledges already-processed replay events without reprocessing', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_replay_1',
      type: 'identity.verification_session.verified',
      data: {
        object: {
          id: 'vs_replay_1',
          metadata: { user_profile_id: 'profile-1' },
        },
      },
    });

    mockQueryTi.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO stripe_events')) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes('SELECT processed')) {
        return { rowCount: 1, rows: [{ processed: true }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_replay_1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('received', true);
    expect(data).toHaveProperty('replayed', true);
    expect(mockQueryTi).not.toHaveBeenCalledWith(expect.stringContaining('SET processed = TRUE'));
  });

  it('records fresh events and marks them processed after handling', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_new_1',
      type: 'customer.created',
      data: {
        object: {
          id: 'cus_123',
        },
      },
    });

    mockQueryTi.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO stripe_events')) {
        return { rowCount: 1, rows: [{ id: 'stripe-row-1' }] };
      }

      if (sql.includes('UPDATE stripe_events') && sql.includes('SET processed = TRUE')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_new_1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('received', true);
    expect(mockQueryTi).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO stripe_events'),
      expect.any(Array)
    );
    expect(mockQueryTi).toHaveBeenCalledWith(
      expect.stringContaining('SET processed = TRUE'),
      expect.any(Array)
    );
  });

  it('routes connected-account events by event.account and acknowledges them separately', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_connect_1',
      type: 'account.updated',
      account: 'acct_123',
      data: {
        object: {
          id: 'acct_123',
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: {
            currently_due: [],
            disabled_reason: null,
          },
        },
      },
    });

    mockQueryTi.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO stripe_events')) {
        return { rowCount: 1, rows: [{ id: 'stripe-row-2' }] };
      }

      if (sql.includes('UPDATE actors') && sql.includes('stripe_account_status')) {
        return { rowCount: 1, rows: [{ id: 'actor-123', user_profile_id: 'profile-123' }] };
      }

      if (sql.includes('UPDATE stripe_events') && sql.includes('SET processed = TRUE')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_connect_1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ received: true, connect: true });
    expect(mockQueryTi).toHaveBeenCalledWith(expect.stringContaining('UPDATE actors'), [
      'acct_123',
      'active',
      true,
    ]);
  });

  it('acknowledges subscription.created events and persists subscription state in deferred handling', async () => {
    const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(((
      callback: (...args: unknown[]) => unknown,
      ...args: unknown[]
    ) => {
      void callback(...args);
      return 0 as unknown as NodeJS.Immediate;
    }) as typeof setImmediate);

    mockConstructEvent.mockReturnValue({
      id: 'evt_sub_created_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_end: 1_776_400_000,
          metadata: {
            user_profile_id: '11111111-1111-1111-1111-111111111111',
            seat_count: '2',
          },
          items: {
            data: [
              {
                price: {
                  id: 'price_actor_professional_monthly_test',
                  recurring: { interval: 'month' },
                },
                quantity: 2,
              },
            ],
          },
        },
      },
    });

    mockQueryTi.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO stripe_events')) {
        return { rowCount: 1, rows: [{ id: 'stripe-row-sub-1' }] };
      }

      if (sql.includes('INSERT INTO user_subscriptions')) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes('SELECT EXISTS')) {
        return { rowCount: 1, rows: [{ has_entitlement: true }] };
      }

      if (sql.includes('UPDATE user_profiles')) {
        return { rowCount: 1, rows: [{ id: '11111111-1111-1111-1111-111111111111' }] };
      }

      if (sql.includes('INSERT INTO audit_log')) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes('UPDATE stripe_events') && sql.includes('SET processed = TRUE')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_sub_created_1' }),
    });

    const response = await POST(request);
    const data = await response.json();
    await Promise.resolve();
    await Promise.resolve();
    setImmediateSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(data).toEqual({ received: true });
    expect(mockQueryTi).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_subscriptions'),
      expect.any(Array)
    );
  });

  it('treats payment_intent.succeeded as idempotent when the deal is already settled', async () => {
    const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(((
      callback: (...args: unknown[]) => unknown,
      ...args: unknown[]
    ) => {
      void callback(...args);
      return 0 as unknown as NodeJS.Immediate;
    }) as typeof setImmediate);

    mockConstructEvent.mockReturnValue({
      id: 'evt_pi_succeeded_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 10_000,
          currency: 'gbp',
        },
      },
    });

    mockQueryTi.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO stripe_events')) {
        return { rowCount: 1, rows: [{ id: 'stripe-row-pi-1' }] };
      }

      if (sql.includes('UPDATE deals') && sql.includes('stripe_payment_intent_id')) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes('UPDATE stripe_events') && sql.includes('SET processed = TRUE')) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes('INSERT INTO audit_log')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_pi_succeeded_1' }),
    });

    const response = await POST(request);
    const data = await response.json();
    await Promise.resolve();
    await Promise.resolve();
    setImmediateSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(data).toEqual({ received: true });
    expect(mockQueryTi).toHaveBeenCalledWith(expect.stringContaining('UPDATE deals'), ['pi_123']);
    expect(mockQueryTi).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.any(Array)
    );
  });
});
