import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { evidenceDraftInput, occupancySegmentInput, taskBatchInput, taskInput } from "./model";
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
import { assertNotRapidContract, isRapidCurrentDraft } from "./lib/rapidEntry";
import { dateFloorYear, defaultTargetYears } from "./lib/countryYears";
import { assignedTaskPeriodProblem } from "./lib/assignedTaskPeriods";
import { assertOccupancySet, occupancyReferenceDate } from "./lib/occupancies";
import { intakeRateLimiter } from "./lib/rateLimits";
import { assertRapidSubmissionId } from "./lib/rapidEntry";
import { recordOccupancySet, taskPoint } from "./occupancies";
import { assertWideEvidenceRowFields } from "./lib/wideEvidenceFields";
import { resolveCitedSource } from "./lib/sources";
import { appendTaskEvent } from "./lib/taskEvents";
import { evidenceDraftDoc } from "./lib/validators";


// the waves a task's wide row must carry: the task's own, else the
// country default (pr-b0: the export header is the shared list for these)
function taskTargetYears(task: { target_years?: number[]; country_code: string }): number[] {
  return task.target_years && task.target_years.length > 0
    ? task.target_years
    : defaultTargetYears(task.country_code);
}

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

// the audited "delete": the author (or a review role) marks a draft
// withdrawn. the row stays on record, and the task leaves the review
// queue only when no other active submission remains on it
export const withdrawEvidenceDraft = mutation({
  args: {
    evidenceDraftId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    evidence_draft_id: v.string(),
    task_id: v.string(),
    task_status: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertTaskReasonLimit("withdraw reason", args.reason);
    const draft = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", args.evidenceDraftId))
      .unique();
    if (draft === null) {
      throw new Error("Evidence draft not found.");
    }
    if (draft.created_by !== user._id && !canReviewEvidence(user)) {
      throw new Error("Evidence draft belongs to another user.");
    }
    const task = await getTaskOrThrow(ctx, draft.task_id);
    if (draft.draft_status === "withdrawn") {
      return { evidence_draft_id: draft.evidence_draft_id, task_id: draft.task_id, task_status: task.status };
    }
    if (draft.draft_status === "superseded") {
      throw new Error("A superseded draft is already inactive; withdraw the current version instead.");
    }
    if (draft.draft_status === "accepted_for_export" || draft.draft_status === "rejected") {
      throw new Error("A decided draft stays on record. Ask a reviewer to reopen the task instead.");
    }
    const now = Date.now();
    await ctx.db.patch(draft._id, { draft_status: "withdrawn", updated_at: now });
    const remainingActive = (
      await Promise.all(
        (["submitted", "unresolved_note"] as const).map((activeStatus) =>
          ctx.db
            .query("evidence_drafts")
            .withIndex("by_task_status", (q) => q.eq("task_id", draft.task_id).eq("draft_status", activeStatus))
            .collect(),
        ),
      )
    ).flat().filter((doc) => doc._id !== draft._id);
    let newTaskStatus = task.status;
    if (
      remainingActive.length === 0
      && ["needs_review", "unresolved_note", "draft_saved", "changes_requested"].includes(task.status)
    ) {
      newTaskStatus = "in_progress";
    }
    await ctx.db.patch(task._id, {
      ...(newTaskStatus === task.status ? {} : { status: newTaskStatus }),
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: draft.task_id,
      eventType: "draft_withdrawn",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: newTaskStatus,
      evidenceDraftId: draft.evidence_draft_id,
      reason: args.reason?.trim() || "Draft withdrawn by its author.",
    });
    return { evidence_draft_id: draft.evidence_draft_id, task_id: draft.task_id, task_status: newTaskStatus };
  },
});

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
      .withIndex("by_task_creator_status", (q) =>
        q.eq("task_id", draft.task_id).eq("created_by", draft.created_by).eq("draft_status", status),
      )
      .take(21);
    if (others.length > 20) {
      throw new Error("This contributor has more than 20 active drafts for the task. Ask JB to repair the duplicate active set before continuing.");
    }
    for (const otherDraft of others) {
      if (otherDraft._id !== draft._id) {
        // a generic submission must never displace an active rapid
        // observation; only rapidEntry's correction path may supersede it
        if (isRapidCurrentDraft(otherDraft)) {
          throw new Error(
            "This task holds a rapid current observation awaiting review. Correct that observation through the rapid entry path instead of submitting separate evidence.",
          );
        }
        await ctx.db.patch(otherDraft._id, {
          draft_status: "superseded",
          updated_at: now,
        });
      }
    }
  }
}

