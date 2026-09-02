// occupancy_v1: one segment of a place of worship's history — a period with
// uncertainty at one location with uncertainty — and the derivation of
// per-census-year presence and location from a set of segments. contract
// and rules per docs/development/occupancy-build-brief-2026-09-02.md,
// implementing the ruled temporal plan (jb 2026-08-31) with location added
// (jb 2026-09-02). derived values are proposals: they reach the observed
// vocabulary only through reviewer confirmation in convex/occupancies.ts.
import { partialDateLower, partialDateUpper } from "./historicalClaims.ts";
import { DEFAULT_DATE_FLOOR_YEAR } from "./countryYears.ts";
import { isValidPartialDate } from "./limits.ts";
import { assertLocationAssertion, type LocationAssertionInput } from "./locationAssertions.ts";
import { canonicalJson, sha256 } from "./sha256.ts";

export const OCCUPANCY_CONTRACT = "occupancy_v1";
export const OCCUPANCY_DERIVATION_VERSION = "occupancy_derivation_v1";

// Period dates are interpreted against the evidence they describe. The
// recorded date is only a legacy fallback for parents that predate that field.
export function occupancyReferenceDate(parentEvidenceDate: string | undefined, recordedAt: number): string {
  return parentEvidenceDate?.trim() || new Date(recordedAt).toISOString().slice(0, 10);
}

export type StartMode = "known" | "between" | "by" | "unknown";
export type EndMode = "still_active" | "known" | "between" | "after" | "unknown";
export type StartBasis = "founding_stated" | "reopening_stated" | "organisation_founded" | "building_dedication" | "first_seen_only" | "unknown";
export type EndBasis = "closure_stated" | "last_seen_only" | "unknown";
export type EndReason = "closed" | "relocated" | "demolished" | "use_changed" | "unknown";
export type DatePrecision = "day" | "month" | "year" | "bounded" | "unknown";
export type LocationRelation = "same_as_task_point" | "distinct";

export type OccupancySegmentInput = {
  contract_version: "occupancy_v1";
  segment_index: number;
  start_mode: StartMode;
  start_date?: string;
  start_not_earlier_than?: string;
  start_not_later_than?: string;
  start_basis: StartBasis;
  end_mode: EndMode;
  end_date?: string;
  end_not_earlier_than?: string;
  end_not_later_than?: string;
  end_basis: EndBasis;
  end_reason?: EndReason;
  still_active_asof?: string;
  successor_site_id?: string;
  location_relation: LocationRelation;
  location?: LocationAssertionInput;
  confidence: "high" | "moderate" | "low" | "uncertain";
  confidence_basis: string;
  source_basis: "inscription_or_document_observed" | "local_investigator_account" | "named_public_source" | "other";
  source_title: string;
  source_reference?: string;
  source_account: string;
  uncertainty_note?: string;
  privacy_flag: string;
};

// the stored, self-contained segment the derivation consumes
export type OccupancySegment = {
  occupancy_id: string;
  segment_index: number;
  start_mode: StartMode;
  start_date?: string;
  start_not_earlier_than?: string;
  start_not_later_than?: string;
  start_basis: StartBasis;
  end_mode: EndMode;
  end_date?: string;
  end_not_earlier_than?: string;
  end_not_later_than?: string;
  end_basis: EndBasis;
  end_reason?: EndReason;
  still_active_asof?: string;
  latitude: number;
  longitude: number;
  location_mode: "building_identified" | "approximate_area";
  location_basis: string;
  uncertainty_radius_m?: number;
};

const MAX_TEXT = 2_000;
const MIN_UNCERTAINTY_NOTE = 12;

