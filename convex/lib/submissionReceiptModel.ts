import { v } from "convex/values";
import { taskStatus, historicalClaimStatus, locationAssertionInput } from "../model";

export const submitCurrentObservationResult = v.object({
  task_id: v.string(),
  evidence_draft_id: v.string(),
  candidate_site_id: v.optional(v.string()),
  task_status: taskStatus,
  deduped: v.boolean(),
  corrected: v.boolean(),
  evidence_version_hash: v.optional(v.string()),
  // a retry of an observation recorded before the version contract has
  // no version to return; the reason is stated rather than a hash invented
  evidence_version_unavailable: v.optional(v.literal("pre_contract")),
  superseded_evidence_draft_id: v.optional(v.string()),
});

export const submitOccupanciesResult = v.object({
  occupancy_ids: v.array(v.string()),
  derived_years: v.array(v.number()),
  conflict_years: v.array(v.number()),
  derived_function_years: v.optional(v.array(v.number())),
  deduped: v.boolean(),
});

export const submitHistoricalClaimResult = v.object({
  historical_claim_id: v.string(),
  claim_status: historicalClaimStatus,
  deduped: v.boolean(),
});

export const submitEvidenceDraftResult = v.object({
  task_id: v.string(),
  evidence_draft_id: v.string(),
  task_status: v.literal("needs_review"),
  evidence_version_hash: v.string(),
  deduped: v.boolean(),
});

export const submitEvidenceDraftWithOccupanciesResult = v.object({
  task_id: v.string(),
  evidence_draft_id: v.string(),
  task_status: v.literal("needs_review"),
  occupancy_ids: v.array(v.string()),
  derived_years: v.array(v.number()),
  conflict_years: v.array(v.number()),
  derived_function_years: v.optional(v.array(v.number())),
  period_count: v.number(),
  deduped: v.boolean(),
  evidence_version_hash: v.optional(v.string()),
});

export const rapidReceiptResult = v.object({
  ...submitCurrentObservationResult.fields,
  period_result: v.optional(submitOccupanciesResult),
  period_evidence_version_hash: v.optional(v.string()),
});
export const receiptOperation = v.union(
  v.literal("submitCurrentObservation"),
  v.literal("submitOccupancies"),
  v.literal("submitHistoricalClaim"),
  v.literal("submitEvidenceDraft"),
  v.literal("submitEvidenceDraftWithOccupancies"),
);
export const committedResult = v.union(
  rapidReceiptResult,
  submitOccupanciesResult,
  submitHistoricalClaimResult,
  submitEvidenceDraftResult,
  submitEvidenceDraftWithOccupanciesResult,
);
export const sourceSnapshot = v.object({
  source_id: v.string(),
  country_code: v.optional(v.string()),
  source_type: v.string(),
  title: v.string(),
  provider: v.optional(v.string()),
  url: v.optional(v.string()),
  archive_ref: v.optional(v.string()),
  licence: v.optional(v.string()),
  publication_date: v.optional(v.string()),
  consulted_date: v.optional(v.string()),
  access_limits: v.optional(v.string()),
  notes: v.optional(v.string()),
});
export const resolvedBindings = v.object({
  task_id: v.optional(v.string()),
  country_code: v.optional(v.string()),
  owner_id: v.optional(v.id("users")),
  source: v.optional(sourceSnapshot),
  source_draft_id: v.optional(v.string()),
  source_version_hash: v.optional(v.string()),
  revision_draft_id: v.optional(v.string()),
  revision_reused: v.optional(v.boolean()),
  revision_intent: v.optional(v.union(v.literal("correction"), v.literal("new_observation"))),
  parent_version_hash: v.optional(v.string()),
  task_defaults: v.optional(
    v.object({
      target_years: v.array(v.number()),
      priority: v.string(),
      task_type: v.string(),
      task_brief: v.optional(v.string()),
      location_assertion: v.optional(locationAssertionInput),
    }),
  ),
});
const common = {
  member_id: v.id("users"),
  client_submission_id: v.string(),
  request_contract: v.string(),
  request_digest: v.string(),
  resolved_bindings: resolvedBindings,
  recorded_at: v.number(),
};
export const receiptRow = v.union(
  v.object({
    ...common,
    operation: v.literal("submitCurrentObservation"),
    result: rapidReceiptResult,
  }),
  v.object({
    ...common,
    operation: v.literal("submitOccupancies"),
    result: submitOccupanciesResult,
  }),
  v.object({
    ...common,
    operation: v.literal("submitHistoricalClaim"),
    result: submitHistoricalClaimResult,
  }),
  v.object({
    ...common,
    operation: v.literal("submitEvidenceDraft"),
    result: submitEvidenceDraftResult,
  }),
  v.object({
    ...common,
    operation: v.literal("submitEvidenceDraftWithOccupancies"),
    result: submitEvidenceDraftWithOccupanciesResult,
  }),
);
export const receiptDocument = v.union(
  v.object({
    ...common,
    _id: v.id("client_submission_receipts"),
    _creationTime: v.number(),
    operation: v.literal("submitCurrentObservation"),
    result: rapidReceiptResult,
  }),
  v.object({
    ...common,
    _id: v.id("client_submission_receipts"),
    _creationTime: v.number(),
    operation: v.literal("submitOccupancies"),
    result: submitOccupanciesResult,
  }),
  v.object({
    ...common,
    _id: v.id("client_submission_receipts"),
    _creationTime: v.number(),
    operation: v.literal("submitHistoricalClaim"),
    result: submitHistoricalClaimResult,
  }),
  v.object({
    ...common,
    _id: v.id("client_submission_receipts"),
    _creationTime: v.number(),
    operation: v.literal("submitEvidenceDraft"),
    result: submitEvidenceDraftResult,
  }),
  v.object({
    ...common,
    _id: v.id("client_submission_receipts"),
    _creationTime: v.number(),
    operation: v.literal("submitEvidenceDraftWithOccupancies"),
    result: submitEvidenceDraftWithOccupanciesResult,
  }),
);
export const correctionFields = v.union(
  v.literal("name"),
  v.literal("address"),
  v.literal("locality"),
  v.literal("latitude"),
  v.literal("longitude"),
  v.literal("locationAssertion"),
  v.literal("probableSameAs"),
);
export const conflictResult = v.object({
  outcome: v.literal("content_conflict"),
  operation: receiptOperation,
  clientSubmissionId: v.string(),
  canResubmitWithNewId: v.literal(true),
  committedResult,
});
export const correctionResult = v.object({
  outcome: v.literal("correction_required"),
  taskId: v.string(),
  fields: v.array(correctionFields),
});
