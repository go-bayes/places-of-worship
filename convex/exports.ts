import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { exportFormat, exportBatchStatus } from "./model";
import { chooseActorRole, requireUser } from "./lib/auth";
import { appendTaskEvent } from "./lib/taskEvents";

async function taskByTaskId(ctx: any, taskId: string): Promise<Doc<"tasks"> | null> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q: any) => q.eq("task_id", taskId))
    .unique();
}

async function decisionsForTask(ctx: any, taskId: string): Promise<Doc<"review_decisions">[]> {
  return await ctx.db
    .query("review_decisions")
    .withIndex("by_task", (q: any) => q.eq("task_id", taskId))
    .collect();
}

export const listExportBatches = query({
  args: {
    countryCode: v.optional(v.string()),
    status: v.optional(exportBatchStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.countryCode !== undefined && args.status !== undefined) {
      const countryCode = args.countryCode;
      const status = args.status;
      return await ctx.db
        .query("export_batches")
        .withIndex("by_country_status", (q) => q.eq("country_code", countryCode).eq("status", status))
        .take(limit);
    }
    return await ctx.db.query("export_batches").withIndex("by_created_time").order("desc").take(limit);
  },
});

export const createExportBatch = mutation({
  args: {
    countryCode: v.string(),
    taskIds: v.optional(v.array(v.string())),
    exportFormat: v.optional(exportFormat),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const now = Date.now();
    const taskIds =
      args.taskIds ??
      (
        await ctx.db
          .query("tasks")
          .withIndex("by_country_status", (q) => q.eq("country_code", args.countryCode).eq("status", "reviewed"))
          .take(1000)
      ).map((task) => task.task_id);

    const reviewDecisionIds: string[] = [];
    for (const taskId of taskIds) {
      const decisions = await decisionsForTask(ctx, taskId);
      reviewDecisionIds.push(
        ...decisions
          .filter((decision) => decision.decision_status === "accepted_for_export")
          .map((decision) => decision.review_decision_id),
      );
    }

    const exportBatchId = `${args.countryCode.toLowerCase()}-convex-export-${now}`;
    await ctx.db.insert("export_batches", {
      export_batch_id: exportBatchId,
      country_code: args.countryCode,
      status: "draft",
      created_by: user._id,
      created_at: now,
      included_task_ids: taskIds,
      included_review_decision_ids: reviewDecisionIds,
      schema_version: "convex-task-layer.v0",
      export_format: args.exportFormat ?? "bundle",
      pow_validation_status: "not_run",
      notes: args.notes,
    });

    return {
      export_batch_id: exportBatchId,
      included_task_count: taskIds.length,
      included_review_decision_count: reviewDecisionIds.length,
    };
  },
});

export const freezeExportBatch = mutation({
  args: {
    exportBatchId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const batch = await ctx.db
      .query("export_batches")
      .withIndex("by_export_batch_id", (q) => q.eq("export_batch_id", args.exportBatchId))
      .unique();
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    if (batch.status !== "draft") {
      throw new Error("Only draft export batches can be frozen.");
    }

    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "frozen",
      frozen_at: now,
    });

    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task === null) {
        continue;
      }
      await ctx.db.patch(task._id, {
        status: "exported",
        updated_at: now,
        last_event_at: now,
      });
      await appendTaskEvent(ctx, {
        taskId,
        eventType: "exported",
        actorUserId: user._id,
        actorRole: chooseActorRole(user, ["curator", "admin"]),
        previousStatus: task.status,
        newStatus: "exported",
        exportBatchId: args.exportBatchId,
      });
    }

    return { export_batch_id: args.exportBatchId, status: "frozen" };
  },
});

export const getExportBundle = query({
  args: {
    exportBatchId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await ctx.db
      .query("export_batches")
      .withIndex("by_export_batch_id", (q) => q.eq("export_batch_id", args.exportBatchId))
      .unique();
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }

    const tasks = [];
    const taskEvents = [];
    const evidenceDrafts = [];
    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task !== null) {
        tasks.push(task);
      }
      taskEvents.push(
        ...(await ctx.db
          .query("task_events")
          .withIndex("by_task_time", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      evidenceDrafts.push(
        ...(await ctx.db
          .query("evidence_drafts")
          .filter((q) => q.eq(q.field("task_id"), taskId))
          .collect()),
      );
    }

    const reviewDecisions = [];
    for (const reviewDecisionId of batch.included_review_decision_ids) {
      const decision = await ctx.db
        .query("review_decisions")
        .withIndex("by_review_decision_id", (q) => q.eq("review_decision_id", reviewDecisionId))
        .unique();
      if (decision !== null) {
        reviewDecisions.push(decision);
      }
    }

    return {
      export_manifest: {
        export_batch_id: batch.export_batch_id,
        country_code: batch.country_code,
        created_at: batch.created_at,
        frozen_at: batch.frozen_at,
        schema_version: batch.schema_version,
        export_format: batch.export_format,
        included_task_count: tasks.length,
        included_evidence_count: evidenceDrafts.length,
        included_review_decision_count: reviewDecisions.length,
      },
      tasks,
      task_events: taskEvents,
      evidence_drafts: evidenceDrafts,
      review_decisions: reviewDecisions,
    };
  },
});
