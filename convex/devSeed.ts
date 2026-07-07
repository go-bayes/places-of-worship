import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// dev-only seeding for LOCAL/dev deployments: one reviewable task with a
// submitted draft, so the batch-review dry run has a queue to triage.
// internal: callable only with the deployment admin key (CLI/dashboard),
// and idempotent per task id. never intended for the production project.
export const seedReviewQueueFixture = internalMutation({
  args: {
    taskId: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.object({ task_id: v.string(), evidence_draft_id: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    const taskId = args.taskId ?? "devseed:nz:001";
    const countryCode = (args.countryCode ?? "NZ").toUpperCase();
    const draftId = `${taskId}:draft`;
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
      .unique();
    if (existing !== null) {
      return { task_id: taskId, evidence_draft_id: draftId, created: false };
    }
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: `devseed-${now}@service.local`,
      display_name: "Dev seed RA",
      initials: "DS",
      roles: ["ra"],
      status: "active",
      created_at: now,
      updated_at: now,
    });
    await ctx.db.insert("task_batches", {
      batch_id: "devseed-batch",
      country_code: countryCode,
      source_kind: "manual_curator",
      target_years: [2013, 2018, 2023],
      status: "active",
      created_by: userId,
      created_at: now,
      updated_at: now,
    });
    await ctx.db.insert("tasks", {
      task_id: taskId,
      batch_id: "devseed-batch",
      country_code: countryCode,
      task_type: "verify_existing_site",
      priority: "medium",
      status: "needs_review",
      target_years: [2013, 2018, 2023],
      name: "St Andrew's on The Terrace",
      locality: "Wellington",
      geometry: { type: "Point", coordinates: [174.7772, -41.2846] },
      task_brief: "Dev-seed fixture: verify this church's current worship use from the linked source.",
      created_at: now,
      updated_at: now,
      last_event_at: now,
    });
    await ctx.db.insert("evidence_drafts", {
      evidence_draft_id: draftId,
      task_id: taskId,
      draft_status: "submitted",
      created_by: userId,
      created_at: now,
      updated_at: now,
      source_type: "archived_website",
      source_title: "St Andrew's on The Terrace — official site",
      source_url_or_file: args.sourceUrl ?? "https://www.standrews.org.nz/",
      source_date_or_capture_date: "2026-07-07",
      locality_raw: "The Terrace, Wellington",
      existence_status: "present",
      worship_use_status: "confirmed_worship",
      assessment_confidence: "medium",
      target_year_statuses: { "2023": "present" },
      evidence_note: "Dev-seed fixture: active congregation with regular services listed.",
      privacy_flag: "clear",
      licence_flag: "clear",
    });
    return { task_id: taskId, evidence_draft_id: draftId, created: true };
  },
});
