import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserRoles: vi.fn(),
  getAgentTeamMembership: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/hdicr/identity-client', () => ({
  getActorById: vi.fn(),
}));

vi.mock('@/lib/hdicr/consent-client', () => ({
  getCurrentConsentLedger: vi.fn(),
}));

vi.mock('@/lib/representation', () => ({
  getAgentByAuth0Id: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import { getAgentTeamMembership, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getCurrentConsentLedger } from '@/lib/hdicr/consent-client';
import { getActorById } from '@/lib/hdicr/identity-client';
import { getAgentByAuth0Id } from '@/lib/representation';

describe('GET /api/agent/roster - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('rejects users without roster permissions', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Assistant']);
    vi.mocked(getAgentTeamMembership).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it('returns roster shape with actor and consent data resolved through HDICR clients', async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce({ user: { sub: 'agent-user-123' } } as any);
    vi.mocked(getUserRoles).mockResolvedValueOnce(['Agent']);
    vi.mocked(getAgentByAuth0Id).mockResolvedValueOnce({ id: 'agent-123' } as any);
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          relationship_id: 'rel-123',
          actor_id: 'actor-123',
          started_at: '2026-04-01T10:00:00.000Z',
        },
      ],
    } as any);
    vi.mocked(getActorById).mockResolvedValueOnce({
      id: 'actor-123',
      registry_id: 'ACT-001',
      stage_name: 'Ada Stage',
      first_name: 'Ada',
      last_name: 'Lovelace',
      verification_status: 'verified',
      profile_image_url: 'https://example.com/ada.jpg',
      location: 'London',
    } as any);
    vi.mocked(getCurrentConsentLedger).mockResolvedValueOnce({
      current: {
        version: 3,
        policy: {
          usageBlocked: true,
        },
      },
      history: [],
      licensesOnCurrentVersion: 0,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM actor_agent_relationships'),
      ['agent-123']
    );
    expect(getActorById).toHaveBeenCalledWith('actor-123');
    expect(getCurrentConsentLedger).toHaveBeenCalledWith('actor-123', false);
    expect(data).toEqual({
      roster: [
        {
          relationship_id: 'rel-123',
          started_at: '2026-04-01T10:00:00.000Z',
          id: 'actor-123',
          registry_id: 'ACT-001',
          stage_name: 'Ada Stage',
          first_name: 'Ada',
          last_name: 'Lovelace',
          verification_status: 'verified',
          profile_image_url: 'https://example.com/ada.jpg',
          location: 'London',
          consent_version: 3,
          consent_policy: {
            usageBlocked: true,
          },
          consent_usage_blocked: true,
        },
      ],
      total: 1,
    });
  });
});