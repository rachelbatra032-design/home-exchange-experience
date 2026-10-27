import assert from "node:assert/strict";
import test from "node:test";
import {
  answerWindowOpen,
  appliedAmount,
  claimWindowOpen,
  depositReleaseDue,
  pointsAutoSettleDue,
} from "./claims";

const start = new Date("2026-11-01T00:00:00.000Z");

test("points settle on their own 24 hours after the start", () => {
  assert.equal(pointsAutoSettleDue(start, new Date("2026-11-01T23:00:00.000Z")), false);
  assert.equal(pointsAutoSettleDue(start, new Date("2026-11-02T00:00:00.000Z")), true);
});

test("the deposit waits 72 hours unless a claim is open", () => {
  const checkout = new Date("2026-11-05T00:00:00.000Z");
  const before = new Date("2026-11-07T23:00:00.000Z");
  const after = new Date("2026-11-08T00:00:00.000Z");
  assert.equal(claimWindowOpen(checkout, before), true);
  assert.equal(depositReleaseDue(checkout, before, false), false);
  assert.equal(depositReleaseDue(checkout, after, false), true);
  assert.equal(depositReleaseDue(checkout, after, true), false);
});

test("an answer is due within 48 hours and a claim cannot take more than the deposit", () => {
  const opened = new Date("2026-11-05T00:00:00.000Z");
  assert.equal(answerWindowOpen(opened, new Date("2026-11-06T12:00:00.000Z")), true);
  assert.equal(answerWindowOpen(opened, new Date("2026-11-07T00:00:00.000Z")), false);
  assert.equal(appliedAmount(20000, 12000), 12000);
  assert.equal(appliedAmount(4000, 12000), 4000);
});
