// seeding fixture (2026-08-14 stocktake ruling): seeds and promotes revision
// batches. STILL LIVE — revise-nz-001/revise-vu-001 await promotion; retire
// only after both batches are promoted. internal: admin-key/CLI only.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { canReview, chooseActorRole } from "./lib/auth";
import { DEFAULT_TARGET_YEARS } from "./lib/countryYears";
import { MEDIUM_TEXT_MAX, TASK_BRIEF_MAX, assertMaxString } from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";
import { taskBatchStatus, taskInput } from "./model";
import { assertTaskSeedTextLimits } from "./tasks";

// phase R1 seeding for per-country revision batches
// (docs/development/revision-pipeline-all-countries.md). Each run creates
// (or extends) one draft task_batches row per country tranche and imports
// one task per shipped map site. Draft batches are invisible to RA queues
// (listTasks hides them from non-reviewer roles) until a curator promotes
// the batch via promoteRevisionBatch — the R1 throttling gate.
//
// note on source_kind: the design doc says `source_kind: "map_snapshot"`,
// but taskBatchSourceKind has no such member and adding one would be a
// schema-vocabulary change outside R1's scope. "static_map_import" is the
// existing member with the intended meaning (tasks imported from the
// country's shipped static map), so revision batches use it.

// builds the canonical revision batch id, e.g. revise-nz-001
function revisionBatchId(countryCode: string, tranche: number): string {
  return `revise-${countryCode.toLowerCase()}-${String(tranche).padStart(3, "0")}`;
}

// resolve the user the seed run is attributed to: an explicit id when
// given, otherwise the first active reviewer/curator/admin/service user.
// internal mutations run with the deployment key, so there is no
// ctx.auth identity to attribute events to. (Mirrors trainingSeed.ts,
// which is frozen and cannot export its private helper.)
async function getSeedActor(
  ctx: MutationCtx,
  userId: Id<"users"> | undefined,
): Promise<Doc<"users">> {
  if (userId !== undefined) {
    const user = await ctx.db.get(userId);
    if (user === null || user.status !== "active" || !canReview(user.roles)) {
      throw new Error("Revision seed actor must be an active reviewer, curator, admin, or service user.");
    }
    return user;
  }
  const users = await ctx.db
    .query("users")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(200);
  for (const user of users) {
    if (canReview(user.roles)) {
      return user;
    }
  }
  throw new Error("No active reviewer, curator, admin, or service user exists for revision seed attribution.");
}

