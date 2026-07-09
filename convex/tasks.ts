import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  projectRole,
  reviewDecisionStatus,
  taskBatchInput,
  taskEventType,
  taskInput,
  taskPriority,
  taskStatus,
  taskStatusValues,
  taskType,
} from "./model";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import { defaultTargetYears } from "./lib/countryYears";
import {
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_BRIEF_MAX,
  TASK_NAME_MAX,
  TASK_REASON_MAX,
  assertClientContextLimit,
  assertMaxString,
  assertTaskReasonLimit,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";
import { evidenceDraftDoc, reviewDecisionDoc, taskDoc, taskEventDoc } from "./lib/validators";

type IssueTaskType =
  | "possible_duplicate"
  | "verify_existing_site"
  | "geometry_check"
  | "osm_identity_link"
  | "other";

function taskIdSlug(name: string): string {
  // keep human-readable task ids stable without letting names dominate ids
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "pow";
}

function manualTaskId(countryCode: string, name: string, now: number): string {
  return `${countryCode.toLowerCase()}-candidate-${now}-${taskIdSlug(name)}`;
}

function issueTaskBrief(issueType: IssueTaskType): string {
  switch (issueType) {
    case "possible_duplicate":
      return "Review this RA-reported possible duplicate and confirm whether the two points are one place of worship before any export.";
    case "verify_existing_site":
      return "Review this RA-reported existing-site concern and confirm the mapped place of worship state before any export.";
    case "geometry_check":
      return "Review this RA-reported geometry concern and confirm that the point location represents the worship site before any export.";
    case "osm_identity_link":
      return "Review this RA-reported OSM identity link and confirm the matched OSM object before any export.";
    case "other":
      return "Review this RA-reported issue and decide the required triage action before any export.";
  }
}

async function getTaskOrThrow(ctx: QueryCtx | MutationCtx, taskId: string): Promise<Doc<"tasks">> {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
    .unique();
  if (task === null) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

// shared with revisionSeed.ts, which seeds through the same task shape
export function assertTaskSeedTextLimits(taskRecord: {
  task_id: string;
  batch_id: string;
  country_code: string;
  matched_current_site_id?: string;
  candidate_site_id?: string;
  source_record_id?: string;
  matched_osm_id?: string;
  name: string;
  address?: string;
  locality?: string;
  task_brief: string;
  automated_checks?: Array<{
    check_id: string;
    severity?: string;
    message: string;
    suggested_action?: string;
  }>;
}): void {
  assertMaxString("task id", taskRecord.task_id, MEDIUM_TEXT_MAX);
  assertMaxString("batch id", taskRecord.batch_id, MEDIUM_TEXT_MAX);
  assertMaxString("country code", taskRecord.country_code, SHORT_TEXT_MAX);
  assertMaxString("matched current site id", taskRecord.matched_current_site_id, MEDIUM_TEXT_MAX);
  assertMaxString("candidate site id", taskRecord.candidate_site_id, MEDIUM_TEXT_MAX);
  assertMaxString("source record id", taskRecord.source_record_id, MEDIUM_TEXT_MAX);
  assertMaxString("matched OSM id", taskRecord.matched_osm_id, MEDIUM_TEXT_MAX);
  assertMaxString("task name", taskRecord.name, TASK_NAME_MAX);
  assertMaxString("task address", taskRecord.address, MEDIUM_TEXT_MAX);
  assertMaxString("task locality", taskRecord.locality, MEDIUM_TEXT_MAX);
  assertMaxString("task brief", taskRecord.task_brief, TASK_BRIEF_MAX);
  for (const check of taskRecord.automated_checks ?? []) {
    assertMaxString("automated check id", check.check_id, MEDIUM_TEXT_MAX);
    assertMaxString("automated check severity", check.severity, SHORT_TEXT_MAX);
    assertMaxString("automated check message", check.message, TASK_BRIEF_MAX);
    assertMaxString("automated check suggested action", check.suggested_action, MEDIUM_TEXT_MAX);
  }
}

export const listTasks = query({
  args: {
    countryCode: v.string(),
    batchId: v.optional(v.string()),
    status: v.optional(taskStatus),
    priority: v.optional(taskPriority),
    limit: v.optional(v.number()),
  },
  returns: v.array(taskDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    // promotion gate (docs/development/revision-pipeline-all-countries.md,
    // phase R1): tasks in a draft batch stay invisible to RA queues until a
    // curator promotes the batch to active. Reviewers and above still see
    // draft batches so they can inspect a seed before promotion.
    const privileged = canReview(user.roles);
    const limit = Math.min(Math.max(args.limit ?? 250, 1), 1000);
    const batchId = args.batchId;
    if (batchId !== undefined && !privileged) {
      const scopedBatch = await ctx.db
        .query("task_batches")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", batchId))
        .unique();
      if (scopedBatch !== null && scopedBatch.status === "draft") {
        return [];
      }
    }
    let tasks: Doc<"tasks">[];
    if (batchId !== undefined && args.status !== undefined) {
      const status = args.status;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_batch_status", (q) => q.eq("batch_id", batchId).eq("status", status))
        .take(limit);
    } else if (batchId !== undefined) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_batch_status", (q) => q.eq("batch_id", batchId))
        .take(limit);
    } else if (args.status !== undefined) {
      const status = args.status;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_country_status", (q) =>
          q.eq("country_code", args.countryCode).eq("status", status),
        )
        .take(limit);
    } else {
      // per-status indexed reads keep every status bucket represented; a
      // single prefix take would fill up on alphabetically-early statuses
      const collected: Doc<"tasks">[] = [];
      for (const status of taskStatusValues) {
        collected.push(
          ...(await ctx.db
            .query("tasks")
            .withIndex("by_country_status", (q) => q.eq("country_code", args.countryCode).eq("status", status))
            .take(limit)),
        );
      }
      tasks = collected
        .sort((left, right) => left._creationTime - right._creationTime)
        .slice(0, limit);
    }

    if (batchId !== undefined) {
      tasks = tasks.filter((task) => task.country_code === args.countryCode);
    }

    // country-wide reads for non-privileged users also exclude draft
    // batches; a country has at most a handful of them at a time
    if (!privileged) {
      const draftBatches = await ctx.db
        .query("task_batches")
        .withIndex("by_country_status", (q) =>
          q.eq("country_code", args.countryCode).eq("status", "draft"),
        )
        .collect();
      if (draftBatches.length > 0) {
        const draftBatchIds = new Set(draftBatches.map((batch) => batch.batch_id));
        tasks = tasks.filter((task) => !draftBatchIds.has(task.batch_id));
      }
    }

    if (args.priority !== undefined) {
      return tasks.filter((task) => task.priority === args.priority);
    }
    return tasks;
  },
});

