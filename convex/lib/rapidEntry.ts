import { WORLD_INTAKE_BOUNDS } from "./countryRegistry.generated.ts";

export type CurrentObservationStatus =
  | "currently_used_for_worship"
  | "place_exists_worship_uncertain"
  | "place_exists_not_used_for_worship"
  | "place_no_longer_exists"
  | "could_not_determine";

export type CurrentObservationBasis =
  | "direct_field_observation"
  | "local_investigator_account"
  | "named_public_source"
  | "other";

export type DerivedCurrentObservation = {
  action: "confirm_current_record" | "missing_current_site" | "closed_or_changed_use" | "no_building_present" | "needs_review";
  existence_status: "present" | "absent" | "uncertain";
  worship_use_status: "confirmed_worship" | "not_worship" | "uncertain";
};

export type CountryIntakeBounds = {
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
  // true only where the country's assigned batch itself uses the rapid
  // design; nominations are rapid-eligible in every registry country
  assignedRapid?: boolean;
  // false refuses the approximate-area location mode for the country;
  // absent or true accepts it (jb ruling r1, 2026-09-02)
  approximateArea?: boolean;
};

// closed per-country registry of rapid-intake bounding boxes, keyed by
// upper-case iso2 code. a country absent here refuses rapid intake rather
// than defaulting open; enabling a country is a deliberate bounds ruling
// (jb, 2026-08-31). an east edge greater than 180 marks a box that crosses
// the antimeridian and is read as east - 360 on the wrapped side.
export const COUNTRY_INTAKE_BOUNDS: Record<string, CountryIntakeBounds> = {
  // assignedRapid: the country's ASSIGNED batch is designed source-first,
  // so rapid observations are accepted on its existing batch tasks; for
  // every other country the rapid task path is restricted to the
  // country's manual nomination batch (jb separation ruling 2026-08-31)
  VU: { name: "Vanuatu", west: 166.491, south: -20.303, east: 170.289, north: -13.022, assignedRapid: true, approximateArea: true },
  // nz includes the chatham islands near 176.5°W, so the box crosses the
  // antimeridian: a longitude is inside when it falls in [165.5, 180] or
  // in the wrapped run [-180, -176] (east 184 - 360)
  NZ: { name: "New Zealand", west: 165.5, south: -47.5, east: 184.0, north: -34.0, approximateArea: true },
};

// one home for the nomination-batch naming contract shared by the rapid
// candidate path, createManualCandidateTask, and the portal
export function manualBatchId(countryCode: string): string {
  return `manual-${countryCode.toLowerCase()}`;
}

// the country's issue batch: revisions of existing records filed from a
// grey context dot land here, and the rapid path accepts observations on
// them exactly as on nominations (revise-with-evidence lane, jb 2026-09-02)
export function issueBatchId(countryCode: string): string {
  return `ra-issues-${countryCode.toLowerCase()}`;
}

export type RapidCandidateContext = {
  placement_zoom?: number;
  proximity_checked?: boolean;
  nearby_count?: number;
};

// Converts the observer's explicit answer into existing provisional fields.
export function deriveCurrentObservation(
  status: CurrentObservationStatus,
  newCandidate: boolean,
): DerivedCurrentObservation {
  switch (status) {
    case "currently_used_for_worship":
      return {
        action: newCandidate ? "missing_current_site" : "confirm_current_record",
        existence_status: "present",
        worship_use_status: "confirmed_worship",
      };
    case "place_exists_worship_uncertain":
      return {
        action: "needs_review",
        existence_status: "present",
        worship_use_status: "uncertain",
      };
    case "place_exists_not_used_for_worship":
      return {
        action: "closed_or_changed_use",
        existence_status: "present",
        worship_use_status: "not_worship",
      };
    // jb 2026-09-03: the building or site is gone, which is the guided
    // form's no_building_present finding, so reviewers see one action for
    // one fact; the periods carry any known dates
    case "place_no_longer_exists":
      return {
        action: "no_building_present",
        existence_status: "absent",
        worship_use_status: "not_worship",
      };
    case "could_not_determine":
      return {
        action: "needs_review",
        existence_status: "uncertain",
        worship_use_status: "uncertain",
      };
  }
}

export function sourceFieldsForObservationBasis(
  basis: CurrentObservationBasis,
  sourceTitle?: string,
  sourceReference?: string,
): {
  source_type: "field_observation" | "other";
  source_title: string;
  source_url_or_file?: string;
} {
  switch (basis) {
    case "direct_field_observation":
      return { source_type: "field_observation", source_title: "RA field observation" };
    case "local_investigator_account":
      return { source_type: "other", source_title: "Local investigator account" };
    case "named_public_source":
      return {
        source_type: "other",
        source_title: sourceTitle?.trim() ?? "",
        ...(sourceReference?.trim() ? { source_url_or_file: sourceReference.trim() } : {}),
      };
    case "other":
      return {
        source_type: "other",
        source_title: sourceTitle?.trim() || "Other RA evidence",
        ...(sourceReference?.trim() ? { source_url_or_file: sourceReference.trim() } : {}),
      };
  }
}

// Rejects malformed identifiers before they reach indexed idempotency lookup.
export function assertRapidSubmissionId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("The submission identifier is invalid. Reload the form and try again.");
  }
}