function blank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function assertPartialDate(label: string, value: string | undefined, referenceDate: string, floorYear: number): string {
  const text = (value ?? "").trim();
  if (!isValidPartialDate(text) || Number(text.slice(0, 4)) < floorYear) {
    throw new Error(`${label} must be a real date as YYYY, YYYY-MM, or YYYY-MM-DD from ${floorYear} onward.`);
  }
  if (partialDateLower(text) > partialDateUpper(referenceDate)) {
    throw new Error(`${label} cannot be later than the evidence reference date (${referenceDate}).`);
  }
  return text;
}

function assertAbsent(label: string, value: string | undefined, why: string): void {
  if (!blank(value)) {
    throw new Error(`${label} must be blank ${why}.`);
  }
}

export function datePrecision(value: string | undefined): DatePrecision {
  if (blank(value)) return "unknown";
  const text = (value ?? "").trim();
  if (/^\d{4}$/.test(text)) return "year";
  if (/^\d{4}-\d{2}$/.test(text)) return "month";
  return "day";
}

export function startPrecision(segment: Pick<OccupancySegmentInput, "start_mode" | "start_date">): DatePrecision {
  if (segment.start_mode === "known") return datePrecision(segment.start_date);
  if (segment.start_mode === "unknown") return "unknown";
  return "bounded";
}

export function endPrecision(segment: Pick<OccupancySegmentInput, "end_mode" | "end_date">): DatePrecision {
  if (segment.end_mode === "known") return datePrecision(segment.end_date);
  if (segment.end_mode === "unknown" || segment.end_mode === "still_active") return "unknown";
  return "bounded";
}

