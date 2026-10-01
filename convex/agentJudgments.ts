import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { assertInternalAgentIngestEnabled, internalAgentServiceUser } from "./lib/agentServiceUser";
import { MEDIUM_TEXT_MAX, assertMaxString } from "./lib/limits";
import { JUDGMENTS_PER_CALL_MAX, judgmentDisposition, recordJudgments, type JudgmentInput } from "./lib/agentJudgments";
import { judgmentsForTaskPlace } from "./lib/judgmentReads";
import { deterministicJudgmentInput, validateScorerJudgment } from "./lib/scorerJudgments";

// reviewer-facing reads and the human disposition write for agent
// judgments (docs/development/agent-judgments.md). humans decide; ai
// recommends. a disposition records what a person did with a judgment and
// changes nothing else.

// bounded reads walk each index newest first, so the cap drops the oldest
const LIST_MAX = 200;

export const listJudgmentsForTask = query({
  args: { taskId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const rows = await ctx.db
      .query("agent_judgments")
      .withIndex("by_task", (q) => q.eq("context.task_id", args.taskId))
      .order("desc")
      .take(LIST_MAX);
    return rows;
  },
});

export const listJudgmentsForSubject = query({
  args: { subjectRef: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const rows = await ctx.db
      .query("agent_judgments")
      .withIndex("by_subject", (q) => q.eq("subject_ref", args.subjectRef))
      .order("desc")
      .take(LIST_MAX);
    return rows;
  },
});

// the judgments about the place a task is about, with each row's newest
// dispositions embedded, so the reviewer panel needs one round trip. the place
// refs are the task's matched osm object and its source record id.
export const listJudgmentsForTaskPlace = query({
  args: { taskId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const task: Doc<"tasks"> | null = await ctx.db
      .query("tasks")
      .withIndex("by_task_id", (q) => q.eq("task_id", args.taskId))
      .unique();
    if (task === null) return [];
    return await judgmentsForTaskPlace(ctx, task);
  },
});

export const listDispositionsForJudgment = query({
  args: { judgmentId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const rows = await ctx.db
      .query("judgment_dispositions")
      .withIndex("by_judgment", (q) => q.eq("judgment_id", args.judgmentId))
      .order("desc")
      .take(LIST_MAX);
    return rows;
  },
});

export const recordJudgmentDisposition = mutation({
  args: {
    judgmentId: v.string(),
    disposition: judgmentDisposition,
    note: v.optional(v.string()),
    reviewDecisionId: v.optional(v.string()),
  },
  returns: v.object({ disposition_id: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const judgment = await ctx.db
      .query("agent_judgments")
      .withIndex("by_judgment_id", (q) => q.eq("judgment_id", args.judgmentId))
      .unique();
    if (judgment === null) {
      throw new Error("Judgment not found.");
    }
    const note = args.note?.trim();
    assertMaxString("judgment disposition note", note, MEDIUM_TEXT_MAX);
    // agreement can stand alone; a disagreement or correction says why
    if ((args.disposition === "disagreed" || args.disposition === "corrected") && (note === undefined || note.length < 8)) {
      throw new Error("A disagreement or correction needs a note of at least eight characters.");
    }
    if (args.reviewDecisionId !== undefined) {
      const decision = await ctx.db
        .query("review_decisions")
        .withIndex("by_review_decision_id", (q) => q.eq("review_decision_id", args.reviewDecisionId!))
        .unique();
      if (decision === null) {
        throw new Error("Review decision not found.");
      }
      // the decision must be about the same work as the judgment: same task,
      // and the same draft when both name one
      if (judgment.context.task_id === undefined || decision.task_id !== judgment.context.task_id) {
        throw new Error("Review decision belongs to a different task from the judgment.");
      }
      if (judgment.context.evidence_draft_id !== undefined && decision.evidence_draft_id !== undefined
        && decision.evidence_draft_id !== judgment.context.evidence_draft_id) {
        throw new Error("Review decision belongs to a different evidence draft from the judgment.");
      }
    }
    const prior = await ctx.db
      .query("judgment_dispositions")
      .withIndex("by_judgment", (q) => q.eq("judgment_id", args.judgmentId))
      .collect();
    const now = Date.now();
    const dispositionId = `${args.judgmentId}:disposition:${now}:${prior.length + 1}`;
    await ctx.db.insert("judgment_dispositions", {
      disposition_id: dispositionId,
      judgment_id: args.judgmentId,
      reviewer_user_id: user._id,
      disposition: args.disposition,
      note: note === undefined || note === "" ? undefined : note,
      review_decision_id: args.reviewDecisionId,
      created_at: now,
    });
    return { disposition_id: dispositionId };
  },
});

// writes deterministic scorer judgments (agent-judgment.v1.1), as converted by
// scripts/osm_confidence_judgments.mjs, on the firstPassReceipts.ingestFirstPass
// pattern: internal, gated by POW_INTERNAL_AGENT_INGEST_ENABLED, attributed to
// the internal agent service user. it creates no task, draft, version, event
// or decision. running it against a deployment is a data import that needs the
// project lead's instruction.
export const ingestDeterministicJudgments = internalMutation({
  args: { judgments: v.array(deterministicJudgmentInput), signalVectorSha256: v.string() },
  returns: v.array(v.object({ judgment_id: v.string(), created: v.boolean() })),
  handler: async (ctx, args) => {
    assertInternalAgentIngestEnabled();
    if (args.judgments.length > JUDGMENTS_PER_CALL_MAX) {
      throw new Error(`At most ${JUDGMENTS_PER_CALL_MAX} judgments per call.`);
    }
    if (!/^[0-9a-f]{64}$/.test(args.signalVectorSha256)) throw new Error("The signal-vector hash is a sha256.");
    const inputs = args.judgments as unknown as JudgmentInput[];
    if (new Set(inputs.map((input) => input.context.country_code)).size > 1) throw new Error("One call carries one country.");
    for (const input of inputs) {
      validateScorerJudgment(input);
      if (input.judge.signal_vector_sha256 !== args.signalVectorSha256) {
        throw new Error("Every judgment names the signal-vector hash the call names.");
      }
    }
    const now = Date.now();
    const service = await internalAgentServiceUser(ctx, now);
    return await recordJudgments(ctx, { actorUserId: service._id, judgments: inputs, now });
  },
});
