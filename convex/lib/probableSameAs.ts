// a contributor links a new entry to a nearby task as probably the same
// place while keeping the two separate (guy, 2026-09-07): the new pin and
// details are recorded at the correct location, the earlier unlocated
// record (for example an eriksen & rose 2010 row) is not overwritten, and
// a reviewer later decides whether to merge. the link rides on both tasks'
// nearby_site_refs, each pointing at the other.
// pure rules only, so node can run the tests without the convex runtime;
// the database steps live in probableSameAsRecords.ts
import { SHORT_TEXT_MAX, TASK_NAME_MAX, assertMaxString } from "./limits.ts";

export type ProbableSameAsInput = {
  task_id: string;
  name?: string;
  distance_m?: number;
};

export type ProbableSameAsRef = {
  task_id: string;
  name?: string;
  distance_m?: number;
  site_id?: string;
  relation: "probable_same_place";
  linked_at: number;
};

export const PROBABLE_SAME_AS_MAX = 5;
export const PROBABLE_SAME_AS_DISTANCE_MAX_M = 100_000;

// validates the contributor's links before any database work
export function assertProbableSameAsInputs(
  refs: readonly ProbableSameAsInput[] | undefined,
  ownTaskId?: string,
): void {
  if (refs === undefined) return;
  if (!Array.isArray(refs)) throw new Error("The linked-place list is invalid.");
  if (refs.length > PROBABLE_SAME_AS_MAX) {
    throw new Error(`Link at most ${PROBABLE_SAME_AS_MAX} nearby places to one entry.`);
  }
  const seen = new Set<string>();
  for (const ref of refs) {
    const taskId = ref.task_id?.trim() ?? "";
    if (!taskId) throw new Error("A linked place needs its task id.");
    assertMaxString("linked task id", taskId, SHORT_TEXT_MAX);
    assertMaxString("linked place name", ref.name, TASK_NAME_MAX);
    if (ownTaskId !== undefined && taskId === ownTaskId) {
      throw new Error("An entry cannot be linked to itself.");
    }
    if (seen.has(taskId)) throw new Error("The same place is linked twice.");
    seen.add(taskId);
    if (ref.distance_m !== undefined) {
      if (!Number.isFinite(ref.distance_m) || ref.distance_m < 0 || ref.distance_m > PROBABLE_SAME_AS_DISTANCE_MAX_M) {
        throw new Error("The linked place's distance is invalid.");
      }
    }
  }
}

function describeRef(ref: { task_id: string; name?: string; distance_m?: number }): string {
  const name = ref.name?.trim() || "an unnamed record";
  const distance = ref.distance_m !== undefined ? `, ${Math.round(ref.distance_m)} m away` : "";
  return `${name} (task ${ref.task_id}${distance})`;
}

// the reviewer-facing check the new task carries; the message names every
// linked record so the queue shows the merge question without a lookup
export function probableSameAsCheck(refs: readonly ProbableSameAsRef[]): {
  check_id: string;
  severity: string;
  message: string;
  suggested_action: string;
} {
  const listed = refs.map(describeRef).join("; ");
  return {
    check_id: "contributor_probable_same_place",
    severity: "warning",
    message: `The contributor linked this entry as probably the same place as ${listed}. The two records stay separate so this pin and its details are kept; decide whether to merge them or keep both.`,
    suggested_action: "review_identity",
  };
}

// the note the earlier record receives, so its reviewer sees the field
// entry that may locate it
export function probableSameAsReciprocalNote(newTask: { task_id: string; name: string }): string {
  return `A field entry (task ${newTask.task_id}, "${newTask.name}") was linked to this record as probably the same place. It was kept as a separate entry with its own location; compare the two before merging.`;
}
