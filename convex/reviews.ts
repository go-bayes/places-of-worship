import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { reviewDecisionInput, taskStatus } from "./model";
import { canReview, chooseActorRole, requireUser } from "./lib/auth";
import {
  LONG_TEXT_MAX,
  MEDIUM_TEXT_MAX,
  TASK_REASON_MAX,
  VALIDATION_SUMMARY_MAX,
  assertMaxJson,
  assertMaxString,
} from "./lib/limits";
import { canonicalJson, sha256 } from "./lib/sha256";
import { appendTaskEvent } from "./lib/taskEvents";
import { assertLocationOutcome } from "./lib/locationOutcome";

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
): "changes_requested" | "reviewed" {
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

// indexed per-status lookups: the old .filter() scanned the whole
// evidence_drafts table per task, which blew the 16MB per-execution
// read limit once the queue held ~40 tasks with large drafts
async function latestDraftForReview(ctx: any, taskId: string): Promise<Doc<"evidence_drafts"> | null> {
  const byStatus = (status: string) =>
    ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q: any) => q.eq("task_id", taskId).eq("draft_status", status))
      .order("desc")
      .first();
  return (await byStatus("submitted"))
    ?? (await byStatus("unresolved_note"))
    ?? (await byStatus("accepted_for_export"))
    // fallback: newest draft in the task's index range (ordered by
    // status then creation — fine for tasks with no reviewable draft)
    ?? (await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q: any) => q.eq("task_id", taskId))
      .order("desc")
      .first())
    ?? null;
}

// return the newest advisory review for the draft currently under review.
async function latestAgentReview(ctx: any, draftId: string | undefined): Promise<Doc<"agent_reviews"> | null> {
  if (draftId === undefined) return null;
  const artifacts = await ctx.db
    .query("agent_reviews")
    .withIndex("by_draft", (q: any) => q.eq("evidence_draft_id", draftId))
    .order("desc")
    .take(1);
  return artifacts[0] ?? null;
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
  returns: v.array(
    v.object({
      task: v.any(),
      latestDraft: v.any(),
      latestReview: v.any(),
      latestAgentReview: v.any(),
      contributor_label: v.optional(v.string()),
      reviewer_label: v.optional(v.string()),
      review_claimant_label: v.optional(v.string()),
      review_claimed_by_me: v.optional(v.boolean()),
      submitted_by_me: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
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

    // person labels let the portal arrange the queue by contributor or by
    // the reviewer who made the last decision; ids stay server-side
    const labelCache = new Map<string, string | undefined>();
    const labelFor = async (userId: Doc<"users">["_id"] | undefined): Promise<string | undefined> => {
      if (userId === undefined) return undefined;
      const key = String(userId);
      if (!labelCache.has(key)) {
        const person = await ctx.db.get(userId);
        labelCache.set(key, person?.display_name || person?.initials || person?.email);
      }
      return labelCache.get(key);
    };

    const rows = [];
    for (const task of tasks) {
      const latestDraft = await latestDraftForReview(ctx, task.task_id);
      const latestReview = await latestReviewDecision(ctx, task.task_id);
      const agentReview = await latestAgentReview(ctx, latestDraft?.evidence_draft_id);
      rows.push({
        task,
        latestDraft,
        latestReview,
        latestAgentReview: agentReview,
        contributor_label: await labelFor(latestDraft?.created_by),
        reviewer_label: await labelFor(latestReview?.reviewer_user_id),
        review_claimant_label: await labelFor(task.review_claimed_by),
        review_claimed_by_me: task.review_claimed_by === user._id,
        // the author-exclusion rule: the portal greys the decision form
        // for the reviewer's own submissions
        submitted_by_me: latestDraft?.created_by === user._id,
      });
    }
    return rows;
  },
});

export const feedbackLoopMetrics = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      task_id: v.string(),
      changes_requested_event_id: v.string(),
      revision_event_id: v.string(),
      changes_requested_at: v.number(),
      revision_started_at: v.number(),
      revision_elapsed_ms: v.number(),
      revision_evidence_draft_id: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const changesRequestedEvents = await ctx.db
      .query("task_events")
      .withIndex("by_event_type_time", (q) => q.eq("event_type", "changes_requested"))
      .order("desc")
      .take(limit);

    const completedTaskIds = new Set<string>();
    const rows = [];
    for (const changesRequestedEvent of changesRequestedEvents) {
      if (completedTaskIds.has(changesRequestedEvent.task_id)) {
        continue;
      }
      const taskEvents = await ctx.db
        .query("task_events")
        .withIndex("by_task_time", (q) =>
          q.eq("task_id", changesRequestedEvent.task_id).gte("occurred_at", changesRequestedEvent.occurred_at),
        )
        .order("asc")
        .take(200);

      let revisionEvent: Doc<"task_events"> | null = null;
      for (const taskEvent of taskEvents) {
        if (taskEvent.occurred_at <= changesRequestedEvent.occurred_at) {
          continue;
        }
        // any actor role counts: reviseEvidenceDraft lets a reviewer or
        // curator start the revision on the ra's behalf
        if (
          taskEvent.event_type === "draft_saved"
          && taskEvent.previous_status === "changes_requested"
          && taskEvent.new_status === "in_progress"
        ) {
          revisionEvent = taskEvent;
          break;
        }
      }

      if (revisionEvent === null) {
        continue;
      }
      rows.push({
        task_id: changesRequestedEvent.task_id,
        changes_requested_event_id: changesRequestedEvent.event_id,
        revision_event_id: revisionEvent.event_id,
        changes_requested_at: changesRequestedEvent.occurred_at,
        revision_started_at: revisionEvent.occurred_at,
        revision_elapsed_ms: revisionEvent.occurred_at - changesRequestedEvent.occurred_at,
        revision_evidence_draft_id: revisionEvent.evidence_draft_id,
      });
      completedTaskIds.add(changesRequestedEvent.task_id);
      if (rows.length >= limit) {
        break;
      }
    }
    return rows;
  },
});

