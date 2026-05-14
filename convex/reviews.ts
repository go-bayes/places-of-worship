import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { reviewDecisionInput, taskStatus } from "./model";
import { chooseActorRole, requireUser } from "./lib/auth";
import {
  LONG_TEXT_MAX,
  MEDIUM_TEXT_MAX,
  TASK_REASON_MAX,
  VALIDATION_SUMMARY_MAX,
  assertMaxJson,
  assertMaxString,
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

async function getDraft(ctx: any, draftId: string | undefined): Promise<Doc<"evidence_drafts"> | null> {
  if (draftId === undefined) {
    return null;
  }
  return await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", draftId))
    .unique();
}

function taskStatusForDecision(
  decisionStatus: "accepted_for_export" | "rejected" | "needs_more_evidence" | "duplicate_task" | "deferred",
) {
  if (decisionStatus === "needs_more_evidence") {
    return "changes_requested";
  }
  return "reviewed";
}

function draftStatusForDecision(
  decisionStatus: "accepted_for_export" | "rejected" | "needs_more_evidence" | "duplicate_task" | "deferred",
) {
  if (decisionStatus === "accepted_for_export") {
    return "accepted_for_export";
  }
  if (decisionStatus === "rejected" || decisionStatus === "duplicate_task") {
    return "rejected";
  }
  return "submitted";
}

async function latestDraftForReview(ctx: any, taskId: string): Promise<Doc<"evidence_drafts"> | null> {
  const drafts = await ctx.db
    .query("evidence_drafts")
    .filter((q: any) => q.eq(q.field("task_id"), taskId))
    .order("desc")
    .take(50);
  return drafts.find((draft: Doc<"evidence_drafts">) => draft.draft_status === "submitted")
    ?? drafts.find((draft: Doc<"evidence_drafts">) => draft.draft_status === "unresolved_note")
    ?? drafts.find((draft: Doc<"evidence_drafts">) => draft.draft_status === "accepted_for_export")
    ?? drafts[0]
    ?? null;
}

async function latestReviewDecision(ctx: any, taskId: string): Promise<Doc<"review_decisions"> | null> {
  const decisions = await ctx.db
    .query("review_decisions")
    .withIndex("by_task", (q: any) => q.eq("task_id", taskId))
    .take(50);
  return decisions.sort(
    (left: Doc<"review_decisions">, right: Doc<"review_decisions">) =>
      right.created_at - left.created_at,
  )[0] ?? null;
}

export const listReviewQueue = query({
  args: {
    countryCode: v.optional(v.string()),
    status: v.optional(taskStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const status = args.status ?? "needs_review";
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    let tasks: Doc<"tasks">[];
    if (args.countryCode !== undefined) {
      const countryCode = args.countryCode;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_country_status", (q) => q.eq("country_code", countryCode).eq("status", status))
        .take(limit);
    } else {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_status_priority", (q) => q.eq("status", status))
        .take(limit);
    }

    const rows = [];
    for (const task of tasks) {
      const latestDraft = await latestDraftForReview(ctx, task.task_id);
      const latestReview = await latestReviewDecision(ctx, task.task_id);
      rows.push({ task, latestDraft, latestReview });
    }
    return rows;
  },
});

export const recordReviewDecision = mutation({
  args: {
    taskId: v.string(),
    decision: reviewDecisionInput,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const draft = await getDraft(ctx, args.decision.evidence_draft_id);
    if (args.decision.evidence_draft_id !== undefined && draft === null) {
      throw new Error(`Evidence draft not found: ${args.decision.evidence_draft_id}`);
    }
    if (draft !== null && draft.task_id !== args.taskId) {
      throw new Error("Evidence draft belongs to a different task.");
    }
    if (args.decision.decision_status === "accepted_for_export" && draft === null) {
      throw new Error("Accepted-for-export decisions require an evidence draft.");
    }
    if ((args.decision.decision_note ?? "").trim().length < 8) {
      throw new Error("Review decisions require a short decision note.");
    }
    assertMaxString("review decision note", args.decision.decision_note, TASK_REASON_MAX);
    assertMaxString("accepted action", args.decision.accepted_action, MEDIUM_TEXT_MAX);
    assertMaxString("required follow-up", args.decision.required_follow_up, LONG_TEXT_MAX);
    assertMaxJson("target-year affects", args.decision.target_year_affects, VALIDATION_SUMMARY_MAX);

    const now = Date.now();
    const reviewDecisionId = `${args.taskId}:review:${now}:${user._id}`;
    const newTaskStatus = taskStatusForDecision(args.decision.decision_status);

    await ctx.db.insert("review_decisions", {
      review_decision_id: reviewDecisionId,
      task_id: args.taskId,
      evidence_draft_id: args.decision.evidence_draft_id,
      reviewer_user_id: user._id,
      decision_status: args.decision.decision_status,
      decision_note: args.decision.decision_note,
      accepted_action: args.decision.accepted_action,
      identity_decision: args.decision.identity_decision,
      target_year_affects: args.decision.target_year_affects ?? [],
      required_follow_up: args.decision.required_follow_up,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.patch(task._id, {
      status: newTaskStatus,
      updated_at: now,
      last_event_at: now,
    });
    if (draft !== null) {
      await ctx.db.patch(draft._id, {
        draft_status: draftStatusForDecision(args.decision.decision_status),
        updated_at: now,
      });
    }

    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: args.decision.decision_status === "needs_more_evidence" ? "changes_requested" : "review_decided",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: newTaskStatus,
      reason: args.decision.decision_note,
      evidenceDraftId: args.decision.evidence_draft_id,
      reviewDecisionId,
    });

    return {
      task_id: args.taskId,
      review_decision_id: reviewDecisionId,
      task_status: newTaskStatus,
    };
  },
});
