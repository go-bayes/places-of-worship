// partial dates under stage 1 of the deep-time date format
// (docs/development/deep-time-date-format-brief-2026-11-24.md, rulings 1 to 8
// of section 10). a partial date is YYYY, YYYY-MM or YYYY-MM-DD with ASCII
// digits and a real Gregorian calendar date. a year below 1000 is written
// with leading zeros (0920, 0920-05, 0920-05-01); the year 0000 is refused in
// every form until stage 2 gives it a meaning. two validators:
// - a historical date (a dated claim, a period, a function chain, the
//   lifecycle date) accepts any four-digit year from 0001;
// - an observation date (an observation, a photograph, a source's own date)
//   keeps the range 1000 to 2100, so 0201 typed for 2021 is still refused.
// the shared test (partialDates.node-test.mjs) runs every copy of these
// validators against schemas/fixtures/partial-dates.v1.json.

export const HISTORICAL_MIN_YEAR = 1;
export const OBSERVATION_MIN_YEAR = 1000;
export const OBSERVATION_MAX_YEAR = 2100;

const PARTIAL_DATE_FORM = /^([0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export type PartialDateParts = { year: number; month?: number; day?: number };

// the parts of a well-formed partial date with a real calendar month and
// day, or null; the year may be 0000 here, and each validator sets its range
export function partialDateParts(value: string): PartialDateParts | null {
  if (typeof value !== "string") return null;
  const match = PARTIAL_DATE_FORM.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  if (match[2] === undefined) return { year };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (match[3] === undefined) return { year, month };
  const day = Number(match[3]);
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

// the year a partial date names, or null when the date is not valid in any kind
export function partialDateYear(value: string): number | null {
  const parts = partialDateParts(value);
  return parts === null || parts.year < HISTORICAL_MIN_YEAR ? null : parts.year;
}

// a historical date: any real date from the year 0001
export function isValidHistoricalDate(value: string): boolean {
  const parts = partialDateParts(value);
  return parts !== null && parts.year >= HISTORICAL_MIN_YEAR;
}

// an observation date: a real date from 1000 to 2100
export function isValidObservationDate(value: string): boolean {
  const parts = partialDateParts(value);
  return parts !== null && parts.year >= OBSERVATION_MIN_YEAR && parts.year <= OBSERVATION_MAX_YEAR;
}

// the earliest and latest calendar day a valid partial date covers, as
// YYYY-MM-DD text; text comparison orders four-digit years correctly
export function partialDateBounds(value: string): { lower: string; upper: string } | null {
  const parts = partialDateParts(value);
  if (parts === null || parts.year < HISTORICAL_MIN_YEAR) return null;
  const year = String(parts.year).padStart(4, "0");
  const month = parts.month === undefined ? undefined : String(parts.month).padStart(2, "0");
  if (parts.month === undefined) return { lower: `${year}-01-01`, upper: `${year}-12-31` };
  if (parts.day === undefined) {
    const last = String(daysInMonth(parts.year, parts.month)).padStart(2, "0");
    return { lower: `${year}-${month}-01`, upper: `${year}-${month}-${last}` };
  }
  return { lower: value, upper: value };
}

// option c of ruling 7: a date below the country's floor, or a documentary
// source's date below the observation range, is accepted when the record
// carries an entry for that date as written and who confirmed it. a record
// without a confirmed date carries no list at all, so its hash is unchanged
export type DateConfirmer = "contributor" | "curator" | "agent";
export const DATE_CONFIRMERS: readonly DateConfirmer[] = ["contributor", "curator", "agent"];
export type ConfirmedDate = { date: string; confirmed_by: DateConfirmer };
// every entry names a distinct date the record holds, so a record's list is
// bounded by its date fields; the most any record holds is a function chain's
// 42 (a bounded start and 20 bounded changes)
export const MAX_CONFIRMED_DATES = 42;

// the source types whose date is a capture date: an observation outright,
// with no documentary exception below 1000 (rulings 3 and 4)
export const CAPTURE_SOURCE_TYPES: ReadonlySet<string> = new Set([
  "field_observation",
  "street_imagery",
  "aerial_imagery",
  "aerial_or_street_imagery",
]);

export function isCaptureSource(sourceType: string | undefined): boolean {
  return sourceType !== undefined && CAPTURE_SOURCE_TYPES.has(sourceType);
}

// the entries of a list whose dates are among the given ones, or undefined
// when none is, so a record without a confirmed date carries no list
export function confirmationsFor(
  list: readonly ConfirmedDate[] | undefined,
  dates: readonly (string | undefined)[],
): ConfirmedDate[] | undefined {
  const present = new Set(dates.map((value) => value?.trim() ?? "").filter((value) => value !== ""));
  const kept = (list ?? []).filter((entry) => present.has(entry.date));
  return kept.length > 0 ? kept : undefined;
}

// the confirmations an edit that sends no list leaves on a record. each date
// field is keyed by the field and the purpose of its date; an entry survives
// only while every field that holds its date after the edit held the same
// date for the same purpose before it. a changed date loses its confirmation,
// a restored date needs a new one, and the same text set in another field,
// or kept under another purpose, needs a fresh confirmation from its writer
export type KeyedDate = { key: string; value: string };

export function carriedConfirmations(
  stored: readonly ConfirmedDate[] | undefined,
  previous: readonly KeyedDate[],
  next: readonly KeyedDate[],
): ConfirmedDate[] | undefined {
  const before = new Set(previous.map((field) => `${field.key}=${field.value}`));
  const kept = (stored ?? []).filter((entry) => {
    const holders = next.filter((field) => field.value === entry.date);
    return holders.length > 0 && holders.every((field) => before.has(`${field.key}=${field.value}`));
  });
  return kept.length > 0 ? kept : undefined;
}

export function isConfirmedDate(list: readonly ConfirmedDate[] | undefined, value: string): boolean {
  return (list ?? []).some((entry) => entry.date === value);
}

// checks the list's own shape against the dates the record holds: every
// entry names a historical date that the record carries, exactly as written,
// once, and a confirmer the writer may name
export function assertConfirmedDates(
  list: readonly ConfirmedDate[] | undefined,
  recordDates: readonly (string | undefined)[],
  allowed: readonly DateConfirmer[] = DATE_CONFIRMERS,
): void {
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("A record without a confirmed date carries no list of confirmed dates; omit the empty list.");
  }
  const present = new Set(recordDates.map((value) => value?.trim() ?? "").filter((value) => value !== ""));
  // distinct entries that each match a date of the record cannot outnumber its dates
  if (list.length > MAX_CONFIRMED_DATES) {
    throw new Error("A record carries at most one confirmed date for each date it holds.");
  }
  const seen = new Set<string>();
  for (const entry of list) {
    if (!isValidHistoricalDate(entry.date)) {
      throw new Error(`The confirmed date ${JSON.stringify(entry.date).slice(0, 40)} must be written YYYY, YYYY-MM or YYYY-MM-DD, with a year before 1000 written with four digits, as 0920.`);
    }
    if (!DATE_CONFIRMERS.includes(entry.confirmed_by)) {
      throw new Error(`The confirmed date ${entry.date} must name who confirmed it: a contributor, a curator or an agent.`);
    }
    if (!allowed.includes(entry.confirmed_by)) {
      throw new Error(`This record cannot carry a date confirmed by ${entry.confirmed_by === "agent" ? "an agent" : `a ${entry.confirmed_by}`}.`);
    }
    if (seen.has(entry.date)) {
      throw new Error(`The confirmed date ${entry.date} is listed twice.`);
    }
    seen.add(entry.date);
    if (!present.has(entry.date)) {
      throw new Error(`The confirmed date ${entry.date} matches no date in this record; a date edited after it was confirmed needs a new confirmation.`);
    }
  }
}

// the confirmers a writer may name: a person names a contributor, and a
// curator, admin or service account may also name a curator. only the
// agent intake names an agent (agentIntake.ts)
export function confirmersForRoles(roles: readonly string[]): DateConfirmer[] {
  const curator = roles.some((role) => role === "curator" || role === "admin" || role === "service");
  return curator ? ["contributor", "curator"] : ["contributor"];
}

export function assertConfirmers(list: readonly ConfirmedDate[] | undefined, allowed: readonly DateConfirmer[]): void {
  for (const entry of list ?? []) {
    if (!allowed.includes(entry.confirmed_by)) {
      throw new Error(`This record cannot carry a date confirmed by ${entry.confirmed_by === "agent" ? "an agent" : `a ${entry.confirmed_by}`}.`);
    }
  }
}

// a historical date in a dated claim, a period, a function chain or the
// lifecycle date: a real date from 0001, and from the country's floor unless
// the record confirms it. the floor is checked when the record is written
export function assertHistoricalDate(
  label: string,
  value: string,
  floorYear: number,
  confirmed: readonly ConfirmedDate[] | undefined,
): void {
  if (!isValidHistoricalDate(value)) {
    throw new Error(`${label} must be a real date written YYYY, YYYY-MM or YYYY-MM-DD; write a year before 1000 with four digits, as 0920.`);
  }
  const year = Number(value.slice(0, 4));
  if (year < floorYear && !isConfirmedDate(confirmed, value)) {
    throw new Error(`${label} ${value} is earlier than ${floorYear}, the earliest year this country accepts without a confirmed date. Check the year, or record who confirmed the date.`);
  }
}

// a documentary source's own date: the observation range, or a real date
// before 1000 that the record confirms (ruling 4). a field observation and a
// rapid current observation take the range outright
export function assertSourceDate(
  label: string,
  value: string,
  confirmed: readonly ConfirmedDate[] | undefined,
): void {
  if (isValidObservationDate(value)) return;
  const year = partialDateYear(value);
  if (year !== null && year < OBSERVATION_MIN_YEAR) {
    if (isConfirmedDate(confirmed, value)) return;
    throw new Error(`${label} ${value} is earlier than ${OBSERVATION_MIN_YEAR}. Check the year, or record who confirmed the date.`);
  }
  throw new Error(`${label} must be a real date written YYYY, YYYY-MM or YYYY-MM-DD from ${OBSERVATION_MIN_YEAR} to ${OBSERVATION_MAX_YEAR}.`);
}