// apply shared human decision rules to an individual or batch item.
export async function applyReviewDecision(ctx: MutationCtx, args: { taskId: string; decision: any; snapshotHash?: string }, user: Doc<"users">) {
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!REVIEW_OPEN_STATUSES.has(task.status)) throw new Error("Task is not open for review; reopen or return it through the workflow first.");
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
    if (args.decision.decision_status === "accepted_for_export" && draft?.agent_intake_only === true) {
      throw new Error("Internal agent intake drafts require ordinary human evidence submission before acceptance for export.");
    }
    // jb ruling 2026-09-01: the submission's author may not judge it; only
    // the author is excluded, any other qualified reviewer may decide
    const judgedDraft = draft ?? await latestDraftForReview(ctx, args.taskId);
    if ((judgedDraft?.pending_occupancy_cards?.length ?? 0) > 0) {
      throw new Error("This evidence still has pending period cards and is not ready for review. Ask the contributor to resubmit it through the current portal.");
    }
    if (judgedDraft !== null && judgedDraft.created_by === user._id) {
      throw new Error("You submitted this evidence; another team member must record the review decision.");
    }
    // second/third-opinion gate (jb 2026-09-01): acceptance for export waits
    // until the requested number of other reviewers have recorded decisions
    if (args.decision.decision_status === "accepted_for_export" && (task.extra_opinions_required ?? 0) > 0) {
      const prior = await ctx.db
        .query("review_decisions")
        .withIndex("by_task", (q: any) => q.eq("task_id", args.taskId))
        .collect();
      const otherReviewers = new Set(
        prior
          .filter((row: Doc<"review_decisions">) => row.reviewer_user_id !== user._id)
          .map((row: Doc<"review_decisions">) => String(row.reviewer_user_id)),
      );
      const needed = task.extra_opinions_required ?? 0;
      if (otherReviewers.size < needed) {
        throw new Error(
          `This task asked for ${needed} additional opinion${needed === 1 ? "" : "s"} before acceptance; `
          + `${otherReviewers.size} other reviewer${otherReviewers.size === 1 ? " has" : "s have"} recorded a decision so far. `
          + "Record a non-acceptance decision to add your opinion, or wait for the others.",
        );
      }
    }
    // provenance of the AI recommendation the reviewer saw: the artifact
    // must exist and belong to this task; agreement without an artifact
    // reference is meaningless and rejected
    if (args.decision.agent_review_agreement !== undefined && args.decision.agent_review_id === undefined) {
      throw new Error("Recording agreement with an AI recommendation requires its agent_review_id.");
    }
    if (args.decision.agent_review_id !== undefined) {
      const artifact = await ctx.db
        .query("agent_reviews")
        .withIndex("by_agent_review_id", (q: any) => q.eq("agent_review_id", args.decision.agent_review_id!))
        .unique();
      if (artifact === null) {
        throw new Error(`Agent review not found: ${args.decision.agent_review_id}`);
      }
      if (artifact.task_id !== args.taskId) {
        throw new Error("Agent review belongs to a different task.");
      }
      if (judgedDraft !== null && artifact.evidence_draft_id !== judgedDraft.evidence_draft_id) {
        throw new Error("Agent review belongs to a different evidence draft.");
      }
    }
    if ((args.decision.decision_note ?? "").trim().length < 8) {
      throw new Error("Review decisions require a short decision note.");
    }
    // a moved pin needs a ruling before acceptance; the ruling is refused
    // where the task has no original point to rule between
    assertLocationOutcome(task, args.decision);
    assertMaxString("review decision note", args.decision.decision_note, TASK_REASON_MAX);
    assertMaxString("accepted action", args.decision.accepted_action, MEDIUM_TEXT_MAX);
    assertMaxString("required follow-up", args.decision.required_follow_up, LONG_TEXT_MAX);
    assertMaxJson("target-year affects", args.decision.target_year_affects, VALIDATION_SUMMARY_MAX);

    const now = Date.now();
    const reviewDecisionId = `${args.taskId}:review:${now}:${user._id}`;
    const newTaskStatus = taskStatusForDecision(args.decision.decision_status);
    const reviewDecisionRecord = {
      review_decision_id: reviewDecisionId,
      task_id: args.taskId,
      evidence_draft_id: args.decision.evidence_draft_id,
      reviewer_user_id: user._id,
      decision_status: args.decision.decision_status,
      decision_note: args.decision.decision_note,
      accepted_action: args.decision.accepted_action,
      identity_decision: args.decision.identity_decision,
      location_outcome: args.decision.location_outcome,
      target_year_affects: args.decision.target_year_affects ?? [],
      required_follow_up: args.decision.required_follow_up,
      agent_review_id: args.decision.agent_review_id,
      agent_review_agreement: args.decision.agent_review_agreement,
      review_snapshot_hash: args.snapshotHash,
      decision_hash_version: args.snapshotHash === undefined ? undefined : 1 as const,
      created_at: now,
      updated_at: now,
    };
    // hash covers review_decision_id, task_id, evidence_draft_id,
    // reviewer_user_id, decision_status, decision_note, accepted_action,
    // identity_decision, location_outcome (absent keys are dropped, so
    // rows before 2026-09-07 still reproduce), target_year_affects,
    // required_follow_up, agent_review_id, agent_review_agreement,
    // created_at, and updated_at; recomputing the hash from the stored
    // row must reproduce it. Snapshot-linked decisions use the named v1
    // envelope below; decisions without a snapshot retain version 0.
    const hashInput = {
      review_decision_id: reviewDecisionRecord.review_decision_id,
      task_id: reviewDecisionRecord.task_id,
      evidence_draft_id: reviewDecisionRecord.evidence_draft_id,
      reviewer_user_id: String(reviewDecisionRecord.reviewer_user_id),
      decision_status: reviewDecisionRecord.decision_status,
      decision_note: reviewDecisionRecord.decision_note,
      accepted_action: reviewDecisionRecord.accepted_action,
      identity_decision: reviewDecisionRecord.identity_decision,
      location_outcome: reviewDecisionRecord.location_outcome,
      target_year_affects: reviewDecisionRecord.target_year_affects,
      required_follow_up: reviewDecisionRecord.required_follow_up,
      agent_review_id: reviewDecisionRecord.agent_review_id,
      agent_review_agreement: reviewDecisionRecord.agent_review_agreement,
      created_at: reviewDecisionRecord.created_at,
      updated_at: reviewDecisionRecord.updated_at,
    };
    const decisionHash = sha256(canonicalJson(args.snapshotHash === undefined ? hashInput : {
      schema_version: "review-decision.v1",
      decision: hashInput,
      review_snapshot_hash: args.snapshotHash,
    }));

    await ctx.db.insert("review_decisions", {
      ...reviewDecisionRecord,
      decision_hash: decisionHash,
    });

    await ctx.db.patch(task._id, {
      status: newTaskStatus,
      // a recorded decision settles the claim and any open question
      ...(task.review_claimed_by !== undefined ? { review_claimed_by: undefined, review_claimed_at: undefined } : {}),
      ...(task.pending_reviewer_comment !== undefined ? { pending_reviewer_comment: undefined } : {}),
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
      clientContext: args.snapshotHash === undefined ? undefined : { review_snapshot_hash: args.snapshotHash },
    });

    return {
      task_id: args.taskId,
      review_decision_id: reviewDecisionId,
      task_status: newTaskStatus,
    };
}

