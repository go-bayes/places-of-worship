export type CurrentObservationStatus =
  | "currently_used_for_worship"
  | "place_exists_worship_uncertain"
  | "place_exists_not_used_for_worship"
  | "could_not_determine";

export type CurrentObservationBasis =
  | "direct_field_observation"
  | "local_investigator_account"
  | "named_public_source"
  | "other";

export type DerivedCurrentObservation = {
  action: "confirm_current_record" | "missing_current_site" | "closed_or_changed_use" | "needs_review";
  existence_status: "present" | "uncertain";
  worship_use_status: "confirmed_worship" | "not_worship" | "uncertain";
};

const VANUATU_BOUNDS = {
  west: 166.491,
  south: -20.303,
  east: 170.289,
  north: -13.022,
};

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

// Vanuatu rapid entry is deliberately country-scoped in its first release.
export function assertVanuatuPoint(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("The candidate location must contain finite coordinates.");
  }
  if (
    longitude < VANUATU_BOUNDS.west
    || longitude > VANUATU_BOUNDS.east
    || latitude < VANUATU_BOUNDS.south
    || latitude > VANUATU_BOUNDS.north
  ) {
    throw new Error("The candidate location falls outside the Vanuatu intake area.");
  }
}

// Requires the map-side precision and duplicate-check gates for a new point.
export function assertRapidCandidateContext(context: RapidCandidateContext | undefined): void {
  if (context?.placement_zoom === undefined || context.placement_zoom < 15) {
    throw new Error("Zoom to building level and confirm the candidate location before submitting.");
  }
  if (context.proximity_checked !== true || !Number.isInteger(context.nearby_count)) {
    throw new Error("Check nearby places before submitting a new candidate.");
  }
}
