import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/consent-proof', () => ({
  generateConsentProof: vi.fn(),
}));

vi.mock('@/lib/hdicr/consent-client', () => ({
  checkConsent: vi.fn(),
}));

import { checkConsent } from '@/lib/hdicr/consent-client';

describe('GET /api/consent/check - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require actorId and consentType parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/consent/check', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return isGranted false when no consent found', async () => {
    const mockCheckConsent = vi.mocked(checkConsent);
    mockCheckConsent.mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/consent/check?actorId=actor-123&consentType=voice_synthesis',
      { method: 'GET' }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('isGranted', false);
    expect(data).toHaveProperty('message');
  });

  it('should return valid response shape when consent is granted', async () => {
    const mockCheckConsent = vi.mocked(checkConsent);

    const consentRecord = {
      id: 'consent-123',
      actor_id: 'actor-123',
      action: 'granted',
      consent_type: 'voice_synthesis',
      consent_scope: { projectId: 'proj-123' },
      project_name: 'Test Project',
      created_at: new Date().toISOString(),
    };

    mockCheckConsent.mockResolvedValueOnce(consentRecord as any);

    const request = new NextRequest(
      'http://localhost:3000/api/consent/check?actorId=actor-123&consentType=voice_synthesis',
      { method: 'GET' }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('isGranted', true);
    expect(data).toHaveProperty('consent');
    expect(data.consent).toHaveProperty('consentId');
    expect(data.consent).toHaveProperty('actorId', 'actor-123');
    expect(data.consent).toHaveProperty('consentType', 'voice_synthesis');
  });

  it('should return isGranted false when consent is revoked', async () => {
    const mockCheckConsent = vi.mocked(checkConsent);

    const revokedRecord = {
      id: 'consent-123',
      actor_id: 'actor-123',
      action: 'revoked',
      consent_type: 'voice_synthesis',
      consent_scope: {},
      project_name: null,
      created_at: new Date().toISOString(),
    };

    mockCheckConsent.mockResolvedValueOnce(revokedRecord as any);

    const request = new NextRequest(
      'http://localhost:3000/api/consent/check?actorId=actor-123&consentType=voice_synthesis',
      { method: 'GET' }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('isGranted', false);
  });

  it('should support includeProof parameter', async () => {
    const mockCheckConsent = vi.mocked(checkConsent);

    const consentRecord = {
      id: 'consent-123',
      actor_id: 'actor-123',
      action: 'granted',
      consent_type: 'voice_synthesis',
      consent_scope: {},
      project_name: null,
      created_at: new Date().toISOString(),
    };

    mockCheckConsent.mockResolvedValueOnce(consentRecord as any);

    const request = new NextRequest(
      'http://localhost:3000/api/consent/check?actorId=actor-123&consentType=voice_synthesis&includeProof=false',
      { method: 'GET' }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('isGranted');
  });
});