// validates one segment's own fields against the parent evidence date
export function assertOccupancySegment(
  segment: OccupancySegmentInput,
  referenceDate: string,
  floorYear: number = DEFAULT_DATE_FLOOR_YEAR,
): void {
  if (segment.contract_version !== OCCUPANCY_CONTRACT) {
    throw new Error("Unsupported occupancy contract version.");
  }
  if (!Number.isInteger(segment.segment_index) || segment.segment_index < 0) {
    throw new Error("Each period needs a non-negative segment index.");
  }
  const s = segment;
  // start
  switch (s.start_mode) {
    case "known":
      assertPartialDate("The start date", s.start_date, referenceDate, floorYear);
      assertAbsent("The start bounds", s.start_not_earlier_than, "when the start date is known");
      assertAbsent("The start bounds", s.start_not_later_than, "when the start date is known");
      break;
    case "between":
      assertPartialDate("The earliest possible start", s.start_not_earlier_than, referenceDate, floorYear);
      assertPartialDate("The latest possible start", s.start_not_later_than, referenceDate, floorYear);
      if (partialDateLower(s.start_not_earlier_than!.trim()) > partialDateUpper(s.start_not_later_than!.trim())) {
        throw new Error("The earliest possible start must not be after the latest possible start.");
      }
      assertAbsent("The start date", s.start_date, "when the start is given as bounds");
      break;
    case "by":
      assertPartialDate("The latest possible start", s.start_not_later_than, referenceDate, floorYear);
      assertAbsent("The start date", s.start_date, "when the start is given as a latest date");
      assertAbsent("The earliest possible start", s.start_not_earlier_than, "when the start is given as a latest date");
      break;
    case "unknown":
      assertAbsent("The start date", s.start_date, "when the start is unknown");
      assertAbsent("The start bounds", s.start_not_earlier_than, "when the start is unknown");
      assertAbsent("The start bounds", s.start_not_later_than, "when the start is unknown");
      break;
    default:
      throw new Error("Choose how the start of the period is known.");
  }
  // basis asymmetry: a dated basis needs a date; an undated start has no basis
  if (s.start_mode === "unknown" && s.start_basis !== "unknown") {
    throw new Error("An unknown start cannot carry a start basis; record it as unknown.");
  }
  if (s.start_mode !== "unknown" && s.start_basis === "unknown") {
    throw new Error("A dated start needs its basis: founding stated, reopening stated, organisation founded, building dedication, or first seen only.");
  }
  // end
  switch (s.end_mode) {
    case "still_active":
      assertPartialDate("The still-active date", s.still_active_asof, referenceDate, floorYear);
      assertAbsent("The end date", s.end_date, "while the place is still active");
      assertAbsent("The end bounds", s.end_not_earlier_than, "while the place is still active");
      assertAbsent("The end bounds", s.end_not_later_than, "while the place is still active");
      if (s.end_reason !== undefined) {
        throw new Error("A still-active period has no end reason.");
      }
      break;
    case "known":
      assertPartialDate("The end date", s.end_date, referenceDate, floorYear);
      assertAbsent("The end bounds", s.end_not_earlier_than, "when the end date is known");
      assertAbsent("The end bounds", s.end_not_later_than, "when the end date is known");
      break;
    case "between":
      assertPartialDate("The earliest possible end", s.end_not_earlier_than, referenceDate, floorYear);
      assertPartialDate("The latest possible end", s.end_not_later_than, referenceDate, floorYear);
      if (partialDateLower(s.end_not_earlier_than!.trim()) > partialDateUpper(s.end_not_later_than!.trim())) {
        throw new Error("The earliest possible end must not be after the latest possible end.");
      }
      assertAbsent("The end date", s.end_date, "when the end is given as bounds");
      break;
    case "after":
      assertPartialDate("The earliest possible end", s.end_not_earlier_than, referenceDate, floorYear);
      assertAbsent("The end date", s.end_date, "when the end is given as an earliest date");
      assertAbsent("The latest possible end", s.end_not_later_than, "when the end is given as an earliest date");
      break;
    case "unknown":
      assertAbsent("The end date", s.end_date, "when the end is unknown");
      assertAbsent("The end bounds", s.end_not_earlier_than, "when the end is unknown");
      assertAbsent("The end bounds", s.end_not_later_than, "when the end is unknown");
      break;
    default:
      throw new Error("Choose how the end of the period is known.");
  }
  if (s.end_mode !== "still_active") {
    assertAbsent("The still-active date", s.still_active_asof, "unless the place is still active");
  }
  const endUndated = s.end_mode === "still_active" || s.end_mode === "unknown";
  if (endUndated && s.end_basis !== "unknown") {
    throw new Error("An undated end cannot carry an end basis; record it as unknown.");
  }
  if (!endUndated && s.end_basis === "unknown") {
    throw new Error("A dated end needs its basis: closure stated or last seen only.");
  }
  if (!endUndated && s.end_mode !== "unknown" && s.end_reason === undefined) {
    throw new Error("A dated end needs its reason: closed, relocated, demolished, use changed, or unknown.");
  }
  if (s.successor_site_id !== undefined && s.end_reason === "relocated") {
    throw new Error("A relocation keeps the same place of worship; a successor identifier is only for a split.");
  }
  // ordering within the segment
  const b = segmentBounds(s);
  if (b.startLower !== undefined && b.endUpper !== undefined && b.startLower > b.endUpper) {
    throw new Error("The period cannot end before it begins.");
  }
  if (b.startUpper !== undefined && b.endLower !== undefined && b.startUpper > b.endLower && s.end_mode !== "still_active") {
    // the certain core would be empty: allowed only when the windows are
    // honestly overlapping bounds, so require them to overlap rather than invert
    if (b.startLower !== undefined && b.startLower > b.endLower) {
      throw new Error("The period cannot end before it begins.");
    }
  }
  // a wholly undated period needs its wording preserved
  if (s.start_mode === "unknown" && s.end_mode === "unknown" && (s.uncertainty_note ?? "").trim().length < MIN_UNCERTAINTY_NOTE) {
    throw new Error(`A period with no dated start or end needs an uncertainty note of at least ${MIN_UNCERTAINTY_NOTE} characters.`);
  }
  // location
  if (s.location_relation === "distinct") {
    if (s.location === undefined) {
      throw new Error("A period at a different place needs its location.");
    }
    assertLocationAssertion(s.location);
  } else if (s.location_relation !== "same_as_task_point") {
    throw new Error("Say whether the period was at the pin or at a different place.");
  } else if (s.location !== undefined) {
    assertLocationAssertion(s.location);
  }
  // provenance text
  if (blank(s.source_title)) throw new Error("Name the source for this period.");
  if ((s.source_account ?? "").trim().length < 12) {
    throw new Error("Record what the source says about this period (at least 12 characters).");
  }
  if (blank(s.confidence_basis)) throw new Error("Say what the confidence rests on.");
  for (const [label, value] of [
    ["source title", s.source_title],
    ["source reference", s.source_reference],
    ["source account", s.source_account],
    ["confidence basis", s.confidence_basis],
    ["uncertainty note", s.uncertainty_note],
  ] as const) {
    if (value !== undefined && value.length > MAX_TEXT) {
      throw new Error(`The ${label} must be ${MAX_TEXT} characters or fewer.`);
    }
  }
}

