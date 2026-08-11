// Half-year exam cycles (LOCKED rule: every employee sits exactly 2 exams per
// year -> one selection per cycle). H1 = Jan-Jun, H2 = Jul-Dec, IST dates.

export function cycleFor(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  return `${y}-H${m <= 6 ? 1 : 2}`;
}

export function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}

export function currentCycle(): string {
  return cycleFor(todayIst());
}

/** Months still available in the cycle, counting the current month.
 *  Used to spread remaining selections evenly: pick ceil(remaining / monthsLeft). */
export function monthsRemainingInCycle(isoDate: string): number {
  const m = Number(isoDate.split("-")[1]);
  return m <= 6 ? 7 - m : 13 - m;
}

/** Cycles belonging to the same calendar year as `cycle`, excluding itself.
 *  The Module 6 question draw excludes everything seen in these (LOCKED rule:
 *  the 2nd annual cycle uses a fresh, non-overlapping question set). */
export function sameYearOtherCycles(cycle: string): string[] {
  const [year, half] = cycle.split("-H");
  return half === "1" ? [`${year}-H2`] : [`${year}-H1`];
}
