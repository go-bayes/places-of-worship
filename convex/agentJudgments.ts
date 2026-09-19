import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { MEDIUM_TEXT_MAX, assertMaxString } from "./lib/limits";
import { judgmentDisposition } from "./lib/agentJudgments";

// reviewer-facing reads and the human disposition write for agent
// judgments (docs/development/agent-judgments.md). humans decide; ai
// recommends. a disposition records what a person did with a judgment and
// changes nothing else.

const LIST_MAX = 200;

export const listJudgmentsForTask = query({
  args: { taskId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    const rows = await ctx.db
      .query("agent_judgments")
      .withIndex("by_task", (q) => q.eq("context.task_id", args.taskId))
      .take(LIST_MAX);
    return rows.sort((left, right) => right.created_at - left.created_at);
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
      .take(LIST_MAX);
    return rows.sort((left, right) => right.created_at - left.created_at);
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
      .take(LIST_MAX);
    return rows.sort((left, right) => right.created_at - left.created_at);
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
