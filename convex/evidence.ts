import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { evidenceDraftInput, taskBatchInput, taskInput } from "./model";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import {
  MEDIUM_TEXT_MAX,
  TASK_BRIEF_MAX,
  assertClientContextLimit,
  assertEvidenceDraftLimits,
  assertEvidenceDraftSubmission,
  assertMaxString,
  assertTaskReasonLimit,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";
import { evidenceDraftDoc } from "./lib/validators";

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
  returns: evidenceDraftDoc,
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
  returns: v.array(evidenceDraftDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!canReview(user.roles)) {
      assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    }
    // collect the task's drafts (indexed prefix bounds reads to one task) and
    // sort in js: the index orders by draft_status before creation time, so a
    // take() here would truncate by status, not recency
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const drafts = (await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q) => q.eq("task_id", args.taskId))
      .collect())
      .sort((left, right) => right._creationTime - left._creationTime)
      .slice(0, limit);
    return canReview(user.roles)
      ? drafts
      : drafts.filter((draft) => draft.created_by === user._id);
  },
});

function canReviewEvidence(user: Doc<"users">): boolean {
  return canReview(user.roles);
}

// marks the author's other active (submitted/unresolved_note) drafts on the
// task as superseded so only one active submission exists per author; indexed
// per-status reads cover every draft, however many the task holds
async function supersedeOtherActiveDrafts(
  ctx: MutationCtx,
  draft: Doc<"evidence_drafts">,
  now: number,
): Promise<void> {
  for (const status of ["submitted", "unresolved_note"] as const) {
    const others = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q) => q.eq("task_id", draft.task_id).eq("draft_status", status))
      .collect();
    for (const otherDraft of others) {
      if (otherDraft._id !== draft._id && otherDraft.created_by === draft.created_by) {
        await ctx.db.patch(otherDraft._id, {
          draft_status: "superseded",
          updated_at: now,
        });
      }
    }
  }
}

const closedTaskStatuses = new Set(["reviewed", "exported"]);
const finalDraftStatuses = new Set(["accepted_for_export", "rejected"]);

async function upsertSpreadsheetBatch(
  ctx: any,
  batch: any,
  user: Doc<"users">,
  now: number,
): Promise<"inserted" | "updated"> {
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
): Promise<"inserted" | "updated" | "skipped_final"> {
  assertMaxString("submitter email", item.submitter_email, MEDIUM_TEXT_MAX);
  assertMaxString("submitter name", item.submitter_name, MEDIUM_TEXT_MAX);
  assertTaskReasonLimit("submission note", item.submit_note);
  assertEvidenceDraftLimits(item.draft);
  assertEvidenceDraftSubmission(item.draft, false);

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
  returns: v.object({
    evidence_draft_id: v.string(),
    task_id: v.string(),
    task_status: v.union(v.literal("needs_review"), v.literal("reviewed"), v.literal("draft_saved")),
  }),
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
        observation_contract_version: args.draft.observation_contract_version ?? "guided_observation_v1",
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
        observation_contract_version: args.draft.observation_contract_version ?? existing.observation_contract_version,
        privacy_flag: args.draft.privacy_flag ?? existing.privacy_flag,
        licence_flag: args.draft.licence_flag ?? existing.licence_flag,
        draft_status: existing.draft_status === "submitted" ? "submitted" : "draft",
        updated_at: now,
      });
    }

    const newTaskStatus = task.status === "needs_review" || task.status === "reviewed" ? task.status : ("draft_saved" as const);
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
  returns: v.object({
    batch_id: v.string(),
    batch: v.union(v.literal("inserted"), v.literal("updated")),
    tasks: v.object({ inserted: v.number(), updated: v.number() }),
    drafts: v.object({ inserted: v.number(), updated: v.number(), skipped_final: v.number() }),
  }),
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

// per-status transition rules for starting a revision. a revision start
// moves the task only when the reviewer has already handed it back
// (changes_requested); while a submission or unresolved note awaits review
// the task keeps its queue status and the revision rides alongside until
// submitted. reviews:feedbackLoopMetrics keys on the changes_requested ->
// in_progress draft_saved event, so that pair must stay stable
const revisionTransitions = {
  changes_requested: "in_progress",
  needs_review: "needs_review",
  unresolved_note: "unresolved_note",
} as const;

