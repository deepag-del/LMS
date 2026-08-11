// Working-day arithmetic for IST scheduling.
// All dates are handled as plain "YYYY-MM-DD" strings so no timezone conversion
// can shift a date — the retest rule (Module 7) is "7 calendar days out, then
// roll forward past weekends and holidays".

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`); // noon UTC: immune to DST/offset edge cases
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(isoDate: string): boolean {
  const dow = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6; // Sunday or Saturday
}

/** Roll forward from isoDate to the next date that is Mon–Fri and not a holiday. */
export function nextWorkingDay(isoDate: string, holidays: Set<string>): string {
  let d = isoDate;
  while (isWeekend(d) || holidays.has(d)) d = addDays(d, 1);
  return d;
}

/** LOCKED retest rule: failure date + offset (default 7) calendar days,
 *  landing on a weekday that is not in the holiday calendar. */
export function scheduleRetestDate(
  failureDate: string,
  holidays: Set<string>,
  offsetDays = 7
): string {
  return nextWorkingDay(addDays(failureDate, offsetDays), holidays);
}
