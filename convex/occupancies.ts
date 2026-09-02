// occupancy lane (docs/development/occupancy-build-brief-2026-09-02.md):
// ras record where and when a place of worship was used; the server
// derives per-census-year presence and location as proposals; reviewers
// confirm, override, or reject each year, with an append-only trail. only
// a reviewer action writes into the observed vocabulary on the parent
// draft (target_year_statuses + target_year_basis).
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser, type ProjectRole } from "./lib/auth";
import { dateFloorYear, defaultTargetYears } from "./lib/countryYears";
import { isHistoricalClaimParentContract } from "./lib/historicalClaims";
import {
  assertClientContextLimit,
  assertMaxString,
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_REASON_MAX,
} from "./lib/limits";
import {
  assertOccupancySet,
  deriveLocations,
  derivePresence,
  endPrecision,
  OCCUPANCY_DERIVATION_VERSION,
  occupancyInputsHash,
  resolveLocation,
  startPrecision,
  type OccupancySegment,
  type OccupancySegmentInput,
} from "./lib/occupancies";
import { intakeRateLimiter } from "./lib/rateLimits";
import { assertRapidSubmissionId } from "./lib/rapidEntry";
import { appendTaskEvent } from "./lib/taskEvents";
import {
  derivedStateEventDoc,
  derivedTargetYearStateDoc,
  derivedYearLocationDoc,
  siteOccupancyDoc,
} from "./lib/validators";
import { derivedPresenceStatus, occupancySegmentInput } from "./model";

const ACTIVE_HISTORY_STATUSES = new Set(["needs_review", "unresolved_note", "changes_requested"]);
const DECISION_NOTE_MIN = 8;
const CONFLICT_CHECK_ID = "lifespan_conflicts_observation";

const occupancyClientContext = v.object({
  portal_version: v.optional(v.string()),
});

async function getTaskOrThrow(ctx: QueryCtx | MutationCtx, taskId: string): Promise<Doc<"tasks">> {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
    .unique();
  if (task === null) {
    throw new Error("The selected task is no longer available. Refresh the portal and try again.");
  }
  return task;
}

async function getParentEvidenceOrThrow(
  ctx: QueryCtx | MutationCtx,
  evidenceDraftId: string,
): Promise<Doc<"evidence_drafts">> {
  const draft = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", evidenceDraftId))
    .unique();
  if (draft === null) {
    throw new Error("The parent evidence record is no longer available. Refresh the portal and try again.");
  }
  return draft;
}

function taskPoint(task: Doc<"tasks">): { latitude: number; longitude: number } {
  const coordinates = (task.geometry as { coordinates?: unknown } | undefined)?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("This task has no usable point, so periods cannot be located against it.");
  }
  return { latitude: Number(coordinates[1]), longitude: Number(coordinates[0]) };
}

function taskTargetYears(task: Doc<"tasks">): number[] {
  return task.target_years && task.target_years.length > 0
    ? task.target_years
    : defaultTargetYears(task.country_code);
}

// the derivation input shape of a stored row
function segmentOf(row: Doc<"site_occupancies">): OccupancySegment {
  return {
    occupancy_id: row.occupancy_id,
    segment_index: row.segment_index,
    start_mode: row.start_mode,
    start_date: row.start_date,
    start_not_earlier_than: row.start_not_earlier_than,
    start_not_later_than: row.start_not_later_than,
    start_basis: row.start_basis,
    end_mode: row.end_mode,
    end_date: row.end_date,
    end_not_earlier_than: row.end_not_earlier_than,
    end_not_later_than: row.end_not_later_than,
    end_basis: row.end_basis,
    end_reason: row.end_reason,
    still_active_asof: row.still_active_asof,
    latitude: row.latitude,
    longitude: row.longitude,
    location_mode: row.location_mode,
    location_basis: row.location_basis,
    uncertainty_radius_m: row.uncertainty_radius_m,
  };
}