// validates a whole submission: indices, one-place-at-a-time, relocation links
export function assertOccupancySet(
  segments: OccupancySegmentInput[],
  referenceDate: string,
  taskPoint: { latitude: number; longitude: number },
  floorYear: number = DEFAULT_DATE_FLOOR_YEAR,
): void {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("Record at least one period.");
  }
  if (segments.length > 20) {
    throw new Error("A submission carries at most 20 periods.");
  }
  segments.forEach((segment) => assertOccupancySegment(segment, referenceDate, floorYear));
  const ordered = [...segments].sort((a, b) => a.segment_index - b.segment_index);
  ordered.forEach((segment, index) => {
    if (segment.segment_index !== index) {
      throw new Error("Periods must be numbered 0, 1, 2… without gaps.");
    }
  });
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const here = segmentBounds(ordered[i]);
    const next = segmentBounds(ordered[i + 1]);
    if (ordered[i].end_mode === "still_active") {
      throw new Error("A still-active period must be the last period.");
    }
    if (here.endLower !== undefined && next.startUpper !== undefined && here.endLower > next.startUpper) {
      throw new Error("Periods overlap: a place of worship occupies one place at a time.");
    }
    if (ordered[i].end_reason === "relocated") {
      const a = resolveLocation(ordered[i], taskPoint);
      const b = resolveLocation(ordered[i + 1], taskPoint);
      if (Math.abs(a.latitude - b.latitude) < 1e-7 && Math.abs(a.longitude - b.longitude) < 1e-7) {
        throw new Error("A relocated period must be followed by a period at a different place.");
      }
    }
  }
  const last = ordered[ordered.length - 1];
  if (last.end_reason === "relocated") {
    throw new Error("A relocated period needs the following period at the new place.");
  }
}

// the point and assertion fields a segment stores
export function resolveLocation(
  segment: Pick<OccupancySegmentInput, "location_relation" | "location">,
  taskPoint: { latitude: number; longitude: number },
): {
  latitude: number;
  longitude: number;
  location_mode: "building_identified" | "approximate_area";
  location_basis: string;
  uncertainty_radius_m?: number;
  location_wording?: string;
  location_confidence: string;
} {
  if (segment.location !== undefined) {
    return {
      latitude: segment.location.latitude,
      longitude: segment.location.longitude,
      location_mode: segment.location.mode,
      location_basis: segment.location.basis,
      ...(segment.location.uncertainty_radius_m !== undefined ? { uncertainty_radius_m: segment.location.uncertainty_radius_m } : {}),
      ...(segment.location.source_wording ? { location_wording: segment.location.source_wording } : {}),
      location_confidence: segment.location.confidence,
    };
  }
  return {
    latitude: taskPoint.latitude,
    longitude: taskPoint.longitude,
    location_mode: "building_identified",
    location_basis: "map_placement",
    location_confidence: "high",
  };
}

export type SegmentBounds = {
  startLower?: string;
  startUpper?: string;
  endLower?: string;
  endUpper?: string;
  open: boolean;
  asof?: string;
};

