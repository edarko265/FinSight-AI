/**
 * Calendar helpers on plain YYYY-MM-DD strings. Periods are inclusive of the
 * start date and exclusive of the end date. Nothing here reads the real clock:
 * "today" is always the server-owned as-of date.
 */
export interface Period {
  startInclusive: string;
  endExclusive: string;
}

const pad = (value: number): string => String(value).padStart(2, "0");

export function toDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parts(date: string): { year: number; month: number; day: number } {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parts(date);
  return toDate(year, month, day + days);
}

export function addMonths(date: string, months: number): string {
  const { year, month } = parts(date);
  return toDate(year, month + months, 1);
}

export function daysBetween(start: string, endExclusive: string): number {
  return Math.round((Date.parse(endExclusive) - Date.parse(start)) / 86_400_000);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthPeriod(key: string): Period {
  const start = `${key}-01`;
  return { startInclusive: start, endExclusive: addMonths(start, 1) };
}

/** The last calendar month that had fully ended on the as-of date. */
export function lastCompletedMonth(asOf: string): Period {
  const thisMonth = `${monthKey(asOf)}-01`;
  return { startInclusive: addMonths(thisMonth, -1), endExclusive: thisMonth };
}

/** The `count` completed months before the as-of date, oldest first. */
export function completedMonths(asOf: string, count: number): Period[] {
  const thisMonth = `${monthKey(asOf)}-01`;
  return Array.from({ length: count }, (_, index) => {
    const start = addMonths(thisMonth, index - count);
    return { startInclusive: start, endExclusive: addMonths(start, 1) };
  });
}

/** Month to date: from the first of the as-of month through the as-of date. */
export function monthToDate(asOf: string): Period {
  return { startInclusive: `${monthKey(asOf)}-01`, endExclusive: addDays(asOf, 1) };
}

export function inPeriod(date: string, period: Period): boolean {
  return date >= period.startInclusive && date < period.endExclusive;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parts(value);
  return toDate(year, month, day) === value;
}