async function activeOccupancies(ctx: QueryCtx | MutationCtx, parentEvidenceDraftId: string): Promise<Doc<"site_occupancies">[]> {
  const rows = await ctx.db
    .query("site_occupancies")
    .withIndex("by_parent_evidence_draft_id", (q) => q.eq("parent_evidence_draft_id", parentEvidenceDraftId))
    .collect();
  return rows.filter((row) => row.claim_status === "submitted").sort((a, b) => a.segment_index - b.segment_index);
}

async function presenceRows(ctx: QueryCtx | MutationCtx, parentEvidenceDraftId: string): Promise<Doc<"derived_target_year_states">[]> {
  return await ctx.db
    .query("derived_target_year_states")
    .withIndex("by_parent_evidence_draft_id", (q) => q.eq("parent_evidence_draft_id", parentEvidenceDraftId))
    .collect();
}

async function locationRows(ctx: QueryCtx | MutationCtx, parentEvidenceDraftId: string): Promise<Doc<"derived_year_locations">[]> {
  return await ctx.db
    .query("derived_year_locations")
    .withIndex("by_parent_evidence_draft_id", (q) => q.eq("parent_evidence_draft_id", parentEvidenceDraftId))
    .collect();
}

function snapshotPresence(row: Doc<"derived_target_year_states"> | null) {
  if (row === null) return null;
  return {
    derived_status: row.derived_status,
    rule_id: row.rule_id,
    review_state: row.review_state,
    override_status: row.override_status ?? null,
    inputs_hash: row.inputs_hash,
  };
}

function snapshotLocations(rows: Doc<"derived_year_locations">[]) {
  return rows.map((row) => ({
    occupancy_id: row.occupancy_id,
    rule_id: row.rule_id,
    location_status: row.location_status,
    review_state: row.review_state,
    latitude: row.override_latitude ?? row.latitude,
    longitude: row.override_longitude ?? row.longitude,
    uncertainty_radius_m: row.override_uncertainty_radius_m ?? row.uncertainty_radius_m ?? null,
  }));
}

