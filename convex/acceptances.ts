import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { acceptanceOutcome, taskStatus } from "./model";
import { canReview, chooseActorRole, requireUser } from "./lib/auth";
import { TASK_REASON_MAX, assertMaxString } from "./lib/limits";
import { canonicalJson, sha256 } from "./lib/sha256";
import { appendTaskEvent } from "./lib/taskEvents";
import {
  acceptanceRefusal,
  eventTypeForAcceptance,
  isSelfDecided,
  taskStatusForAcceptance,
} from "./lib/acceptance";

// the pi acceptance layer (jb rulings r-p1..r-p5, 2026-09-04; brief
// docs/development/pi-acceptance-layer-brief-2026-09-04.md): a reviewer's
// accepted-for-export decision leaves the task `reviewed`, awaiting a
// principal investigator; recordAcceptance moves it to `pi_accepted` (the
// only status the export takes) or returns it to the reviewers. rows are
// append-only, hashed like review decisions, and every acceptance writes
// a task event so the timeline reads reviewer -> pi -> export.

const acceptanceDoc = v.object({
  _id: v.id("task_acceptances"),
  _creationTime: v.number(),
  acceptance_id: v.string(),
  task_id: v.string(),
  review_decision_id: v.string(),
  evidence_draft_id: v.optional(v.string()),
  pi_user_id: v.id("users"),
  outcome: acceptanceOutcome,
  note: v.string(),
  self_decided: v.boolean(),
  legacy: v.optional(v.boolean()),
  created_at: v.number(),
  acceptance_hash: v.optional(v.string()),
});

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

// the newest decision on the task: the one a pi ratifies or returns
async function latestDecision(ctx: any, taskId: string): Promise<Doc<"review_decisions"> | null> {
  const rows: Doc<"review_decisions">[] = await ctx.db
    .query("review_decisions")
    .withIndex("by_task", (q: any) => q.eq("task_id", taskId))
    .collect();
  rows.sort((a, b) => b.created_at - a.created_at);
  return rows[0] ?? null;
}

export const recordAcceptance = mutation({
  args: {
    taskId: v.string(),
    outcome: acceptanceOutcome,
    note: v.string(),
  },
  returns: v.object({
    acceptance_id: v.string(),
    task_id: v.string(),
    task_status: taskStatus,
    self_decided: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["pi"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const decision = await latestDecision(ctx, args.taskId);
    const draft = decision?.evidence_draft_id
      ? await ctx.db
        .query("evidence_drafts")
        .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", decision.evidence_draft_id!))
        .unique()
      : null;
    assertMaxString("acceptance note", args.note, TASK_REASON_MAX);
    const refusal = acceptanceRefusal({
      userRoles: user.roles,
      userId: String(user._id),
      taskStatus: task.status,
      decision: decision === null
        ? null
        : { decision_status: decision.decision_status, reviewer_user_id: String(decision.reviewer_user_id) },
      draftAuthorId: draft ? String(draft.created_by) : undefined,
      note: args.note,
    });
    if (refusal !== null) {
      throw new Error(refusal);
    }
    const ratified = decision!;
    const now = Date.now();
    const acceptanceId = `${args.taskId}:acceptance:${now}:${user._id}`;
    const selfDecided = isSelfDecided({
      decision: { reviewer_user_id: String(ratified.reviewer_user_id) },
      userId: String(user._id),
    });
    const record = {
      acceptance_id: acceptanceId,
      task_id: args.taskId,
      review_decision_id: ratified.review_decision_id,
      evidence_draft_id: ratified.evidence_draft_id,
      pi_user_id: user._id,
      outcome: args.outcome,
      note: args.note.trim(),
      self_decided: selfDecided,
      created_at: now,
    };
    // the hash covers every stored field but itself; recomputing it from
    // the row must reproduce it, as for review decisions
    const acceptanceHash = sha256(canonicalJson({ ...record, pi_user_id: String(record.pi_user_id) }));
    await ctx.db.insert("task_acceptances", { ...record, acceptance_hash: acceptanceHash });

    const newStatus = taskStatusForAcceptance(args.outcome);
    await ctx.db.patch(task._id, {
      status: newStatus,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: eventTypeForAcceptance(args.outcome),
      actorUserId: user._id,
      actorRole: "pi",
      previousStatus: task.status,
      newStatus,
      reason: record.note,
      evidenceDraftId: ratified.evidence_draft_id,
      reviewDecisionId: ratified.review_decision_id,
      acceptanceId,
    });
    return { acceptance_id: acceptanceId, task_id: args.taskId, task_status: newStatus, self_decided: selfDecided };
  },
});

// the acceptance trail on a task, newest first, for the review portal
export const listTaskAcceptances = query({
  args: { taskId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(acceptanceDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "pi"]);
    if (!canReview(user.roles)) {
      // an ra sees the trail on their own task only
      const task = await getTaskOrThrow(ctx, args.taskId);
      if (task.assigned_to !== user._id) {
        throw new Error("Task is assigned to another user.");
      }
    }
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const rows = await ctx.db
      .query("task_acceptances")
      .withIndex("by_task", (q) => q.eq("task_id", args.taskId))
      .collect();
    rows.sort((a, b) => b.created_at - a.created_at);
    return rows.slice(0, limit);
  },
});

// the pi role's holders, so the portal can say who accepts (no ids)
export const listPrincipalInvestigators = query({
  args: {},
  returns: v.array(v.object({ label: v.string() })),
  handler: async (ctx) => {
    await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "pi"]);
    const active = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return active
      .filter((person) => person.roles.includes("pi"))
      .map((person) => ({ label: person.display_name || person.initials || "PI" }));
  },
});

