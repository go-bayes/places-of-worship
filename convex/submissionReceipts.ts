import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { canReview, requireUser } from "./lib/auth";
import {
  assertCountryIntakePoint,
  assertRapidCandidateContext,
  assertRapidSubmissionId,
  deriveCurrentObservation,
  isRapidCurrentDraft,
  sourceFieldsForObservationBasis,
} from "./lib/rapidEntry";
import { intakeRateLimiter } from "./lib/rateLimits";
import { assertRealSourceTitle, assertSourceRecordLimits, normalizeTitleKey, resolveCitedSource } from "./lib/sources";
import { objectHash, withoutUndefined } from "./lib/canonicalJson";
import { dateFloorYear } from "./lib/countryYears";
import { assertAssertionMatchesTaskPoint, assertCountryAllowsAssertionMode } from "./lib/locationAssertions";
import { assertProbableSameAsInputs } from "./lib/probableSameAs";
import { resolveProbableSameAsRefs } from "./lib/probableSameAsRecords";
import {
  assertOccupancySet,
  derivePresence,
  deriveLocations,
  occupancyReferenceDate,
  resolveLocation,
} from "./lib/occupancies";
import { assertChainAgreesWithPeriods, assertFunctionChain, deriveFunctions } from "./lib/functionChain";
import {
  assertClientContextLimit,
  assertEvidenceDraftLimits,
  assertEvidenceDraftSubmission,
  assertMaxString,
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_NAME_MAX,
  URL_OR_FILE_MAX,
} from "./lib/limits";
import {
  evidenceDraftInput,
  functionChainInput,
  occupancySegmentInput,
  locationAssertionInput,
  revisionIntent,
} from "./model";
import { submitCurrentObservationArgs, submitCurrentObservationHandler } from "./rapidEntry";
import { submitOccupanciesArgs, submitOccupanciesHandler, taskPoint, taskTargetYears } from "./occupancies";
import { submitHistoricalClaimArgs, submitHistoricalClaimHandler } from "./historicalClaims";
import { createSourceArgs, createSourceHandler } from "./sources";
import {
  createIssueTaskArgs,
  createIssueTaskHandler,
  createManualCandidateTaskArgs,
  createManualCandidateTaskHandler,
} from "./tasks";
import {
  reviseEvidenceDraftHandler,
  saveEvidenceDraftHandler,
  submitEvidenceDraftHandler,
  submitEvidenceDraftWithOccupanciesHandler,
} from "./evidence";
import { submissionReceipt } from "./evidenceVersions";
import {
  committedResult,
  conflictResult,
  correctionFields,
  correctionResult,
  rapidReceiptResult,
  receiptDocument,
  receiptOperation,
  resolvedBindings,
  sourceSnapshot,
  submitEvidenceDraftResult,
  submitEvidenceDraftWithOccupanciesResult,
  submitHistoricalClaimResult,
  submitOccupanciesResult,
} from "./lib/submissionReceiptModel";
import {
  REQUEST_CONTRACT,
  assertDateShape,
  assertRequestBounds,
  normaliseCandidate,
  normaliseInput,
  normaliseSegments,
  requestDigest,
} from "./lib/submissionRequest";

const ROLES = ["ra", "reviewer", "curator", "admin"] as const;
const { clientContext: _issueContext, ...issueFields } = createIssueTaskArgs.fields;
const { clientContext: _manualContext, ...manualFields } = createManualCandidateTaskArgs.fields;
export const taskCreationInput = v.union(
  v.object({ kind: v.literal("issue"), ...issueFields }),
  v.object({ kind: v.literal("manual"), ...manualFields }),
);
export const sourceInput = v.union(
  v.object({ kind: v.literal("register"), ...createSourceArgs.fields }),
  v.object({ kind: v.literal("existing"), sourceId: v.string() }),
  v.object({ kind: v.literal("citation") }),
);
// explicit volatile audit metadata; never part of a request digest
const receiptClientContext = v.object({
  placement_zoom: v.optional(v.number()),
  proximity_checked: v.optional(v.boolean()),
  nearby_count: v.optional(v.number()),
  portal_version: v.optional(v.string()),
  source: v.optional(v.string()),
  country_code: v.optional(v.string()),
  batch_id: v.optional(v.string()),
  selected_target_year: v.optional(v.number()),
  page_path: v.optional(v.string()),
  nearby_place_commentary: v.optional(v.string()),
});
const occupancySubmissionInput = v.object({
  ...submitOccupanciesArgs.fields,
  clientContext: v.optional(receiptClientContext),
});
const historySubmissionInput = v.object({
  ...submitHistoricalClaimArgs.fields,
  clientContext: v.optional(receiptClientContext),
});
const prerequisiteFields = {
  source: v.optional(sourceInput),
  taskCreation: v.optional(taskCreationInput),
};
export const rapidSubmissionInput = v.object({
  ...submitCurrentObservationArgs.fields,
  clientContext: v.optional(receiptClientContext),
  ...prerequisiteFields,
  candidateComparison: v.optional(submitCurrentObservationArgs.fields.candidate),
  segments: v.optional(v.array(occupancySegmentInput)),
  chain: v.optional(functionChainInput),
});
export const draftSubmissionInput = v.object({
  clientSubmissionId: v.string(),
  taskId: v.optional(v.string()),
  evidenceDraftId: v.optional(v.string()),
  draft: evidenceDraftInput,
  note: v.optional(v.string()),
  ...prerequisiteFields,
  revision: v.optional(v.object({ taskId: v.string(), intent: v.optional(revisionIntent) })),
  clientContext: v.optional(v.any()),
});
export const guidedSubmissionInput = v.object({
  ...draftSubmissionInput.fields,
  segments: v.array(occupancySegmentInput),
  chain: v.optional(functionChainInput),
});
const rapidOutcome = v.union(
  v.object({
    outcome: v.literal("committed"),
    ...rapidReceiptResult.fields,
    legacy_unverified: v.optional(v.literal(true)),
  }),
  conflictResult,
  correctionResult,
);
const periodsOutcome = v.union(
  v.object({
    outcome: v.literal("committed"),
    ...submitOccupanciesResult.fields,
    legacy_unverified: v.optional(v.literal(true)),
  }),
  conflictResult,
  correctionResult,
);
const historyOutcome = v.union(
  v.object({
    outcome: v.literal("committed"),
    ...submitHistoricalClaimResult.fields,
    legacy_unverified: v.optional(v.literal(true)),
  }),
  conflictResult,
  correctionResult,
);
const generalOutcome = v.union(
  v.object({
    outcome: v.literal("committed"),
    ...submitEvidenceDraftResult.fields,
    legacy_unverified: v.optional(v.literal(true)),
  }),
  conflictResult,
  correctionResult,
);
const guidedOutcome = v.union(
  v.object({
    outcome: v.literal("committed"),
    ...submitEvidenceDraftWithOccupanciesResult.fields,
    legacy_unverified: v.optional(v.literal(true)),
  }),
  conflictResult,
  correctionResult,
);

