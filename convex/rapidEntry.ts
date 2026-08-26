import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { assertOwnsOrCanReview, chooseActorRole, requireUser } from "./lib/auth";
import { defaultTargetYears } from "./lib/countryYears";
import {
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_NAME_MAX,
  URL_OR_FILE_MAX,
  assertEvidenceDraftLimits,
  assertEvidenceDraftSubmission,
  assertMaxString,
} from "./lib/limits";
import { intakeRateLimiter } from "./lib/rateLimits";
import {
  assertRapidCandidateContext,
  assertRapidSubmissionId,
  assertVanuatuPoint,
  deriveCurrentObservation,
  sourceFieldsForObservationBasis,
} from "./lib/rapidEntry";
import { appendTaskEvent } from "./lib/taskEvents";
import { privacyFlag, rapidCurrentObservationInput, taskStatus } from "./model";

const RAPID_ENTRY_COUNTRY = "VU";
const RAPID_ENTRY_BATCH = "manual-vu";
const ACTIVE_INTAKE_STATUSES = new Set([
  "open",
  "in_progress",
  "draft_saved",
  "changes_requested",
  "reopened",
]);

const candidateInput = v.object({
  name: v.string(),
  address: v.optional(v.string()),
  locality: v.optional(v.string()),
  latitude: v.number(),
  longitude: v.number(),
});

const rapidClientContext = v.object({
  placement_zoom: v.optional(v.number()),
  proximity_checked: v.optional(v.boolean()),
  nearby_count: v.optional(v.number()),
  portal_version: v.optional(v.string()),
});

async function getTaskOrThrow(ctx: MutationCtx, taskId: string): Promise<Doc<"tasks">> {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
    .unique();
  if (task === null) {
    throw new Error("The selected task is no longer available. Refresh the portal and try again.");
  }
  return task;
}

function assertClientContext(context: typeof rapidClientContext.type | undefined): void {
  if (context?.placement_zoom !== undefined) {
    if (!Number.isFinite(context.placement_zoom) || context.placement_zoom < 0 || context.placement_zoom > 24) {
      throw new Error("The recorded map zoom is invalid.");
    }
  }
  if (context?.nearby_count !== undefined) {
    if (!Number.isInteger(context.nearby_count) || context.nearby_count < 0 || context.nearby_count > 1_000) {
      throw new Error("The nearby-place count is invalid.");
    }
  }
  assertMaxString("portal version", context?.portal_version, SHORT_TEXT_MAX);
}

async function supersedeEarlierSubmissions(
  ctx: MutationCtx,
  taskId: string,
  actorId: Doc<"users">["_id"],
  newDraftId: string,
  now: number,
): Promise<void> {
  for (const status of ["submitted", "unresolved_note"] as const) {
    const drafts = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_creator_status", (q) => q.eq("task_id", taskId).eq("created_by", actorId).eq("draft_status", status))
      .take(11);
    if (drafts.length > 10) {
      throw new Error("This task has too many active submissions to supersede safely. Ask JB to review its history.");
    }
    for (const draft of drafts) {
      if (draft.evidence_draft_id !== newDraftId) {
        await ctx.db.patch(draft._id, { draft_status: "superseded", updated_at: now });
      }
    }
  }
}

