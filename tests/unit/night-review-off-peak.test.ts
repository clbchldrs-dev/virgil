import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocalHourMinute,
  isHourWithinOffPeak,
  isNightReviewCronEnqueueSlot,
  isNowWithinOffPeakLocal,
  isRunHourAllowedForOffPeak,
} from "../../lib/night-review/off-peak";

const bounds = { startHour: 23, endHourExclusive: 7 };

test("isHourWithinOffPeak covers 11pm-7am band", () => {
  assert.equal(isHourWithinOffPeak(23, bounds), true);
  assert.equal(isHourWithinOffPeak(0, bounds), true);
  assert.equal(isHourWithinOffPeak(6, bounds), true);
  assert.equal(isHourWithinOffPeak(7, bounds), false);
  assert.equal(isHourWithinOffPeak(12, bounds), false);
  assert.equal(isHourWithinOffPeak(22, bounds), false);
});

test("isRunHourAllowedForOffPeak rejects midday", () => {
  assert.equal(isRunHourAllowedForOffPeak(3, bounds), true);
  assert.equal(isRunHourAllowedForOffPeak(14, bounds), false);
});

test("3am America/New_York is enqueue slot when run hour is 3", () => {
  // 2026-01-15 08:00 UTC = 03:00 EST (UTC-5)
  const jan = new Date("2026-01-15T08:00:00.000Z");
  assert.equal(
    isNightReviewCronEnqueueSlot(jan, "America/New_York", bounds, 3),
    true
  );
  assert.equal(getLocalHourMinute(jan, "America/New_York").hour, 3);
});

test("same instant is not slot when run hour expects 4am", () => {
  const jan = new Date("2026-01-15T08:00:00.000Z");
  assert.equal(
    isNightReviewCronEnqueueSlot(jan, "America/New_York", bounds, 4),
    false
  );
});

test("isNowWithinOffPeakLocal true at 3am local", () => {
  const jan = new Date("2026-01-15T08:00:00.000Z");
  assert.equal(isNowWithinOffPeakLocal(jan, "America/New_York", bounds), true);
});

test("isNowWithinOffPeakLocal false at noon local", () => {
  const noon = new Date("2026-01-15T17:00:00.000Z");
  assert.equal(
    isNowWithinOffPeakLocal(noon, "America/New_York", bounds),
    false
  );
});
