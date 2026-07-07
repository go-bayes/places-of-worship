import type {
  BatchImportRowReport,
  Confidence,
  EvidenceDraft,
  GeocodingBasis,
  LifecycleClaim,
  SourceRecord,
  SourceReference,
} from "./types";

// pure batch-import machinery per docs/portal-batch-import-and-corrections.md:
// CSV parsing, the row rules (the submit-path rules plus import's two
// stricter additions), idempotency hashing, and draft construction.
// no storage here — providers own persistence, this module owns the contract.

export const IMPORT_MAX_ROWS = 200;

const PARTIAL_DATE = /^\d{4}(-\d{2})?(-\d{2})?$/;
const REQUIRED_HEADERS = ["name", "country_code", "source_locator"] as const;
const KNOWN_HEADERS = new Set([
  "name",
  "country_code",
  "religion",
  "denomination_code",
  "taxonomy_version",
  "lat",
  "lng",
  "locality",
  "containing_area",
  "geocoding_basis",
  "location_confidence",
  "source_locator",
  "source_url",
  "first_date",
  "last_date",
  "date_confidence",
  "culturally_sensitive",
  "notes",
]);
const GEOCODING_BASES = new Set<GeocodingBasis>([
  "exact_address",
  "historical_address_matched",
  "described_locality",
  "map_georeference",
  "regional_only",
  "unknown",
]);
const CONFIDENCES = new Set<Confidence>(["high", "medium", "low"]);

export interface ImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedImportFile {
  headers: string[];
  rows: ImportRow[];
  fileProblems: string[];
}

// minimal RFC-4180 CSV reader: quoted fields, escaped quotes, embedded
// commas and newlines. no library, no streaming — files are capped small.
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      field = "";
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((value) => value.trim() !== "")) records.push(record);
  return records;
}

export function parseImportFile(csvText: string, countryCode: string): ParsedImportFile {
  const fileProblems: string[] = [];
  const records = parseCsv(csvText);
  if (records.length === 0) {
    return { headers: [], rows: [], fileProblems: ["The file has no rows."] };
  }
  const headers = (records[0] ?? []).map((header) => header.trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      fileProblems.push(`Missing required column: ${required}.`);
    }
  }
  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    fileProblems.push("The file has headers but no data rows.");
  }
  if (dataRecords.length > IMPORT_MAX_ROWS) {
    fileProblems.push(
      `The file has ${dataRecords.length} rows; the per-run cap is ${IMPORT_MAX_ROWS}. Split the file and import each part.`,
    );
  }
  if (countryCode === "VU" && !headers.includes("culturally_sensitive")) {
    fileProblems.push(
      "Vanuatu files need a culturally_sensitive column so every row answers the kastom prompt.",
    );
  }
  if (fileProblems.length > 0) {
    return { headers, rows: [], fileProblems };
  }
  const rows: ImportRow[] = dataRecords.map((record, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, column) => {
      values[header] = (record[column] ?? "").trim();
    });
    return { rowNumber: index + 2, values }; // +2: 1-based, after the header row
  });
  return { headers, rows, fileProblems };
}

// the row rules: every submit-path rule in the same wording, plus the
// two stricter additions the ratified note owns explicitly
export function validateImportRow(row: ImportRow, countryCode: string): string[] {
  const problems: string[] = [];
  const value = (key: string) => row.values[key] ?? "";

  if (!value("name")) {
    problems.push("Give the place a name as the source states it; a batch row without a name is unreviewable.");
  }
  if (value("country_code").toUpperCase() !== countryCode.toUpperCase()) {
    problems.push(`Row country ${value("country_code") || "(blank)"} does not match the file's country ${countryCode}.`);
  }
  if (value("denomination_code") && !value("taxonomy_version")) {
    problems.push("Add the taxonomy version that goes with the denomination code.");
  }

  const hasLat = value("lat") !== "";
  const hasLng = value("lng") !== "";
  if (hasLat !== hasLng) {
    problems.push("Enter both latitude and longitude, or leave both blank.");
  }
  if (hasLat && hasLng) {
    const lat = Number(value("lat"));
    const lng = Number(value("lng"));
    if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      problems.push("Latitude and longitude must be numeric and in range.");
    }
    if (!value("geocoding_basis")) {
      problems.push("Choose a geocoding basis so reviewers know how the point was placed.");
    }
  } else if (!value("containing_area")) {
    problems.push("A row without coordinates must name its containing area, even when a locality is given.");
  }
  if (value("geocoding_basis") && !GEOCODING_BASES.has(value("geocoding_basis") as GeocodingBasis)) {
    problems.push(`Unknown geocoding basis: ${value("geocoding_basis")}.`);
  }
  for (const key of ["location_confidence", "date_confidence"] as const) {
    if (value(key) && !CONFIDENCES.has(value(key) as Confidence)) {
      problems.push(`${key} must be high, medium, or low.`);
    }
  }
  for (const key of ["first_date", "last_date"] as const) {
    if (value(key) && !PARTIAL_DATE.test(value(key))) {
      problems.push(`Write ${key} as YYYY, YYYY-MM, or YYYY-MM-DD.`);
    }
  }
  if (value("source_url") && !/^https?:\/\//i.test(value("source_url"))) {
    problems.push("source_url must be an http(s) URL.");
  }
  if (!value("source_locator")) {
    problems.push("Every row needs a source_locator: a stable entry reference into the file's source record.");
  }
  const sensitive = value("culturally_sensitive").toLowerCase();
  if (sensitive && sensitive !== "yes" && sensitive !== "no") {
    problems.push("culturally_sensitive must be yes or no.");
  }
  return problems;
}

