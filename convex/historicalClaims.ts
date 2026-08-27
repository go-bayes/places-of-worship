import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertHistoricalClaim,
  historicalClaimReferenceDate,
  isHistoricalClaimParentContract,
} from "./lib/historicalClaims";
import { assertOwnsOrCanReview, canReview, chooseActorRole, requireUser } from "./lib/auth";
import {
  assertClientContextLimit,
  assertMaxString,
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "./lib/limits";
import { intakeRateLimiter } from "./lib/rateLimits";
import { assertRapidSubmissionId } from "./lib/rapidEntry";
import { appendTaskEvent } from "./lib/taskEvents";
import { historicalClaimInput, historicalClaimStatus } from "./model";
import { historicalClaimDoc } from "./lib/validators";

const ACTIVE_HISTORY_STATUSES = new Set(["needs_review", "unresolved_note", "changes_requested"]);

const historicalClientContext = v.object({
  portal_version: v.optional(v.string()),
});

// loads one task by its stable public identifier.
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

// loads the submitted evidence record that anchors the historical claims.
async function getParentEvidenceOrThrow(
  ctx: QueryCtx | MutationCtx,
  evidenceDraftId: string,
): Promise<Doc<"evidence_drafts">> {
  const draft = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", evidenceDraftId))
    .unique();
  if (draft === null) {
    throw new Error("The current observation is no longer available. Refresh the portal and try again.");
  }
  return draft;
}

// lists bounded, role-appropriate historical claims for one task.
export const listTaskHistoricalClaims = query({
  args: {
    taskId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(historicalClaimDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin"]);
    const task = await getTaskOrThrow(ctx, args.taskId);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    if (canReview(user.roles)) {
      return await ctx.db
        .query("historical_claims")
        .withIndex("by_task_and_created_at", (q) => q.eq("task_id", task.task_id))
        .order("desc")
        .take(limit);
    }
    assertOwnsOrCanReview(user._id, user.roles, task.assigned_to);
    return await ctx.db
      .query("historical_claims")
      .withIndex("by_task_creator_and_created_at", (q) => q.eq("task_id", task.task_id).eq("created_by", user._id))
      .order("desc")
      .take(limit);
  },
});

// records one confirmed historical claim while preserving its source account.
export const submitHistoricalClaim = mutation({
  args: {
    clientSubmissionId: v.string(),
    taskId: v.string(),
    parentEvidenceDraftId: v.string(),
    claim: historicalClaimInput,
    clientContext: v.optional(historicalClientContext),
  },
  returns: v.object({
    historical_claim_id: v.string(),
    claim_status: historicalClaimStatus,
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
      .query("historical_claims")
      .withIndex("by_intake_submission_key", (q) => q.eq("intake_submission_key", submissionKey))
      .unique();
    if (existing !== null) {
      if (existing.created_by !== user._id) {
        throw new Error("The submission identifier is already in use.");
      }
      return {
        historical_claim_id: existing.historical_claim_id,
        claim_status: existing.claim_status as "submitted" | "superseded" | "withdrawn",
        deduped: true,
      };
    }

    const task = await getTaskOrThrow(ctx, args.taskId);
    const parent = await getParentEvidenceOrThrow(ctx, args.parentEvidenceDraftId);
    if (!ACTIVE_HISTORY_STATUSES.has(task.status)) {
      throw new Error("This task is closed for historical entry. Ask JB to reopen it before adding history.");
    }
    const supportedParent = isHistoricalClaimParentContract(parent.observation_contract_version);
    if (parent.task_id !== task.task_id || !supportedParent) {
      throw new Error("Historical claims must attach to submitted rapid or guided evidence for this task.");
    }
    if (parent.created_by !== user._id) {
      throw new Error("Only the investigator who submitted the parent evidence can add its known history.");
    }
    if (parent.draft_status !== "submitted" && parent.draft_status !== "unresolved_note") {
      throw new Error("Add history to the latest submitted evidence record, not to an earlier version.");
    }
    const { referenceDate, referenceDateBasis } = historicalClaimReferenceDate(
      parent.source_date_or_capture_date,
      new Date().toISOString().slice(0, 10),
    );
    assertHistoricalClaim(args.claim, referenceDate);

    await intakeRateLimiter.limit(ctx, "historicalClaimPerUser", { key: user._id, throws: true });
    await intakeRateLimiter.limit(ctx, "historicalClaimGlobal", { throws: true });

    const now = Date.now();
    const historicalClaimId = `${task.task_id}:${user._id}:history:${args.clientSubmissionId}`;
    await ctx.db.insert("historical_claims", {
      historical_claim_id: historicalClaimId,
      task_id: task.task_id,
      parent_evidence_draft_id: parent.evidence_draft_id,
      claim_status: "submitted",
      contract_version: "historical_claim_v1",
      created_by: user._id,
      created_at: now,
      updated_at: now,
      claim_kind: args.claim.claim_kind,
      claim_timing: args.claim.claim_timing,
      claim_text: args.claim.claim_text.trim(),
      reference_date: referenceDate,
      reference_date_basis: referenceDateBasis,
      ...(args.claim.earliest_supported_date?.trim()
        ? { earliest_supported_date: args.claim.earliest_supported_date.trim() }
        : {}),
      ...(args.claim.latest_supported_date?.trim()
        ? { latest_supported_date: args.claim.latest_supported_date.trim() }
        : {}),
      continues_through_observation: args.claim.continues_through_observation,
      confidence: args.claim.confidence,
      confidence_basis: args.claim.confidence_basis.trim(),
      source_basis: args.claim.source_basis,
      source_title: args.claim.source_title.trim(),
      ...(args.claim.source_reference?.trim()
        ? { source_reference: args.claim.source_reference.trim() }
        : {}),
      source_account: args.claim.source_account.trim(),
      ...(args.claim.uncertainty_note?.trim()
        ? { uncertainty_note: args.claim.uncertainty_note.trim() }
        : {}),
      privacy_flag: args.claim.privacy_flag,
      intake_submission_key: submissionKey,
    });

    const actorRole = chooseActorRole(user, ["ra", "reviewer", "curator", "admin"]);
    await appendTaskEvent(ctx, {
      taskId: task.task_id,
      eventType: "note_added",
      actorUserId: user._id,
      actorRole,
      evidenceDraftId: parent.evidence_draft_id,
      reason: `Historical ${args.claim.claim_timing} claim submitted for review.`,
      clientContext: {
        ...(args.clientContext ?? {}),
        country_code: task.country_code,
        historical_claim_id: historicalClaimId,
        contract_version: "historical_claim_v1",
      },
    });

    return {
      historical_claim_id: historicalClaimId,
      claim_status: "submitted" as const,
      deduped: false,
    };
  },
});
