import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('consent-client - HDICR flag-awareness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_CONSENT_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('grantConsent calls local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'consent-123' }] });
    vi.doMock('@/lib/db', () => ({ query: mockQuery }));
    vi.doMock('@/lib/consent-ledger', () => ({
      createConsentEntry: vi.fn(),
      getConsentHistory: vi.fn(),
      getLatestConsent: vi.fn(),
    }));

    const { grantConsent } = await import('@/lib/hdicr/consent-client');

    const result = await grantConsent({
      actorId: 'actor-123',
      consentType: 'voice_synthesis',
      requesterId: 'req-1',
      requesterType: 'agent',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 'consent-123');
  });

  it('grantConsent throws in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/consent-ledger', () => ({
      createConsentEntry: vi.fn(),
      getConsentHistory: vi.fn(),
      getLatestConsent: vi.fn(),
    }));

    const { grantConsent } = await import('@/lib/hdicr/consent-client');

    await expect(
      grantConsent({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        requesterId: 'req-1',
        requesterType: 'agent',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      })
    ).rejects.toThrow('fail-closed');
  });

  it('revokeConsent throws in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/consent-ledger', () => ({
      createConsentEntry: vi.fn(),
      getConsentHistory: vi.fn(),
      getLatestConsent: vi.fn(),
    }));

    const { revokeConsent } = await import('@/lib/hdicr/consent-client');

    await expect(
      revokeConsent({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      })
    ).rejects.toThrow('fail-closed');
  });

  it('domain-level override takes precedence over global mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_CONSENT_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/consent-ledger', () => ({
      createConsentEntry: vi.fn(),
      getConsentHistory: vi.fn(),
      getLatestConsent: vi.fn(),
    }));

    const { grantConsent } = await import('@/lib/hdicr/consent-client');

    await expect(
      grantConsent({
        actorId: 'actor-123',
        consentType: 'voice_synthesis',
        requesterId: 'req-1',
        requesterType: 'agent',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      })
    ).rejects.toThrow('fail-closed');
  });
});
