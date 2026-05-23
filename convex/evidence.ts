import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { evidenceDraftInput, taskBatchInput, taskInput } from "./model";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import {
  MEDIUM_TEXT_MAX,
  TASK_BRIEF_MAX,
  assertClientContextLimit,
  assertEvidenceDraftLimits,
  assertMaxString,
  assertTaskReasonLimit,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";

async function getTaskOrThrow(ctx: any, taskId: string): Promise<Doc<"tasks">> {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q: any) => q.eq("task_id", taskId))
    .unique();
  if (task === null) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

async function getDraftOrThrow(ctx: any, draftId: string): Promise<Doc<"evidence_drafts">> {
  const draft = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", draftId))
    .unique();
  if (draft === null) {
    throw new Error(`Evidence draft not found: ${draftId}`);
  }
  return draft;
}

export const getEvidenceDraft = query({
  args: {
    evidenceDraftId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const draft = await getDraftOrThrow(ctx, args.evidenceDraftId);
    if (
      draft.created_by !== user._id &&
      !canReview(user.roles)
    ) {
      throw new Error("Evidence draft belongs to another user.");
    }
    return draft;
  },
});

export const listTaskEvidence = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!canReview(user.roles)) {
      assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    }
    const drafts = await ctx.db
      .query("evidence_drafts")
      .filter((q) => q.eq(q.field("task_id"), args.taskId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 50, 1), 200));
    return canReview(user.roles)
      ? drafts
      : drafts.filter((draft) => draft.created_by === user._id);
  },
});

function canReviewEvidence(user: Doc<"users">): boolean {
  return canReview(user.roles);
}

const closedTaskStatuses = new Set(["reviewed", "exported"]);
const finalDraftStatuses = new Set(["accepted_for_export", "rejected"]);

async function upsertSpreadsheetBatch(ctx: any, batch: any, user: Doc<"users">, now: number) {
  assertMaxString("batch id", batch.batch_id, MEDIUM_TEXT_MAX);
  assertMaxString("batch notes", batch.notes, TASK_BRIEF_MAX);
  const existing = await ctx.db
    .query("task_batches")
    .withIndex("by_batch_id", (q: any) => q.eq("batch_id", batch.batch_id))
    .unique();
  if (existing === null) {
    await ctx.db.insert("task_batches", {
      ...batch,
      status: batch.status ?? "active",
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });
    return "inserted";
  }
  await ctx.db.patch(existing._id, {
    country_code: batch.country_code,
    source_kind: batch.source_kind,
    source_manifest_id: batch.source_manifest_id,
    target_years: batch.target_years,
    status: batch.status ?? existing.status,
    notes: batch.notes,
    updated_at: now,
  });
  return "updated";
}

async function upsertSpreadsheetTask(ctx: any, taskRecord: any, user: Doc<"users">, now: number) {
  assertMaxString("task id", taskRecord.task_id, MEDIUM_TEXT_MAX);
  assertMaxString("task name", taskRecord.name, MEDIUM_TEXT_MAX);
  assertMaxString("task brief", taskRecord.task_brief, TASK_BRIEF_MAX);
  const actorRole = chooseActorRole(user, ["service", "admin"]);
  const existing = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q: any) => q.eq("task_id", taskRecord.task_id))
    .unique();
  if (existing === null) {
    const status = taskRecord.status ?? "needs_review";
    await ctx.db.insert("tasks", {
      ...taskRecord,
      status,
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
      newStatus: status,
      reason: `Imported from spreadsheet batch ${taskRecord.batch_id}.`,
    });
    return "inserted";
  }

  const status = closedTaskStatuses.has(existing.status)
    ? existing.status
    : taskRecord.status ?? "needs_review";
  await ctx.db.patch(existing._id, {
    ...taskRecord,
    status,
    assigned_to: existing.assigned_to,
    claimed_by: existing.claimed_by,
    claimed_at: existing.claimed_at,
    nearby_site_refs: taskRecord.nearby_site_refs ?? existing.nearby_site_refs,
    automated_checks: taskRecord.automated_checks ?? existing.automated_checks,
    source_context: taskRecord.source_context ?? existing.source_context,
    updated_at: now,
    last_event_at: now,
  });
  await appendTaskEvent(ctx, {
    taskId: taskRecord.task_id,
    eventType: "imported",
    actorUserId: user._id,
    actorRole,
    previousStatus: existing.status,
    newStatus: status,
    reason: `Updated from spreadsheet batch ${taskRecord.batch_id}.`,
  });
  return "updated";
}