async function latestDraftForTask(
  ctx: QueryCtx,
  taskId: string,
  user: Doc<"users">,
): Promise<Doc<"evidence_drafts"> | null> {
  // collect the task's drafts (indexed prefix bounds reads to one task) and
  // sort in js: the index orders by draft_status before creation time, so a
  // take() here would truncate by status, not recency
  const drafts = (await ctx.db
    .query("evidence_drafts")
    .withIndex("by_task_status", (q) => q.eq("task_id", taskId))
    .collect())
    .sort((left, right) => right._creationTime - left._creationTime);
  if (canReview(user.roles)) {
    return drafts[0] ?? null;
  }
  return drafts.find((draft) => draft.created_by === user._id) ?? null;
}

async function latestReviewDecision(ctx: QueryCtx, taskId: string): Promise<Doc<"review_decisions"> | null> {
  const decisions = await ctx.db
    .query("review_decisions")
    .withIndex("by_task", (q) => q.eq("task_id", taskId))
    .take(50);
  return decisions.sort((left, right) => right.created_at - left.created_at)[0] ?? null;
}

export const listMyTasks = query({
  args: {
    statuses: v.optional(v.array(taskStatus)),
    countryCode: v.optional(v.string()),
    batchId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    task: taskDoc,
    latestDraft: v.union(evidenceDraftDoc, v.null()),
    latestReview: v.union(reviewDecisionDoc, v.null()),
  })),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const statuses = args.statuses ?? [
      "in_progress",
      "draft_saved",
      "needs_review",
      "unresolved_note",
      "changes_requested",
      "skipped",
      "reviewed",
      "exported",
    ];
    const results: Doc<"tasks">[] = [];
    for (const status of statuses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee_status", (q) => q.eq("assigned_to", user._id).eq("status", status))
        .take(limit);
      results.push(...tasks);
    }
    const filtered = results
      .filter((task) => args.countryCode === undefined || task.country_code === args.countryCode)
      .filter((task) => args.batchId === undefined || task.batch_id === args.batchId)
      .sort((left, right) => (right.last_event_at ?? right.updated_at) - (left.last_event_at ?? left.updated_at))
      .slice(0, limit);

    const rows = [];
    for (const task of filtered) {
      rows.push({
        task,
        latestDraft: await latestDraftForTask(ctx, task.task_id, user),
        latestReview: await latestReviewDecision(ctx, task.task_id),
      });
    }
    return rows;
  },
});

