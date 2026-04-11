import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  queryTi: vi.fn(),
}));

vi.mock('@/lib/hdicr/client-helpers', () => ({
  getActorByAuth0UserId: vi.fn(),
  checkActiveConsent: vi.fn(),
  checkManualVerificationRequest: vi.fn(),
}));

import { GET } from './route';
import { auth0 } from '@/lib/auth0';
import { queryTi } from '@/lib/db';
import {
  getActorByAuth0UserId,
  checkActiveConsent,
  checkManualVerificationRequest,
} from '@/lib/hdicr/client-helpers';

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

    vi.mocked(queryTi).mockResolvedValueOnce({
      rows: [{ id: 'profile-1', role: 'Actor', profile_completed: true }],
    } as any);

    vi.mocked(getActorByAuth0UserId).mockResolvedValueOnce({
      id: 'actor-1',
      auth0UserId: 'auth0|actor-1',
      email: 'actor@example.com',
      firstName: 'Test',
      lastName: 'Actor',
      registryId: 'reg-1',
      verificationStatus: 'pending',
      createdAt: '2024-01-01T00:00:00Z',
    } as any);

    vi.mocked(checkActiveConsent).mockResolvedValueOnce(false);
    vi.mocked(checkManualVerificationRequest).mockResolvedValueOnce(true);

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