async function markDraftSubmitted(
  ctx: MutationCtx,
  draft: Doc<"evidence_drafts">,
  task: Doc<"tasks">,
  user: Doc<"users">,
  now: number,
  note: string | undefined,
  clientContext?: unknown,
): Promise<void> {
  await ctx.db.patch(draft._id, { draft_status: "submitted", updated_at: now });
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
    evidenceDraftId: draft.evidence_draft_id,
    reason: note,
    clientContext,
  });
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
  assertNotRapidContract(item.draft, "spreadsheet import");
  assertEvidenceDraftLimits(item.draft);
  assertEvidenceDraftSubmission(item.draft, false);

  const draftId = item.evidence_draft_id ?? `${item.task_id}:spreadsheet:${now}`;
  const task = await getTaskOrThrow(ctx, item.task_id);
  assertWideEvidenceRowFields(item.draft.generated_wide_row, taskTargetYears(task));
  const actorRole = chooseActorRole(user, ["service", "admin"]);
  const existing = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", draftId))
    .unique();

  if (existing !== null && finalDraftStatuses.has(existing.draft_status)) {
    return "skipped_final";
  }
  assertNotRapidContract(existing, "spreadsheet import");

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
    assertNotRapidContract(args.draft, "the general draft route");
    assertEvidenceDraftLimits(args.draft);
    assertWideEvidenceRowFields(args.draft.generated_wide_row, taskTargetYears(task));
    assertClientContextLimit(args.clientContext);
    // a cited register source must exist and be active before it is stored
    await resolveCitedSource(ctx, args.draft.source_id, args.draft.source_locator);

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
      assertNotRapidContract(existing, "the general draft route");
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
    // a rapid observation is never cloned into a generic draft: the
    // original stays on record and its author corrects it by submitting a
    // new current observation through rapidEntry:submitCurrentObservation
    if (isRapidCurrentDraft(sourceDraft)) {
      throw new Error(
        "This task holds a rapid current observation. Submit a corrected observation instead of revising; the original stays on record.",
      );
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
        guided_submission_key: _sourceGuidedSubmissionKey,
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
    assertNotRapidContract(draft, "the general submission route");
    assertEvidenceDraftSubmission(draft, false);
    const task = await getTaskOrThrow(ctx, draft.task_id);
    assertWideEvidenceRowFields(draft.generated_wide_row, taskTargetYears(task));
    if (
      task.country_code === "NZ"
      && task.assigned_to !== undefined
      && draft.observation_contract_version === "guided_observation_v1"
    ) {
      throw new Error("Assigned guided tasks must submit evidence and periods together. Reload the portal and try again.");
    }
    const now = Date.now();
    await markDraftSubmitted(ctx, draft, task, user, now, args.note);
    return { task_id: draft.task_id, evidence_draft_id: args.evidenceDraftId, task_status: "needs_review" as const };
  },
});

const guidedSubmissionClientContext = v.object({
  source: v.optional(v.string()),
  country_code: v.optional(v.string()),
  batch_id: v.optional(v.string()),
  selected_target_year: v.optional(v.number()),
  page_path: v.optional(v.string()),
  portal_version: v.optional(v.string()),
});

