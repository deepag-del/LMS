import test from "node:test";
import assert from "node:assert/strict";
import { cycleFor, monthsRemainingInCycle, sameYearOtherCycles } from "./cycles";

test("cycleFor maps months to half-year cycles", () => {
  assert.equal(cycleFor("2026-01-01"), "2026-H1");
  assert.equal(cycleFor("2026-06-30"), "2026-H1");
  assert.equal(cycleFor("2026-07-01"), "2026-H2");
  assert.equal(cycleFor("2026-12-31"), "2026-H2");
});

test("monthsRemainingInCycle counts the current month", () => {
  assert.equal(monthsRemainingInCycle("2026-01-15"), 6); // Jan..Jun
  assert.equal(monthsRemainingInCycle("2026-06-15"), 1);
  assert.equal(monthsRemainingInCycle("2026-07-15"), 6); // Jul..Dec
  assert.equal(monthsRemainingInCycle("2026-12-15"), 1);
});

test("sameYearOtherCycles pairs the halves", () => {
  assert.deepEqual(sameYearOtherCycles("2026-H1"), ["2026-H2"]);
  assert.deepEqual(sameYearOtherCycles("2026-H2"), ["2026-H1"]);
});