// iso day bounds of a segment's start and end; still_active anchors the
// end's lower bound at the as-of date and leaves the upper bound open
export function segmentBounds(
  s: Pick<OccupancySegmentInput,
    "start_mode" | "start_date" | "start_not_earlier_than" | "start_not_later_than"
    | "end_mode" | "end_date" | "end_not_earlier_than" | "end_not_later_than" | "still_active_asof">,
): SegmentBounds {
  const t = (value: string | undefined) => (value ?? "").trim();
  const bounds: SegmentBounds = { open: false };
  switch (s.start_mode) {
    case "known":
      bounds.startLower = partialDateLower(t(s.start_date));
      bounds.startUpper = partialDateUpper(t(s.start_date));
      break;
    case "between":
      bounds.startLower = partialDateLower(t(s.start_not_earlier_than));
      bounds.startUpper = partialDateUpper(t(s.start_not_later_than));
      break;
    case "by":
      bounds.startUpper = partialDateUpper(t(s.start_not_later_than));
      break;
    default:
      break;
  }
  switch (s.end_mode) {
    case "still_active":
      bounds.open = true;
      bounds.asof = partialDateUpper(t(s.still_active_asof));
      bounds.endLower = bounds.asof;
      break;
    case "known":
      bounds.endLower = partialDateLower(t(s.end_date));
      bounds.endUpper = partialDateUpper(t(s.end_date));
      break;
    case "between":
      bounds.endLower = partialDateLower(t(s.end_not_earlier_than));
      bounds.endUpper = partialDateUpper(t(s.end_not_later_than));
      break;
    case "after":
      bounds.endLower = partialDateLower(t(s.end_not_earlier_than));
      break;
    default:
      break;
  }
  return bounds;
}

export type PresenceStatus = "present" | "absent" | "uncertain";
export type PresenceRuleId =
  | "inside_interval"
  | "before_stated_founding"
  | "before_stated_reopening"
  | "before_first_record"
  | "after_stated_closure"
  | "after_last_record"
  | "within_start_window"
  | "within_end_window"
  | "beyond_active_anchor"
  | "start_unknown"
  | "end_unknown";

export type SegmentFiring = {
  occupancy_id: string;
  rule_id: PresenceRuleId;
  status: PresenceStatus;
};

// the ruled rule table, first match wins; rule 8 precedes rule 7 so an open
// segment reports its anchor; rule 10 (end_unknown) is the brief's addition
export function presenceForSegment(segment: OccupancySegment, year: number): SegmentFiring | null {
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  const b = segmentBounds(segment);
  const fire = (rule_id: PresenceRuleId, status: PresenceStatus): SegmentFiring => ({ occupancy_id: segment.occupancy_id, rule_id, status });

  if (b.startUpper !== undefined && b.startUpper <= yStart && b.endLower !== undefined && yEnd <= b.endLower) {
    return fire("inside_interval", "present");
  }
  // a stated founding or a stated reopening both license absence before
  // the start: a source that states a reopening states that the place was
  // out of use until then (rule 2 and its pr-e twin 2b)
  if (b.startLower !== undefined && yEnd < b.startLower) {
    if (segment.start_basis === "founding_stated") return fire("before_stated_founding", "absent");
    if (segment.start_basis === "reopening_stated") return fire("before_stated_reopening", "absent");
    return fire("before_first_record", "uncertain");
  }
  if (b.endUpper !== undefined && yStart > b.endUpper) {
    return segment.end_basis === "closure_stated"
      ? fire("after_stated_closure", "absent")
      : fire("after_last_record", "uncertain");
  }
  if (b.startUpper !== undefined && yStart < b.startUpper && (b.startLower === undefined || yEnd >= b.startLower)) {
    return fire("within_start_window", "uncertain");
  }
  if (b.open && b.asof !== undefined && yEnd > b.asof) {
    return fire("beyond_active_anchor", "uncertain");
  }
  if (!b.open && b.endLower !== undefined && yEnd > b.endLower && (b.endUpper === undefined || yStart <= b.endUpper)) {
    return fire("within_end_window", "uncertain");
  }
  if (b.startUpper === undefined && b.startLower === undefined && (b.endLower === undefined || yEnd <= b.endLower)) {
    return fire("start_unknown", "uncertain");
  }
  if (b.startUpper !== undefined && b.startUpper <= yStart && b.endLower === undefined && !b.open) {
    return fire("end_unknown", "uncertain");
  }
  return null;
}