// Final assigned-task submission is one Convex transaction: the evidence
// transition, period replacement, derived proposals, and events either all
// commit or all roll back. Saved draft cards therefore remain recoverable
// after any failed final submission.
export const submitEvidenceDraftWithOccupancies = mutation({
  args: {
    evidenceDraftId: v.string(),
    note: v.optional(v.string()),
    clientSubmissionId: v.string(),
    segments: v.array(occupancySegmentInput),
    clientContext: v.optional(guidedSubmissionClientContext),
  },
  returns: v.object({
    task_id: v.string(),
    evidence_draft_id: v.string(),
    task_status: v.literal("needs_review"),
    occupancy_ids: v.array(v.string()),
    derived_years: v.array(v.number()),
    conflict_years: v.array(v.number()),
    period_count: v.number(),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertTaskReasonLimit("submission note", args.note);
    assertRapidSubmissionId(args.clientSubmissionId);
    assertMaxString("evidence draft id", args.evidenceDraftId, MEDIUM_TEXT_MAX);
    assertClientContextLimit(args.clientContext);
    const draft = await getDraftOrThrow(ctx, args.evidenceDraftId);
    if (draft.created_by !== user._id) {
      throw new Error("Only the contributor who saved this evidence can submit its periods.");
    }
    assertNotRapidContract(draft, "the guided evidence-and-periods route");
    assertEvidenceDraftSubmission(draft, false);
    const task = await getTaskOrThrow(ctx, draft.task_id);
    assertWideEvidenceRowFields(draft.generated_wide_row, taskTargetYears(task));
    const submissionKey = `${user._id}:${args.clientSubmissionId}`;

    if (draft.guided_submission_key !== undefined) {
      if (draft.guided_submission_key !== submissionKey) {
        throw new Error("This evidence has already been submitted. Refresh the task list before trying again.");
      }
      const existing = await ctx.db
        .query("site_occupancies")
        .withIndex("by_submission_key", (q) => q.eq("submission_key", submissionKey))
        .take(21);
      if (existing.length > 20) {
        throw new Error("This submission has more than 20 active periods. Ask JB to repair the duplicate set before continuing.");
      }
      const submittedForDraft = existing.filter(
        (row) => row.parent_evidence_draft_id === draft.evidence_draft_id,
      );
      return {
        task_id: draft.task_id,
        evidence_draft_id: draft.evidence_draft_id,
        task_status: "needs_review" as const,
        occupancy_ids: submittedForDraft.map((row) => row.occupancy_id),
        derived_years: [],
        conflict_years: [],
        period_count: submittedForDraft.length,
        deduped: true,
      };
    }
    if (draft.draft_status !== "draft") {
      throw new Error("Submit periods against the current editable draft, not an earlier submitted version.");
    }
    const requirement = assignedTaskPeriodProblem(task, draft, args.segments.length);
    if (requirement) throw new Error(requirement);

    const now = Date.now();
    if (args.segments.length > 0) {
      const referenceDate = occupancyReferenceDate(draft.source_date_or_capture_date, now);
      assertOccupancySet(args.segments, referenceDate, taskPoint(task), dateFloorYear(task.country_code));
      await intakeRateLimiter.limit(ctx, "occupancyPerUser", { key: user._id, throws: true });
      await intakeRateLimiter.limit(ctx, "occupancyGlobal", { throws: true });
    }
    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);
    await markDraftSubmitted(ctx, draft, task, user, now, args.note, args.clientContext);
    await ctx.db.patch(draft._id, { guided_submission_key: submissionKey, updated_at: now });
    const { occupancyIds, derived } = await recordOccupancySet(ctx, {
      task,
      parent: draft,
      user,
      actorRole,
      submissionKey,
      submissionToken: args.clientSubmissionId,
      segments: args.segments,
      now,
      clientContext: args.clientContext,
      eventTaskStatus: "needs_review",
    });
    return {
      task_id: draft.task_id,
      evidence_draft_id: draft.evidence_draft_id,
      task_status: "needs_review" as const,
      occupancy_ids: occupancyIds,
      derived_years: derived.years,
      conflict_years: derived.conflicts,
      period_count: args.segments.length,
      deduped: false,
    };
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
    assertNotRapidContract(draft, "the unresolved-note route");
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
