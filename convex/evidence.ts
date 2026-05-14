import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { evidenceDraftInput } from "./model";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import {
  assertClientContextLimit,
  assertEvidenceDraftLimits,
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
