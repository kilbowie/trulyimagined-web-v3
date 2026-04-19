import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db', () => ({
  queryTi: vi.fn(),
}));

describe('agency-seat-limits', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('allows membership changes when projected seats remain within cap', async () => {
    const db = await import('@/lib/db');
    const queryTi = db.queryTi as unknown as Mock;

    queryTi
      .mockResolvedValueOnce({ rows: [{ user_profile_id: 'owner-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occupied_seats: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ plan_key: 'agency_boutique', status: 'active', seat_count: 3 }],
        rowCount: 1,
      });

    const { assertAgencySeatCapacityForNextStatus } = await import('@/lib/agency-seat-limits');

    const result = await assertAgencySeatCapacityForNextStatus({
      agencyId: 'agency-1',
      nextStatus: 'invited',
    });

    expect(result.enforcementEnabled).toBe(true);
    expect(result.seatCapacity).toBe(3);
    expect(result.occupiedSeats).toBe(2);
  });

  it('throws when projected seats exceed subscription seat_count', async () => {
    const db = await import('@/lib/db');
    const queryTi = db.queryTi as unknown as Mock;

    queryTi
      .mockResolvedValueOnce({ rows: [{ user_profile_id: 'owner-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occupied_seats: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ plan_key: 'agency_independent', status: 'active', seat_count: 3 }],
        rowCount: 1,
      });

    const { assertAgencySeatCapacityForNextStatus, AgencySeatCapacityError } =
      await import('@/lib/agency-seat-limits');

    await expect(
      assertAgencySeatCapacityForNextStatus({
        agencyId: 'agency-1',
        nextStatus: 'invited',
      })
    ).rejects.toBeInstanceOf(AgencySeatCapacityError);
  });

  it('does not enforce cap for non-agency or missing subscription records', async () => {
    const db = await import('@/lib/db');
    const queryTi = db.queryTi as unknown as Mock;

    queryTi
      .mockResolvedValueOnce({ rows: [{ user_profile_id: 'owner-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occupied_seats: 12 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const { getAgencySeatAllocation } = await import('@/lib/agency-seat-limits');

    const allocation = await getAgencySeatAllocation('agency-1');

    expect(allocation.enforcementEnabled).toBe(false);
    expect(allocation.seatCapacity).toBeNull();
    expect(allocation.occupiedSeats).toBe(12);
  });

  it('evaluates transitions using excludeMemberId for seat-accurate status changes', async () => {
    const db = await import('@/lib/db');
    const queryTi = db.queryTi as unknown as Mock;

    queryTi
      .mockResolvedValueOnce({ rows: [{ user_profile_id: 'owner-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occupied_seats: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ plan_key: 'agency_sme', status: 'active', seat_count: 2 }],
        rowCount: 1,
      });

    const { assertAgencySeatCapacityForNextStatus } = await import('@/lib/agency-seat-limits');

    const allocation = await assertAgencySeatCapacityForNextStatus({
      agencyId: 'agency-1',
      memberId: 'member-1',
      nextStatus: 'active',
    });

    expect(allocation.enforcementEnabled).toBe(true);
    expect(allocation.availableSeats).toBe(1);
    expect(queryTi).toHaveBeenCalledWith(expect.stringContaining('AND id <> $3'), [
      'agency-1',
      ['invited', 'active'],
      'member-1',
    ]);
  });
});