async function taskById(ctx: MutationCtx | QueryCtx, taskId: string) {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
    .unique();
  if (task === null) throw new Error("The selected task is no longer available.");
  return task;
}
async function draftById(ctx: MutationCtx | QueryCtx, draftId: string) {
  return ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", draftId))
    .unique();
}
async function findReceipt(ctx: MutationCtx | QueryCtx, memberId: Doc<"users">["_id"], id: string) {
  return ctx.db
    .query("client_submission_receipts")
    .withIndex("by_member_submission", (q) =>
      q.eq("member_id", memberId).eq("client_submission_id", id),
    )
    .unique();
}
async function start(ctx: MutationCtx, raw: { clientSubmissionId: string }) {
  const user = await requireUser(ctx, ROLES);
  assertRapidSubmissionId(raw.clientSubmissionId);
  assertRequestBounds(raw);
  await intakeRateLimiter.limit(ctx, "submissionAttemptPerMember", { key: user._id, throws: true });
  return { user, receipt: await findReceipt(ctx, user._id, raw.clientSubmissionId) };
}
function compare(
  receipt: Doc<"client_submission_receipts"> | null,
  digest: string,
  operation: typeof receiptOperation.type,
  id: string,
) {
  if (receipt === null) return null;
  if (receipt.operation !== operation || receipt.request_digest !== digest)
    return {
      outcome: "content_conflict" as const,
      operation: receipt.operation,
      clientSubmissionId: id,
      canResubmitWithNewId: true as const,
      committedResult: receipt.result,
    };
  return { outcome: "committed" as const, ...receipt.result, deduped: true };
}
async function chargeCreation(
  ctx: MutationCtx,
  user: Doc<"users">,
  kind: "source" | "task" | "general",
) {
  const names = {
    source: ["sourceCreationPerUser", "sourceCreationGlobal"],
    task: ["taskCreationPerUser", "taskCreationGlobal"],
    general: ["generalSubmissionPerUser", "generalSubmissionGlobal"],
  } as const;
  await intakeRateLimiter.limit(ctx, names[kind][0], { key: user._id, throws: true });
  await intakeRateLimiter.limit(ctx, names[kind][1], { throws: true });
}
function normaliseTask(input: typeof taskCreationInput.type | undefined) {
  if (!input) return input;
  return {
    ...input,
    ...(input.kind === "issue"
      ? { assignToReporter: input.assignToReporter ?? false }
      : normaliseCandidate(input)),
    countryCode: input.countryCode.toUpperCase(),
    ...(input.targetYears !== undefined
      ? { targetYears: [...new Set(input.targetYears)].sort((a, b) => a - b) }
      : {}),
  };
}
function prepareNames<
  T extends {
    candidate?: { name: string };
    candidateComparison?: { name: string };
    taskCreation?: { kind: string; name: string };
  },
