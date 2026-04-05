import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/lib/hdicr/consent-client', () => ({
  createConsentLedgerEntry: vi.fn(),
  resolveActorContextByAuth0UserId: vi.fn(),
}));

import { auth0 } from '@/lib/auth0';
import {
  createConsentLedgerEntry,
  resolveActorContextByAuth0UserId,
} from '@/lib/hdicr/consent-client';

describe('POST /api/consent-ledger/create - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require authentication', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    mockGetSession.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/consent-ledger/create', {
      method: 'POST',
      body: JSON.stringify({ policy: {} }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
  });

  it('should require actor role', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorContext = vi.mocked(resolveActorContextByAuth0UserId);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorContext.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/consent-ledger/create', {
      method: 'POST',
      body: JSON.stringify({ policy: {} }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toHaveProperty('error');
  });

  it('should validate policy schema', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorContext = vi.mocked(resolveActorContextByAuth0UserId);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorContext.mockResolvedValueOnce({
      actorId: 'actor-123',
      userProfileId: 'profile-123',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/consent-ledger/create', {
      method: 'POST',
      body: JSON.stringify({
        policy: {
          // Invalid: missing required fields
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Invalid request');
    expect(data).toHaveProperty('details');
  });

  it('should create consent ledger entry and return valid response shape', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorContext = vi.mocked(resolveActorContextByAuth0UserId);
    const mockCreateConsentLedgerEntry = vi.mocked(createConsentLedgerEntry);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorContext.mockResolvedValueOnce({
      actorId: 'actor-123',
      userProfileId: 'profile-123',
    } as any);

    const consentEntry = {
      id: 'ledger-entry-123',
      actor_id: 'actor-123',
      version: 1,
      policy: {
        mediaUsage: { film: 'allow' },
      },
      status: 'active',
      created_at: new Date().toISOString(),
    };

    mockCreateConsentLedgerEntry.mockResolvedValueOnce(consentEntry as any);

    const request = new NextRequest('http://localhost:3000/api/consent-ledger/create', {
      method: 'POST',
      body: JSON.stringify({
        policy: {
          mediaUsage: {
            film: 'allow',
            television: 'allow',
            streaming: 'allow',
            gaming: 'allow',
            voiceReplication: 'allow',
            virtualReality: 'allow',
            socialMedia: 'allow',
            advertising: 'allow',
            merchandise: 'allow',
            livePerformance: 'allow',
          },
          contentTypes: {
            explicit: 'deny',
            political: 'allow',
            religious: 'allow',
            violence: 'allow',
            alcohol: 'allow',
            tobacco: 'allow',
            gambling: 'allow',
            pharmaceutical: 'allow',
            firearms: 'allow',
            adultContent: 'deny',
          },
          territories: {
            allowed: ['US', 'UK'],
            denied: [],
          },
          aiControls: {
            trainingAllowed: false,
            syntheticGenerationAllowed: false,
            biometricAnalysisAllowed: false,
          },
          commercial: {
            paymentRequired: true,
            minFee: 500,
            revenueShare: 15,
          },
          attributionRequired: true,
        },
        reason: 'Initial consent setup',
      }),
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('entry');
    expect(data.entry).toHaveProperty('id', 'ledger-entry-123');
    expect(data.entry).toHaveProperty('version', 1);
    expect(data.entry).toHaveProperty('status', 'active');
    expect(data.entry).toHaveProperty('created_at');
  });

  it('should pass IP and User Agent to adapter', async () => {
    const mockGetSession = vi.mocked(auth0.getSession);
    const mockResolveActorContext = vi.mocked(resolveActorContextByAuth0UserId);
    const mockCreateConsentLedgerEntry = vi.mocked(createConsentLedgerEntry);

    mockGetSession.mockResolvedValueOnce({
      user: { sub: 'user-123' },
      idToken: 'token',
      accessToken: 'token',
    } as any);

    mockResolveActorContext.mockResolvedValueOnce({
      actorId: 'actor-123',
      userProfileId: 'profile-123',
    } as any);

    mockCreateConsentLedgerEntry.mockResolvedValueOnce({
      id: 'ledger-entry-123',
      actor_id: 'actor-123',
      version: 1,
      policy: {},
      status: 'active',
      created_at: new Date().toISOString(),
    } as any);

    const policy = {
      mediaUsage: {
        film: 'allow',
        television: 'allow',
        streaming: 'allow',
        gaming: 'allow',
        voiceReplication: 'allow',
        virtualReality: 'allow',
        socialMedia: 'allow',
        advertising: 'allow',
        merchandise: 'allow',
        livePerformance: 'allow',
      },
      contentTypes: {
        explicit: 'deny',
        political: 'allow',
        religious: 'allow',
        violence: 'allow',
        alcohol: 'allow',
        tobacco: 'allow',
        gambling: 'allow',
        pharmaceutical: 'allow',
        firearms: 'allow',
        adultContent: 'deny',
      },
      territories: { allowed: ['US'], denied: [] },
      aiControls: {
        trainingAllowed: false,
        syntheticGenerationAllowed: false,
        biometricAnalysisAllowed: false,
      },
      commercial: { paymentRequired: true },
      attributionRequired: true,
    };

    const request = new NextRequest('http://localhost:3000/api/consent-ledger/create', {
      method: 'POST',
      body: JSON.stringify({ policy }),
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    await POST(request);

    expect(mockCreateConsentLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-123',
        policy,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })
    );
  });
});