export const getTask = query({
  args: {
    taskId: v.string(),
  },
  returns: v.object({
    task: taskDoc,
    latestDraft: v.union(evidenceDraftDoc, v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const latestDraft = await latestDraftForTask(ctx, args.taskId, user);
    return { task, latestDraft };
  },
});

export const getTaskEvents = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(taskEventDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!canReview(user.roles)) {
      assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    }
    const events = await ctx.db
      .query("task_events")
      .withIndex("by_task_time", (q) => q.eq("task_id", args.taskId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 100, 1), 500));
    return canReview(user.roles)
      ? events
      : events.filter((event) => event.actor_user_id === user._id);
  },
});

export const getTaskHistory = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    events: v.array(v.object({
      event_type: taskEventType,
      occurred_at: v.number(),
      previous_status: v.optional(taskStatus),
      new_status: v.optional(taskStatus),
      evidence_draft_id: v.optional(v.string()),
      actor_role: projectRole,
      actor_user_id: v.optional(v.id("users")),
      reason: v.optional(v.string()),
      is_self: v.boolean(),
    })),
    draft_count: v.number(),
    latest_review: v.union(v.null(), v.object({
      decision_status: reviewDecisionStatus,
      created_at: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    await getTaskOrThrow(ctx, args.taskId);

    const privileged = canReview(user.roles);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const events = await ctx.db
      .query("task_events")
      .withIndex("by_task_time", (q) => q.eq("task_id", args.taskId))
      .order("desc")
      .take(limit);
    const drafts = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q) => q.eq("task_id", args.taskId))
      .collect();
    const latestReview = await latestReviewDecision(ctx, args.taskId);

    return {
      // expose workflow state to all roles while limiting attribution and notes
      events: events.map((event) => {
        const isSelf = event.actor_user_id === user._id;
        const canSeePrivateFields = privileged || isSelf;
        return {
          event_type: event.event_type,
          occurred_at: event.occurred_at,
          ...(event.previous_status !== undefined ? { previous_status: event.previous_status } : {}),
          ...(event.new_status !== undefined ? { new_status: event.new_status } : {}),
          ...(event.evidence_draft_id !== undefined ? { evidence_draft_id: event.evidence_draft_id } : {}),
          actor_role: event.actor_role,
          ...(canSeePrivateFields ? { actor_user_id: event.actor_user_id } : {}),
          ...(canSeePrivateFields && event.reason !== undefined ? { reason: event.reason } : {}),
          is_self: isSelf,
        };
      }),
      draft_count: drafts.length,
      latest_review: latestReview === null
        ? null
        : {
            decision_status: latestReview.decision_status,
            created_at: latestReview.created_at,
          },
    };
  },
});