>(raw: T): T {
  return {
    ...raw,
    ...(raw.candidate
      ? {
          candidate: {
            ...raw.candidate,
            name: raw.candidate.name.trim() || "Unknown place of worship",
          },
        }
      : {}),
    ...(raw.candidateComparison
      ? {
          candidateComparison: {
            ...raw.candidateComparison,
            name: raw.candidateComparison.name.trim() || "Unknown place of worship",
          },
        }
      : {}),
    ...(raw.taskCreation?.kind === "manual"
      ? {
          taskCreation: {
            ...raw.taskCreation,
            name: raw.taskCreation.name.trim() || "Unknown place of worship",
          },
        }
      : {}),
  };
}
function normaliseSource(source: typeof sourceInput.type | undefined) {
  return source?.kind === "register"
    ? {
        ...source,
        ...(source.countryCode ? { countryCode: source.countryCode.toUpperCase() } : {}),
      }
    : source;
}
async function resolveSource(
  ctx: MutationCtx,
  user: Doc<"users">,
  source: typeof sourceInput.type | undefined,
  suppliedId: string | undefined,
  locator: string | undefined,
  country: string,
) {
  if (source !== undefined && suppliedId !== undefined)
    throw new Error("Choose a source descriptor or source_id, not both.");
  let sourceId = suppliedId;
  if (source?.kind === "register") {
    if (source.countryCode !== undefined && source.countryCode !== country)
      throw new Error("The source country does not match the task.");
    const { kind: _kind, ...descriptor } = source;
    const registered = await createSourceHandler(ctx, descriptor);
    sourceId = registered.source_id;
    if (!registered.existing) await chargeCreation(ctx, user, "source");
  } else if (source?.kind === "existing") sourceId = source.sourceId;
  const row = await resolveCitedSource(ctx, sourceId, locator);
  if (row !== null && row.country_code !== undefined && row.country_code !== country)
    throw new Error("The cited source belongs to another country.");
  const snapshot =
    row === null
      ? undefined
      : (Object.fromEntries(
          Object.keys(sourceSnapshot.fields)
            .filter((field) => row[field as keyof typeof row] !== undefined)
            .map((field) => [field, row[field as keyof typeof row]]),
        ) as typeof sourceSnapshot.type);
  return { sourceId, snapshot };
}
async function resolveTask(
  ctx: MutationCtx,
  user: Doc<"users">,
  taskId: string | undefined,
  creation: typeof taskCreationInput.type | undefined,
  clientContext: unknown,
) {
  if ((taskId === undefined) === (creation === undefined))
    throw new Error("Choose a task or a task-creation descriptor.");
  if (creation !== undefined) {
    const { kind, ...descriptor } = creation;
    const result =
      kind === "issue"
        ? await createIssueTaskHandler(ctx, {
            ...descriptor,
            clientContext,
          } as typeof createIssueTaskArgs.type)
        : await createManualCandidateTaskHandler(ctx, {
            ...descriptor,
            clientContext,
          } as typeof createManualCandidateTaskArgs.type);
    if (!("deduped" in result) || !result.deduped) await chargeCreation(ctx, user, "task");
    taskId = result.task_id;
  }
  return taskById(ctx, taskId!);
}
function taskBindings(task: Doc<"tasks">): typeof resolvedBindings.type {
  return {
    task_id: task.task_id,
    country_code: task.country_code,
    task_defaults: {
      target_years: task.target_years,
      priority: task.priority,
      task_type: task.task_type,
      task_brief: task.task_brief,
      location_assertion: task.initial_location_assertion,
    },
  };
}
async function persist(
  ctx: MutationCtx,
  user: Doc<"users">,
  id: string,
  operation: typeof receiptOperation.type,
  digest: string,
  result: typeof committedResult.type,
  bindings: typeof resolvedBindings.type,
) {
  // operation and result are validated together by the table's closed union
  const row = withoutUndefined({
    member_id: user._id,
    client_submission_id: id,
    operation,
    request_contract: REQUEST_CONTRACT,
    request_digest: digest,
    result,
    resolved_bindings: bindings,
    recorded_at: Date.now(),
  });
  await ctx.db.insert(
    "client_submission_receipts",
    row as typeof import("./lib/submissionReceiptModel").receiptRow.type,
  );
}
function candidateDifferences(
  task: Doc<"tasks">,
  candidate: NonNullable<typeof rapidSubmissionInput.type.candidateComparison>,
): (typeof correctionFields.type)[] {
  if (!task.candidate_site_id) throw new Error("Candidate comparison requires a candidate task.");
  const stored = normaliseCandidate({
    name: task.name.trim() || "Unknown place of worship",
    address: task.address?.trim() || undefined,
    locality: task.locality?.trim() || undefined,
    latitude: task.geometry.coordinates[1],
    longitude: task.geometry.coordinates[0],
    locationAssertion: normaliseInput(
      v.optional(locationAssertionInput),
      task.initial_location_assertion,
    ),
    probableSameAs: (task.nearby_site_refs ?? [])
      .filter((ref) => ref.relation === "probable_same_place")
      .map((ref) => ({ task_id: ref.task_id! })),
  });
  const attempted = normaliseCandidate(candidate);
  return Object.keys(stored).filter(
    (field) =>
      objectHash(withoutUndefined({ value: stored[field as keyof typeof stored] })) !==
      objectHash(withoutUndefined({ value: attempted[field as keyof typeof attempted] })),
  ) as (typeof correctionFields.type)[];
}

