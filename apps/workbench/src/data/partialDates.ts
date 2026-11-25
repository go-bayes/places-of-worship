// partial dates under stage 1 of the deep-time date format
// (docs/development/deep-time-date-format-brief-2026-11-24.md, section 10):
// the workbench copy of convex/lib/partialDates.ts. a partial date is YYYY,
// YYYY-MM or YYYY-MM-DD with a real Gregorian calendar date; a year before
// 1000 is written with four digits (0920) and the year 0000 is refused. a
// historical date accepts any year from 0001; an observation date keeps
// 1000 to 2100. convex/lib/partialDates.node-test.mjs runs this copy against
// the shared fixture, schemas/fixtures/partial-dates.v1.json.

const PARTIAL_DATE_FORM = /^([0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// the year of a real calendar date in one of the three forms, or null
function realDateYear(value: string): number | null {
  const match = PARTIAL_DATE_FORM.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  if (match[2] === undefined) return year;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (match[3] === undefined) return year;
  const day = Number(match[3]);
  return day >= 1 && day <= daysInMonth(year, month) ? year : null;
}

export function isHistoricalDate(value: string): boolean {
  const year = realDateYear(value);
  return year !== null && year >= 1;
}

export function isObservationDate(value: string): boolean {
  const year = realDateYear(value);
  return year !== null && year >= 1000 && year <= 2100;
}
