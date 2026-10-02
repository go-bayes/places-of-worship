// copied into convex/ only for the anonymous local integration run
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { intakeRateLimiter } from "./lib/rateLimits";
const tables = [
  "users",
  "tasks",
  "task_batches",
  "sources",
  "task_events",
  "evidence_drafts",
  "evidence_versions",
  "evidence_submission_receipts",
  "evidence_head_changes",
  "historical_claims",
  "site_occupancies",
  "derived_target_year_states",
  "derived_year_locations",
  "derived_target_year_functions",
  "derived_state_events",
  "client_submission_receipts",
] as const;
export const seed = internalMutation({
  args: { subject: v.string(), taskId: v.string(), country: v.optional(v.string()) },
  returns: v.object({ memberId: v.id("users"), taskId: v.string() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const memberId = await ctx.db.insert("users", {
      auth_subject: args.subject,
      initials: "TEST",
      roles: ["ra"],
      status: "active",
      created_at: now,
      updated_at: now,
    });
    await ctx.db.insert("tasks", {
      task_id: args.taskId,
      batch_id: "synthetic-local",
      country_code: args.country ?? "VU",
      task_type: "verify_existing_site",
      priority: "medium",
      status: "in_progress",
      target_years: [2013, 2018, 2023],
      geometry: { type: "Point", coordinates: [168.31, -17.74] },
      name: "Synthetic local test place",
      task_brief: "Synthetic local verification task.",
      nearby_site_refs: [],
      automated_checks: [],
      created_at: now,
      updated_at: now,
      last_event_at: now,
    });
    return { memberId, taskId: args.taskId };
  },
});
export const inspect = internalQuery({
  args: { memberId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const table of tables) counts[table] = (await ctx.db.query(table).collect()).length;
    return {
      counts,
      allowance: await intakeRateLimiter.getValue(ctx, "submissionAttemptPerMember", {
        key: args.memberId,
      }),
    };
  },
});
export const alter = internalMutation({
  args: {
    memberId: v.optional(v.id("users")),
    taskId: v.optional(v.string()),
    draftId: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.memberId !== undefined)
      await ctx.db.patch(args.memberId, { status: args.status as "disabled" | "active" });
    if (args.taskId !== undefined) {
      const task = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", args.taskId!))
        .unique();
      if (task !== null) await ctx.db.patch(task._id, { status: args.status as "reviewed" });
    }
    if (args.sourceId !== undefined) {
      const source = await ctx.db
        .query("sources")
        .withIndex("by_source_id", (q) => q.eq("source_id", args.sourceId!))
        .unique();
      if (source !== null)
        await ctx.db.patch(source._id, { title: "Synthetic reviewer changed the register title." });
    }
    if (args.draftId !== undefined) {
      const draft = await ctx.db
        .query("evidence_drafts")
        .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", args.draftId!))
        .unique();
      if (draft !== null)
        await ctx.db.patch(draft._id, { draft_status: args.status as "withdrawn" });
    }
    return null;
  },
});