export const recordReviewDecision = mutation({
  args: { taskId: v.string(), decision: reviewDecisionInput },
  returns: v.object({ task_id: v.string(), review_decision_id: v.string(), task_status: taskStatus }),
  handler: async (ctx, args) => applyReviewDecision(ctx, args, await requireUser(ctx, ["reviewer", "curator", "admin"])),
});

async function reviewSnapshot(ctx: MutationCtx | QueryCtx, taskId: string, evidenceDraftId: string) {
  const task = await getTaskOrThrow(ctx, taskId);
  const draft = await getDraft(ctx, evidenceDraftId);
  if (draft === null || draft.task_id !== taskId) throw new Error("Evidence draft not found for task.");
  const decisions = await ctx.db.query("review_decisions").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect();
  const taskEvents = await ctx.db.query("task_events").withIndex("by_task_time", (q: any) => q.eq("task_id", taskId)).collect();
  const agentReviews = await ctx.db.query("agent_reviews").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect();
  const historicalClaims = await ctx.db.query("historical_claims").withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId)).collect();
  const occupancies = await ctx.db.query("site_occupancies").withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId)).collect();
  const targetYearStates = await ctx.db.query("derived_target_year_states").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect();
  const yearLocations = await ctx.db.query("derived_year_locations").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect();
  const targetYearFunctions = await ctx.db.query("derived_target_year_functions").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect();
  const derivedEvents = await ctx.db.query("derived_state_events").withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId)).collect();
  const snapshot = { task, draft, review_decisions: decisions, task_events: taskEvents, agent_reviews: agentReviews, historical_claims: historicalClaims, site_occupancies: occupancies, derived_target_year_states: targetYearStates, derived_year_locations: yearLocations, derived_target_year_functions: targetYearFunctions, derived_state_events: derivedEvents };
  return { task, draft, snapshot, hash: sha256(canonicalJson(snapshot)) };
}