// resolves a country's intake bounds: the hand-ruled registry first, then
// the generated world registry (jb ruling r-h1, 2026-09-03: every country
// takes evidence, without assignments). a world entry accepts nominations
// and the approximate-area mode and never marks an assigned batch rapid;
// a code in neither table still refuses
export function countryIntakeBounds(countryCode: string): CountryIntakeBounds {
  const code = countryCode.toUpperCase();
  const ruled = COUNTRY_INTAKE_BOUNDS[code];
  if (ruled !== undefined) return ruled;
  const world = WORLD_INTAKE_BOUNDS[code];
  if (world === undefined) {
    throw new Error(`Rapid entry is not yet enabled for ${code}.`);
  }
  return { ...world, approximateArea: true };
}

function longitudeWithinBounds(bounds: CountryIntakeBounds, longitude: number): boolean {
  // leaflet's world is continuous, so a pin dropped after panning across
  // the antimeridian arrives as e.g. +183.4; normalise to [-180, 180)
  // before testing so a point inside the box is never refused
  longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  if (bounds.east <= 180) {
    return longitude >= bounds.west && longitude <= bounds.east;
  }
  // antimeridian-crossing box: the eastern-hemisphere run up to 180 plus
  // the wrapped western-hemisphere run from -180 to east - 360
  return (
    (longitude >= bounds.west && longitude <= 180)
    || (longitude >= -180 && longitude <= bounds.east - 360)
  );
}

// a new candidate point must fall inside its country's declared intake box
export function assertCountryIntakePoint(countryCode: string, latitude: number, longitude: number): void {
  const bounds = countryIntakeBounds(countryCode);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("The candidate location must contain finite coordinates.");
  }
  if (
    latitude < bounds.south
    || latitude > bounds.north
    || !longitudeWithinBounds(bounds, longitude)
  ) {
    throw new Error(`The candidate location falls outside the ${bounds.name} intake area.`);
  }
}

// zoom floors mirror the portal: a building must be placed at building
// zoom; an approximate area only needs its centre placed at locality zoom
export const BUILDING_PLACEMENT_MIN_ZOOM = 15;
export const APPROXIMATE_AREA_MIN_ZOOM = 8;

// Requires the map-side precision and duplicate-check gates for a new point.
export function assertRapidCandidateContext(
  context: RapidCandidateContext | undefined,
  locationMode: "building_identified" | "approximate_area" = "building_identified",
): void {
  const requiredZoom = locationMode === "approximate_area" ? APPROXIMATE_AREA_MIN_ZOOM : BUILDING_PLACEMENT_MIN_ZOOM;
  if (context?.placement_zoom === undefined || context.placement_zoom < requiredZoom) {
    throw new Error(
      locationMode === "approximate_area"
        ? "Zoom in far enough to place the centre of the approximate area before submitting."
        : "Zoom to building level and confirm the candidate location before submitting.",
    );
  }
  if (context.proximity_checked !== true || !Number.isInteger(context.nearby_count)) {
    throw new Error("Check nearby places before submitting a new candidate.");
  }
}

export const RAPID_CURRENT_CONTRACT = "rapid_current_v1";

export type RapidDraftShape = {
  observation_contract_version?: string;
  current_observation_status?: string;
  current_observation_basis?: string;
  action?: string;
  existence_status?: string;
  worship_use_status?: string;
};

const CURRENT_OBSERVATION_STATUSES: readonly CurrentObservationStatus[] = [
  "currently_used_for_worship",
  "place_exists_worship_uncertain",
  "place_exists_not_used_for_worship",
  "place_no_longer_exists",
  "could_not_determine",
];

export function isRapidCurrentDraft(draft: RapidDraftShape | null | undefined): boolean {
  return draft?.observation_contract_version === RAPID_CURRENT_CONTRACT;
}

// a rapid draft persists only the server-derived provisional fields; any
// stored triple that the observer's answer could not have produced is a
// tampered or misrouted record and must not reach review or export
export function assertRapidDerivedConsistency(draft: RapidDraftShape): void {
  const status = draft.current_observation_status as CurrentObservationStatus | undefined;
  if (status === undefined || !CURRENT_OBSERVATION_STATUSES.includes(status)) {
    throw new Error("A rapid current observation requires a controlled current-status answer.");
  }
  const forExisting = deriveCurrentObservation(status, false);
  const forCandidate = deriveCurrentObservation(status, true);
  const allowedActions = new Set([forExisting.action, forCandidate.action]);
  if (draft.action === undefined || !allowedActions.has(draft.action as DerivedCurrentObservation["action"])) {
    throw new Error(`Rapid observation action "${draft.action ?? "missing"}" does not follow from status "${status}".`);
  }
  if (draft.existence_status !== forExisting.existence_status) {
    throw new Error(`Rapid observation existence status "${draft.existence_status ?? "missing"}" does not follow from status "${status}".`);
  }
  if (draft.worship_use_status !== forExisting.worship_use_status) {
    throw new Error(`Rapid observation worship-use status "${draft.worship_use_status ?? "missing"}" does not follow from status "${status}".`);
  }
}

// only rapidEntry:submitCurrentObservation may create or replace a
// rapid observation; every other write route rejects the contract and its
// fields so a client cannot reach the rapid record through a generic door
export function assertNotRapidContract(draft: RapidDraftShape | null | undefined, route: string): void {
  if (draft === null || draft === undefined) return;
  if (isRapidCurrentDraft(draft) || draft.current_observation_status || draft.current_observation_basis) {
    throw new Error(
      `Rapid current observations cannot be written through ${route}. Use the rapid-entry submission, which keeps the original observation on record.`,
    );
  }
}