const BACKFILL_USER_EMAIL = "pi-acceptance-backfill@service.local";

// migration (brief section 2.10): every task exported before the layer
// receives one legacy acceptance row so the export history stays
// explicable; tasks already `reviewed` simply await a pi. idempotent:
// a task with any acceptance row is skipped. run once per deployment:
//   npx convex run acceptances:backfillLegacyExported '{}'
export const backfillLegacyExported = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({ exported_tasks: v.number(), backfilled: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let serviceUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", BACKFILL_USER_EMAIL))
      .unique();
    let serviceUserId: Id<"users">;
    if (serviceUser === null) {
      if (args.dryRun) {
        serviceUserId = "dry-run" as unknown as Id<"users">;
      } else {
        serviceUserId = await ctx.db.insert("users", {
          email: BACKFILL_USER_EMAIL,
          display_name: "PI acceptance backfill (2026-09-04)",
          initials: "SVC",
          roles: ["service"],
          status: "active",
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      serviceUserId = serviceUser._id;
    }
    const exported = await ctx.db
      .query("tasks")
      .withIndex("by_status_priority", (q) => q.eq("status", "exported"))
      .collect();
    let backfilled = 0;
    let skipped = 0;
    for (const task of exported) {
      const existing = await ctx.db
        .query("task_acceptances")
        .withIndex("by_task", (q) => q.eq("task_id", task.task_id))
        .first();
      if (existing !== null) {
        skipped += 1;
        continue;
      }
      const decision = await latestDecision(ctx, task.task_id);
      if (args.dryRun) {
        backfilled += 1;
        continue;
      }
      const record = {
        acceptance_id: `${task.task_id}:acceptance:legacy:${now}`,
        task_id: task.task_id,
        review_decision_id: decision?.review_decision_id ?? "",
        evidence_draft_id: decision?.evidence_draft_id,
        pi_user_id: serviceUserId,
        outcome: "accepted" as const,
        note: "legacy: exported before the PI acceptance layer (2026-09-04)",
        self_decided: false,
        legacy: true,
        created_at: now,
      };
      await ctx.db.insert("task_acceptances", {
        ...record,
        acceptance_hash: sha256(canonicalJson({ ...record, pi_user_id: String(serviceUserId) })),
      });
      backfilled += 1;
    }
    return { exported_tasks: exported.length, backfilled, skipped };
  },
});