// validate fresh observation content before a returned candidate refusal;
// receipt comparison and legacy recovery still precede these first-write gates
async function assertFreshRapidObservation(
  ctx: MutationCtx,
  args: typeof rapidSubmissionInput.type,
) {
  assertClientContextLimit(args.clientContext);
  const context = args.clientContext;
  if (context?.placement_zoom !== undefined && (!Number.isFinite(context.placement_zoom) || context.placement_zoom < 0 || context.placement_zoom > 24))
    throw new Error("The recorded map zoom is invalid.");
  if (context?.nearby_count !== undefined && (!Number.isInteger(context.nearby_count) || context.nearby_count < 0 || context.nearby_count > 1_000))
    throw new Error("The nearby-place count is invalid.");
  assertMaxString("portal version", context?.portal_version, SHORT_TEXT_MAX);
  const observation = args.observation;
  assertMaxString("source title", observation.source_title, MEDIUM_TEXT_MAX);
  assertMaxString("source reference", observation.source_reference, URL_OR_FILE_MAX);
  assertMaxString("denomination or tradition label", observation.denomination_or_tradition_raw, MEDIUM_TEXT_MAX);
  assertMaxString("direct observation", observation.direct_observation, 2_000);
  assertMaxString("uncertainty or follow-up", observation.uncertainty_note, 2_000);
  if (args.flagForDiscussion && (observation.uncertainty_note?.length ?? 0) < 12)
    throw new Error("Explain what needs discussion before flagging this entry.");
  if (args.source !== undefined && observation.source_id !== undefined)
    throw new Error("Choose a source descriptor or source_id, not both.");
  const descriptor = args.source?.kind === "register" ? args.source : undefined;
  let cited: Doc<"sources"> | null;
  if (descriptor !== undefined) {
    if (descriptor.countryCode !== undefined && descriptor.countryCode !== args.countryCode)
      throw new Error("The source country does not match the task.");
    assertRealSourceTitle(descriptor.title);
    if (!descriptor.url && !descriptor.archiveRef)
      throw new Error("Every source needs either a URL or an archive reference.");
    assertSourceRecordLimits({
      title: descriptor.title, provider: descriptor.provider, url: descriptor.url,
      archive_ref: descriptor.archiveRef, licence: descriptor.licence,
      publication_date: descriptor.publicationDate, consulted_date: descriptor.consultedDate,
      access_limits: descriptor.accessLimits, notes: descriptor.notes,
    });
    assertMaxString("source locator", observation.source_locator, SHORT_TEXT_MAX);
    cited = (await ctx.db.query("sources")
      .withIndex("by_title_key", (q) => q.eq("title_key", normalizeTitleKey(descriptor.title)))
      .collect()).find((row) => row.status === "active" && row.country_code === descriptor.countryCode) ?? null;
  } else {
    const sourceId = args.source?.kind === "existing" ? args.source.sourceId : observation.source_id;
    cited = await resolveCitedSource(ctx, sourceId, observation.source_locator);
  }
  if (cited?.country_code !== undefined && cited.country_code !== args.countryCode)
    throw new Error("The cited source belongs to another country.");
  const source = sourceFieldsForObservationBasis(
    observation.observation_basis,
    observation.source_title,
    observation.source_reference,
  );
  const draft = {
    observation_contract_version: "rapid_current_v1",
    ...deriveCurrentObservation(observation.current_status, args.candidate !== undefined),
    ...source,
    source_title: source.source_title || cited?.title || descriptor?.title,
    source_url_or_file: source.source_url_or_file ?? cited?.url ?? cited?.archive_ref ?? descriptor?.url ?? descriptor?.archiveRef,
    source_date_or_capture_date: observation.observed_on,
    evidence_note: observation.direct_observation,
    uncertainty_note: observation.uncertainty_note,
    current_observation_status: observation.current_status,
    current_observation_basis: observation.observation_basis,
  };
  assertEvidenceDraftLimits(draft);
  assertEvidenceDraftSubmission(draft, args.flagForDiscussion === true);
  if (args.chain !== undefined && !args.segments?.length)
    throw new Error("A function chain requires periods.");
  if (args.segments?.length) {
    const reference = occupancyReferenceDate(observation.observed_on, Date.now());
    const point = args.taskId !== undefined
      ? taskPoint(await taskById(ctx, args.taskId))
      : (args.candidate ?? args.taskCreation)!;
    assertOccupancySet(args.segments, reference, point, dateFloorYear(args.countryCode!));
    if (args.chain !== undefined) {
      assertFunctionChain(args.chain, reference, dateFloorYear(args.countryCode!));
      assertChainAgreesWithPeriods(args.chain, args.segments);
    }
  }
}