export const reviseEvidenceDraft = mutation({
  args: {
    taskId: v.string(),
  },
  returns: v.object({
    task_id: v.string(),
    previous_evidence_draft_id: v.string(),
    evidence_draft_id: v.string(),
    task_status: v.union(
      v.literal("in_progress"),
      v.literal("needs_review"),
      v.literal("unresolved_note"),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const nextStatus = revisionTransitions[task.status as keyof typeof revisionTransitions];
    if (nextStatus === undefined) {
      throw new Error(
        "A revision can only start when the task status is changes_requested, needs_review, or unresolved_note.",
      );
    }
    // the task is the natural key from the RA UI; resolve the active
    // submission server-side so a stale client cannot clone the wrong
    // draft. unresolved-note tasks hold their evidence under the
    // unresolved_note draft status rather than submitted
    const latestByStatus = (status: "submitted" | "unresolved_note" | "draft") =>
      ctx.db
        .query("evidence_drafts")
        .withIndex("by_task_status", (q) => q.eq("task_id", args.taskId).eq("draft_status", status))
        .order("desc")
        .first();
    const candidates = [await latestByStatus("submitted"), await latestByStatus("unresolved_note")]
      .filter((draft): draft is Doc<"evidence_drafts"> => draft !== null)
      .sort((left, right) => right._creationTime - left._creationTime);
    const sourceDraft = candidates[0] ?? null;
    if (sourceDraft === null) {
      throw new Error("No submitted evidence draft or unresolved note found for this task.");
    }
    if (sourceDraft.created_by !== user._id && !canReview(user.roles)) {
      throw new Error("Evidence draft belongs to another user.");
    }

    const now = Date.now();
    // reuse the author's newest editable draft instead of minting a second
    // clone: a repeat click or an unfinished earlier revision should
    // continue, not fork
    const latestEditable = await latestByStatus("draft");
    const existingRevision =
      latestEditable !== null && latestEditable.created_by === sourceDraft.created_by
        ? latestEditable
        : null;
    if (existingRevision !== null && task.status === nextStatus) {
      // no status transition pending and an editable draft already exists;
      // return it without a duplicate task event
      return {
        task_id: args.taskId,
        previous_evidence_draft_id: sourceDraft.evidence_draft_id,
        evidence_draft_id: existingRevision.evidence_draft_id,
        task_status: nextStatus,
      };
    }

    let revisionDraftId: string;
    if (existingRevision !== null) {
      revisionDraftId = existingRevision.evidence_draft_id;
    } else {
      revisionDraftId = `${sourceDraft.task_id}:${sourceDraft.created_by}:revision:${now}`;
      // import dedup keys stay on the original: the clone's content will be
      // edited, so a carried-over content hash would lie about what it holds
      const {
        _id: _sourceRowId,
        _creationTime: _sourceCreationTime,
        evidence_draft_id: _sourceDraftId,
        draft_status: _sourceDraftStatus,
        created_at: _sourceCreatedAt,
        updated_at: _sourceUpdatedAt,
        source_claim_key: _sourceSourceClaimKey,
        claim_hash: _sourceClaimHash,
        import_batch_id: _sourceImportBatchId,
        ...draftContent
      } = sourceDraft;

      await ctx.db.insert("evidence_drafts", {
        ...draftContent,
        evidence_draft_id: revisionDraftId,
        draft_status: "draft",
        created_at: now,
        updated_at: now,
      });
    }
    await ctx.db.patch(task._id, {
      status: nextStatus,
      assigned_to: task.assigned_to ?? sourceDraft.created_by,
      claimed_by: task.claimed_by ?? sourceDraft.created_by,
      claimed_at: task.claimed_at ?? now,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: sourceDraft.task_id,
      eventType: "draft_saved",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: nextStatus,
      evidenceDraftId: revisionDraftId,
      reason: `Started revision from ${sourceDraft.draft_status === "unresolved_note" ? "unresolved note" : "submitted draft"} ${sourceDraft.evidence_draft_id}.`,
      clientContext: {
        revision_of_evidence_draft_id: sourceDraft.evidence_draft_id,
      },
    });

    return {
      task_id: sourceDraft.task_id,
      previous_evidence_draft_id: sourceDraft.evidence_draft_id,
      evidence_draft_id: revisionDraftId,
      task_status: nextStatus,
    };
  },
});

export const submitEvidenceDraft = mutation({
  args: {
    evidenceDraftId: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    evidence_draft_id: v.string(),
    task_status: v.literal("needs_review"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertTaskReasonLimit("submission note", args.note);
    const draft = await getDraftOrThrow(ctx, args.evidenceDraftId);
    if (draft.created_by !== user._id && !canReview(user.roles)) {
      throw new Error("Evidence draft belongs to another user.");
    }
    assertEvidenceDraftSubmission(draft, false);
    const task = await getTaskOrThrow(ctx, draft.task_id);
    const now = Date.now();

    await ctx.db.patch(draft._id, {
      draft_status: "submitted",
      updated_at: now,
    });
    await supersedeOtherActiveDrafts(ctx, draft, now);
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
    return { task_id: draft.task_id, evidence_draft_id: args.evidenceDraftId, task_status: "needs_review" as const };
  },
});

export const submitUnresolvedNote = mutation({
  args: {
    evidenceDraftId: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    task_id: v.string(),
    evidence_draft_id: v.string(),
    task_status: v.literal("unresolved_note"),
  }),
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
    assertEvidenceDraftSubmission(draft, true);
    const task = await getTaskOrThrow(ctx, draft.task_id);
    const now = Date.now();

    await ctx.db.patch(draft._id, {
      draft_status: "unresolved_note",
      updated_at: now,
    });
    await supersedeOtherActiveDrafts(ctx, draft, now);
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
    return { task_id: draft.task_id, evidence_draft_id: args.evidenceDraftId, task_status: "unresolved_note" as const };
  },
});
