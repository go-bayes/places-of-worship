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
  assertCountryIntakePoint,
  assertRapidCandidateContext,
  assertRapidSubmissionId,
  countryIntakeBounds,
  deriveCurrentObservation,
  isRapidCurrentDraft,
  issueBatchId,
  manualBatchId,
  sourceFieldsForObservationBasis,
} from "./lib/rapidEntry";
import { resolveCitedSource } from "./lib/sources";
import { appendTaskEvent } from "./lib/taskEvents";
import { assertAssertionMatchesTaskPoint, assertCountryAllowsAssertionMode } from "./lib/locationAssertions";
import { locationAssertionInput, privacyFlag, rapidCurrentObservationInput, taskStatus } from "./model";

// the first release was vanuatu-only; an omitted country keeps the deployed
// portal's behaviour exactly while newer clients name their country
const DEFAULT_RAPID_ENTRY_COUNTRY = "VU";
const ACTIVE_INTAKE_STATUSES = new Set([
  "open",
  "in_progress",
  "draft_saved",
  "reopened",
]);
// a task already holding a submitted rapid observation accepts a correction
// only from that observation's author; the earlier record is superseded,
// never rewritten, and reviewers act through review decisions instead
const CORRECTION_STATUSES = new Set([
  "needs_review",
  "unresolved_note",
  "changes_requested",
]);

