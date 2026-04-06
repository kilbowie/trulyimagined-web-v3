import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('licensing-client - HDICR flag-awareness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_LICENSING_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('applyLicensingDecision calls local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'req-123', status: 'approved' }] });
    vi.doMock('@/lib/db', () => ({ query: mockQuery }));
    vi.doMock('@/lib/licensing', () => ({
      getActorLicenses: vi.fn(),
      getLicenseStats: vi.fn(),
    }));

    const { applyLicensingDecision } = await import('@/lib/hdicr/licensing-client');

    const result = await applyLicensingDecision('req-123', 'actor-123', 'approve');

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toHaveProperty('status', 'approved');
  });

  it('applyLicensingDecision throws in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/licensing', () => ({
      getActorLicenses: vi.fn(),
      getLicenseStats: vi.fn(),
    }));

    const { applyLicensingDecision } = await import('@/lib/hdicr/licensing-client');

    await expect(applyLicensingDecision('req-123', 'actor-123', 'approve')).rejects.toThrow(
      'fail-closed'
    );
  });

  it('domain-level override takes precedence over global mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_LICENSING_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/licensing', () => ({
      getActorLicenses: vi.fn(),
      getLicenseStats: vi.fn(),
    }));

    const { applyLicensingDecision } = await import('@/lib/hdicr/licensing-client');

    await expect(
      applyLicensingDecision('req-123', 'actor-123', 'reject', 'Not accepted')
    ).rejects.toThrow('fail-closed');
  });

  it('listActorLicensingRequests throws in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/licensing', () => ({
      getActorLicenses: vi.fn(),
      getLicenseStats: vi.fn(),
    }));

    const { listActorLicensingRequests } = await import('@/lib/hdicr/licensing-client');

    await expect(listActorLicensingRequests('actor-123')).rejects.toThrow('fail-closed');
  });

  it('getActorLicensesAndStats throws in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));
    vi.doMock('@/lib/licensing', () => ({
      getActorLicenses: vi.fn(),
      getLicenseStats: vi.fn(),
    }));

    const { getActorLicensesAndStats } = await import('@/lib/hdicr/licensing-client');

    await expect(getActorLicensesAndStats('actor-123')).rejects.toThrow('fail-closed');
  });
});