export const submitVanuatuCurrentObservation = mutation({
  args: {
    clientSubmissionId: v.string(),
    taskId: v.optional(v.string()),
    candidate: v.optional(candidateInput),
    observation: rapidCurrentObservationInput,
    clientContext: v.optional(rapidClientContext),
  },
  returns: v.object({
    task_id: v.string(),
    evidence_draft_id: v.string(),
    candidate_site_id: v.optional(v.string()),
    task_status: taskStatus,
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertRapidSubmissionId(args.clientSubmissionId);
    assertClientContext(args.clientContext);
    if ((args.taskId === undefined) === (args.candidate === undefined)) {
      throw new Error("Choose either an existing task or a new candidate location.");
    }

    const submissionKey = `${user._id}:${args.clientSubmissionId}`;
    const existingDraft = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_intake_submission_key", (q) => q.eq("intake_submission_key", submissionKey))
      .unique();
    if (existingDraft !== null) {
      if (existingDraft.created_by !== user._id) {
        throw new Error("The submission identifier is already in use.");
      }
      const existingTask = await getTaskOrThrow(ctx, existingDraft.task_id);
      return {
        task_id: existingTask.task_id,
        evidence_draft_id: existingDraft.evidence_draft_id,
        ...(existingTask.candidate_site_id !== undefined
          ? { candidate_site_id: existingTask.candidate_site_id }
          : {}),
        task_status: existingTask.status,
        deduped: true,
      };
    }

    assertMaxString("submission identifier", args.clientSubmissionId, SHORT_TEXT_MAX);
    assertMaxString("source title", args.observation.source_title, MEDIUM_TEXT_MAX);
    assertMaxString("source reference", args.observation.source_reference, URL_OR_FILE_MAX);
    assertMaxString("denomination or tradition label", args.observation.denomination_or_tradition_raw, MEDIUM_TEXT_MAX);
    assertMaxString("direct observation", args.observation.direct_observation, 2_000);
    assertMaxString("uncertainty or follow-up", args.observation.uncertainty_note, 2_000);

    const newCandidate = args.candidate !== undefined;
    if (newCandidate) {
      assertRapidCandidateContext(args.clientContext);
    }
    const derived = deriveCurrentObservation(args.observation.current_status, newCandidate);
    const source = sourceFieldsForObservationBasis(
      args.observation.observation_basis,
      args.observation.source_title,
      args.observation.source_reference,
    );
    const targetYears = defaultTargetYears(RAPID_ENTRY_COUNTRY);
    const targetYearStatuses = Object.fromEntries(targetYears.map((year) => [String(year), "not_assessed" as const]));
    const now = Date.now();
    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);

    let authorisedExistingTask: Doc<"tasks"> | undefined;
    if (args.taskId !== undefined) {
      assertMaxString("task id", args.taskId, MEDIUM_TEXT_MAX);
      authorisedExistingTask = await getTaskOrThrow(ctx, args.taskId);
      if (authorisedExistingTask.country_code !== RAPID_ENTRY_COUNTRY) {
        throw new Error("Rapid current entry is enabled only for Vanuatu tasks.");
      }
      assertOwnsOrCanReview(user._id, user.roles, authorisedExistingTask.assigned_to);
      if (!ACTIVE_INTAKE_STATUSES.has(authorisedExistingTask.status)) {
        throw new Error("This task is already under review or closed. Start a revision instead.");
      }
    } else {
      const candidate = args.candidate!;
      assertMaxString("candidate name", candidate.name, TASK_NAME_MAX);
      assertMaxString("candidate address", candidate.address, MEDIUM_TEXT_MAX);
      assertMaxString("candidate locality", candidate.locality, MEDIUM_TEXT_MAX);
      assertVanuatuPoint(candidate.latitude, candidate.longitude);
    }

    // Consume capacity only after malformed and unauthorised requests fail.
    await intakeRateLimiter.limit(ctx, "rapidEntryPerUser", { key: user._id, throws: true });
    await intakeRateLimiter.limit(ctx, "rapidEntryGlobal", { throws: true });

    let task: Doc<"tasks">;
    if (authorisedExistingTask !== undefined) {
      task = authorisedExistingTask;
    } else {
      const candidate = args.candidate!;
      const batch = await ctx.db
        .query("task_batches")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", RAPID_ENTRY_BATCH))
        .unique();
      if (batch === null) {
        await ctx.db.insert("task_batches", {
          batch_id: RAPID_ENTRY_BATCH,
          country_code: RAPID_ENTRY_COUNTRY,
          source_kind: "ra_nomination",
          target_years: targetYears,
          status: "active",
          created_by: user._id,
          created_at: now,
          updated_at: now,
          notes: "Vanuatu rapid current-place observations",
        });
      } else if (batch.status !== "active") {
        throw new Error("Vanuatu rapid entry is paused. Ask JB before continuing.");
      }

      const taskId = `vu-candidate-${args.clientSubmissionId}`;
      const candidateSiteId = `candidate:${taskId}`;
      const taskIdCollision = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
        .unique();
      if (taskIdCollision !== null) {
        throw new Error("The candidate identifier is already in use. Reload the form and try again.");
      }
      const taskRecord = {
        task_id: taskId,
        batch_id: RAPID_ENTRY_BATCH,
        country_code: RAPID_ENTRY_COUNTRY,
        task_type: "missing_from_project_map" as const,
        priority: "high" as const,
        status: "in_progress" as const,
        assigned_to: user._id,
        claimed_by: user._id,
        claimed_at: now,
        target_years: targetYears,
        candidate_site_id: candidateSiteId,
        name: candidate.name.trim() || "Unknown place of worship",
        ...(candidate.address?.trim() ? { address: candidate.address.trim() } : {}),
        ...(candidate.locality?.trim() ? { locality: candidate.locality.trim() } : {}),
        geometry: {
          type: "Point",
          coordinates: [candidate.longitude, candidate.latitude],
        },
        nearby_site_refs: [],
        automated_checks: [{
          check_id: "rapid_current_nomination",
          severity: "info",
          message: "An invited RA submitted a current-place observation through the Vanuatu rapid-entry path.",
          suggested_action: "review_identity_and_current_use",
        }],
        task_brief: "Review this Vanuatu current-place observation. Confirm site identity, present worship use, sensitivity, and whether an existing project or OSM record already represents the place before export.",
        source_context: {
          intake_mode: "rapid_current_v1",
          proximity_checked: args.clientContext?.proximity_checked ?? false,
          nearby_count: args.clientContext?.nearby_count ?? 0,
        },
        intake_submission_key: submissionKey,
        created_at: now,
        updated_at: now,
        last_event_at: now,
      };
      const taskDocId = await ctx.db.insert("tasks", taskRecord);
      const insertedTask = await ctx.db.get(taskDocId);
      if (insertedTask === null) {
        throw new Error("The candidate task could not be read after creation.");
      }
      task = insertedTask;
      await appendTaskEvent(ctx, {
        taskId,
        eventType: "opened",
        actorUserId: user._id,
        actorRole,
        newStatus: "in_progress",
        reason: "Vanuatu current-place observation started.",
        clientContext: args.clientContext,
      });
    }

    const denominationRaw = args.observation.denomination_or_tradition_raw?.trim() || undefined;
    const draftId = `${task.task_id}:${user._id}:rapid:${args.clientSubmissionId}`;
    const draftRecord = {
      evidence_draft_id: draftId,
      task_id: task.task_id,
      draft_status: "submitted" as const,
      created_by: user._id,
      created_at: now,
      updated_at: now,
      observation_contract_version: "rapid_current_v1" as const,
      ...source,
      provider: "Project RA",
      source_date_or_capture_date: args.observation.observed_on,
      action: derived.action,
      change_class: "uncertain" as const,
      target_year_statuses: targetYearStatuses,
      existence_status: derived.existence_status,
      worship_use_status: derived.worship_use_status,
      ...(denominationRaw ? { denomination_or_tradition_raw: denominationRaw } : {}),
      denomination_label_basis: denominationRaw
        ? (args.observation.denomination_label_basis ?? "unknown" as const)
        : "unknown" as const,
      denomination_relation: denominationRaw ? "label_only" as const : "uncertain" as const,
      ...(args.observation.direct_observation?.trim()
        ? { evidence_note: args.observation.direct_observation.trim() }
        : {}),
      ...(args.observation.uncertainty_note?.trim()
        ? { uncertainty_note: args.observation.uncertainty_note.trim() }
        : {}),
      current_observation_status: args.observation.current_status,
      current_observation_basis: args.observation.observation_basis,
      privacy_flag: args.observation.privacy_flag,
      licence_flag: "needs_review" as const,
      validation_summary: {
        status: "server_validated",
        contract: "rapid_current_v1",
        historical_target_years_assessed: false,
      },
      intake_submission_key: submissionKey,
    };
    assertEvidenceDraftLimits(draftRecord);
    assertEvidenceDraftSubmission(draftRecord, false);
    await ctx.db.insert("evidence_drafts", draftRecord);
    await supersedeEarlierSubmissions(ctx, task.task_id, user._id, draftId, now);
    await ctx.db.patch(task._id, {
      assigned_to: task.assigned_to ?? user._id,
      claimed_by: task.claimed_by ?? user._id,
      claimed_at: task.claimed_at ?? now,
      status: "needs_review",
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: task.task_id,
      eventType: "submitted_for_review",
      actorUserId: user._id,
      actorRole,
      previousStatus: task.status,
      newStatus: "needs_review",
      evidenceDraftId: draftId,
      reason: "Vanuatu current observation submitted for review.",
      clientContext: args.clientContext,
    });

    return {
      task_id: task.task_id,
      evidence_draft_id: draftId,
      ...(task.candidate_site_id !== undefined ? { candidate_site_id: task.candidate_site_id } : {}),
      task_status: "needs_review" as const,
      deduped: false,
    };
  },
});