export const upsertTasksFromStaticMap = mutation({
  args: {
    batch: taskBatchInput,
    tasks: v.array(taskInput),
  },
  returns: v.object({
    batch_id: v.string(),
    inserted: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["admin", "service"]);
    const actorRole = chooseActorRole(user, ["service", "admin"]);
    const now = Date.now();
    assertMaxString("batch id", args.batch.batch_id, MEDIUM_TEXT_MAX);
    assertMaxString("batch country code", args.batch.country_code, SHORT_TEXT_MAX);
    assertMaxString("batch source manifest id", args.batch.source_manifest_id, MEDIUM_TEXT_MAX);
    assertMaxString("batch notes", args.batch.notes, TASK_BRIEF_MAX);

    const existingBatch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batch.batch_id))
      .unique();
    if (existingBatch === null) {
      await ctx.db.insert("task_batches", {
        ...args.batch,
        status: args.batch.status ?? "active",
        created_by: user._id,
        created_at: now,
        updated_at: now,
      });
    } else {
      await ctx.db.patch(existingBatch._id, {
        country_code: args.batch.country_code,
        source_kind: args.batch.source_kind,
        source_manifest_id: args.batch.source_manifest_id,
        target_years: args.batch.target_years,
        status: args.batch.status ?? existingBatch.status,
        notes: args.batch.notes,
        updated_at: now,
      });
    }

    let inserted = 0;
    let updated = 0;
    for (const taskRecord of args.tasks) {
      assertTaskSeedTextLimits(taskRecord);
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", taskRecord.task_id))
        .unique();
      if (existing === null) {
        await ctx.db.insert("tasks", {
          ...taskRecord,
          status: taskRecord.status ?? "open",
          nearby_site_refs: taskRecord.nearby_site_refs ?? [],
          automated_checks: taskRecord.automated_checks ?? [],
          created_at: now,
          updated_at: now,
          last_event_at: now,
        });
        await appendTaskEvent(ctx, {
          taskId: taskRecord.task_id,
          eventType: "imported",
          actorUserId: user._id,
          actorRole,
          newStatus: taskRecord.status ?? "open",
          reason: `Imported from task batch ${args.batch.batch_id}.`,
        });
        inserted += 1;
      } else {
        await ctx.db.patch(existing._id, {
          ...taskRecord,
          status: existing.status,
          assigned_to: existing.assigned_to,
          claimed_by: existing.claimed_by,
          claimed_at: existing.claimed_at,
          nearby_site_refs: taskRecord.nearby_site_refs ?? existing.nearby_site_refs,
          automated_checks: taskRecord.automated_checks ?? existing.automated_checks,
          source_context: taskRecord.source_context ?? existing.source_context,
          updated_at: now,
        });
        updated += 1;
      }
    }

    return { batch_id: args.batch.batch_id, inserted, updated };
  },
});

export const claimTask = mutation({
  args: {
    taskId: v.string(),
  },
  returns: v.object({
    task_id: v.string(),
    status: taskStatus,
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);

    const now = Date.now();
    const newStatus = task.status === "open" || task.status === "reopened" ? "in_progress" : task.status;
    await ctx.db.patch(task._id, {
      assigned_to: user._id,
      claimed_by: user._id,
      claimed_at: now,
      status: newStatus,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "claimed",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus,
    });
    return { task_id: args.taskId, status: newStatus };
  },
});

export const releaseTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    status: v.literal("open"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);

    const now = Date.now();
    await ctx.db.patch(task._id, {
      assigned_to: undefined,
      claimed_by: undefined,
      claimed_at: undefined,
      status: "open",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "unclaimed",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "open",
      reason: args.reason,
    });
    return { task_id: args.taskId, status: "open" as const };
  },
});

export const skipTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    status: v.literal("skipped"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);

    const now = Date.now();
    await ctx.db.patch(task._id, {
      assigned_to: user._id,
      claimed_by: user._id,
      claimed_at: task.claimed_at ?? now,
      status: "skipped",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "skipped",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "skipped",
      reason: args.reason,
    });
    return { task_id: args.taskId, status: "skipped" as const };
  },
});

export const unskipTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    status: v.literal("in_progress"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    if (task.status !== "skipped") {
      throw new Error("Only skipped tasks can be unskipped.");
    }
    assertTaskReasonLimit("unskip reason", args.reason);

    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "in_progress",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "reopened",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "in_progress",
      reason: args.reason ?? "Unskipped by the assignee.",
    });
    return { task_id: args.taskId, status: "in_progress" as const };
  },
});

export const markProvisionallyClosed = mutation({
  args: {
    taskId: v.string(),
    evidenceDraftId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    status: v.literal("provisionally_closed"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);

    const now = Date.now();
    await ctx.db.patch(task._id, {
      assigned_to: user._id,
      claimed_by: user._id,
      claimed_at: task.claimed_at ?? now,
      status: "provisionally_closed",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "provisionally_closed",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "provisionally_closed",
      reason: args.reason,
      evidenceDraftId: args.evidenceDraftId,
    });
    return { task_id: args.taskId, status: "provisionally_closed" as const };
  },
});

