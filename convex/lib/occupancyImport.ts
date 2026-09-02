// occupancy columns of the bulk-import contract (PR-D of
// docs/portal-location-and-occupancy-plan.md, section 4): one import row per
// period of one place, rows of the same place sharing source_locator and
// numbered by segment_index. this module turns a row's column strings into
// an occupancy_v1 segment; the full set is then validated by
// assertOccupancySet exactly as an ra submission is. pure, so the builder
// scripts and the server agree on one reading of the columns.
import type { LocationAssertionInput } from "./locationAssertions.ts";
import type { OccupancySegmentInput } from "./occupancies.ts";

export const OCCUPANCY_IMPORT_COLUMNS = [
  "segment_index",
  "start_mode",
  "start_date",
  "start_not_earlier_than",
  "start_not_later_than",
  "start_basis",
  "end_mode",
  "end_date",
  "end_not_earlier_than",
  "end_not_later_than",
  "end_basis",
  "end_reason",
  "still_active_asof",
  "latitude",
  "longitude",
  "location_mode",
  "uncertainty_radius_m",
  "location_basis",
  "location_wording",
  "occupancy_confidence",
  "occupancy_confidence_basis",
  "occupancy_source_basis",
  "occupancy_source_reference",
  "occupancy_source_account",
  "occupancy_uncertainty_note",
] as const;

export type OccupancyImportColumn = (typeof OCCUPANCY_IMPORT_COLUMNS)[number];

// the typed row shape: numbers arrive as numbers from the json run file and
// as strings from a csv; both are accepted
export type OccupancyImportRow = {
  segment_index?: number | string;
  start_mode?: string;
  start_date?: string;
  start_not_earlier_than?: string;
  start_not_later_than?: string;
  start_basis?: string;
  end_mode?: string;
  end_date?: string;
  end_not_earlier_than?: string;
  end_not_later_than?: string;
  end_basis?: string;
  end_reason?: string;
  still_active_asof?: string;
  latitude?: number | string;
  longitude?: number | string;
  location_mode?: string;
  uncertainty_radius_m?: number | string;
  location_basis?: string;
  location_wording?: string;
  occupancy_confidence?: string;
  occupancy_confidence_basis?: string;
  occupancy_source_basis?: string;
  occupancy_source_reference?: string;
  occupancy_source_account?: string;
  occupancy_uncertainty_note?: string;
};

export type OccupancyImportDefaults = {
  sourceTitle: string;
  sourceLocator: string;
  taskPoint: { latitude: number; longitude: number };
  privacyFlag: "clear" | "needs_review" | "restricted";
};

const START_MODES = new Set(["known", "between", "by", "unknown"]);
const END_MODES = new Set(["still_active", "known", "between", "after", "unknown"]);
const START_BASES = new Set(["founding_stated", "reopening_stated", "organisation_founded", "building_dedication", "first_seen_only", "unknown"]);
const END_BASES = new Set(["closure_stated", "last_seen_only", "unknown"]);
const END_REASONS = new Set(["closed", "relocated", "demolished", "use_changed", "unknown"]);
const LOCATION_MODES = new Set(["building_identified", "approximate_area"]);
const LOCATION_BASES = new Set(["map_placement", "address_or_locality", "named_source_description", "local_investigator_account", "other"]);
const CONFIDENCES = new Set(["high", "moderate", "low", "uncertain"]);
const SOURCE_BASES = new Set(["inscription_or_document_observed", "local_investigator_account", "named_public_source", "other"]);

const DEFAULT_CONFIDENCE_BASIS = "Imported from the file source as compiled by its author; not independently checked.";

