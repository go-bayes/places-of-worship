// a reviewer's ruling on a moved pin (jb, 2026-09-07): a revision task
// carries the contributor's point as its geometry and the record's
// original point in its issue report; nothing moved the record until the
// reviewer said which point stands. the outcome rides on the review
// decision and the export carries the accepted point, so the master
// rebuild reads a ruling rather than inferring one from two points.
export type LocationOutcome = "accept_moved_point" | "keep_original_point" | "uncertain";

export const LOCATION_OUTCOMES: readonly LocationOutcome[] = Object.freeze([
  "accept_moved_point",
  "keep_original_point",
  "uncertain",
]);

type TaskLike = {
  geometry?: unknown;
  source_context?: unknown;
};

function pointOf(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  return [lng, lat];
}

export function taskPoint(task: TaskLike): [number, number] | undefined {
  const geometry = task.geometry as { coordinates?: unknown } | undefined;
  return pointOf(geometry?.coordinates);
}

// the record's original point, present only on a revision filed from an
// existing record
export function originalPoint(task: TaskLike): [number, number] | undefined {
  const context = task.source_context as { issue_report?: { original_point?: unknown } } | undefined;
  return pointOf(context?.issue_report?.original_point);
}

// true when the contributor's point differs from the record's point
export function pinMoved(task: TaskLike): boolean {
  const original = originalPoint(task);
  const current = taskPoint(task);
  if (original === undefined || current === undefined) return false;
  return Math.abs(original[0] - current[0]) > 1e-7 || Math.abs(original[1] - current[1]) > 1e-7;
}

// an outcome is meaningful only where two points exist; accepting a moved
// pin for export without saying which point stands leaves the map where
// it was, so the ruling is required there
export function assertLocationOutcome(
  task: TaskLike,
  decision: { decision_status: string; location_outcome?: LocationOutcome },
): void {
  if (decision.location_outcome !== undefined) {
    if (!LOCATION_OUTCOMES.includes(decision.location_outcome)) {
      throw new Error("The location outcome is not one of the recognised values.");
    }
    if (originalPoint(task) === undefined) {
      throw new Error("A location outcome applies only to a revision of an existing record's point.");
    }
  }
  if (decision.decision_status === "accepted_for_export" && pinMoved(task) && decision.location_outcome === undefined) {
    throw new Error("The contributor moved the pin: say whether the moved point is accepted, the original kept, or the location uncertain.");
  }
}

// the point the ruling settles on, as [longitude, latitude]
export function acceptedPoint(task: TaskLike, outcome: LocationOutcome | undefined): [number, number] | undefined {
  switch (outcome) {
    case "accept_moved_point":
      return taskPoint(task);
    case "keep_original_point":
      return originalPoint(task);
    default:
      return undefined;
  }
}

// the export columns: the ruling, the two points it chose between, and
// the point that stands; every value blank where no ruling applies
export function locationOutcomeColumns(
  task: TaskLike | undefined,
  outcome: LocationOutcome | undefined,
): Record<string, unknown> {
  const original = task === undefined ? undefined : originalPoint(task);
  const accepted = task === undefined ? undefined : acceptedPoint(task, outcome);
  return {
    location_outcome: outcome ?? "",
    original_latitude: original === undefined ? "" : original[1],
    original_longitude: original === undefined ? "" : original[0],
    accepted_latitude: accepted === undefined ? "" : accepted[1],
    accepted_longitude: accepted === undefined ? "" : accepted[0],
  };
}