export const reopenTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.string(),
  },
  returns: v.object({
    task_id: v.string(),
    status: v.literal("reopened"),
  }),
  handler: async (ctx, args) => {
    // RAs can reopen from the map's context-dot inspection flow, alongside
    // reviewers/curators/admins (portal feature, 2026-07-08)
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    // ra-initiated reopens are limited to tasks under review or closed
    // pending review; reviewers/curators/admins may reopen any task
    // exported tasks stay closed to ra reopens so export bookkeeping
    // is undisturbed (JB ruling 2026-07-08)
    const raReopenable = new Set([
      "needs_review",
      "unresolved_note",
      "provisionally_closed",
      "reviewed",
    ]);
    if (!canReview(user.roles) && !raReopenable.has(task.status)) {
      throw new Error("This task is not in a state a research assistant can reopen.");
    }
    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "reopened",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "reopened",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "reopened",
      reason: args.reason,
    });
    return { task_id: args.taskId, status: "reopened" as const };
  },
});

export const addTaskNote = mutation({
  args: {
    taskId: v.string(),
    note: v.string(),
    clientContext: v.optional(v.any()),
  },
  returns: v.object({
    task_id: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "note_added",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: task.status,
      reason: args.note,
      clientContext: args.clientContext,
    });
    await ctx.db.patch(task._id, { last_event_at: Date.now() });
    return { task_id: args.taskId };
  },
});

