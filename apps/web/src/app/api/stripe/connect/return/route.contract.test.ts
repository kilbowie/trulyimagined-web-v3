import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../_shared', () => ({
  updateActorConnectStatus: vi.fn(),
}));

import { updateActorConnectStatus } from '../_shared';
import { GET } from './route';

describe('GET /api/stripe/connect/return - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.AUTH0_BASE_URL;
  });

  it('returns 400 when query string does not include an account id', async () => {
    const request = new NextRequest('http://localhost:3000/api/stripe/connect/return', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing Stripe account id');
  });

  it('redirects to dashboard with connect status and account id', async () => {
    process.env.AUTH0_BASE_URL = 'https://app.trulyimagined.com';
    vi.mocked(updateActorConnectStatus).mockResolvedValueOnce({
      onboardingComplete: true,
    } as never);

    const request = new NextRequest(
      'http://localhost:3000/api/stripe/connect/return?account=acct_123',
      {
        method: 'GET',
      }
    );

    const response = await GET(request);
    const location = response.headers.get('location');

    expect(response.status).toBe(307);
    expect(location).toBe(
      'https://app.trulyimagined.com/dashboard/verify-identity?connect_status=complete&account_id=acct_123'
    );
    expect(updateActorConnectStatus).toHaveBeenCalledWith('acct_123');
  });
});