async function importSubmittedSpreadsheetDraft(
  ctx: any,
  item: any,
  user: Doc<"users">,
  now: number,
) {
  assertMaxString("submitter email", item.submitter_email, MEDIUM_TEXT_MAX);
  assertMaxString("submitter name", item.submitter_name, MEDIUM_TEXT_MAX);
  assertTaskReasonLimit("submission note", item.submit_note);
  assertEvidenceDraftLimits(item.draft);

  const draftId = item.evidence_draft_id ?? `${item.task_id}:spreadsheet:${now}`;
  const task = await getTaskOrThrow(ctx, item.task_id);
  const actorRole = chooseActorRole(user, ["service", "admin"]);
  const existing = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", draftId))
    .unique();

  if (existing !== null && finalDraftStatuses.has(existing.draft_status)) {
    return "skipped_final";
  }

  const draftRecord = {
    evidence_draft_id: draftId,
    task_id: item.task_id,
    draft_status: "submitted",
    created_by: existing?.created_by ?? user._id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    privacy_flag: item.draft.privacy_flag ?? "clear",
    licence_flag: item.draft.licence_flag ?? "needs_review",
    ...item.draft,
  };

  if (existing === null) {
    await ctx.db.insert("evidence_drafts", draftRecord);
  } else {
    await ctx.db.patch(existing._id, draftRecord);
  }

  const nextTaskStatus = closedTaskStatuses.has(task.status) ? task.status : "needs_review";
  await ctx.db.patch(task._id, {
    status: nextTaskStatus,
    updated_at: now,
    last_event_at: now,
  });
  await appendTaskEvent(ctx, {
    taskId: item.task_id,
    eventType: "submitted_for_review",
    actorUserId: user._id,
    actorRole,
    previousStatus: task.status,
    newStatus: nextTaskStatus,
    evidenceDraftId: draftId,
    reason: item.submit_note ?? "Imported from a spreadsheet submission.",
    clientContext: {
      source: "spreadsheet_submission_import",
      submitter_email: item.submitter_email,
      submitter_name: item.submitter_name,
    },
  });

  return existing === null ? "inserted" : "updated";
}

export const saveEvidenceDraft = mutation({
  args: {
    taskId: v.string(),
    evidenceDraftId: v.optional(v.string()),
    draft: evidenceDraftInput,
    clientContext: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    assertEvidenceDraftLimits(args.draft);
    assertClientContextLimit(args.clientContext);

    const now = Date.now();
    const draftId = args.evidenceDraftId ?? `${args.taskId}:${user._id}:draft`;
    const existing = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", draftId))
      .unique();

    if (existing === null) {
      await ctx.db.insert("evidence_drafts", {
        evidence_draft_id: draftId,
        task_id: args.taskId,
        draft_status: "draft",
        created_by: user._id,
        created_at: now,
        updated_at: now,
        privacy_flag: args.draft.privacy_flag ?? "clear",
        licence_flag: args.draft.licence_flag ?? "needs_review",
        ...args.draft,
      });
    } else {
      if (existing.created_by !== user._id && !canReviewEvidence(user)) {
        throw new Error("Evidence draft belongs to another user.");
      }
      if (
        existing.created_by === user._id
        && !canReviewEvidence(user)
        && ["submitted", "unresolved_note", "accepted_for_export", "rejected"].includes(existing.draft_status)
      ) {
        throw new Error("Submitted evidence cannot be edited directly. Start a revision instead.");
      }
      await ctx.db.patch(existing._id, {
        ...args.draft,
        privacy_flag: args.draft.privacy_flag ?? existing.privacy_flag,
        licence_flag: args.draft.licence_flag ?? existing.licence_flag,
        draft_status: existing.draft_status === "submitted" ? "submitted" : "draft",
        updated_at: now,
      });
    }

    const newTaskStatus = task.status === "needs_review" || task.status === "reviewed" ? task.status : "draft_saved";
    await ctx.db.patch(task._id, {
      assigned_to: task.assigned_to ?? user._id,
      claimed_by: task.claimed_by ?? user._id,
      claimed_at: task.claimed_at ?? now,
      status: newTaskStatus,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "draft_saved",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: newTaskStatus,
      evidenceDraftId: draftId,
      clientContext: args.clientContext,
    });
    return { evidence_draft_id: draftId, task_id: args.taskId, task_status: newTaskStatus };
  },
});

