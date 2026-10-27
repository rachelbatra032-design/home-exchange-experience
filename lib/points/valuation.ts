export function bedroomBase(bedrooms: number): number {
  if (bedrooms <= 1) return 80;
  if (bedrooms === 2) return 110;
  if (bedrooms === 3) return 140;
  return 170;
}

export function nightlyPoints(input: {
  bedrooms: number;
  tier: number;
  hasAc: boolean;
  hasParking: boolean;
  hasPool: boolean;
  hasWorkspace: boolean;
}): { total: number; lines: string[] } {
  const base = bedroomBase(input.bedrooms);
  const scaled = Math.round(base * input.tier);
  const lines = [
    `${input.bedrooms} bedroom${input.bedrooms === 1 ? "" : "s"} at ${base}, times the city rate ${input.tier}, is ${scaled}`,
  ];
  let total = scaled;
  const adders: [boolean, number, string][] = [
    [input.hasAc, 10, "Air conditioning"],
    [input.hasParking, 5, "Parking"],
    [input.hasPool, 20, "A private pool"],
    [input.hasWorkspace, 5, "A desk"],
  ];
  for (const [on, amount, label] of adders) {
    if (!on) continue;
    total += amount;
    lines.push(`${label} adds ${amount}`);
  }
  return { total, lines };
}

export const WELCOME_POINTS = 150;

export function depositRupees(bedrooms: number): number {
  if (bedrooms <= 1) return 5_000;
  if (bedrooms === 2) return 8_000;
  if (bedrooms === 3) return 12_000;
  return 15_000;
}

export const MEMBERSHIP_RUPEES = 7_500;
export const GST_RATE = 0.18;

export function membershipBreakdown(): { base: number; gst: number; total: number } {
  const gst = Math.round(MEMBERSHIP_RUPEES * GST_RATE);
  return { base: MEMBERSHIP_RUPEES, gst, total: MEMBERSHIP_RUPEES + gst };
}

export function cancellationSplit(
  nights: number,
  nightly: number,
  daysUntilStart: number,
): { toHost: number; toGuest: number; reason: string } {
  const total = nights * nightly;
  if (daysUntilStart > 14) {
    return {
      toHost: 0,
      toGuest: total,
      reason: "More than 14 days before the stay, the hold goes back to the guest.",
    };
  }
  if (daysUntilStart >= 3) {
    return {
      toHost: nightly,
      toGuest: total - nightly,
      reason: "Between 3 and 14 days before the stay, one night stays with the host.",
    };
  }
  return {
    toHost: total,
    toGuest: 0,
    reason: "Under 3 days, or a guest who does not arrive, the whole hold stays with the host.",
  };
}

export function balances(entries: { bucket: string; delta: number }[]): {
  available: number;
  held: number;
} {
  let available = 0;
  let held = 0;
  for (const entry of entries) {
    if (entry.bucket === "available") available += entry.delta;
    if (entry.bucket === "held") held += entry.delta;
  }
  return { available, held };
}
