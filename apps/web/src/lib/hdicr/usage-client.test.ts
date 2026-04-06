import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('usage-client - remote authoritative behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_USAGE_ADAPTER_MODE;
    delete process.env.HDICR_REMOTE_BASE_URL;
  });

  it('actorExistsById uses local adapter in local mode', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';

    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'actor-123' }] });
    vi.doMock('@/lib/db', () => ({ query: mockQuery }));

    const { actorExistsById } = await import('@/lib/hdicr/usage-client');

    const result = await actorExistsById('actor-123');
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('createUsageTrackingRecord fails closed in remote mode without base URL', async () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { createUsageTrackingRecord } = await import('@/lib/hdicr/usage-client');

    await expect(
      createUsageTrackingRecord({
        actorId: 'actor-123',
        usageType: 'voice_minutes',
        quantity: 5,
        unit: 'minutes',
        generatedBy: 'test',
        metadata: {},
      })
    ).rejects.toThrow('fail-closed');
  });

  it('domain override enforces remote mode over global local', async () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_USAGE_ADAPTER_MODE = 'remote';

    vi.doMock('@/lib/db', () => ({ query: vi.fn() }));

    const { getGlobalUsageStats } = await import('@/lib/hdicr/usage-client');

    await expect(getGlobalUsageStats()).rejects.toThrow('fail-closed');
  });
});
