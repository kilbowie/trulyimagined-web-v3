import { BILLING_PLANS } from '@/lib/billing';
import { queryTi } from '@/lib/db';

const ENTITLED_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;
const AGENCY_MEMBER_OCCUPYING_STATUSES = ['invited', 'active'] as const;
const AGENCY_PLAN_KEYS = BILLING_PLANS.filter((plan) => plan.id.startsWith('agency_')).map(
  (plan) => plan.id
);

export type AgencyTeamMemberStatus = 'invited' | 'active' | 'disabled' | 'deleted';

export interface AgencySeatAllocation {
  enforcementEnabled: boolean;
  agencyId: string;
  planKey: string | null;
  subscriptionStatus: string | null;
  seatCapacity: number | null;
  occupiedSeats: number;
  availableSeats: number | null;
}

export class AgencySeatCapacityError extends Error {
  readonly code = 'AGENCY_SEAT_CAPACITY_EXCEEDED';
  readonly allocation: AgencySeatAllocation;

  constructor(allocation: AgencySeatAllocation) {
    super('Agency seat capacity reached for current subscription tier.');
    this.name = 'AgencySeatCapacityError';
    this.allocation = allocation;
  }
}

function isSeatOccupyingStatus(status: AgencyTeamMemberStatus): boolean {
  return status === 'invited' || status === 'active';
}

async function resolveAgencyOwnerUserId(agencyId: string): Promise<string | null> {
  const result = await queryTi(
    `SELECT user_profile_id
     FROM agents
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [agencyId]
  );

  return (result.rows[0]?.user_profile_id as string | undefined) ?? null;
}

async function resolveAgencySubscription(userProfileId: string): Promise<{
  planKey: string;
  status: string;
  seatCount: number;
} | null> {
  if (AGENCY_PLAN_KEYS.length === 0) {
    return null;
  }

  const result = await queryTi(
    `SELECT plan_key, status, seat_count
     FROM user_subscriptions
     WHERE user_id = $1
       AND status = ANY($2::text[])
       AND plan_key = ANY($3::text[])
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userProfileId, ENTITLED_SUBSCRIPTION_STATUSES, AGENCY_PLAN_KEYS]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const row = result.rows[0] as {
    plan_key: string;
    status: string;
    seat_count: number | string;
  };

  const seatCount = Number(row.seat_count);
  return {
    planKey: row.plan_key,
    status: row.status,
    seatCount: Number.isFinite(seatCount) && seatCount > 0 ? seatCount : 1,
  };
}

async function countOccupiedAgencySeats(
  agencyId: string,
  excludeMemberId?: string
): Promise<number> {
  const baseSql = `SELECT COUNT(*)::int AS occupied_seats
                   FROM agency_team_members
                   WHERE agency_id = $1
                     AND deleted_at IS NULL
                     AND status = ANY($2::text[])`;

  const result = excludeMemberId
    ? await queryTi(`${baseSql} AND id <> $3`, [
        agencyId,
        AGENCY_MEMBER_OCCUPYING_STATUSES,
        excludeMemberId,
      ])
    : await queryTi(baseSql, [agencyId, AGENCY_MEMBER_OCCUPYING_STATUSES]);

  const occupiedSeats = Number(result.rows[0]?.occupied_seats ?? 0);
  return Number.isFinite(occupiedSeats) && occupiedSeats >= 0 ? occupiedSeats : 0;
}

export async function getAgencySeatAllocation(
  agencyId: string,
  options?: { excludeMemberId?: string }
): Promise<AgencySeatAllocation> {
  const ownerUserId = await resolveAgencyOwnerUserId(agencyId);
  const occupiedSeats = await countOccupiedAgencySeats(agencyId, options?.excludeMemberId);

  if (!ownerUserId) {
    return {
      enforcementEnabled: false,
      agencyId,
      planKey: null,
      subscriptionStatus: null,
      seatCapacity: null,
      occupiedSeats,
      availableSeats: null,
    };
  }

  const subscription = await resolveAgencySubscription(ownerUserId);
  if (!subscription) {
    return {
      enforcementEnabled: false,
      agencyId,
      planKey: null,
      subscriptionStatus: null,
      seatCapacity: null,
      occupiedSeats,
      availableSeats: null,
    };
  }

  return {
    enforcementEnabled: true,
    agencyId,
    planKey: subscription.planKey,
    subscriptionStatus: subscription.status,
    seatCapacity: subscription.seatCount,
    occupiedSeats,
    availableSeats: Math.max(0, subscription.seatCount - occupiedSeats),
  };
}

export async function assertAgencySeatCapacityForNextStatus(params: {
  agencyId: string;
  nextStatus: AgencyTeamMemberStatus;
  memberId?: string;
}): Promise<AgencySeatAllocation> {
  const allocation = await getAgencySeatAllocation(params.agencyId, {
    excludeMemberId: params.memberId,
  });

  if (!allocation.enforcementEnabled || allocation.seatCapacity === null) {
    return allocation;
  }

  const requiredSeats = isSeatOccupyingStatus(params.nextStatus) ? 1 : 0;
  const projectedSeats = allocation.occupiedSeats + requiredSeats;

  if (projectedSeats > allocation.seatCapacity) {
    throw new AgencySeatCapacityError(allocation);
  }

  return allocation;
}