export type DerivedPresence = {
  target_year: number;
  derived_status: PresenceStatus;
  rule_id: string;
  segment_rules: SegmentFiring[];
};

// combines the per-segment firings for one year
export function combinePresence(year: number, firings: SegmentFiring[]): DerivedPresence | null {
  if (firings.length === 0) return null;
  const pick = (status: PresenceStatus) => firings.find((f) => f.status === status);
  const present = pick("present");
  if (present) return { target_year: year, derived_status: "present", rule_id: present.rule_id, segment_rules: firings };
  const uncertain = pick("uncertain");
  if (uncertain) return { target_year: year, derived_status: "uncertain", rule_id: uncertain.rule_id, segment_rules: firings };
  return { target_year: year, derived_status: "absent", rule_id: firings[0].rule_id, segment_rules: firings };
}

export function derivePresence(segments: OccupancySegment[], targetYears: readonly number[]): DerivedPresence[] {
  const out: DerivedPresence[] = [];
  for (const year of targetYears) {
    const firings = segments
      .map((segment) => presenceForSegment(segment, year))
      .filter((f): f is SegmentFiring => f !== null);
    const combined = combinePresence(year, firings);
    if (combined !== null) out.push(combined);
  }
  return out;
}

export type LocationRuleId = "occupancy_covers_year" | "transition_window" | "within_own_window" | "imputed_from_nearest";
export type LocationStatus = "located" | "located_uncertain" | "imputed";

export type DerivedLocation = {
  target_year: number;
  occupancy_id: string;
  rule_id: LocationRuleId;
  location_status: LocationStatus;
  latitude: number;
  longitude: number;
  location_mode: "building_identified" | "approximate_area";
  location_basis: string;
  uncertainty_radius_m?: number;
  gap_years?: number;
  transition_group?: string;
};

const WINDOW_RULES = new Set<PresenceRuleId>(["within_start_window", "within_end_window", "beyond_active_anchor", "end_unknown"]);

function locationRow(segment: OccupancySegment, year: number, rule_id: LocationRuleId, location_status: LocationStatus): DerivedLocation {
  return {
    target_year: year,
    occupancy_id: segment.occupancy_id,
    rule_id,
    location_status,
    latitude: segment.latitude,
    longitude: segment.longitude,
    location_mode: segment.location_mode,
    location_basis: segment.location_basis,
    ...(segment.uncertainty_radius_m !== undefined ? { uncertainty_radius_m: segment.uncertainty_radius_m } : {}),
  };
}

// years between the census year and the segment's nearest dated bound
export function gapYears(segment: OccupancySegment, year: number): number {
  const b = segmentBounds(segment);
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  if (b.startLower !== undefined && b.startLower > yEnd) return Number(b.startLower.slice(0, 4)) - year;
  const lastKnown = b.endUpper ?? b.endLower;
  if (lastKnown !== undefined && lastKnown < yStart) return year - Number(lastKnown.slice(0, 4));
  return 0;
}

