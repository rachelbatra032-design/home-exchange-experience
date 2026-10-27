import assert from "node:assert/strict";
import test from "node:test";
import {
  balances,
  cancellationSplit,
  depositRupees,
  membershipBreakdown,
  nightlyPoints,
} from "./valuation";

test("a Pune 3 bedroom with no extras is 140 points", () => {
  const priced = nightlyPoints({
    bedrooms: 3,
    tier: 1,
    hasAc: false,
    hasParking: false,
    hasPool: false,
    hasWorkspace: false,
  });
  assert.equal(priced.total, 140);
});

test("a Mumbai 2 bedroom with air conditioning is 142 points", () => {
  const priced = nightlyPoints({
    bedrooms: 2,
    tier: 1.2,
    hasAc: true,
    hasParking: false,
    hasPool: false,
    hasWorkspace: false,
  });
  assert.equal(priced.total, 142);
});

test("cancellation follows the three windows", () => {
  assert.deepEqual(cancellationSplit(4, 100, 20), {
    toHost: 0,
    toGuest: 400,
    reason: "More than 14 days before the stay, the hold goes back to the guest.",
  });
  assert.equal(cancellationSplit(4, 100, 10).toHost, 100);
  assert.equal(cancellationSplit(4, 100, 10).toGuest, 300);
  assert.equal(cancellationSplit(4, 100, 1).toHost, 400);
  assert.equal(cancellationSplit(1, 140, 10).toGuest, 0);
});

test("deposit and membership are fixed published numbers", () => {
  assert.deepEqual(
    [1, 2, 3, 4].map(depositRupees),
    [5000, 8000, 12000, 15000],
  );
  assert.deepEqual(membershipBreakdown(), { base: 7500, gst: 1350, total: 8850 });
});

test("ledger buckets sum independently", () => {
  assert.deepEqual(
    balances([
      { bucket: "available", delta: 150 },
      { bucket: "available", delta: -140 },
      { bucket: "held", delta: 140 },
    ]),
    { available: 10, held: 140 },
  );
});
