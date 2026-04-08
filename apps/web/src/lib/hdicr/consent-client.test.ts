import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('consent-client - HDICR flag-awareness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_CONSENT_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
    vi.restoreAllMocks();
  });

  it('grantConsent calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'consent-123' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { grantConsent } = await import('@/lib/hdicr/consent-client');

    const result = await grantConsent({
      actorId: 'actor-123',
      consentType: 'voice_synthesis',
      requesterId: 'req-1',
      requesterType: 'agent',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/consent/grant',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toHaveProperty('id', 'consent-123');
  });

  it('fails closed at import time when remote base URL is missing', async () => {
    await expect(import('@/lib/hdicr/consent-client')).rejects.toThrow('fail-closed');
  });

  it('revokeConsent calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ notFound: false, record: { id: 'consent-123' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { revokeConsent } = await import('@/lib/hdicr/consent-client');

    await expect(
      revokeConsent({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      })
    ).resolves.toEqual({ notFound: false, record: { id: 'consent-123' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/consent/revoke',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('checkConsent remains remote-only even with local mode env', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ consent: { id: 'consent-123' } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { checkConsent } = await import('@/lib/hdicr/consent-client');

    await expect(
      checkConsent({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
      })
    ).resolves.toEqual({ id: 'consent-123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/consent/check?actorId=actor-123&consentType=voice_synthesis',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('checkConsentEnforcement calls remote endpoint', async () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ httpStatus: 200, decision: 'allow' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { checkConsentEnforcement } = await import('@/lib/hdicr/consent-client');

    await expect(
      checkConsentEnforcement({
        actorId: 'a2e2ed95-219f-4bc3-8ef4-197061d4d6e6',
        requestedUsage: 'film_tv',
        apiClientId: '47ed5b2e-0f46-4825-bcfe-c03c69559ebf',
      })
    ).resolves.toEqual({ httpStatus: 200, decision: 'allow' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hdicr.example.com/v1/consent/enforcement/check',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
