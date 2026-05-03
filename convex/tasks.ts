import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { taskBatchInput, taskInput, taskPriority, taskStatus, taskType } from "./model";
import { assertOwnsOrCanReview, chooseActorRole, requireUser } from "./lib/auth";
import { appendTaskEvent } from "./lib/taskEvents";

function manualTaskId(countryCode: string, name: string, now: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${countryCode.toLowerCase()}-candidate-${now}-${slug || "pow"}`;
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

export const listTasks = query({
  args: {
    countryCode: v.string(),
    status: v.optional(taskStatus),
    priority: v.optional(taskPriority),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    const limit = Math.min(Math.max(args.limit ?? 250, 1), 1000);
    let tasks: Doc<"tasks">[];
    if (args.status !== undefined) {
      const status = args.status;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_country_status", (q) =>
          q.eq("country_code", args.countryCode).eq("status", status),
        )
        .take(limit);
    } else {
      tasks = await ctx.db
        .query("tasks")
        .filter((q) => q.eq(q.field("country_code"), args.countryCode))
        .take(limit);
    }

    if (args.priority !== undefined) {
      return tasks.filter((task) => task.priority === args.priority);
    }
    return tasks;
  },
});

export const listMyTasks = query({
  args: {
    statuses: v.optional(v.array(taskStatus)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const statuses = args.statuses ?? ["in_progress", "draft_saved", "needs_review"];
    const results: Doc<"tasks">[] = [];
    for (const status of statuses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee_status", (q) => q.eq("assigned_to", user._id).eq("status", status))
        .take(limit);
      results.push(...tasks);
    }
    return results.slice(0, limit);
  },
});

export const getTask = query({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const latestDraft = await ctx.db
      .query("evidence_drafts")
      .filter((q) => q.eq(q.field("task_id"), args.taskId))
      .order("desc")
      .first();
    return { task, latestDraft };
  },
});

export const getTaskEvents = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service"]);
    return await ctx.db
      .query("task_events")
      .withIndex("by_task_time", (q) => q.eq("task_id", args.taskId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 100, 1), 500));
  },
});

export const upsertTasksFromStaticMap = mutation({
  args: {
    batch: taskBatchInput,
    tasks: v.array(taskInput),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["admin", "service"]);
    const actorRole = chooseActorRole(user, ["service", "admin"]);
    const now = Date.now();

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
    return { task_id: args.taskId, status: "open" };
  },
});

export const skipTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.optional(v.string()),
  },
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
    return { task_id: args.taskId, status: "skipped" };
  },
});

export const markProvisionallyClosed = mutation({
  args: {
    taskId: v.string(),
    evidenceDraftId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
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
    return { task_id: args.taskId, status: "provisionally_closed" };
  },
});

export const reopenTask = mutation({
  args: {
    taskId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
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
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "reopened",
      reason: args.reason,
    });
    return { task_id: args.taskId, status: "reopened" };
  },
});

export const addTaskNote = mutation({
  args: {
    taskId: v.string(),
    note: v.string(),
    clientContext: v.optional(v.any()),
  },
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
    taskBrief: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
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
      target_years: [2013, 2018, 2023],
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
    });
    return { task_id: taskId, candidate_site_id: candidateSiteId, status: "in_progress" };
  },
});
