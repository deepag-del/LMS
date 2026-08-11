import test from "node:test";
import assert from "node:assert/strict";
import { addDays, isWeekend, nextWorkingDay, scheduleRetestDate } from "./workdays";

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("isWeekend identifies Saturday and Sunday", () => {
  assert.equal(isWeekend("2026-08-15"), true); // Saturday
  assert.equal(isWeekend("2026-08-16"), true); // Sunday
  assert.equal(isWeekend("2026-08-17"), false); // Monday
});

test("nextWorkingDay rolls past a weekend", () => {
  assert.equal(nextWorkingDay("2026-08-15", new Set()), "2026-08-17"); // Sat → Mon
});

test("nextWorkingDay rolls past consecutive holidays and weekends", () => {
  // Mon 17th and Tue 18th are holidays → next working day is Wed 19th
  const holidays = new Set(["2026-08-17", "2026-08-18"]);
  assert.equal(nextWorkingDay("2026-08-15", holidays), "2026-08-19");
});

test("retest rule: fail Friday → +7 days is Friday (working day)", () => {
  assert.equal(scheduleRetestDate("2026-08-07", new Set()), "2026-08-14");
});

test("retest rule: fail Saturday → +7 days is Saturday → rolls to Monday", () => {
  assert.equal(scheduleRetestDate("2026-08-08", new Set()), "2026-08-17");
});

test("retest rule: +7 lands on Independence Day (Sat) then Sunday → Monday", () => {
  const holidays = new Set(["2026-08-15"]);
  assert.equal(scheduleRetestDate("2026-08-08", holidays), "2026-08-17");
});

test("retest rule: +7 lands on a weekday holiday → next weekday", () => {
  const holidays = new Set(["2026-10-02"]); // Gandhi Jayanti, a Friday
  assert.equal(scheduleRetestDate("2026-09-25", holidays), "2026-10-05"); // Fri holiday → Mon
});