// rules l1–l5 on one year's per-segment firings
export function locationsForYear(
  segments: OccupancySegment[],
  presence: DerivedPresence | null,
  year: number,
): DerivedLocation[] {
  if (presence === null || presence.derived_status === "absent") return [];
  const byId = new Map(segments.map((segment) => [segment.occupancy_id, segment]));
  const covering = presence.segment_rules.filter((f) => f.rule_id === "inside_interval");
  const windowed = presence.segment_rules.filter((f) => WINDOW_RULES.has(f.rule_id));
  if (covering.length === 1 && windowed.length === 0) {
    return [locationRow(byId.get(covering[0].occupancy_id)!, year, "occupancy_covers_year", "located")];
  }
  const candidates = [...covering, ...windowed];
  if (candidates.length >= 2) {
    const group = `${year}:${candidates.map((f) => f.occupancy_id).join("|")}`;
    return candidates.map((f) => ({
      ...locationRow(byId.get(f.occupancy_id)!, year, "transition_window", "located_uncertain"),
      transition_group: group,
    }));
  }
  if (candidates.length === 1) {
    return [locationRow(byId.get(candidates[0].occupancy_id)!, year, "within_own_window", "located_uncertain")];
  }
  // l4: presence derived but no segment reaches the year
  let nearest: OccupancySegment | null = null;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (const segment of segments) {
    const gap = gapYears(segment, year);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = segment;
    }
  }
  if (nearest === null) return [];
  return [{ ...locationRow(nearest, year, "imputed_from_nearest", "imputed"), gap_years: nearestGap }];
}

export function deriveLocations(
  segments: OccupancySegment[],
  presences: DerivedPresence[],
  targetYears: readonly number[],
): DerivedLocation[] {
  const byYear = new Map(presences.map((p) => [p.target_year, p]));
  return targetYears.flatMap((year) => locationsForYear(segments, byYear.get(year) ?? null, year));
}

// hash over every field the derivation consumes, so an edit to any of them
// resets the derived rows to unconfirmed
export function occupancyInputsHash(segments: OccupancySegment[]): string {
  const consumed = [...segments]
    .sort((a, b) => a.segment_index - b.segment_index)
    .map((s) => ({
      occupancy_id: s.occupancy_id,
      segment_index: s.segment_index,
      start_mode: s.start_mode,
      start_date: s.start_date ?? null,
      start_not_earlier_than: s.start_not_earlier_than ?? null,
      start_not_later_than: s.start_not_later_than ?? null,
      start_basis: s.start_basis,
      end_mode: s.end_mode,
      end_date: s.end_date ?? null,
      end_not_earlier_than: s.end_not_earlier_than ?? null,
      end_not_later_than: s.end_not_later_than ?? null,
      end_basis: s.end_basis,
      still_active_asof: s.still_active_asof ?? null,
      latitude: s.latitude,
      longitude: s.longitude,
      location_mode: s.location_mode,
      uncertainty_radius_m: s.uncertainty_radius_m ?? null,
    }));
  return sha256(canonicalJson({ version: OCCUPANCY_DERIVATION_VERSION, segments: consumed }));
}

// plain words for the reviewer's confirm bar
export const PRESENCE_RULE_TEXT: Record<PresenceRuleId, string> = {
  inside_interval: "the year falls inside the recorded period",
  before_stated_founding: "the year is before the stated founding",
  before_stated_reopening: "the year is before the stated reopening",
  before_first_record: "the year is before the first record, which does not prove absence",
  after_stated_closure: "the year is after the stated closure",
  after_last_record: "the year is after the last record, which does not prove absence",
  within_start_window: "the year falls inside the start uncertainty window",
  within_end_window: "the year falls inside the end uncertainty window",
  beyond_active_anchor: "the year is after the still-active date; an observation cannot speak past itself",
  start_unknown: "the start is unknown",
  end_unknown: "the end is unknown",
};

export const LOCATION_RULE_TEXT: Record<LocationRuleId, string> = {
  occupancy_covers_year: "one period certainly covers the year",
  transition_window: "the year falls between two periods' uncertainty windows",
  within_own_window: "the year falls inside this period's uncertainty window",
  imputed_from_nearest: "no dated period reaches the year; location carried from the nearest period",
};