// a VU row without an explicit kastom answer is parked, never imported
export function isParkedSensitive(row: ImportRow, countryCode: string): boolean {
  if (countryCode.toUpperCase() !== "VU") return false;
  const sensitive = (row.values["culturally_sensitive"] ?? "").toLowerCase();
  return sensitive !== "yes" && sensitive !== "no";
}

// fnv-1a over the normalised known columns: the content half of the
// idempotency test (locator OR hash marks a duplicate)
export function claimHash(row: ImportRow): string {
  const normalised = [...KNOWN_HEADERS]
    .sort()
    .map((key) => `${key}=${(row.values[key] ?? "").trim().toLowerCase()}`)
    .join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalised.length; i += 1) {
    hash ^= normalised.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function sourceClaimKey(sourceRecordId: string, sourceLocator: string): string {
  return `${sourceRecordId}#${sourceLocator}`;
}

function lifecycleFromRow(row: ImportRow): LifecycleClaim[] {
  const confidence = ((row.values["date_confidence"] || "medium") as Confidence) ?? "medium";
  const claims: LifecycleClaim[] = [];
  if (row.values["first_date"]) {
    claims.push({ eventKind: "first_seen", date: { value: row.values["first_date"] }, confidence });
  }
  if (row.values["last_date"]) {
    claims.push({ eventKind: "last_seen", date: { value: row.values["last_date"] }, confidence });
  }
  return claims;
}

// the per-row second source reference: inherits the file's source type
// and derives a real title so the claim passes the submit path's
// real-title rule
function rowSourceReference(row: ImportRow, fileSource: SourceRecord): SourceReference | null {
  const url = row.values["source_url"];
  if (!url) return null;
  return {
    sourceType: fileSource.sourceType,
    title: `${fileSource.title}, entry ${row.values["source_locator"]}`,
    url,
  };
}

// preserved-extras rule: unknown columns land in the evidence notes so
// nothing the curator supplied is silently dropped
function extrasAsNotes(row: ImportRow): string {
  const extras = Object.entries(row.values)
    .filter(([key, val]) => !KNOWN_HEADERS.has(key) && val !== "")
    .map(([key, val]) => `${key}: ${val}`);
  const notes = row.values["notes"] ? [row.values["notes"]] : [];
  return [...notes, ...extras].join("\n");
}

export interface BuiltImportClaim {
  draft: Omit<EvidenceDraft, "draftId" | "taskId" | "updatedAt">;
  siteName: string;
  lat?: number;
  lng?: number;
}

export function buildImportClaim(
  row: ImportRow,
  countryCode: string,
  fileSource: SourceRecord,
  importBatchId: string,
): BuiltImportClaim {
  const values = row.values;
  const hasCoords = values["lat"] !== "" && values["lng"] !== "";
  const lat = hasCoords ? Number(values["lat"]) : undefined;
  const lng = hasCoords ? Number(values["lng"]) : undefined;
  const geocodingBasis: GeocodingBasis = hasCoords
    ? (values["geocoding_basis"] as GeocodingBasis)
    : values["locality"]
      ? "described_locality"
      : "regional_only";
  const locationConfidence: Confidence =
    (values["location_confidence"] as Confidence) || (hasCoords ? "medium" : "low");
  const rowSource = rowSourceReference(row, fileSource);
  const sensitiveAnswer = values["culturally_sensitive"]?.toLowerCase();

  return {
    siteName: values["name"] ?? "",
    lat,
    lng,
    draft: {
      countryCode,
      targetYearStatuses: {},
      location: {
        lat,
        lng,
        locality: values["locality"] || undefined,
        containingArea: values["containing_area"]
          ? { areaName: values["containing_area"], countryCode }
          : undefined,
        geocodingBasis,
        locationConfidence,
      },
      attributes: {
        name: values["name"],
        religion: values["religion"] || undefined,
        denominationCode: values["denomination_code"] || undefined,
        taxonomyVersion: values["taxonomy_version"] || undefined,
        culturallySensitive:
          sensitiveAnswer === "yes" ? true : sensitiveAnswer === "no" ? false : undefined,
      },
      lifecycle: lifecycleFromRow(row),
      sources: rowSource ? [fileSource, rowSource] : [fileSource],
      evidenceNotes: extrasAsNotes(row) || undefined,
      sourceRecordId: fileSource.sourceRecordId,
      contributionMode: "source_first",
      lane: "fixed",
      origin: "batch_import",
      providerKind: "demo",
      state: "draft",
      claimProvenance: {
        lane: "fixed",
        origin: "batch_import",
        sourceRecordId: fileSource.sourceRecordId,
        sourceLocator: row.values["source_locator"],
        sourceClaimKey: fileSource.sourceRecordId
          ? sourceClaimKey(fileSource.sourceRecordId, row.values["source_locator"] ?? "")
          : undefined,
        claimHash: claimHash(row),
        importBatchId,
      },
    },
  };
}

export type { BatchImportRowReport };