function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberOf(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

// a row carries a period when either temporal mode is present
export function rowHasOccupancy(row: OccupancyImportRow): boolean {
  return text(row.start_mode) !== undefined || text(row.end_mode) !== undefined;
}

// the location-assertion confidence follows the mode and radius, so the
// import needs no extra column for it
export function assertionConfidence(
  mode: "building_identified" | "approximate_area",
  radius: number | undefined,
): LocationAssertionInput["confidence"] {
  if (mode === "building_identified") return "high";
  if (radius === undefined) return "uncertain";
  if (radius <= 300) return "moderate";
  if (radius <= 2_000) return "low";
  return "uncertain";
}

// build the embedded assertion for a segment: an explicit point makes the
// period distinct from the task point; a mode without a point describes the
// task point itself
function locationOf(
  row: OccupancyImportRow,
  defaults: OccupancyImportDefaults,
  problems: string[],
): { relation: "same_as_task_point" | "distinct"; location?: LocationAssertionInput } {
  let latitude = numberOf(row.latitude);
  let longitude = numberOf(row.longitude);
  if ((latitude === undefined) !== (longitude === undefined)) {
    problems.push("Enter both latitude and longitude for the period, or leave both blank.");
    latitude = undefined;
    longitude = undefined;
  } else if (latitude !== undefined && (Number.isNaN(latitude) || Number.isNaN(longitude!))) {
    problems.push("The period's latitude and longitude must be numeric.");
    latitude = undefined;
    longitude = undefined;
  }
  const radius = numberOf(row.uncertainty_radius_m);
  if (radius !== undefined && Number.isNaN(radius)) {
    problems.push("uncertainty_radius_m must be a whole number of metres.");
  }
  const modeText = text(row.location_mode);
  if (modeText !== undefined && !LOCATION_MODES.has(modeText)) {
    problems.push(`Unknown location_mode: ${modeText}.`);
  }
  const basisText = text(row.location_basis);
  if (basisText !== undefined && !LOCATION_BASES.has(basisText)) {
    problems.push(`Unknown location_basis: ${basisText}.`);
  }
  const hasPoint = latitude !== undefined;
  const describesLocation = hasPoint || modeText !== undefined || radius !== undefined || basisText !== undefined || text(row.location_wording) !== undefined;
  if (!describesLocation) {
    return { relation: "same_as_task_point" };
  }
  const mode = (modeText ?? (radius !== undefined ? "approximate_area" : "building_identified")) as LocationAssertionInput["mode"];
  const point = hasPoint ? { latitude: latitude!, longitude: longitude! } : defaults.taskPoint;
  const samePoint = Math.abs(point.latitude - defaults.taskPoint.latitude) < 1e-9
    && Math.abs(point.longitude - defaults.taskPoint.longitude) < 1e-9;
  const location: LocationAssertionInput = {
    contract_version: "location_assertion_v1",
    mode,
    basis: (basisText ?? "map_placement") as LocationAssertionInput["basis"],
    latitude: point.latitude,
    longitude: point.longitude,
    ...(radius !== undefined && !Number.isNaN(radius) ? { uncertainty_radius_m: Math.round(radius) } : {}),
    ...(text(row.location_wording) ? { source_wording: text(row.location_wording) } : {}),
    confidence: assertionConfidence(mode, radius !== undefined && !Number.isNaN(radius) ? radius : undefined),
    contributor_confirmed: true,
  };
  return { relation: samePoint ? "same_as_task_point" : "distinct", location };
}

// reads one import row as one occupancy_v1 segment. vocabulary and number
// problems are reported here; date rules, basis asymmetry, and ordering are
// left to assertOccupancySet so the import cannot drift from the ra path
export function segmentFromImportRow(
  row: OccupancyImportRow,
  defaults: OccupancyImportDefaults,
): { segment: OccupancySegmentInput | null; problems: string[] } {
  const problems: string[] = [];
  const index = numberOf(row.segment_index) ?? 0;
  if (!Number.isInteger(index) || index < 0) {
    problems.push("segment_index must be a whole number from 0.");
  }
  const startMode = text(row.start_mode) ?? "unknown";
  if (!START_MODES.has(startMode)) problems.push(`Unknown start_mode: ${startMode}.`);
  const startBasis = text(row.start_basis) ?? (startMode === "unknown" ? "unknown" : "");
  if (!START_BASES.has(startBasis)) {
    problems.push(startBasis ? `Unknown start_basis: ${startBasis}.` : "A dated start needs start_basis.");
  }
  const endMode = text(row.end_mode) ?? "unknown";
  if (!END_MODES.has(endMode)) problems.push(`Unknown end_mode: ${endMode}.`);
  const endUndated = endMode === "still_active" || endMode === "unknown";
  const endBasis = text(row.end_basis) ?? (endUndated ? "unknown" : "");
  if (!END_BASES.has(endBasis)) {
    problems.push(endBasis ? `Unknown end_basis: ${endBasis}.` : "A dated end needs end_basis.");
  }
  const endReason = text(row.end_reason);
  if (endReason !== undefined && !END_REASONS.has(endReason)) problems.push(`Unknown end_reason: ${endReason}.`);
  const confidence = text(row.occupancy_confidence) ?? "moderate";
  if (!CONFIDENCES.has(confidence)) problems.push(`Unknown occupancy_confidence: ${confidence}.`);
  const sourceBasis = text(row.occupancy_source_basis) ?? "named_public_source";
  if (!SOURCE_BASES.has(sourceBasis)) problems.push(`Unknown occupancy_source_basis: ${sourceBasis}.`);
  const { relation, location } = locationOf(row, defaults, problems);
  if (problems.length > 0) {
    return { segment: null, problems };
  }
  const segment: OccupancySegmentInput = {
    contract_version: "occupancy_v1",
    segment_index: index,
    start_mode: startMode as OccupancySegmentInput["start_mode"],
    ...(text(row.start_date) ? { start_date: text(row.start_date) } : {}),
    ...(text(row.start_not_earlier_than) ? { start_not_earlier_than: text(row.start_not_earlier_than) } : {}),
    ...(text(row.start_not_later_than) ? { start_not_later_than: text(row.start_not_later_than) } : {}),
    start_basis: startBasis as OccupancySegmentInput["start_basis"],
    end_mode: endMode as OccupancySegmentInput["end_mode"],
    ...(text(row.end_date) ? { end_date: text(row.end_date) } : {}),
    ...(text(row.end_not_earlier_than) ? { end_not_earlier_than: text(row.end_not_earlier_than) } : {}),
    ...(text(row.end_not_later_than) ? { end_not_later_than: text(row.end_not_later_than) } : {}),
    end_basis: endBasis as OccupancySegmentInput["end_basis"],
    ...(endReason !== undefined ? { end_reason: endReason as OccupancySegmentInput["end_reason"] } : {}),
    ...(text(row.still_active_asof) ? { still_active_asof: text(row.still_active_asof) } : {}),
    location_relation: relation,
    ...(location !== undefined ? { location } : {}),
    confidence: confidence as OccupancySegmentInput["confidence"],
    confidence_basis: text(row.occupancy_confidence_basis) ?? DEFAULT_CONFIDENCE_BASIS,
    source_basis: sourceBasis as OccupancySegmentInput["source_basis"],
    source_title: defaults.sourceTitle,
    source_reference: text(row.occupancy_source_reference) ?? defaults.sourceLocator,
    source_account: text(row.occupancy_source_account)
      ?? `${defaults.sourceTitle}, entry ${defaults.sourceLocator}: period as recorded in the source.`,
    ...(text(row.occupancy_uncertainty_note) ? { uncertainty_note: text(row.occupancy_uncertainty_note) } : {}),
    privacy_flag: defaults.privacyFlag,
  };
  return { segment, problems: [] };
}

// groups import rows by source_locator, preserving first-appearance order
// and sorting each place's rows by segment_index
export function groupImportRows<T extends OccupancyImportRow & { source_locator: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.source_locator.trim();
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [row]);
    } else {
      group.push(row);
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (numberOf(a.segment_index) ?? 0) - (numberOf(b.segment_index) ?? 0));
  }
  return groups;
}