const candidateInput = v.object({
  name: v.string(),
  address: v.optional(v.string()),
  locality: v.optional(v.string()),
  latitude: v.number(),
  longitude: v.number(),
  // how sure the observer is of the point: absent means an identified
  // building at the pin (the pre-2026-09-02 behaviour), otherwise the
  // same location_assertion_v1 the curator nomination path records
  locationAssertion: v.optional(locationAssertionInput),
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

// the author's active rapid observation on a task, if any
async function activeRapidObservationBy(
  ctx: MutationCtx,
  taskId: string,
  actorId: Doc<"users">["_id"],
): Promise<Doc<"evidence_drafts"> | null> {
  for (const status of ["submitted", "unresolved_note"] as const) {
    const draft = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_creator_status", (q) => q.eq("task_id", taskId).eq("created_by", actorId).eq("draft_status", status))
      .order("desc")
      .first();
    if (draft !== null) return draft;
  }
  return null;
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

export const submitCurrentObservation = mutation({
  args: {
    clientSubmissionId: v.string(),
    countryCode: v.optional(v.string()),
    taskId: v.optional(v.string()),
    candidate: v.optional(candidateInput),
    observation: rapidCurrentObservationInput,
    clientContext: v.optional(rapidClientContext),
    // a partial entry the observer wants discussed rather than reviewed
    // as complete; it lands as an unresolved note instead of needs_review
    flagForDiscussion: v.optional(v.boolean()),
  },
  returns: v.object({
    task_id: v.string(),
    evidence_draft_id: v.string(),
    candidate_site_id: v.optional(v.string()),
    task_status: taskStatus,
    deduped: v.boolean(),
    corrected: v.boolean(),
    superseded_evidence_draft_id: v.optional(v.string()),
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
        corrected: false,
      };
    }

    assertMaxString("submission identifier", args.clientSubmissionId, SHORT_TEXT_MAX);
    assertMaxString("source title", args.observation.source_title, MEDIUM_TEXT_MAX);
    assertMaxString("source reference", args.observation.source_reference, URL_OR_FILE_MAX);
    assertMaxString("denomination or tradition label", args.observation.denomination_or_tradition_raw, MEDIUM_TEXT_MAX);
    assertMaxString("direct observation", args.observation.direct_observation, 2_000);
    assertMaxString("uncertainty or follow-up", args.observation.uncertainty_note, 2_000);

    const newCandidate = args.candidate !== undefined;
    const candidateLocation = args.candidate === undefined
      ? undefined
      : args.candidate.locationAssertion ?? {
        contract_version: "location_assertion_v1" as const,
        mode: "building_identified" as const,
        basis: "map_placement" as const,
        latitude: args.candidate.latitude,
        longitude: args.candidate.longitude,
        confidence: "high" as const,
        contributor_confirmed: true as const,
      };
    if (args.candidate !== undefined && candidateLocation !== undefined) {
      // task-level location contract, outside the locked rapid draft
      // contract: the country gate and the point match are enforced
      // exactly as on the curator nomination path
      assertCountryAllowsAssertionMode(args.countryCode?.trim().toUpperCase() ?? DEFAULT_RAPID_ENTRY_COUNTRY, candidateLocation.mode);
      assertAssertionMatchesTaskPoint(candidateLocation, args.candidate.latitude, args.candidate.longitude);
      assertRapidCandidateContext(args.clientContext, candidateLocation.mode);
    }
    const derived = deriveCurrentObservation(args.observation.current_status, newCandidate);
    const source = sourceFieldsForObservationBasis(
      args.observation.observation_basis,
      args.observation.source_title,
      args.observation.source_reference,
    );
    // a picked register source is resolved and stamped; the denormalised
    // strings below remain the at-submission snapshot, with the register
    // filling gaps the ra left blank
    const citedSource = await resolveCitedSource(
      ctx,
      args.observation.source_id,
      args.observation.source_locator,
    );
    const sourceSnapshot = citedSource === null
      ? source
      : {
          ...source,
          source_title: source.source_title || citedSource.title,
          source_url_or_file: source.source_url_or_file ?? citedSource.url ?? citedSource.archive_ref,
        };
    const now = Date.now();
    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);

    // an omitted country preserves the vanuatu-era client exactly; the
    // registry inside countryIntakeBounds is the closed enabling gate
    const requestedCountry = args.countryCode?.trim().toUpperCase();
    if (requestedCountry !== undefined) {
      assertMaxString("country code", requestedCountry, SHORT_TEXT_MAX);
    }
    let intakeCountry: string;
    let authorisedExistingTask: Doc<"tasks"> | undefined;
    let correctedDraft: Doc<"evidence_drafts"> | null = null;
    if (args.taskId !== undefined) {
      assertMaxString("task id", args.taskId, MEDIUM_TEXT_MAX);
      authorisedExistingTask = await getTaskOrThrow(ctx, args.taskId);
      // an existing task carries its own country; the registry refuses
      // countries without a declared intake ruling
      intakeCountry = authorisedExistingTask.country_code.toUpperCase();
      const taskIntake = countryIntakeBounds(intakeCountry);
      // rapid observations land only on rapid-designed tasks: the
      // country's nomination batch, or any batch where the country's
      // assigned work itself is rapid (vu). a crafted call must not put a
      // rapid draft on a guided-design assigned task (separation ruling)
      if (
        !taskIntake.assignedRapid
        && authorisedExistingTask.batch_id !== manualBatchId(intakeCountry)
        && authorisedExistingTask.batch_id !== issueBatchId(intakeCountry)
      ) {
        throw new Error("This task uses the detailed evidence form. Record it through the portal's guided workflow.");
      }
      if (requestedCountry !== undefined && requestedCountry !== intakeCountry) {
        throw new Error("The submitted country does not match the selected task.");
      }
      if (ACTIVE_INTAKE_STATUSES.has(authorisedExistingTask.status)) {
        assertOwnsOrCanReview(user._id, user.roles, authorisedExistingTask.assigned_to);
        // a task already holding the author's guided evidence must not be
        // overwritten through the rapid path (separation ruling)
        for (const draftStatus of ["draft", "submitted", "unresolved_note"] as const) {
          const held = await ctx.db
            .query("evidence_drafts")
            .withIndex("by_task_creator_status", (q) => q.eq("task_id", authorisedExistingTask!.task_id).eq("created_by", user._id).eq("draft_status", draftStatus))
            .order("desc")
            .first();
          if (held !== null && !isRapidCurrentDraft(held)) {
            throw new Error("This task holds detailed evidence. Revise it through the detailed form instead of the rapid path.");
          }
        }
      } else if (CORRECTION_STATUSES.has(authorisedExistingTask.status)) {
        correctedDraft = await activeRapidObservationBy(ctx, authorisedExistingTask.task_id, user._id);
        if (correctedDraft === null) {
          throw new Error("Only the observer who recorded this observation can correct it while it awaits review.");
        }
        if (!isRapidCurrentDraft(correctedDraft)) {
          throw new Error("This task holds detailed evidence. Revise it through the detailed form instead of the rapid path.");
        }
      } else {
        throw new Error("This task has been reviewed or closed. Ask JB to reopen it before recording a new observation.");
      }
    } else {
      const candidate = args.candidate!;
      intakeCountry = requestedCountry ?? DEFAULT_RAPID_ENTRY_COUNTRY;
      assertMaxString("candidate name", candidate.name, TASK_NAME_MAX);
      assertMaxString("candidate address", candidate.address, MEDIUM_TEXT_MAX);
      assertMaxString("candidate locality", candidate.locality, MEDIUM_TEXT_MAX);
      assertCountryIntakePoint(intakeCountry, candidate.latitude, candidate.longitude);
    }
    const intake = countryIntakeBounds(intakeCountry);
    const rapidEntryBatch = manualBatchId(intakeCountry);
    const targetYears = defaultTargetYears(intakeCountry);
    const targetYearStatuses = Object.fromEntries(targetYears.map((year) => [String(year), "not_assessed" as const]));

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
        .withIndex("by_batch_id", (q) => q.eq("batch_id", rapidEntryBatch))
        .unique();
      if (batch === null) {
        await ctx.db.insert("task_batches", {
          batch_id: rapidEntryBatch,
          country_code: intakeCountry,
          source_kind: "ra_nomination",
          target_years: targetYears,
          status: "active",
          created_by: user._id,
          created_at: now,
          updated_at: now,
          notes: `${intake.name} rapid current-place observations`,
        });
      } else if (batch.status !== "active") {
        throw new Error(`${intake.name} rapid entry is paused. Ask JB before continuing.`);
      }

      const taskId = `${intakeCountry.toLowerCase()}-candidate-${args.clientSubmissionId}`;
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
        batch_id: rapidEntryBatch,
        country_code: intakeCountry,
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
        ...(candidateLocation !== undefined ? { initial_location_assertion: candidateLocation } : {}),
        nearby_site_refs: [],
        automated_checks: [{
          check_id: "rapid_current_nomination",
          severity: "info",
          message: `An invited RA submitted a current-place observation through the ${intake.name} rapid-entry path.`,
          suggested_action: "review_identity_and_current_use",
        }],
        task_brief: `Review this ${intake.name} current-place observation. Confirm site identity, present worship use, sensitivity, and whether an existing project or OSM record already represents the place before export.`,
        source_context: {
          intake_mode: "rapid_current_v1",
          proximity_checked: args.clientContext?.proximity_checked ?? false,
          nearby_count: args.clientContext?.nearby_count ?? 0,
          ...(candidateLocation !== undefined ? { location_mode: candidateLocation.mode } : {}),
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
        reason: `${intake.name} current-place observation started.`,
        clientContext: args.clientContext,
      });
    }

    const flagged = args.flagForDiscussion === true;
    if (flagged && (args.observation.uncertainty_note?.trim().length ?? 0) < 12) {
      // a discussion flag must carry its explanation; the client keeps it
      // in the uncertainty note so the reviewer sees what needs settling
      throw new Error("Explain what needs discussion before flagging this entry.");
    }
    const denominationRaw = args.observation.denomination_or_tradition_raw?.trim() || undefined;
    const draftId = `${task.task_id}:${user._id}:rapid:${args.clientSubmissionId}`;
    const draftRecord = {
      evidence_draft_id: draftId,
      task_id: task.task_id,
      draft_status: flagged ? ("unresolved_note" as const) : ("submitted" as const),
      created_by: user._id,
      created_at: now,
      updated_at: now,
      observation_contract_version: "rapid_current_v1" as const,
      ...sourceSnapshot,
      ...(citedSource === null ? {} : { source_id: citedSource.source_id }),
      ...(args.observation.source_locator?.trim()
        ? { source_locator: args.observation.source_locator.trim() }
        : {}),
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
    const landedStatus = flagged ? ("unresolved_note" as const) : ("needs_review" as const);
    assertEvidenceDraftLimits(draftRecord);
    assertEvidenceDraftSubmission(draftRecord, flagged);
    await ctx.db.insert("evidence_drafts", draftRecord);
    await supersedeEarlierSubmissions(ctx, task.task_id, user._id, draftId, now);
    await ctx.db.patch(task._id, {
      assigned_to: task.assigned_to ?? user._id,
      claimed_by: task.claimed_by ?? user._id,
      claimed_at: task.claimed_at ?? now,
      status: landedStatus,
      updated_at: now,
      last_event_at: now,
    });
    await appendTaskEvent(ctx, {
      taskId: task.task_id,
      eventType: flagged ? "submitted_unresolved_note" : "submitted_for_review",
      actorUserId: user._id,
      actorRole,
      previousStatus: task.status,
      newStatus: landedStatus,
      evidenceDraftId: draftId,
      reason: flagged
        ? `${intake.name} partial current observation flagged for discussion.`
        : correctedDraft !== null
          ? `Corrected ${intake.name} current observation submitted for review; supersedes ${correctedDraft.evidence_draft_id}.`
          : `${intake.name} current observation submitted for review.`,
      clientContext: {
        ...(args.clientContext ?? {}),
        ...(correctedDraft !== null ? { corrects_evidence_draft_id: correctedDraft.evidence_draft_id } : {}),
      },
    });

    return {
      task_id: task.task_id,
      evidence_draft_id: draftId,
      ...(task.candidate_site_id !== undefined ? { candidate_site_id: task.candidate_site_id } : {}),
      task_status: landedStatus,
      deduped: false,
      corrected: correctedDraft !== null,
      ...(correctedDraft !== null ? { superseded_evidence_draft_id: correctedDraft.evidence_draft_id } : {}),
    };
  },
});

// the deployed vanuatu portal still calls the release-one name; both
// exports register the same mutation, so the old route keeps its exact
// contract until the client workstream moves to submitCurrentObservation
export const submitVanuatuCurrentObservation = submitCurrentObservation;
