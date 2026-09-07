// database steps for a probable-same-place link (see probableSameAs.ts
// for the rules): resolve the contributor's links and write the
// reciprocal refs and audit notes on the linked tasks
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ProjectRole } from "./auth";
import { probableSameAsReciprocalNote } from "./probableSameAs";
import type { ProbableSameAsInput, ProbableSameAsRef } from "./probableSameAs";
import { appendTaskEvent } from "./taskEvents";

// resolves the contributor's links against the database: the linked task
// must exist in the same country. returns the refs the new task stores,
// with the linked record's own name and site id from the database
export async function resolveProbableSameAsRefs(
  ctx: MutationCtx,
  refs: readonly ProbableSameAsInput[] | undefined,
  countryCode: string,
  now: number,
): Promise<{ refs: ProbableSameAsRef[]; tasks: Doc<"tasks">[] }> {
  if (refs === undefined || refs.length === 0) return { refs: [], tasks: [] };
  const resolved: ProbableSameAsRef[] = [];
  const tasks: Doc<"tasks">[] = [];
  for (const ref of refs) {
    const taskId = ref.task_id.trim();
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
      .unique();
    if (task === null) {
      throw new Error(`The linked place (task ${taskId}) is no longer available. Refresh the portal and link it again.`);
    }
    if (task.country_code !== countryCode) {
      throw new Error("A linked place must be in the same country as the new entry.");
    }
    tasks.push(task);
    resolved.push({
      task_id: task.task_id,
      name: task.name,
      ...(task.matched_current_site_id ? { site_id: task.matched_current_site_id } : {}),
      ...(ref.distance_m !== undefined ? { distance_m: Math.round(ref.distance_m) } : {}),
      relation: "probable_same_place",
      linked_at: now,
    });
  }
  return { refs: resolved, tasks };
}

// writes the reciprocal link and an audit note on each linked task; the
// linked task's status, claim, and evidence are untouched
export async function recordProbableSameAsReciprocals(
  ctx: MutationCtx,
  args: {
    newTask: { task_id: string; name: string };
    linkedTasks: readonly Doc<"tasks">[];
    refs: readonly ProbableSameAsRef[];
    actorUserId: Doc<"users">["_id"];
    actorRole: ProjectRole;
    now: number;
    clientContext?: unknown;
  },
): Promise<void> {
  const note = probableSameAsReciprocalNote(args.newTask);
  for (const linked of args.linkedTasks) {
    const own = args.refs.find((ref) => ref.task_id === linked.task_id);
    const reciprocal: ProbableSameAsRef = {
      task_id: args.newTask.task_id,
      name: args.newTask.name,
      ...(own?.distance_m !== undefined ? { distance_m: own.distance_m } : {}),
      relation: "probable_same_place",
      linked_at: args.now,
    };
    const existing = (linked.nearby_site_refs ?? []).filter((ref) => ref.task_id !== args.newTask.task_id);
    await ctx.db.patch(linked._id, {
      nearby_site_refs: [...existing, reciprocal],
      updated_at: args.now,
      last_event_at: args.now,
    });
    await appendTaskEvent(ctx, {
      taskId: linked.task_id,
      eventType: "note_added",
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      previousStatus: linked.status,
      newStatus: linked.status,
      reason: note,
      clientContext: args.clientContext,
    });
  }
}