export const submitCurrentObservationV1 = mutation({
  args: rapidSubmissionInput.fields,
  returns: rapidOutcome,
  handler: async (ctx, raw): Promise<typeof rapidOutcome.type> => {
    const { user, receipt } = await start(ctx, raw);
    const args = normaliseInput(rapidSubmissionInput, prepareNames(raw));
    args.flagForDiscussion ??= false;
    args.source = normaliseSource(args.source);
    args.taskCreation = normaliseTask(args.taskCreation);
    if (args.candidate) args.candidate = normaliseCandidate(args.candidate);
    if (args.candidateComparison)
      args.candidateComparison = normaliseCandidate(args.candidateComparison);
    if (args.segments !== undefined) args.segments = normaliseSegments(args.segments);
    if (
      [args.taskId, args.candidate, args.taskCreation].filter((target) => target !== undefined)
        .length !== 1
    )
      throw new Error("Choose one rapid submission target.");
    const country = args.taskId
      ? receipt?.resolved_bindings.task_id === args.taskId
        ? receipt.resolved_bindings.country_code!
        : (await taskById(ctx, args.taskId)).country_code
      : (args.taskCreation?.countryCode ?? args.countryCode?.toUpperCase() ?? "VU");
    if (args.countryCode !== undefined && args.countryCode.toUpperCase() !== country)
      throw new Error("The submitted country does not match the task.");
    args.countryCode = country;
    assertDateShape(args);
    const digest = requestDigest(
      receipt?.request_contract ?? REQUEST_CONTRACT,
      "submitCurrentObservation",
      args,
    );
    const prior = compare(receipt, digest, "submitCurrentObservation", args.clientSubmissionId);
    if (prior !== null) return prior as typeof rapidOutcome.type;
    const legacy = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_intake_submission_key", (q) =>
        q.eq("intake_submission_key", `${user._id}:${args.clientSubmissionId}`),
      )
      .unique();
    if (legacy !== null)
      return {
        outcome: "committed",
        ...(await submitCurrentObservationHandler(ctx, {
          ...args,
          taskId: legacy.task_id,
          candidate: undefined,
        })),
        legacy_unverified: true,
      };
    await assertFreshRapidObservation(ctx, args);
    if (args.candidateComparison !== undefined) {
      if (!args.taskId) throw new Error("Candidate comparison requires a task target.");
      const task = await taskById(ctx, args.taskId);
      const candidate = args.candidateComparison;
      assertMaxString("candidate name", candidate.name, TASK_NAME_MAX);
      assertMaxString("candidate address", candidate.address, MEDIUM_TEXT_MAX);
      assertMaxString("candidate locality", candidate.locality, MEDIUM_TEXT_MAX);
      assertCountryIntakePoint(country, candidate.latitude, candidate.longitude);
      assertProbableSameAsInputs(candidate.probableSameAs);
      await resolveProbableSameAsRefs(ctx, candidate.probableSameAs, country, Date.now());
      // normaliseCandidate supplies the creation path's default assertion
      const assertion = candidate.locationAssertion!;
      assertCountryAllowsAssertionMode(country, assertion.mode);
      assertAssertionMatchesTaskPoint(assertion, candidate.latitude, candidate.longitude);
      const fields = candidateDifferences(task, args.candidateComparison);
      // author-only correction authority is enforced even for typed refusals
      const owned =
        (await ctx.db
          .query("evidence_drafts")
          .withIndex("by_task_creator_status", (q) =>
            q
              .eq("task_id", task.task_id)
              .eq("created_by", user._id)
              .eq("draft_status", "submitted"),
          )
          .first()) ??
        (await ctx.db
          .query("evidence_drafts")
          .withIndex("by_task_creator_status", (q) =>
            q
              .eq("task_id", task.task_id)
              .eq("created_by", user._id)
              .eq("draft_status", "unresolved_note"),
          )
          .first());
      if (
        owned === null ||
        !["needs_review", "unresolved_note", "changes_requested"].includes(task.status)
      )
        throw new Error("Only the observer can correct an observation awaiting review.");
      if (!isRapidCurrentDraft(owned))
        throw new Error("This task holds detailed evidence. Revise it through the detailed form.");
      if (fields.length > 0)
        return { outcome: "correction_required", taskId: task.task_id, fields };
    }
    assertClientContextLimit(args.clientContext);
    if (args.taskCreation !== undefined) {
      assertCountryIntakePoint(country, args.taskCreation.latitude, args.taskCreation.longitude);
      if (args.taskCreation.kind === "manual")
        assertRapidCandidateContext(
          args.clientContext,
          args.taskCreation.locationAssertion?.mode ?? "building_identified",
        );
    }
    const source = await resolveSource(
      ctx,
      user,
      args.source,
      args.observation.source_id,
      args.observation.source_locator,
      country,
    );
    const task = args.taskCreation
      ? await resolveTask(ctx, user, undefined, args.taskCreation, args.clientContext)
      : undefined;
    const result: typeof rapidReceiptResult.type = await submitCurrentObservationHandler(ctx, {
      ...args,
      taskId: task?.task_id ?? args.taskId,
      observation: { ...args.observation, source_id: source.sourceId },
    });
    const committedTask = await taskById(ctx, result.task_id);
    if (args.candidate !== undefined) await chargeCreation(ctx, user, "task");
    if (args.chain !== undefined && !args.segments?.length)
      throw new Error("A function chain requires periods.");
    if (args.segments?.length) {
      result.period_result = await submitOccupanciesHandler(ctx, {
        clientSubmissionId: args.clientSubmissionId,
        taskId: result.task_id,
        parentEvidenceDraftId: result.evidence_draft_id,
        segments: args.segments,
        chain: args.chain,
        clientContext: args.clientContext,
      });
      result.period_evidence_version_hash = (
        await draftById(ctx, result.evidence_draft_id)
      )?.evidence_version_hash;
    }
    await persist(ctx, user, args.clientSubmissionId, "submitCurrentObservation", digest, result, {
      ...taskBindings(committedTask),
      owner_id: user._id,
      source: source.snapshot,
    });
    return { outcome: "committed", ...result };
  },
});

