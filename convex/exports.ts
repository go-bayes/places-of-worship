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

function jsonl(rows: unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

function acceptedEvidenceDraftIds(reviewDecisions: Doc<"review_decisions">[]): Set<string> {
  return new Set(
    reviewDecisions
      .map((decision) => decision.evidence_draft_id)
      .filter((draftId): draftId is string => draftId !== undefined),
  );
}

function siteEvidenceWideCsv(
  evidenceDrafts: Doc<"evidence_drafts">[],
  reviewDecisions: Doc<"review_decisions">[],
): { csv: string; rowCount: number; fieldCount: number } {
  const acceptedDraftIds = acceptedEvidenceDraftIds(reviewDecisions);
  const rows: Record<string, unknown>[] = [];
  let fields: string[] = [];

  for (const draft of evidenceDrafts) {
    if (!acceptedDraftIds.has(draft.evidence_draft_id)) {
      continue;
    }
    const generated = draft.generated_wide_row as
      | { fields?: unknown; row?: unknown }
      | undefined;
    if (!generated || !Array.isArray(generated.fields) || typeof generated.row !== "object" || generated.row === null) {
      continue;
    }
    if (fields.length === 0) {
      fields = generated.fields.map((field) => String(field));
    }
    rows.push(generated.row as Record<string, unknown>);
  }

  if (fields.length === 0) {
    return { csv: "", rowCount: 0, fieldCount: 0 };
  }

  const lines = [csvLine(fields)];
  for (const row of rows) {
    lines.push(csvLine(fields.map((field) => row[field] ?? "")));
  }
  return {
    csv: `${lines.join("\n")}\n`,
    rowCount: rows.length,
    fieldCount: fields.length,
  };
}

function exportFiles(
  manifest: Record<string, unknown>,
  tasks: Doc<"tasks">[],
  taskEvents: Doc<"task_events">[],
  evidenceDrafts: Doc<"evidence_drafts">[],
  reviewDecisions: Doc<"review_decisions">[],
) {
  const wide = siteEvidenceWideCsv(evidenceDrafts, reviewDecisions);
  const fileManifest = {
    ...manifest,
    files: [
      { filename: "export_manifest.json", content_type: "application/json" },
      { filename: "tasks.jsonl", content_type: "application/x-ndjson", record_count: tasks.length },
      { filename: "task_events.jsonl", content_type: "application/x-ndjson", record_count: taskEvents.length },
      { filename: "evidence_drafts.jsonl", content_type: "application/x-ndjson", record_count: evidenceDrafts.length },
      { filename: "review_decisions.jsonl", content_type: "application/x-ndjson", record_count: reviewDecisions.length },
      {
        filename: "site_evidence_wide.csv",
        content_type: "text/csv",
        record_count: wide.rowCount,
        field_count: wide.fieldCount,
      },
    ],
  };

  return {
    export_manifest_json: JSON.stringify(fileManifest, null, 2) + "\n",
    tasks_jsonl: jsonl(tasks),
    task_events_jsonl: jsonl(taskEvents),
    evidence_drafts_jsonl: jsonl(evidenceDrafts),
    review_decisions_jsonl: jsonl(reviewDecisions),
    site_evidence_wide_csv: wide.csv,
  };
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

    const exportManifest = {
      export_batch_id: batch.export_batch_id,
      country_code: batch.country_code,
      created_at: batch.created_at,
      frozen_at: batch.frozen_at,
      schema_version: batch.schema_version,
      export_format: batch.export_format,
      included_task_count: tasks.length,
      included_evidence_count: evidenceDrafts.length,
      included_review_decision_count: reviewDecisions.length,
      pow_validation_status: batch.pow_validation_status,
    };

    return {
      export_manifest: exportManifest,
      tasks,
      task_events: taskEvents,
      evidence_drafts: evidenceDrafts,
      review_decisions: reviewDecisions,
      files: exportFiles(exportManifest, tasks, taskEvents, evidenceDrafts, reviewDecisions),
    };
  },
});
