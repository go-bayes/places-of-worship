// the curator batch-import row rules (docs/portal-batch-import-and-corrections.md),
// moved here from convex/batchImport.ts so the shared date test
// (partialDates.node-test.mjs) can reach them. the workbench module
// apps/workbench/src/data/batchImport.ts applies the same rules
import { isValidHistoricalDate, isValidObservationDate, type ConfirmedDate } from "./partialDates.ts";

// the shape of a partial date the import accepted before stage 1
const PARTIAL_DATE_FORM = /^[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?$/;

export const GEOCODING_BASES = new Set([
  "exact_address",
  "historical_address_matched",
  "described_locality",
  "map_georeference",
  "regional_only",
  "unknown",
]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

export type ImportRow = {
  row_number: number;
  name: string;
  country_code: string;
  religion?: string;
  denomination_code?: string;
  taxonomy_version?: string;
  lat?: number;
  lng?: number;
  locality?: string;
  containing_area?: string;
  geocoding_basis?: string;
  location_confidence?: string;
  source_locator: string;
  source_url?: string;
  first_date?: string;
  last_date?: string;
  date_confidence?: string;
  culturally_sensitive?: "yes" | "no";
  notes?: string;
  claim_hash: string;
  // deep-time stage 1 (ruling 7): dates in this row the curator who
  // prepared the file confirmed, as written
  confirmed_dates?: string[];
};


// the date columns each import route stores as a date, and so may carry a
// curator's confirmation: the nomination import writes first_date as the
// lifecycle date (last_date goes into a note); the occupancy import also
// stores each period's dates. the source's consulted date is file-level
// register text, never a row's confirmed date
export const NOMINATION_CONFIRMABLE_COLUMNS = ["first_date"] as const;
export const OCCUPANCY_CONFIRMABLE_COLUMNS = [
  "first_date",
  "start_date",
  "start_not_earlier_than",
  "start_not_later_than",
  "end_date",
  "end_not_earlier_than",
  "end_not_later_than",
  "still_active_asof",
] as const;

// the deep-time stage 1 rules for a row's own dates, applied to a fresh
// import after its duplicate check: first_date and last_date are real
// historical dates; first_date, stored as the lifecycle date, meets the
// country's floor unless the row confirms it; each confirmed date is a real
// date the route stores from this row, listed once
export function importRowDateProblems(
  row: { first_date?: string; last_date?: string; confirmed_dates?: string[] },
  floorYear: number,
  confirmable: readonly string[],
): string[] {
  const problems: string[] = [];
  const confirmed = new Set((row.confirmed_dates ?? []).map((value) => value.trim()));
  for (const [label, value] of [["first_date", row.first_date], ["last_date", row.last_date]] as const) {
    // the value as the route stores it, untrimmed
    const date = value ?? "";
    if (!date) continue;
    if (!isValidHistoricalDate(date)) {
      problems.push(`Write ${label} as a real date, YYYY, YYYY-MM, or YYYY-MM-DD, with a year before 1000 written with four digits, as 0920.`);
    } else if (label === "first_date" && Number(date.slice(0, 4)) < floorYear && !confirmed.has(date)) {
      problems.push(`first_date ${date} is earlier than ${floorYear}, the earliest year this country accepts without a confirmed date. Check the year, or list it in confirmed_dates.`);
    }
  }
  const record = row as Record<string, unknown>;
  const storable = new Set(
    confirmable
      .map((column) => record[column])
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim()),
  );
  const seen = new Set<string>();
  for (const value of row.confirmed_dates ?? []) {
    const date = value.trim();
    if (!isValidHistoricalDate(date)) {
      problems.push("Write each confirmed date as YYYY, YYYY-MM, or YYYY-MM-DD, with a year before 1000 written with four digits, as 0920.");
    } else if (seen.has(date)) {
      problems.push(`The confirmed date ${date} is listed twice.`);
    } else if (!storable.has(date)) {
      problems.push(`The confirmed date ${date} is not a date this import stores from the row; confirm ${confirmable.join(", ")} only.`);
    }
    seen.add(date);
  }
  return problems;
}

// an evidence record's source date from the file's consulted date: only a
// real observation date, from 1000 to 2100. the register keeps the
// consulted date as the curator wrote it
export function evidenceSourceDate(consultedDate: string | undefined): string | undefined {
  const date = consultedDate?.trim() ?? "";
  return isValidObservationDate(date) ? date : undefined;
}

// the curator's confirmations that cover a record's own dates, or undefined
// when none does, so a record without a confirmed date carries no list
export function curatorConfirmations(
  confirmed: readonly string[] | undefined,
  recordDates: readonly (string | undefined)[],
): ConfirmedDate[] | undefined {
  const present = new Set(recordDates.map((value) => value?.trim() ?? "").filter((value) => value !== ""));
  const dates = [...new Set((confirmed ?? []).map((value) => value.trim()))].filter((date) => present.has(date));
  return dates.length > 0 ? dates.map((date) => ({ date, confirmed_by: "curator" as const })) : undefined;
}

// same rules as the workbench module (apps/workbench/src/data/batchImport.ts),
// server-side: the mutation is the last line of defence once clients other
// than the workbench exist. pure, so the shared date test reaches it
export function validateImportRow(row: ImportRow, countryCode: string): string[] {
  const problems: string[] = [];
  if (!row.name.trim()) {
    problems.push("Give the place a name as the source states it; a batch row without a name is unreviewable.");
  }
  if (row.country_code.toUpperCase() !== countryCode.toUpperCase()) {
    problems.push(`Row country ${row.country_code || "(blank)"} does not match the file's country ${countryCode}.`);
  }
  if (row.denomination_code && !row.taxonomy_version) {
    problems.push("Add the taxonomy version that goes with the denomination code.");
  }
  const hasLat = row.lat !== undefined;
  const hasLng = row.lng !== undefined;
  if (hasLat !== hasLng) {
    problems.push("Enter both latitude and longitude, or leave both blank.");
  }
  if (hasLat && hasLng) {
    if (Math.abs(row.lat!) > 90 || Math.abs(row.lng!) > 180) {
      problems.push("Latitude and longitude must be numeric and in range.");
    }
    if (!row.geocoding_basis) {
      problems.push("Choose a geocoding basis so reviewers know how the point was placed.");
    }
  } else if (!row.containing_area?.trim()) {
    problems.push("A row without coordinates must name its containing area, even when a locality is given.");
  }
  if (row.geocoding_basis && !GEOCODING_BASES.has(row.geocoding_basis)) {
    problems.push(`Unknown geocoding basis: ${row.geocoding_basis}.`);
  }
  for (const [label, value] of [
    ["location_confidence", row.location_confidence],
    ["date_confidence", row.date_confidence],
  ] as const) {
    if (value && !CONFIDENCES.has(value)) {
      problems.push(`${label} must be high, medium, or low.`);
    }
  }
  for (const [label, value] of [
    ["first_date", row.first_date],
    ["last_date", row.last_date],
  ] as const) {
    // the form only, as before stage 1: a row already imported keeps its
    // duplicate skip; importRowDateProblems applies the date rules after it
    if (value && !PARTIAL_DATE_FORM.test(value)) {
      problems.push(`Write ${label} as YYYY, YYYY-MM, or YYYY-MM-DD.`);
    }
  }
  if (row.source_url && !/^https?:\/\//i.test(row.source_url)) {
    problems.push("source_url must be an http(s) URL.");
  }
  if (!row.source_locator.trim()) {
    problems.push("Every row needs a source_locator: a stable entry reference into the file's source record.");
  }
  return problems;
}
