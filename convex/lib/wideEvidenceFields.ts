// single source of truth for the site_evidence_wide column list (pr-b0 of
// the ruled temporal plan, jb 2026-08-31). the portal builds each draft's
// generated_wide_row from a mirror of this list
// (apps/regions/nz/js/wide-evidence-fields.js, loaded via a plain <script>
// tag, so it cannot import this module); the exporter takes the csv header
// from here and maps every row by column name; the draft routes refuse a
// row whose field list disagrees, so a stale portal build can never lose
// columns silently. the mirror, the template header
// (docs/templates/ra-historical-site-evidence/site_evidence_wide.csv) and
// this list are held equal by wideEvidenceFields.node-test.mjs. change all
// three in one commit.

export const WIDE_EVIDENCE_LEADING_FIELDS: readonly string[] = Object.freeze([
  "evidence_row_id", "collection_batch", "country_code", "area_hint",
  "source_dataset_id", "source_type", "provider", "source_title",
  "source_url_or_file", "source_record_id", "retrieval_date", "retrieved_by",
  "licence", "access_limits", "redistribution_limits", "raw_file_location",
  "source_notes", "name_raw", "name_standardised",
  "denomination_or_tradition_raw", "site_type", "address_raw",
  "historical_address_raw", "historical_locality_raw",
  "modern_address_candidate", "address_standardised", "locality_raw",
  "territorial_authority_hint", "address_change_note", "geocoding_basis",
  "geocoding_confidence", "latitude", "longitude", "geometry_wkt_or_geojson",
  "matched_osm_id", "osm_object_type", "osm_version_timestamp",
  "osm_tags_raw", "osm_start_date", "osm_old_start_date", "osm_end_date",
  "osm_lifecycle_date_notes", "matched_current_site_id", "candidate_site_id",
  "match_method", "match_confidence", "candidate_match_notes",
  "visual_verification_source", "visual_verification_url_or_file",
  "visual_verification_capture_date", "visual_verification_summary",
  "organisation_founded_date", "organisation_founded_date_precision",
  "site_opened_date", "site_opened_date_precision",
  "building_opened_or_dedicated_date",
  "building_opened_or_dedicated_date_precision",
  "origin_not_earlier_than_date", "origin_not_earlier_than_date_precision",
  "origin_not_later_than_date", "origin_not_later_than_date_precision",
  "first_seen_date", "first_seen_date_precision", "last_seen_date",
  "last_seen_date_precision", "site_closed_date", "site_closed_date_precision",
  "closure_not_earlier_than_date", "closure_not_earlier_than_date_precision",
  "closure_not_later_than_date", "closure_not_later_than_date_precision",
  "building_demolished_date", "building_demolished_date_precision",
  "use_changed_date", "use_changed_date_precision", "relocated_date",
  "relocated_date_precision", "date_evidence_raw", "date_evidence_summary",
  "existence_status", "worship_use_status", "public_access_status",
]);

// per census wave, in wave order: the observed status with its confirmed
// level of use (r-f1', 2026-09-03), probability and evidence, then the
// basis of the status and the confirmed derived location (occupancy lane,
// 2026-09-02), then the confirmed denomination and its basis (pr-f,
// 2026-09-03)
export const TARGET_YEAR_FIELD_SUFFIXES: readonly string[] = Object.freeze([
  "status", "use_level", "probability", "evidence",
  "basis", "latitude", "longitude", "uncertainty_radius_m", "location_basis",
  "denomination", "denomination_basis",
]);

export const WIDE_EVIDENCE_TRAILING_FIELDS: readonly string[] = Object.freeze([
  "quality_flag", "review_status",
  "privacy_flag", "licence_flag", "extracted_by", "extracted_at",
  "reviewed_by", "reviewed_at", "review_note", "exclusion_reason",
]);

export function targetYearFields(targetYears: readonly number[]): string[] {
  return targetYears.flatMap((year) => TARGET_YEAR_FIELD_SUFFIXES.map((suffix) => `target_year_${year}_${suffix}`));
}

// the full column list for a country's waves
export function wideEvidenceFields(targetYears: readonly number[]): string[] {
  return [
    ...WIDE_EVIDENCE_LEADING_FIELDS,
    ...targetYearFields(targetYears),
    ...WIDE_EVIDENCE_TRAILING_FIELDS,
  ];
}

export type GeneratedWideRow = {
  fields: string[];
  row: Record<string, unknown>;
};

// reads a draft's generated_wide_row into a typed shape, or undefined
// when the draft carries none (rapid drafts never do)
export function readGeneratedWideRow(value: unknown): GeneratedWideRow | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") {
    throw new Error("The generated wide row must be an object.");
  }
  const generated = value as { fields?: unknown; row?: unknown };
  if (!Array.isArray(generated.fields) || generated.fields.some((field) => typeof field !== "string")) {
    throw new Error("The generated wide row must list its fields.");
  }
  if (typeof generated.row !== "object" || generated.row === null || Array.isArray(generated.row)) {
    throw new Error("The generated wide row must carry a row object.");
  }
  return { fields: generated.fields as string[], row: generated.row as Record<string, unknown> };
}

// server-side gate: the row's field list must equal the shared list for
// the task's waves, in order, and the row may carry no other columns. a
// mismatch means the portal build is behind this module (the site's js
// sits behind a multi-hour cache), so the message says to reload
export function assertWideEvidenceRowFields(value: unknown, targetYears: readonly number[]): void {
  const generated = readGeneratedWideRow(value);
  if (generated === undefined) return;
  const expected = wideEvidenceFields(targetYears);
  const same = generated.fields.length === expected.length
    && generated.fields.every((field, index) => field === expected[index]);
  if (!same) {
    const missing = expected.filter((field) => !generated.fields.includes(field));
    const extra = generated.fields.filter((field) => !expected.includes(field));
    const detail = [
      missing.length ? `missing ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` : "",
      extra.length ? `unexpected ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? "…" : ""}` : "",
      !missing.length && !extra.length ? "columns out of order" : "",
    ].filter(Boolean).join("; ");
    throw new Error(`The portal's export column list is out of date (${detail}). Reload the portal and save again.`);
  }
  const unknownKeys = Object.keys(generated.row).filter((key) => !expected.includes(key));
  if (unknownKeys.length) {
    throw new Error(`The generated wide row carries columns outside the export list: ${unknownKeys.slice(0, 5).join(", ")}.`);
  }
}

// values in header order; a column the row lacks exports blank rather
// than shifting its neighbours
export function wideEvidenceRowValues(row: Record<string, unknown>, fields: readonly string[]): unknown[] {
  return fields.map((field) => (row[field] === undefined || row[field] === null ? "" : row[field]));
}