export const submitOccupanciesV1 = mutation({
  args: occupancySubmissionInput.fields,
  returns: periodsOutcome,
  handler: async (ctx, raw): Promise<typeof periodsOutcome.type> => {
    const { user, receipt } = await start(ctx, raw);
    const args = normaliseInput(occupancySubmissionInput, raw);
    args.segments = normaliseSegments(args.segments);
    assertDateShape(args);
    const digest = requestDigest(
      receipt?.request_contract ?? REQUEST_CONTRACT,
      "submitOccupancies",
      args,
    );
    const prior = compare(receipt, digest, "submitOccupancies", args.clientSubmissionId);
    if (prior !== null) return prior as typeof periodsOutcome.type;
    const legacy = await ctx.db
      .query("site_occupancies")
      .withIndex("by_submission_key", (q) =>
        q.eq("submission_key", `${user._id}:${args.clientSubmissionId}`),
      )
      .first();
    const parent = legacy === null ? await draftById(ctx, args.parentEvidenceDraftId) : null;
    const result = await submitOccupanciesHandler(ctx, args);
    if (legacy !== null) return { outcome: "committed", ...result, legacy_unverified: true };
    await persist(ctx, user, args.clientSubmissionId, "submitOccupancies", digest, result, {
      ...taskBindings(await taskById(ctx, args.taskId)),
      owner_id: user._id,
      parent_version_hash: parent?.evidence_version_hash,
    });
    return { outcome: "committed", ...result };
  },
});
export const submitHistoricalClaimV1 = mutation({
  args: historySubmissionInput.fields,
  returns: historyOutcome,
  handler: async (ctx, raw): Promise<typeof historyOutcome.type> => {
    const { user, receipt } = await start(ctx, raw);
    const args = normaliseInput(historySubmissionInput, raw);
    assertDateShape(args);
    const digest = requestDigest(
      receipt?.request_contract ?? REQUEST_CONTRACT,
      "submitHistoricalClaim",
      args,
    );
    const prior = compare(receipt, digest, "submitHistoricalClaim", args.clientSubmissionId);
    if (prior !== null) return prior as typeof historyOutcome.type;
    const legacy = await ctx.db
      .query("historical_claims")
      .withIndex("by_intake_submission_key", (q) =>
        q.eq("intake_submission_key", `${user._id}:${args.clientSubmissionId}`),
      )
      .unique();
    const parent = legacy === null ? await draftById(ctx, args.parentEvidenceDraftId) : null;
    const result = await submitHistoricalClaimHandler(ctx, args);
    if (legacy !== null) return { outcome: "committed", ...result, legacy_unverified: true };
    await persist(ctx, user, args.clientSubmissionId, "submitHistoricalClaim", digest, result, {
      ...taskBindings(await taskById(ctx, args.taskId)),
      owner_id: user._id,
      parent_version_hash: parent?.evidence_version_hash,
    });
    return { outcome: "committed", ...result };
  },
});