export const importSubmittedEvidenceDrafts = mutation({
  args: {
    batch: taskBatchInput,
    tasks: v.array(taskInput),
    drafts: v.array(v.object({
      task_id: v.string(),
      evidence_draft_id: v.optional(v.string()),
      draft: evidenceDraftInput,
      submit_note: v.optional(v.string()),
      submitter_email: v.optional(v.string()),
      submitter_name: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["admin", "service"]);
    const now = Date.now();
    const batchResult = await upsertSpreadsheetBatch(ctx, args.batch, user, now);
    const taskCounts = { inserted: 0, updated: 0 };
    const draftCounts = { inserted: 0, updated: 0, skipped_final: 0 };

    for (const taskRecord of args.tasks) {
      const result = await upsertSpreadsheetTask(ctx, taskRecord, user, now);
      taskCounts[result as "inserted" | "updated"] += 1;
    }

    for (const item of args.drafts) {
      const result = await importSubmittedSpreadsheetDraft(ctx, item, user, now);
      draftCounts[result as "inserted" | "updated" | "skipped_final"] += 1;
    }

    return {
      batch_id: args.batch.batch_id,
      batch: batchResult,
      tasks: taskCounts,
      drafts: draftCounts,
    };
  },
});

export const submitEvidenceDraft = mutation({
  args: {
    evidenceDraftId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertTaskReasonLimit("submission note", args.note);
    const draft = await getDraftOrThrow(ctx, args.evidenceDraftId);
    if (draft.created_by !== user._id && !canReview(user.roles)) {
      throw new Error("Evidence draft belongs to another user.");
    }
    const task = await getTaskOrThrow(ctx, draft.task_id);
    const now = Date.now();

    await ctx.db.patch(draft._id, {
      draft_status: "submitted",
      updated_at: now,
    });
    const otherDrafts = await ctx.db
      .query("evidence_drafts")
      .filter((q) => q.eq(q.field("task_id"), draft.task_id))
      .take(100);
    for (const otherDraft of otherDrafts) {
      if (
        otherDraft._id !== draft._id
        && otherDraft.created_by === draft.created_by
        && (otherDraft.draft_status === "submitted" || otherDraft.draft_status === "unresolved_note")
      ) {
        await ctx.db.patch(otherDraft._id, {
          draft_status: "superseded",
          updated_at: now,
        });
      }
    }
    await ctx.db.patch(task._id, {
      status: "needs_review",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: draft.task_id,
      eventType: "submitted_for_review",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "needs_review",
      evidenceDraftId: args.evidenceDraftId,
      reason: args.note,
    });
    return { task_id: draft.task_id, evidence_draft_id: args.evidenceDraftId, task_status: "needs_review" };
  },
});

export const submitUnresolvedNote = mutation({
  args: {
    evidenceDraftId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertTaskReasonLimit("unresolved note", args.note);
    const draft = await getDraftOrThrow(ctx, args.evidenceDraftId);
    if (
      draft.created_by !== user._id
      && !canReview(user.roles)
    ) {
      throw new Error("Evidence draft belongs to another user.");
    }
    const task = await getTaskOrThrow(ctx, draft.task_id);
    const now = Date.now();

    await ctx.db.patch(draft._id, {
      draft_status: "unresolved_note",
      updated_at: now,
    });
    const otherDrafts = await ctx.db
      .query("evidence_drafts")
      .filter((q) => q.eq(q.field("task_id"), draft.task_id))
      .take(100);
    for (const otherDraft of otherDrafts) {
      if (
        otherDraft._id !== draft._id
        && otherDraft.created_by === draft.created_by
        && (otherDraft.draft_status === "submitted" || otherDraft.draft_status === "unresolved_note")
      ) {
        await ctx.db.patch(otherDraft._id, {
          draft_status: "superseded",
          updated_at: now,
        });
      }
    }
    await ctx.db.patch(task._id, {
      status: "unresolved_note",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: draft.task_id,
      eventType: "submitted_unresolved_note",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "unresolved_note",
      evidenceDraftId: args.evidenceDraftId,
      reason: args.note,
    });
    return { task_id: draft.task_id, evidence_draft_id: args.evidenceDraftId, task_status: "unresolved_note" };
  },
});
