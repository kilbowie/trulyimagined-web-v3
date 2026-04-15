export type PlatformFeeBand = {
  maxDealValueCents: number | null;
  feeBps: number;
};

export const PLATFORM_FEE_BANDS: PlatformFeeBand[] = [
  { maxDealValueCents: 500_000, feeBps: 1750 },
  { maxDealValueCents: 5_000_000, feeBps: 1300 },
  { maxDealValueCents: 10_000_000, feeBps: 900 },
  { maxDealValueCents: null, feeBps: 750 },
];

export function getPlatformFeeBps(dealValueCents: number): number {
  for (const band of PLATFORM_FEE_BANDS) {
    if (band.maxDealValueCents === null || dealValueCents <= band.maxDealValueCents) {
      return band.feeBps;
    }
  }

  return PLATFORM_FEE_BANDS[PLATFORM_FEE_BANDS.length - 1]?.feeBps ?? 750;
}

export function calculatePlatformFeeCents(dealValueCents: number): number {
  if (!Number.isFinite(dealValueCents) || dealValueCents <= 0) {
    throw new Error('dealValueCents must be a positive integer');
  }

  const feeBps = getPlatformFeeBps(dealValueCents);
  return Math.floor((dealValueCents * feeBps) / 10_000);
}

export function calculateDealBreakdown(dealValueCents: number): {
  dealValueCents: number;
  platformFeeCents: number;
  actorPayoutCents: number;
  platformFeeBps: number;
} {
  const platformFeeCents = calculatePlatformFeeCents(dealValueCents);
  const platformFeeBps = getPlatformFeeBps(dealValueCents);
  const actorPayoutCents = dealValueCents - platformFeeCents;

  return {
    dealValueCents,
    platformFeeCents,
    actorPayoutCents,
    platformFeeBps,
  };
}