function normaliseDraft<T extends typeof draftSubmissionInput.type>(args: T): T {
  args.source = normaliseSource(args.source);
  args.taskCreation = normaliseTask(args.taskCreation);
  args.draft = {
    ...args.draft,
    observation_contract_version:
      args.draft.observation_contract_version ?? "guided_observation_v1",
    privacy_flag: args.draft.privacy_flag ?? "clear",
    licence_flag: args.draft.licence_flag ?? "needs_review",
  };
  if (args.revision !== undefined) {
    if (args.taskId !== undefined && args.taskId !== args.revision.taskId)
      throw new Error("The revision task does not match the submission task.");
    args.taskId = args.revision.taskId;
    if (args.taskCreation !== undefined) throw new Error("A revision requires an existing task.");
  }
  if ((args.taskId === undefined) === (args.taskCreation === undefined))
    throw new Error("Choose a draft task binding.");
  return args;
}
function assertDraftPeriods(
  task: Doc<"tasks">,
  draft: typeof evidenceDraftInput.type,
  segments: (typeof occupancySegmentInput.type)[],
  chain: typeof functionChainInput.type | undefined,
) {
  const reference = occupancyReferenceDate(draft.source_date_or_capture_date, Date.now());
  const targetYears = taskTargetYears(task);
  if (segments.length) {
    const point = taskPoint(task);
    assertOccupancySet(segments, reference, point, dateFloorYear(task.country_code));
    const rows = segments.map((segment) => ({
      ...segment,
      occupancy_id: String(segment.segment_index),
      ...resolveLocation(segment, point),
    }));
    const presences = derivePresence(rows, targetYears);
    const locations = deriveLocations(rows, presences, targetYears);
    for (const derived of presences) {
      const stated =
        draft.target_year_statuses?.[
          String(derived.target_year) as keyof typeof draft.target_year_statuses
        ];
      if (stated && stated !== "not_assessed" && stated !== derived.derived_status)
        throw new Error(
          `Draft target year ${derived.target_year} disagrees with its compiled periods.`,
        );
      const wide = draft.generated_wide_row?.row?.[`target_year_${derived.target_year}_status`];
      if (wide && wide !== "not_assessed" && wide !== derived.derived_status)
        throw new Error(
          `Wide-row target year ${derived.target_year} disagrees with its compiled periods.`,
        );
      const level = draft.generated_wide_row?.row?.[`target_year_${derived.target_year}_use_level`];
      if (level && level !== derived.use_level)
        throw new Error(
          `Wide-row use level for ${derived.target_year} disagrees with its compiled periods.`,
        );
      const wideRow = draft.generated_wide_row?.row;
      const locationFields = ["latitude", "longitude", "uncertainty_radius_m", "location_basis"] as const;
      const supplied = locationFields.filter((field) => {
        const value = wideRow?.[`target_year_${derived.target_year}_${field}`];
        return value !== undefined && value !== null && value !== "";
      });
      if (supplied.length && !locations.some((location) =>
        location.target_year === derived.target_year && supplied.every((field) => {
          const value = wideRow![`target_year_${derived.target_year}_${field}`];
          if (field === "location_basis") return value === location[field];
          return (typeof value === "number" || typeof value === "string")
            && Number.isFinite(Number(value)) && Number(value) === location[field];
        }),
      )) throw new Error(`Wide-row location for ${derived.target_year} disagrees with its compiled periods.`);
    }
  }
  if (chain !== undefined) {
    if (!segments.length) throw new Error("A function chain requires periods.");
    assertFunctionChain(chain, reference, dateFloorYear(task.country_code));
    assertChainAgreesWithPeriods(chain, segments);
    const functions = deriveFunctions(chain, targetYears);
    for (const year of targetYears) {
      const label = draft.generated_wide_row?.row?.[`target_year_${year}_denomination`];
      if (label !== undefined && label !== null && label !== "" && !functions.some((row) =>
        row.target_year === year && row.candidate_labels.includes(label),
      )) throw new Error(`Wide-row denomination for ${year} disagrees with its function chain.`);
    }
  }
}
async function writeDraft(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: typeof draftSubmissionInput.type,
  segments?: (typeof occupancySegmentInput.type)[],
  chain?: typeof functionChainInput.type,
) {
  const task = await resolveTask(ctx, user, args.taskId, args.taskCreation, args.clientContext);
  const source = await resolveSource(
    ctx,
    user,
    args.source,
    args.draft.source_id,
    args.draft.source_locator,
    task.country_code,
  );
  const bindings: typeof resolvedBindings.type = {
    ...taskBindings(task),
    owner_id: user._id,
    source: source.snapshot,
  };
  let draftId = args.evidenceDraftId;
  if (args.revision !== undefined) {
    // supplied existing draft identifies the correction's source, never the
    // resolved editable target; replay must not resolve this mutable lineage
    const earlierEditable = await ctx.db
      .query("evidence_drafts")
      .withIndex("by_task_status", (q) => q.eq("task_id", task.task_id).eq("draft_status", "draft"))
      .order("desc")
      .first();
    const revision = await reviseEvidenceDraftHandler(ctx, args.revision);
    draftId = revision.evidence_draft_id;
    const resolved = await draftById(ctx, draftId);
    if (resolved === null) throw new Error("The editable revision could not be read.");
    // the legacy helper can return an ordinary editable draft before pinning
    // its lineage; only V1 initialises that draft in this transaction
    if (resolved.revision_of_evidence_draft_id === undefined) {
      const source = await draftById(ctx, revision.previous_evidence_draft_id);
      if (source === null) throw new Error("The revision source could not be read.");
      const lineage = {
        revision_of_evidence_draft_id: source.evidence_draft_id,
        revision_of_version_hash: source.evidence_version_hash,
        revision_intent: args.revision.intent ?? "correction",
      };
      await ctx.db.patch(resolved._id, lineage);
      Object.assign(resolved, lineage);
    }
    if (
      args.evidenceDraftId !== undefined &&
      resolved?.revision_of_evidence_draft_id !== args.evidenceDraftId
    )
      throw new Error("The revision source does not match the supplied evidence draft.");
    bindings.source_draft_id = resolved?.revision_of_evidence_draft_id;
    bindings.source_version_hash = resolved?.revision_of_version_hash;
    bindings.revision_draft_id = draftId;
    bindings.revision_intent = resolved?.revision_intent;
    bindings.revision_reused = earlierEditable?.evidence_draft_id === draftId;
  }
  draftId ??= `${task.task_id}:${user._id}:atomic:${args.clientSubmissionId}`;
  const existing = await draftById(ctx, draftId);
  if (existing !== null && existing.task_id !== task.task_id)
    throw new Error("The draft belongs to another task.");
  if (
    existing !== null &&
    existing.created_by !== user._id &&
    (segments !== undefined || !canReview(user.roles))
  )
    throw new Error("Only the contributor may submit this atomic draft.");
  bindings.owner_id = existing?.created_by ?? user._id;
  const content = {
    ...args.draft,
    source_id: source.sourceId,
    source_title: args.draft.source_title ?? source.snapshot?.title,
    source_url_or_file:
      args.draft.source_url_or_file ?? source.snapshot?.url ?? source.snapshot?.archive_ref,
  };
  assertEvidenceDraftLimits(content);
  assertEvidenceDraftSubmission(content, false);
  if (segments !== undefined) assertDraftPeriods(task, content, segments, chain);
  await chargeCreation(ctx, user, "general");
  // clear omitted input members so save A/save B/restore A submits exactly A
  // existing lineage and server state remain owned by the shared writer
  if (existing !== null) {
    if (existing.draft_status !== "draft")
      throw new Error("Start a revision before submitting edited evidence.");
    const reset = {
      ...Object.fromEntries(Object.keys(evidenceDraftInput.fields).map((key) => [key, undefined])),
      ...content,
      pending_occupancy_cards: undefined,
      // copied derivations and chains belong to the source version; the new
      // attempt records only its explicit periods and chain for fresh review
      target_year_basis: undefined,
      target_year_use_levels: undefined,
      target_year_denominations: undefined,
      target_year_denomination_basis: undefined,
      function_chain: undefined,
    };
    await ctx.db.patch(existing._id, reset);
  }
  await saveEvidenceDraftHandler(ctx, {
    taskId: task.task_id,
    evidenceDraftId: draftId,
    draft: { ...content, pending_occupancy_cards: undefined },
    clientContext: args.clientContext,
  });
  return { draftId, bindings };
}
async function legacyDraft(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: typeof draftSubmissionInput.type,
  guided: boolean,
) {
  if (args.evidenceDraftId === undefined) return false;
  if (guided)
    return (
      (await draftById(ctx, args.evidenceDraftId))?.guided_submission_key ===
      `${user._id}:${args.clientSubmissionId}`
    );
  return (await submissionReceipt(ctx, `submit:${user._id}:${args.clientSubmissionId}`)) !== null;
}
export const submitEvidenceDraftV1 = mutation({
  args: draftSubmissionInput.fields,
  returns: generalOutcome,
  handler: async (ctx, raw): Promise<typeof generalOutcome.type> => {
    const { user, receipt } = await start(ctx, raw);
    const args = normaliseDraft(normaliseInput(draftSubmissionInput, prepareNames(raw)));
    assertDateShape(args);
    const digest = requestDigest(
      receipt?.request_contract ?? REQUEST_CONTRACT,
      "submitEvidenceDraft",
      args,
    );
    const prior = compare(receipt, digest, "submitEvidenceDraft", args.clientSubmissionId);
    if (prior !== null) return prior as typeof generalOutcome.type;
    if (await legacyDraft(ctx, user, args, false))
      return {
        outcome: "committed",
        ...(await submitEvidenceDraftHandler(ctx, {
          evidenceDraftId: args.evidenceDraftId!,
          note: args.note,
          clientSubmissionId: args.clientSubmissionId,
        })),
        legacy_unverified: true,
      };
    const { draftId, bindings } = await writeDraft(ctx, user, args);
    const result = await submitEvidenceDraftHandler(ctx, {
      evidenceDraftId: draftId,
      clientSubmissionId: args.clientSubmissionId,
      note: args.note,
    });
    await persist(
      ctx,
      user,
      args.clientSubmissionId,
      "submitEvidenceDraft",
      digest,
      result,
      bindings,
    );
    return { outcome: "committed", ...result };
  },
});
export const submitEvidenceDraftWithOccupanciesV1 = mutation({
  args: guidedSubmissionInput.fields,
  returns: guidedOutcome,
  handler: async (ctx, raw): Promise<typeof guidedOutcome.type> => {
    const { user, receipt } = await start(ctx, raw);
    const args = normaliseDraft(normaliseInput(guidedSubmissionInput, prepareNames(raw)));
    args.segments = normaliseSegments(args.segments);
    assertDateShape(args);
    const digest = requestDigest(
      receipt?.request_contract ?? REQUEST_CONTRACT,
      "submitEvidenceDraftWithOccupancies",
      args,
    );
    const prior = compare(
      receipt,
      digest,
      "submitEvidenceDraftWithOccupancies",
      args.clientSubmissionId,
    );
    if (prior !== null) return prior as typeof guidedOutcome.type;
    if (await legacyDraft(ctx, user, args, true))
      return {
        outcome: "committed",
        ...(await submitEvidenceDraftWithOccupanciesHandler(ctx, {
          ...args,
          evidenceDraftId: args.evidenceDraftId!,
        })),
        legacy_unverified: true,
      };
    const { draftId, bindings } = await writeDraft(ctx, user, args, args.segments, args.chain);
    const result = await submitEvidenceDraftWithOccupanciesHandler(ctx, {
      ...args,
      evidenceDraftId: draftId,
    });
    await persist(
      ctx,
      user,
      args.clientSubmissionId,
      "submitEvidenceDraftWithOccupancies",
      digest,
      result,
      bindings,
    );
    return { outcome: "committed", ...result };
  },
});
export const getClientSubmissionReceipt = query({
  args: { clientSubmissionId: v.string() },
  returns: v.union(receiptDocument, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "service", "pi"]);
    assertRapidSubmissionId(args.clientSubmissionId);
    return findReceipt(ctx, user._id, args.clientSubmissionId);
  },
});