export const getReviewSnapshot = query({
  args: { taskId: v.string(), evidenceDraftId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const row = await reviewSnapshot(ctx, args.taskId, args.evidenceDraftId);
    return { task_id: args.taskId, evidence_draft_id: args.evidenceDraftId, snapshot_hash: row.hash, summary: { task_status: row.task.status, draft_status: row.draft.draft_status, review_decisions: row.snapshot.review_decisions.length, task_events: row.snapshot.task_events.length, agent_reviews: row.snapshot.agent_reviews.length, historical_claims: row.snapshot.historical_claims.length, site_occupancies: row.snapshot.site_occupancies.length, derived_states: row.snapshot.derived_target_year_states.length, derived_locations: row.snapshot.derived_year_locations.length, derived_functions: row.snapshot.derived_target_year_functions.length }, snapshot: row.snapshot };
  },
});

export const getRecordedReviewSnapshot = query({
  args: { snapshotHash: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const row = await ctx.db.query("review_snapshots").withIndex("by_hash", (q) => q.eq("snapshot_hash", args.snapshotHash)).unique();
    if (row === null) throw new Error("Recorded review snapshot not found.");
    return row;
  },
});

export const batchRecordReviewDecisions = mutation({
  args: {
    items: v.array(v.object({ task_id: v.string(), evidence_draft_id: v.string(), snapshot_hash: v.string(), decision: reviewDecisionInput })),
  },
  returns: v.object({ count: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    if (args.items.length === 0 || args.items.length > 20) throw new Error("A review batch must contain 1 to 20 items.");
    const seen = new Set<string>();
    const checked: Array<{ item: typeof args.items[number]; row: Awaited<ReturnType<typeof reviewSnapshot>>; snapshotJson: string }> = [];
    let aggregateBytes = 0;
    for (const item of args.items) {
      if (seen.has(item.task_id) || !/^[0-9a-f]{64}$/.test(item.snapshot_hash)) throw new Error("Batch contains duplicate task or invalid snapshot hash.");
      seen.add(item.task_id);
      if (item.decision.decision_status !== "accepted_for_export") throw new Error("This batch endpoint is for accepted-for-export decisions only.");
      if (item.decision.evidence_draft_id !== item.evidence_draft_id) throw new Error("Decision draft does not match snapshot draft.");
      const row = await reviewSnapshot(ctx, item.task_id, item.evidence_draft_id);
      if (row.hash !== item.snapshot_hash) throw new Error(`Review snapshot is stale for ${item.task_id}.`);
      if (!REVIEW_OPEN_STATUSES.has(row.task.status)) throw new Error(`Task ${item.task_id} is not open for review.`);
      if (row.draft.draft_status !== "submitted" && row.draft.draft_status !== "unresolved_note") throw new Error(`Draft ${item.evidence_draft_id} is not submitted.`);
      if (row.draft.agent_intake_only === true) throw new Error("Internal agent intake drafts require ordinary human evidence submission before acceptance for export.");
      const snapshotJson = canonicalJson(row.snapshot);
      const snapshotBytes = new TextEncoder().encode(snapshotJson).length;
      if (snapshotBytes > 128 * 1024) throw new Error(`Review snapshot for ${item.task_id} exceeds 128 KiB.`);
      aggregateBytes += snapshotBytes;
      if (aggregateBytes > 512 * 1024) throw new Error("Review batch snapshots exceed 512 KiB.");
      checked.push({ item, row, snapshotJson });
    }
    // Convex mutations are transactional: if any shared decision validation or
    // write fails, all earlier decisions in this batch roll back.
    for (const entry of checked) {
      const recorded = await ctx.db.query("review_snapshots").withIndex("by_hash", (q) => q.eq("snapshot_hash", entry.item.snapshot_hash)).unique();
      if (recorded === null) await ctx.db.insert("review_snapshots", { snapshot_hash: entry.item.snapshot_hash, snapshot_json: entry.snapshotJson, created_at: Date.now(), reviewer_user_id: user._id });
      await applyReviewDecision(ctx, { taskId: entry.item.task_id, decision: entry.item.decision, snapshotHash: entry.item.snapshot_hash }, user);
    }
    return { count: checked.length };
  },
});

// statuses a reviewer can act on; mirrors the portal's decision-form gate
const REVIEW_OPEN_STATUSES = new Set([
  "needs_review",
  "unresolved_note",
  "changes_requested",
  "provisionally_closed",
]);

// review-side claim pool (jb 2026-09-01): mirrors the ra claim semantics.
// any qualified reviewer except the draft's author may claim a task, so
// two reviewers do not unknowingly work the same submission
export const claimReviewTask = mutation({
  args: { taskId: v.string() },
  returns: v.object({ task_id: v.string(), review_claimed: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!REVIEW_OPEN_STATUSES.has(task.status)) {
      throw new Error("This task is not open for review.");
    }
    if (task.review_claimed_by !== undefined && task.review_claimed_by !== user._id) {
      throw new Error("Another reviewer has already claimed this task.");
    }
    const latestDraft = await latestDraftForReview(ctx, args.taskId);
    if (latestDraft !== null && latestDraft.created_by === user._id) {
      throw new Error("You submitted this evidence; another team member must review it.");
    }
    if (task.review_claimed_by === user._id) {
      return { task_id: args.taskId, review_claimed: true };
    }
    const now = Date.now();
    await ctx.db.patch(task._id, {
      review_claimed_by: user._id,
      review_claimed_at: now,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "review_claimed",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: task.status,
      reason: "Task claimed for review.",
    });
    return { task_id: args.taskId, review_claimed: true };
  },
});

export const releaseReviewTask = mutation({
  args: { taskId: v.string() },
  returns: v.object({ task_id: v.string(), review_claimed: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (task.review_claimed_by === undefined) {
      return { task_id: args.taskId, review_claimed: false };
    }
    const isClaimant = task.review_claimed_by === user._id;
    const isCuratorOrAdmin = user.roles.includes("curator") || user.roles.includes("admin");
    if (!isClaimant && !isCuratorOrAdmin) {
      throw new Error("Only the claimant, a curator, or an admin may release this review claim.");
    }
    const now = Date.now();
    await ctx.db.patch(task._id, {
      review_claimed_by: undefined,
      review_claimed_at: undefined,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "review_released",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: task.status,
      reason: isClaimant ? "Review claim released." : "Review claim released by a curator or admin.",
    });
    return { task_id: args.taskId, review_claimed: false };
  },
});

// second/third-opinion request (jb 2026-09-01): callable at submission by
// the people involved with the task and at review by any review role; each
// call asks for one more independent reviewer before acceptance, capped at
// a third opinion
export const requestAdditionalOpinion = mutation({
  args: {
    taskId: v.string(),
    note: v.string(),
  },
  returns: v.object({ task_id: v.string(), extra_opinions_required: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const note = args.note.trim();
    if (note.length < 8) {
      throw new Error("Briefly say why another opinion is needed.");
    }
    assertMaxString("opinion request note", note, TASK_REASON_MAX);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!canReview(user.roles)) {
      const latestDraft = await latestDraftForReview(ctx, args.taskId);
      const involved = task.assigned_to === user._id
        || task.claimed_by === user._id
        || latestDraft?.created_by === user._id;
      if (!involved) {
        throw new Error("Only the task's contributor or a review role can request another opinion here.");
      }
    }
    const current = task.extra_opinions_required ?? 0;
    if (current >= 2) {
      throw new Error("A third opinion is already requested; that is the cap.");
    }
    const now = Date.now();
    await ctx.db.patch(task._id, {
      extra_opinions_required: current + 1,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "opinion_requested",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: task.status,
      reason: note,
    });
    return { task_id: args.taskId, extra_opinions_required: current + 1 };
  },
});

// return-for-comment (jb 2026-09-01): instead of deciding, the reviewer
// sends the contributor a question — for example to answer an AI
// recommendation to reject — and holds the decision until the reply.
// the task shows in the ra's changes-requested panel with a reply box;
// answering returns it to the review queue
export const requestContributorComment = mutation({
  args: {
    taskId: v.string(),
    comment: v.string(),
  },
  returns: v.object({ task_id: v.string(), task_status: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const comment = args.comment.trim();
    if (comment.length < 8) {
      throw new Error("Write the question or comment the contributor should answer.");
    }
    assertMaxString("reviewer comment", comment, TASK_REASON_MAX);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!REVIEW_OPEN_STATUSES.has(task.status)) {
      throw new Error("This task is not open for review.");
    }
    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "changes_requested",
      pending_reviewer_comment: comment,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "comment_requested",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: "changes_requested",
      reason: comment,
    });
    return { task_id: args.taskId, task_status: "changes_requested" };
  },
});
