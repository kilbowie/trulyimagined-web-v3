import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/representation-termination', () => ({
  applyDueRepresentationTerminations: vi.fn(),
}));

import { applyDueRepresentationTerminations } from '@/lib/representation-termination';

describe('GET /api/representation/terminate/sweep - Contract Test', () => {
  const originalSecret = process.env.REPRESENTATION_TERMINATION_CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REPRESENTATION_TERMINATION_CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.REPRESENTATION_TERMINATION_CRON_SECRET = originalSecret;
  });

  it('returns 401 when unauthorized', async () => {
    const request = new NextRequest('http://localhost:3000/api/representation/terminate/sweep');

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('accepts Vercel cron header auth', async () => {
    vi.mocked(applyDueRepresentationTerminations).mockResolvedValueOnce({
      scanned: 0,
      completed: 0,
      failed: 0,
      retriesAttempted: 0,
      retriesRecovered: 0,
      failureRate: 0,
      durationMs: 12,
      failures: [],
      warning: {
        triggered: false,
        failureRateThreshold: 0.2,
        failureCountThreshold: 3,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/representation/terminate/sweep', {
      headers: {
        'x-vercel-cron': '1',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('authMode', 'vercel-cron-header');
    expect(data).toHaveProperty('durationMs', 12);
    expect(data).toHaveProperty('warning.triggered', false);
  });

  it('accepts secret query auth', async () => {
    vi.mocked(applyDueRepresentationTerminations).mockResolvedValueOnce({
      scanned: 1,
      completed: 1,
      failed: 0,
      retriesAttempted: 1,
      retriesRecovered: 1,
      failureRate: 0,
      durationMs: 5,
      failures: [],
      warning: {
        triggered: false,
        failureRateThreshold: 0.2,
        failureCountThreshold: 3,
      },
    } as any);

    const request = new NextRequest(
      'http://localhost:3000/api/representation/terminate/sweep?secret=test-secret'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('completed', 1);
    expect(data).toHaveProperty('authMode', 'shared-secret');
    expect(data).toHaveProperty('retriesRecovered', 1);
  });
});