async function appendDerivedEvent(
  ctx: MutationCtx,
  args: {
    taskId: string;
    parentEvidenceDraftId: string;
    targetYear: number;
    action: "derived" | "invalidated" | "confirmed" | "overridden" | "rejected";
    actorUserId: Id<"users">;
    actorRole: string;
    before?: unknown;
    after?: unknown;
    note?: string;
    now: number;
  },
): Promise<void> {
  await ctx.db.insert("derived_state_events", {
    event_id: `${args.parentEvidenceDraftId}:${args.targetYear}:${args.action}:${args.now}:${args.actorUserId}`,
    task_id: args.taskId,
    parent_evidence_draft_id: args.parentEvidenceDraftId,
    target_year: args.targetYear,
    action: args.action,
    actor_user_id: args.actorUserId,
    actor_role: args.actorRole,
    ...(args.before !== undefined ? { before: args.before } : {}),
    ...(args.after !== undefined ? { after: args.after } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
    created_at: args.now,
  });
}

// re-runs both derivations for a parent draft and reconciles the stored
// derived rows: unchanged rows keep their review state, changed rows go
// back to derived_unconfirmed with an invalidated event, rows no rule
// produces any more become superseded. never deletes.
async function rederive(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  parent: Doc<"evidence_drafts">,
  actorUserId: Id<"users">,
  actorRole: string,
  now: number,
): Promise<{ years: number[]; conflicts: number[] }> {
  const segments = (await activeOccupancies(ctx, parent.evidence_draft_id)).map(segmentOf);
  const targetYears = taskTargetYears(task);
  const presences = derivePresence(segments, targetYears);
  const locations = deriveLocations(segments, presences, targetYears);
  const inputsHash = occupancyInputsHash(segments);
  const observed = (parent.target_year_statuses ?? {}) as Record<string, string>;

  const existingPresence = new Map((await presenceRows(ctx, parent.evidence_draft_id)).map((row) => [row.target_year, row]));
  const existingLocations = await locationRows(ctx, parent.evidence_draft_id);
  const conflicts: number[] = [];
  const derivedYears = new Set(presences.map((p) => p.target_year));

  for (const presence of presences) {
    const year = presence.target_year;
    const observedStatus = observed[String(year)];
    const conflict = observedStatus !== undefined && observedStatus !== "not_assessed" && observedStatus !== presence.derived_status;
    if (conflict) conflicts.push(year);
    const existing = existingPresence.get(year) ?? null;
    const yearLocations = locations.filter((l) => l.target_year === year);
    if (existing !== null && existing.inputs_hash === inputsHash && existing.review_state !== "superseded") {
      continue;
    }
    const before = snapshotPresence(existing);
    const record = {
      derived_status: presence.derived_status,
      rule_id: presence.rule_id,
      segment_rules: presence.segment_rules,
      derivation_version: OCCUPANCY_DERIVATION_VERSION,
      inputs_hash: inputsHash,
      review_state: "derived_unconfirmed" as const,
      override_status: undefined,
      conflicts_observation: conflict,
      updated_at: now,
    };
    if (existing === null) {
      await ctx.db.insert("derived_target_year_states", {
        derived_state_id: `${parent.evidence_draft_id}:presence:${year}`,
        task_id: task.task_id,
        parent_evidence_draft_id: parent.evidence_draft_id,
        target_year: year,
        ...record,
        created_at: now,
      });
    } else {
      await ctx.db.patch(existing._id, record);
    }
    // location rows are keyed by occupancy id, which changes with every
    // submission, so the year's earlier rows are superseded and new ones
    // inserted
    for (const old of existingLocations.filter((l) => l.target_year === year && l.review_state !== "superseded")) {
      await ctx.db.patch(old._id, { review_state: "superseded", updated_at: now });
    }
    for (const location of yearLocations) {
      await ctx.db.insert("derived_year_locations", {
        derived_location_id: `${parent.evidence_draft_id}:location:${year}:${location.occupancy_id}`,
        task_id: task.task_id,
        parent_evidence_draft_id: parent.evidence_draft_id,
        target_year: year,
        occupancy_id: location.occupancy_id,
        location_status: location.location_status,
        rule_id: location.rule_id,
        latitude: location.latitude,
        longitude: location.longitude,
        location_mode: location.location_mode,
        location_basis: location.location_basis,
        ...(location.uncertainty_radius_m !== undefined ? { uncertainty_radius_m: location.uncertainty_radius_m } : {}),
        ...(location.gap_years !== undefined ? { gap_years: location.gap_years } : {}),
        ...(location.transition_group !== undefined ? { transition_group: location.transition_group } : {}),
        derivation_version: OCCUPANCY_DERIVATION_VERSION,
        inputs_hash: inputsHash,
        review_state: "derived_unconfirmed",
        created_at: now,
        updated_at: now,
      });
    }
    await appendDerivedEvent(ctx, {
      taskId: task.task_id,
      parentEvidenceDraftId: parent.evidence_draft_id,
      targetYear: year,
      action: existing === null ? "derived" : "invalidated",
      actorUserId,
      actorRole,
      before,
      after: {
        presence: { derived_status: presence.derived_status, rule_id: presence.rule_id, review_state: "derived_unconfirmed", inputs_hash: inputsHash },
        locations: yearLocations.map((l) => ({ occupancy_id: l.occupancy_id, rule_id: l.rule_id, location_status: l.location_status, latitude: l.latitude, longitude: l.longitude, uncertainty_radius_m: l.uncertainty_radius_m ?? null })),
      },
      now,
    });
  }
  // years no rule produces any more
  for (const [year, row] of existingPresence) {
    if (derivedYears.has(year) || row.review_state === "superseded") continue;
    await ctx.db.patch(row._id, { review_state: "superseded", updated_at: now });
    for (const old of existingLocations.filter((l) => l.target_year === year && l.review_state !== "superseded")) {
      await ctx.db.patch(old._id, { review_state: "superseded", updated_at: now });
    }
    await appendDerivedEvent(ctx, {
      taskId: task.task_id,
      parentEvidenceDraftId: parent.evidence_draft_id,
      targetYear: year,
      action: "invalidated",
      actorUserId,
      actorRole,
      before: snapshotPresence(row),
      after: null,
      now,
    });
  }
  // a derived value that contradicts an observed one raises a check the
  // reviewer must settle; the engine never resolves it
  const checks = (task.automated_checks ?? []) as Array<{ check_id?: string }>;
  if (conflicts.length > 0 && !checks.some((check) => check?.check_id === CONFLICT_CHECK_ID)) {
    await ctx.db.patch(task._id, {
      automated_checks: [
        ...(task.automated_checks ?? []),
        {
          check_id: CONFLICT_CHECK_ID,
          severity: "warning",
          message: `Derived occupancy states differ from observed target-year statuses for ${conflicts.join(", ")}. Confirm is refused for those years; override with a note or reject.`,
          suggested_action: "review_derived_years",
        },
      ],
      updated_at: now,
    });
  }
  return { years: presences.map((p) => p.target_year), conflicts };
}

// the one write route for a set of periods: supersedes the author's earlier
// set for the parent, inserts the rows, rederives the census-year proposals,
// and records the task event. the ra mutation and the bulk import both call
// it, so the stored shape cannot drift between them. the caller has already
// authorised the actor and validated the set
export async function recordOccupancySet(
  ctx: MutationCtx,
  args: {
    task: Doc<"tasks">;
    parent: Doc<"evidence_drafts">;
    user: Doc<"users">;
    actorRole: ProjectRole;
    submissionKey: string;
    submissionToken: string;
    segments: OccupancySegmentInput[];
    now: number;
    clientContext?: unknown;
  },
): Promise<{ occupancyIds: string[]; derived: { years: number[]; conflicts: number[] } }> {
  const { task, parent, user, actorRole, now } = args;
  const point = taskPoint(task);
  // the author's earlier set for this parent is superseded, never rewritten
  for (const row of await activeOccupancies(ctx, parent.evidence_draft_id)) {
    if (row.created_by === user._id) {
      await ctx.db.patch(row._id, { claim_status: "superseded", updated_at: now });
    }
  }
  const occupancyIds: string[] = [];
  for (const segment of [...args.segments].sort((a, b) => a.segment_index - b.segment_index)) {
    const location = resolveLocation(segment, point);
    const occupancyId = `${task.task_id}:${user._id}:occupancy:${args.submissionToken}:${segment.segment_index}`;
    occupancyIds.push(occupancyId);
    const trimmed = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
    await ctx.db.insert("site_occupancies", {
      occupancy_id: occupancyId,
      task_id: task.task_id,
      parent_evidence_draft_id: parent.evidence_draft_id,
      claim_status: "submitted",
      contract_version: "occupancy_v1",
      submission_key: args.submissionKey,
      segment_index: segment.segment_index,
      start_mode: segment.start_mode,
      ...(trimmed(segment.start_date) ? { start_date: trimmed(segment.start_date) } : {}),
      ...(trimmed(segment.start_not_earlier_than) ? { start_not_earlier_than: trimmed(segment.start_not_earlier_than) } : {}),
      ...(trimmed(segment.start_not_later_than) ? { start_not_later_than: trimmed(segment.start_not_later_than) } : {}),
      start_precision: startPrecision(segment),
      start_basis: segment.start_basis,
      end_mode: segment.end_mode,
      ...(trimmed(segment.end_date) ? { end_date: trimmed(segment.end_date) } : {}),
      ...(trimmed(segment.end_not_earlier_than) ? { end_not_earlier_than: trimmed(segment.end_not_earlier_than) } : {}),
      ...(trimmed(segment.end_not_later_than) ? { end_not_later_than: trimmed(segment.end_not_later_than) } : {}),
      end_precision: endPrecision(segment),
      end_basis: segment.end_basis,
      ...(segment.end_reason !== undefined ? { end_reason: segment.end_reason } : {}),
      ...(trimmed(segment.still_active_asof) ? { still_active_asof: trimmed(segment.still_active_asof) } : {}),
      ...(trimmed(segment.successor_site_id) ? { successor_site_id: trimmed(segment.successor_site_id) } : {}),
      location_relation: segment.location_relation,
      latitude: location.latitude,
      longitude: location.longitude,
      location_mode: location.location_mode,
      location_basis: location.location_basis,
      ...(location.uncertainty_radius_m !== undefined ? { uncertainty_radius_m: location.uncertainty_radius_m } : {}),
      ...(location.location_wording ? { location_wording: location.location_wording } : {}),
      location_confidence: location.location_confidence,
      confidence: segment.confidence,
      confidence_basis: segment.confidence_basis.trim(),
      source_basis: segment.source_basis,
      source_title: segment.source_title.trim(),
      ...(trimmed(segment.source_reference) ? { source_reference: trimmed(segment.source_reference) } : {}),
      source_account: segment.source_account.trim(),
      ...(trimmed(segment.uncertainty_note) ? { uncertainty_note: trimmed(segment.uncertainty_note) } : {}),
      privacy_flag: segment.privacy_flag as "clear" | "needs_review" | "restricted",
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });
  }
  const derived = await rederive(ctx, task, parent, user._id, actorRole, now);
  await appendTaskEvent(ctx, {
    taskId: task.task_id,
    eventType: "note_added",
    actorUserId: user._id,
    actorRole,
    previousStatus: task.status,
    newStatus: task.status,
    reason: `Recorded ${args.segments.length} occupancy period${args.segments.length === 1 ? "" : "s"}; derived ${derived.years.length} census-year proposal${derived.years.length === 1 ? "" : "s"} awaiting reviewer confirmation.`,
    evidenceDraftId: parent.evidence_draft_id,
    clientContext: args.clientContext,
  });
  return { occupancyIds, derived };
}

// lists the task's periods: reviewers see all, an ra sees their own
export const listTaskOccupancies = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(siteOccupancyDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 100), 1), 200);
    const rows = await ctx.db
      .query("site_occupancies")
      .withIndex("by_task_and_created_at", (q) => q.eq("task_id", task.task_id))
      .order("desc")
      .take(limit);
    if (canReview(user.roles)) return rows;
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    return rows.filter((row) => row.created_by === user._id);
  },
});

