import { COUNTRY_INTAKE_BOUNDS } from "./rapidEntry.ts";

export type LocationAssertionMode = "building_identified" | "approximate_area";

export type LocationAssertionBasis =
  | "map_placement"
  | "address_or_locality"
  | "named_source_description"
  | "local_investigator_account"
  | "other";

export type LocationAssertionConfidence = "high" | "moderate" | "low" | "uncertain";

export type LocationAssertionInput = {
  contract_version: "location_assertion_v1";
  mode: LocationAssertionMode;
  basis: LocationAssertionBasis;
  latitude: number;
  longitude: number;
  uncertainty_radius_m?: number;
  source_wording?: string;
  confidence: LocationAssertionConfidence;
  contributor_confirmed: true;
};

// per-country location-mode rule. every registry country now accepts both
// modes (jb ruling r1, 2026-09-02: the approximate-area mode is allowed
// everywhere, vanuatu included, because historical places are often known
// only to a locality); a country may still opt out by declaring
// approximateArea: false in the intake registry, and countries outside the
// registry keep both modes for the curator nomination path
export function assertCountryAllowsAssertionMode(
  countryCode: string,
  mode: LocationAssertionMode,
): void {
  const entry = COUNTRY_INTAKE_BOUNDS[countryCode.toUpperCase()];
  if (mode === "approximate_area" && entry !== undefined && entry.approximateArea === false) {
    throw new Error(
      `Nominations for ${countryCode.toUpperCase()} must identify the building; an approximate area cannot be accepted.`,
    );
  }
}

// the master-data location grade (geometry-history location_confidence) is
// derived from the mode and radius, never entered by hand: thresholds per
// jb ruling r2, 2026-09-02
export type LocationConfidenceGrade = "building" | "parcel_or_compound" | "street" | "locality" | "area";

export function locationConfidenceGrade(
  assertion: Pick<LocationAssertionInput, "mode" | "uncertainty_radius_m">,
): LocationConfidenceGrade {
  if (assertion.mode === "building_identified") return "building";
  const radius = assertion.uncertainty_radius_m ?? Number.POSITIVE_INFINITY;
  if (radius <= 100) return "parcel_or_compound";
  if (radius <= 300) return "street";
  if (radius <= 2_000) return "locality";
  return "area";
}

const MAX_LOCATION_WORDING = 2_000;
const MIN_UNCERTAINTY_RADIUS_M = 25;
const MAX_UNCERTAINTY_RADIUS_M = 100_000;

function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("The confirmed latitude is invalid.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("The confirmed longitude is invalid.");
  }
}

export function assertLocationAssertion(assertion: LocationAssertionInput): void {
  assertCoordinates(assertion.latitude, assertion.longitude);
  if (assertion.contributor_confirmed !== true) {
    throw new Error("Confirm that the location description matches the evidence before submitting.");
  }
  const sourceWording = assertion.source_wording?.trim() ?? "";
  if (sourceWording.length > MAX_LOCATION_WORDING) {
    throw new Error(`Location wording must be ${MAX_LOCATION_WORDING} characters or fewer.`);
  }
  if (assertion.mode === "building_identified") {
    if (assertion.uncertainty_radius_m !== undefined) {
      throw new Error("A building-level location must not include an uncertainty radius.");
    }
    return;
  }
  const radius = assertion.uncertainty_radius_m;
  if (
    radius === undefined
    || !Number.isInteger(radius)
    || radius < MIN_UNCERTAINTY_RADIUS_M
    || radius > MAX_UNCERTAINTY_RADIUS_M
  ) {
    throw new Error(
      `An approximate location requires a whole-metre uncertainty radius from ${MIN_UNCERTAINTY_RADIUS_M} to ${MAX_UNCERTAINTY_RADIUS_M}.`,
    );
  }
  if (!sourceWording) {
    throw new Error("Record what the source or informant establishes about the approximate location.");
  }
}

export function assertAssertionMatchesTaskPoint(
  assertion: LocationAssertionInput,
  latitude: number,
  longitude: number,
): void {
  assertLocationAssertion(assertion);
  if (Math.abs(assertion.latitude - latitude) > 1e-9 || Math.abs(assertion.longitude - longitude) > 1e-9) {
    throw new Error("The location assertion does not match the submitted task point.");
  }
}