export const createIssueTask = mutation({
  args: {
    countryCode: v.string(),
    name: v.string(),
    issueType: v.union(
      v.literal("possible_duplicate"),
      v.literal("verify_existing_site"),
      v.literal("geometry_check"),
      v.literal("osm_identity_link"),
      v.literal("other"),
    ),
    note: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    siteId: v.optional(v.string()),
    osmId: v.optional(v.string()),
    relatedSiteId: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    targetYears: v.optional(v.array(v.number())),
    clientContext: v.optional(v.any()),
  },
  returns: v.union(
    v.object({
      task_id: v.string(),
      status: v.literal("open"),
      deduped: v.literal(true),
    }),
    v.object({
      task_id: v.string(),
      batch_id: v.string(),
      status: v.literal("open"),
      deduped: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertMaxString("issue country code", args.countryCode, SHORT_TEXT_MAX);
    assertMaxString("issue task name", args.name, TASK_NAME_MAX);
    assertTaskReasonLimit("issue note", args.note);
    assertMaxString("issue matched current site id", args.siteId, MEDIUM_TEXT_MAX);
    assertMaxString("issue matched OSM id", args.osmId, MEDIUM_TEXT_MAX);
    assertMaxString("issue related site id", args.relatedSiteId, MEDIUM_TEXT_MAX);
    assertMaxString("issue source title", args.sourceTitle, MEDIUM_TEXT_MAX);
    assertMaxString("issue source URL", args.sourceUrl, MEDIUM_TEXT_MAX);
    assertClientContextLimit(args.clientContext);

    const cc = args.countryCode.toLowerCase();
    const batchId = `ra-issues-${cc}`;
    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);

    let duplicateTask: Doc<"tasks"> | null = null;
    if (args.siteId !== undefined) {
      const candidates = await ctx.db
        .query("tasks")
        .withIndex("by_matched_site", (q) => q.eq("matched_current_site_id", args.siteId))
        .collect();
      for (const task of candidates) {
        if (task.batch_id === batchId && task.status === "open") {
          duplicateTask = task;
          break;
        }
      }
    } else if (args.osmId !== undefined) {
      const candidates = await ctx.db
        .query("tasks")
        .withIndex("by_osm", (q) => q.eq("matched_osm_id", args.osmId))
        .collect();
      for (const task of candidates) {
        if (task.batch_id === batchId && task.status === "open") {
          duplicateTask = task;
          break;
        }
      }
    }

    if (duplicateTask !== null) {
      await appendTaskEvent(ctx, {
        taskId: duplicateTask.task_id,
        eventType: "note_added",
        actorUserId: user._id,
        actorRole,
        previousStatus: duplicateTask.status,
        newStatus: duplicateTask.status,
        reason: args.note,
        clientContext: args.clientContext,
      });
      await ctx.db.patch(duplicateTask._id, { last_event_at: Date.now() });
      return { task_id: duplicateTask.task_id, status: "open" as const, deduped: true as const };
    }

    const now = Date.now();
    const existingBatch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", batchId))
      .unique();
    if (existingBatch === null) {
      await ctx.db.insert("task_batches", {
        batch_id: batchId,
        country_code: args.countryCode,
        source_kind: "ra_nomination",
        target_years: args.targetYears ?? [],
        status: "active",
        created_by: user._id,
        created_at: now,
        updated_at: now,
        notes: "ad-hoc issue reports from ra map inspection",
      });
    }

    const taskId = `${cc}-issue-${now}-${taskIdSlug(args.name)}`;
    const taskRecord = {
      task_id: taskId,
      batch_id: batchId,
      country_code: args.countryCode,
      task_type: args.issueType,
      priority: "medium" as const,
      status: "open" as const,
      target_years: args.targetYears ?? [],
      matched_current_site_id: args.siteId,
      matched_osm_id: args.osmId,
      name: args.name,
      geometry: {
        type: "Point",
        coordinates: [args.longitude, args.latitude],
      },
      nearby_site_refs: [],
      automated_checks: [
        {
          check_id: "ra_issue_report",
          severity: "info",
          message: args.note,
          suggested_action: args.issueType,
        },
      ],
      task_brief: issueTaskBrief(args.issueType),
      source_context: {
        issue_report: {
          reported_by: user._id,
          ...(args.relatedSiteId !== undefined ? { related_site_id: args.relatedSiteId } : {}),
          ...(args.sourceTitle !== undefined ? { source_title: args.sourceTitle } : {}),
          ...(args.sourceUrl !== undefined ? { source_url: args.sourceUrl } : {}),
        },
      },
      created_at: now,
      updated_at: now,
      last_event_at: now,
    };
    assertTaskSeedTextLimits(taskRecord);

    await ctx.db.insert("tasks", taskRecord);
    await appendTaskEvent(ctx, {
      taskId,
      eventType: "opened",
      actorUserId: user._id,
      actorRole,
      newStatus: "open",
      reason: args.note,
      clientContext: args.clientContext,
    });
    return { task_id: taskId, batch_id: batchId, status: "open" as const, deduped: false as const };
  },
});

export const createManualCandidateTask = mutation({
  args: {
    countryCode: v.string(),
    name: v.string(),
    address: v.optional(v.string()),
    locality: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    priority: v.optional(taskPriority),
    taskType: v.optional(taskType),
    targetYears: v.optional(v.array(v.number())),
    taskBrief: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
    clientContext: v.optional(v.any()),
  },
  returns: v.object({
    task_id: v.string(),
    candidate_site_id: v.string(),
    status: v.literal("in_progress"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertMaxString("nomination country code", args.countryCode, SHORT_TEXT_MAX);
    assertMaxString("nomination name", args.name, TASK_NAME_MAX);
    assertMaxString("nomination address", args.address, MEDIUM_TEXT_MAX);
    assertMaxString("nomination locality", args.locality, MEDIUM_TEXT_MAX);
    assertMaxString("nomination task brief", args.taskBrief, TASK_BRIEF_MAX);
    assertMaxString("nomination source note", args.sourceNote, TASK_REASON_MAX);
    assertClientContextLimit(args.clientContext);
    const now = Date.now();
    const taskId = manualTaskId(args.countryCode, args.name, now);
    const candidateSiteId = `candidate:${taskId}`;
    const taskBrief =
      args.taskBrief ??
      "Review this user-nominated place of worship candidate. Check whether it is already on the project map or in OSM before accepting it for export.";

    await ctx.db.insert("tasks", {
      task_id: taskId,
      batch_id: `manual-${args.countryCode.toLowerCase()}`,
      country_code: args.countryCode,
      task_type: args.taskType ?? "missing_from_project_map",
      priority: args.priority ?? "high",
      status: "in_progress",
      assigned_to: user._id,
      claimed_by: user._id,
      claimed_at: now,
      target_years: args.targetYears ?? defaultTargetYears(args.countryCode),
      candidate_site_id: candidateSiteId,
      name: args.name,
      address: args.address,
      locality: args.locality,
      geometry: {
        type: "Point",
        coordinates: [args.longitude, args.latitude],
      },
      nearby_site_refs: [],
      automated_checks: [
        {
          check_id: "user_nomination",
          severity: "info",
          message: args.sourceNote ?? "Candidate was nominated from the task map.",
          suggested_action: "review_identity",
        },
      ],
      task_brief: taskBrief,
      created_at: now,
      updated_at: now,
      last_event_at: now,
    });

    await appendTaskEvent(ctx, {
      taskId,
      eventType: "opened",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      newStatus: "in_progress",
      reason: args.sourceNote,
      // pin-drop placement provenance (zoom, proximity result) rides here
      clientContext: args.clientContext,
    });
    return { task_id: taskId, candidate_site_id: candidateSiteId, status: "in_progress" as const };
  },
});