export const seedRevisionBatch = internalMutation({
  args: {
    countryCode: v.string(),
    tranche: v.number(),
    // the country's shipped census waves. Convex functions cannot read
    // repo files at runtime, so the caller derives these from the wave
    // set of apps/regions/<cc>/data/area_summary_*.json (the same waves
    // the portal's COUNTRY_CONFIGS and lib/countryYears.ts mirror).
    targetYears: v.array(v.number()),
    // one record per shipped map site, in the same shape
    // tasks:upsertTasksFromStaticMap consumes (model.ts taskInput).
    // Every record must carry matched_current_site_id: it is the dedup
    // key, and a revision task is by definition about an existing
    // mapped place.
    sites: v.array(taskInput),
    notes: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
  },
  returns: v.object({
    batch_id: v.string(),
    batch_created: v.boolean(),
    batch_status: taskBatchStatus,
    created: v.number(),
    skipped_existing: v.number(),
    skipped_existing_site_ids: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!/^[a-zA-Z]{2}$/.test(args.countryCode)) {
      throw new Error(`Country code must be two letters, got: ${args.countryCode}`);
    }
    if (!Number.isInteger(args.tranche) || args.tranche < 1 || args.tranche > 999) {
      throw new Error(`Tranche must be an integer between 1 and 999, got: ${args.tranche}`);
    }
    if (args.targetYears.length === 0) {
      throw new Error("targetYears must list the country's shipped census waves.");
    }
    const countryCode = args.countryCode.toUpperCase();
    // when the convex-side wave mirror knows this country, a mismatch is
    // a caller error (wrong waves would seed wrong revision questions);
    // countries absent from the mirror rely on the explicit argument
    const mirroredYears = DEFAULT_TARGET_YEARS[countryCode];
    if (
      mirroredYears !== undefined &&
      JSON.stringify([...args.targetYears].sort()) !== JSON.stringify([...mirroredYears].sort())
    ) {
      throw new Error(
        `targetYears ${JSON.stringify(args.targetYears)} do not match the shipped waves for ${countryCode} ` +
          `(${JSON.stringify(mirroredYears)}); update lib/countryYears.ts if the country's waves changed.`,
      );
    }

    const batchId = revisionBatchId(countryCode, args.tranche);
    assertMaxString("revision batch notes", args.notes, TASK_BRIEF_MAX);

    const actor = await getSeedActor(ctx, args.createdByUserId);
    const actorRole = chooseActorRole(actor, ["service", "admin", "curator", "reviewer"]);
    const now = Date.now();

    const existingBatch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", batchId))
      .unique();
    let batchCreated = false;
    let batchStatus: Doc<"task_batches">["status"];
    if (existingBatch === null) {
      // draft, NOT active: the batch stays out of RA queues until a
      // curator promotes it (design doc R1 throttling rule)
      await ctx.db.insert("task_batches", {
        batch_id: batchId,
        country_code: countryCode,
        source_kind: "static_map_import",
        target_years: args.targetYears,
        status: "draft",
        created_by: actor._id,
        created_at: now,
        updated_at: now,
        notes: args.notes,
      });
      batchCreated = true;
      batchStatus = "draft";
    } else {
      if (existingBatch.country_code !== countryCode) {
        throw new Error(
          `Batch ${batchId} already exists for country ${existingBatch.country_code}, not ${countryCode}.`,
        );
      }
      // re-seed appends tasks only; never touch the batch status, so a
      // re-run can never promote (or demote) a batch as a side effect
      await ctx.db.patch(existingBatch._id, {
        updated_at: now,
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
      });
      batchStatus = existingBatch.status;
    }

    let created = 0;
    const skippedSiteIds: string[] = [];
    for (const site of args.sites) {
      assertTaskSeedTextLimits(site);
      if (site.batch_id !== batchId) {
        throw new Error(
          `Site record batch_id ${site.batch_id} does not match the derived batch id ${batchId}.`,
        );
      }
      if (site.country_code.toUpperCase() !== countryCode) {
        throw new Error(
          `Site record country_code ${site.country_code} does not match batch country ${countryCode}.`,
        );
      }
      const siteId = site.matched_current_site_id;
      if (siteId === undefined || siteId.trim() === "") {
        throw new Error(
          `Site record ${site.task_id} has no matched_current_site_id; revision tasks require the dedup key.`,
        );
      }

      // idempotency: a site that already carries ANY task under this
      // matched_current_site_id is skipped, so a re-seed appends only new
      // sites and the batch never duplicates work already queued in the
      // issue, training, or an earlier revision lane
      const existingForSite = await ctx.db
        .query("tasks")
        .withIndex("by_matched_site", (q) => q.eq("matched_current_site_id", siteId))
        .first();
      if (existingForSite !== null) {
        skippedSiteIds.push(siteId);
        continue;
      }
      // secondary guard: never collide on task_id either
      const existingTask = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", site.task_id))
        .unique();
      if (existingTask !== null) {
        skippedSiteIds.push(siteId);
        continue;
      }

      await ctx.db.insert("tasks", {
        ...site,
        country_code: countryCode,
        // always open; queue visibility is controlled by the batch's
        // draft status, not by the task status
        status: "open",
        target_years: site.target_years.length > 0 ? site.target_years : args.targetYears,
        nearby_site_refs: site.nearby_site_refs ?? [],
        automated_checks: site.automated_checks ?? [],
        created_at: now,
        updated_at: now,
        last_event_at: now,
      });
      await appendTaskEvent(ctx, {
        taskId: site.task_id,
        eventType: "imported",
        actorUserId: actor._id,
        actorRole,
        newStatus: "open",
        reason: `Seeded from the shipped ${countryCode} map snapshot into revision batch ${batchId} (draft until curator promotion).`,
      });
      created += 1;
    }

    return {
      batch_id: batchId,
      batch_created: batchCreated,
      batch_status: batchStatus,
      created,
      skipped_existing: skippedSiteIds.length,
      skipped_existing_site_ids: skippedSiteIds,
    };
  },
});

// the curator promotion step: draft -> active makes the batch visible to
// RA queues. Internal on purpose — promotion is a PI/curator decision run
// from the CLI, never from portal code, until the design doc's governance
// phases land a UI for it.
export const promoteRevisionBatch = internalMutation({
  args: {
    batchId: v.string(),
  },
  returns: v.object({
    batch_id: v.string(),
    previous_status: taskBatchStatus,
    status: v.literal("active"),
  }),
  handler: async (ctx, args) => {
    assertMaxString("batch id", args.batchId, MEDIUM_TEXT_MAX);
    const batch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batchId))
      .unique();
    if (batch === null) {
      throw new Error(`Batch not found: ${args.batchId}`);
    }
    if (batch.status !== "draft") {
      throw new Error(`Only draft batches can be promoted; ${args.batchId} is ${batch.status}.`);
    }
    await ctx.db.patch(batch._id, {
      status: "active",
      updated_at: Date.now(),
    });
    return {
      batch_id: args.batchId,
      previous_status: batch.status,
      status: "active" as const,
    };
  },
});