// the derived proposals and their trail for one task
export const listDerivedStates = query({
  args: { taskId: v.string() },
  returns: v.object({
    presence: v.array(derivedTargetYearStateDoc),
    locations: v.array(derivedYearLocationDoc),
    events: v.array(derivedStateEventDoc),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    if (!canReview(user.roles)) {
      assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    }
    const presence = await ctx.db
      .query("derived_target_year_states")
      .withIndex("by_task", (q) => q.eq("task_id", task.task_id))
      .collect();
    const locations = await ctx.db
      .query("derived_year_locations")
      .withIndex("by_task", (q) => q.eq("task_id", task.task_id))
      .collect();
    const events = await ctx.db
      .query("derived_state_events")
      .withIndex("by_task_and_created_at", (q) => q.eq("task_id", task.task_id))
      .order("desc")
      .take(200);
    return { presence, locations, events };
  },
});

// records the author's set of periods for a submitted evidence record and
// derives the per-year proposals; a resubmission supersedes the earlier set
export const submitOccupancies = mutation({
  args: {
    clientSubmissionId: v.string(),
    taskId: v.string(),
    parentEvidenceDraftId: v.string(),
    segments: v.array(occupancySegmentInput),
    clientContext: v.optional(occupancyClientContext),
  },
  returns: v.object({
    occupancy_ids: v.array(v.string()),
    derived_years: v.array(v.number()),
    conflict_years: v.array(v.number()),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    assertRapidSubmissionId(args.clientSubmissionId);
    assertMaxString("task id", args.taskId, MEDIUM_TEXT_MAX);
    assertMaxString("parent evidence draft id", args.parentEvidenceDraftId, MEDIUM_TEXT_MAX);
    assertMaxString("portal version", args.clientContext?.portal_version, SHORT_TEXT_MAX);
    assertClientContextLimit(args.clientContext);

    const submissionKey = `${user._id}:${args.clientSubmissionId}`;
    const existing = await ctx.db
      .query("site_occupancies")
      .withIndex("by_submission_key", (q) => q.eq("submission_key", submissionKey))
      .collect();
    if (existing.length > 0) {
      if (existing[0].created_by !== user._id) {
        throw new Error("The submission identifier is already in use.");
      }
      return {
        occupancy_ids: existing.map((row) => row.occupancy_id),
        derived_years: [],
        conflict_years: [],
        deduped: true,
      };
    }

    const task = await getTaskOrThrow(ctx, args.taskId);
    const parent = await getParentEvidenceOrThrow(ctx, args.parentEvidenceDraftId);
    if (!ACTIVE_HISTORY_STATUSES.has(task.status)) {
      throw new Error("This task is closed for history entry. Ask JB to reopen it before adding periods.");
    }
    if (parent.task_id !== task.task_id || !isHistoricalClaimParentContract(parent.observation_contract_version)) {
      throw new Error("Periods must attach to submitted rapid or guided evidence for this task.");
    }
    if (parent.created_by !== user._id) {
      throw new Error("Only the investigator who submitted the parent evidence can record its periods.");
    }
    if (parent.draft_status !== "submitted" && parent.draft_status !== "unresolved_note") {
      throw new Error("Record periods against the latest submitted evidence record, not an earlier version.");
    }
    const referenceDate = new Date().toISOString().slice(0, 10);
    const point = taskPoint(task);
    assertOccupancySet(args.segments, referenceDate, point, dateFloorYear(task.country_code));

    await intakeRateLimiter.limit(ctx, "occupancyPerUser", { key: user._id, throws: true });
    await intakeRateLimiter.limit(ctx, "occupancyGlobal", { throws: true });

    const now = Date.now();
    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);
    const { occupancyIds, derived } = await recordOccupancySet(ctx, {
      task,
      parent,
      user,
      actorRole,
      submissionKey,
      submissionToken: args.clientSubmissionId,
      segments: args.segments,
      now,
      clientContext: args.clientContext,
    });
    return {
      occupancy_ids: occupancyIds,
      derived_years: derived.years,
      conflict_years: derived.conflicts,
      deduped: false,
    };
  },
});

type DecisionAction = "confirm" | "override" | "reject";

// the shared body of a per-year decision; returns the status written
async function applyYearDecision(
  ctx: MutationCtx,
  user: Doc<"users">,
  task: Doc<"tasks">,
  parent: Doc<"evidence_drafts">,
  presence: Doc<"derived_target_year_states">,
  action: DecisionAction,
  note: string | undefined,
  override: { status?: "present" | "absent" | "uncertain"; latitude?: number; longitude?: number; uncertainty_radius_m?: number } | undefined,
  now: number,
): Promise<string | null> {
  const year = presence.target_year;
  const actorRole = chooseActorRole(user, ["reviewer", "curator", "admin"]);
  const yearLocations = (await locationRows(ctx, parent.evidence_draft_id)).filter(
    (row) => row.target_year === year && row.review_state !== "superseded",
  );
  const before = { presence: snapshotPresence(presence), locations: snapshotLocations(yearLocations) };
  let written: string | null = null;
  if (action === "confirm") {
    if (presence.conflicts_observation) {
      throw new Error(`The derived ${year} state conflicts with an observed status; override it with a note or reject it.`);
    }
    await ctx.db.patch(presence._id, { review_state: "reviewer_confirmed", override_status: undefined, updated_at: now });
    for (const row of yearLocations) {
      await ctx.db.patch(row._id, { review_state: "reviewer_confirmed", updated_at: now });
    }
    written = presence.derived_status;
    await ctx.db.patch(parent._id, {
      target_year_statuses: { ...((parent.target_year_statuses ?? {}) as Record<string, "present" | "absent" | "uncertain" | "not_assessed">), [String(year)]: presence.derived_status },
      target_year_basis: { ...((parent.target_year_basis ?? {}) as Record<string, "source_observation" | "reviewer_confirmed_derivation" | "reviewer_override">), [String(year)]: "reviewer_confirmed_derivation" },
      updated_at: now,
    });
  } else if (action === "override") {
    if (override === undefined || (override.status === undefined && override.latitude === undefined && override.longitude === undefined && override.uncertainty_radius_m === undefined)) {
      throw new Error("An override needs a status, a point, or a radius.");
    }
    if ((override.latitude === undefined) !== (override.longitude === undefined)) {
      throw new Error("An overriding point needs both latitude and longitude.");
    }
    const status = override.status ?? presence.derived_status;
    await ctx.db.patch(presence._id, { review_state: "reviewer_overridden", override_status: status, updated_at: now });
    for (const row of yearLocations) {
      await ctx.db.patch(row._id, {
        review_state: "reviewer_overridden",
        ...(override.latitude !== undefined ? { override_latitude: override.latitude, override_longitude: override.longitude } : {}),
        ...(override.uncertainty_radius_m !== undefined ? { override_uncertainty_radius_m: override.uncertainty_radius_m } : {}),
        updated_at: now,
      });
    }
    written = status;
    await ctx.db.patch(parent._id, {
      target_year_statuses: { ...((parent.target_year_statuses ?? {}) as Record<string, "present" | "absent" | "uncertain" | "not_assessed">), [String(year)]: status },
      target_year_basis: { ...((parent.target_year_basis ?? {}) as Record<string, "source_observation" | "reviewer_confirmed_derivation" | "reviewer_override">), [String(year)]: "reviewer_override" },
      updated_at: now,
    });
  } else {
    await ctx.db.patch(presence._id, { review_state: "reviewer_rejected", override_status: undefined, updated_at: now });
    for (const row of yearLocations) {
      await ctx.db.patch(row._id, { review_state: "reviewer_rejected", updated_at: now });
    }
  }
  const afterPresence = await ctx.db.get(presence._id);
  const afterLocations = (await locationRows(ctx, parent.evidence_draft_id)).filter(
    (row) => row.target_year === year && row.review_state !== "superseded",
  );
  await appendDerivedEvent(ctx, {
    taskId: task.task_id,
    parentEvidenceDraftId: parent.evidence_draft_id,
    targetYear: year,
    action: action === "confirm" ? "confirmed" : action === "override" ? "overridden" : "rejected",
    actorUserId: user._id,
    actorRole,
    before,
    after: { presence: snapshotPresence(afterPresence), locations: snapshotLocations(afterLocations), written_status: written },
    ...(note !== undefined ? { note } : {}),
    now,
  });
  return written;
}

async function reviewerAndParent(
  ctx: MutationCtx,
  taskId: string,
  parentEvidenceDraftId: string,
): Promise<{ user: Doc<"users">; task: Doc<"tasks">; parent: Doc<"evidence_drafts"> }> {
  const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
  const task = await getTaskOrThrow(ctx, taskId);
  const parent = await getParentEvidenceOrThrow(ctx, parentEvidenceDraftId);
  if (parent.task_id !== task.task_id) {
    throw new Error("The evidence record belongs to a different task.");
  }
  // author-cannot-accept-own holds for derived years as for decisions
  if (parent.created_by === user._id) {
    throw new Error("You submitted this evidence; another team member must confirm its derived years.");
  }
  return { user, task, parent };
}

// one reviewer action on one derived census year
export const decideDerivedYear = mutation({
  args: {
    taskId: v.string(),
    parentEvidenceDraftId: v.string(),
    targetYear: v.number(),
    action: v.union(v.literal("confirm"), v.literal("override"), v.literal("reject")),
    note: v.optional(v.string()),
    override: v.optional(v.object({
      status: v.optional(derivedPresenceStatus),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      uncertainty_radius_m: v.optional(v.number()),
    })),
  },
  returns: v.object({
    target_year: v.number(),
    review_state: v.string(),
    written_status: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { user, task, parent } = await reviewerAndParent(ctx, args.taskId, args.parentEvidenceDraftId);
    assertMaxString("decision note", args.note, TASK_REASON_MAX);
    const note = args.note?.trim();
    if (args.action !== "confirm" && (note ?? "").length < DECISION_NOTE_MIN) {
      throw new Error(`An override or rejection needs a note of at least ${DECISION_NOTE_MIN} characters.`);
    }
    const presence = (await presenceRows(ctx, parent.evidence_draft_id)).find(
      (row) => row.target_year === args.targetYear && row.review_state !== "superseded",
    );
    if (presence === undefined) {
      throw new Error(`No derived state exists for ${args.targetYear} on this evidence record.`);
    }
    const now = Date.now();
    const written = await applyYearDecision(ctx, user, task, parent, presence, args.action, note, args.override, now);
    await appendTaskEvent(ctx, {
      taskId: task.task_id,
      eventType: "note_added",
      actorUserId: user._id,
      actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
      previousStatus: task.status,
      newStatus: task.status,
      reason: `Derived ${args.targetYear} state ${args.action === "confirm" ? "confirmed" : args.action === "override" ? "overridden" : "rejected"}${written ? ` as ${written}` : ""}.`,
      evidenceDraftId: parent.evidence_draft_id,
    });
    const after = await ctx.db.get(presence._id);
    return { target_year: args.targetYear, review_state: after?.review_state ?? "derived_unconfirmed", written_status: written };
  },
});

// confirms every year the ruled criteria allow (rules 1, 2, 4 with l1 or
// no location rows, no conflict); the rest are listed with the reason
export const confirmAllDerived = mutation({
  args: {
    taskId: v.string(),
    parentEvidenceDraftId: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    confirmed: v.array(v.number()),
    skipped: v.array(v.object({ target_year: v.number(), reason: v.string() })),
  }),
  handler: async (ctx, args) => {
    const { user, task, parent } = await reviewerAndParent(ctx, args.taskId, args.parentEvidenceDraftId);
    assertMaxString("decision note", args.note, TASK_REASON_MAX);
    const confirmable = new Set(["inside_interval", "before_stated_founding", "after_stated_closure"]);
    const rows = (await presenceRows(ctx, parent.evidence_draft_id))
      .filter((row) => row.review_state === "derived_unconfirmed")
      .sort((a, b) => a.target_year - b.target_year);
    const locations = (await locationRows(ctx, parent.evidence_draft_id)).filter((row) => row.review_state !== "superseded");
    const confirmed: number[] = [];
    const skipped: { target_year: number; reason: string }[] = [];
    const now = Date.now();
    for (const row of rows) {
      if (!confirmable.has(row.rule_id)) {
        skipped.push({ target_year: row.target_year, reason: "uncertain years need a per-year decision" });
        continue;
      }
      if (row.conflicts_observation) {
        skipped.push({ target_year: row.target_year, reason: "conflicts with an observed status" });
        continue;
      }
      const yearLocations = locations.filter((l) => l.target_year === row.target_year);
      if (yearLocations.some((l) => l.rule_id !== "occupancy_covers_year")) {
        skipped.push({ target_year: row.target_year, reason: "location is uncertain or imputed" });
        continue;
      }
      await applyYearDecision(ctx, user, task, parent, row, "confirm", args.note?.trim() || undefined, undefined, now + confirmed.length);
      confirmed.push(row.target_year);
    }
    if (confirmed.length > 0) {
      await appendTaskEvent(ctx, {
        taskId: task.task_id,
        eventType: "note_added",
        actorUserId: user._id,
        actorRole: chooseActorRole(user, ["reviewer", "curator", "admin"]),
        previousStatus: task.status,
        newStatus: task.status,
        reason: `Confirmed derived states for ${confirmed.join(", ")}.`,
        evidenceDraftId: parent.evidence_draft_id,
      });
    }
    return { confirmed, skipped };
  },
});
