import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentReviewAgreement,
  agentReviewBatchStatus,
  agentReviewRecommendation,
  agentSourceCheck,
  automatedCheck,
  changeClass,
  currentObservationBasis,
  currentObservationStatus,
  denominationLabelBasis,
  denominationRelation,
  evidenceDraftStatus,
  exportBatchStatus,
  exportFormat,
  historicalClaimConfidence,
  historicalClaimContractVersion,
  historicalClaimKind,
  historicalClaimSourceBasis,
  historicalClaimStatus,
  historicalClaimTiming,
  identityDecision,
  licenceFlag,
  observationContractVersion,
  nearbySiteRef,
  privacyFlag,
  projectRole,
  reviewDecisionStatus,
  taskBatchSourceKind,
  taskBatchStatus,
  taskEventType,
  taskPriority,
  taskStatus,
  taskType,
  targetYearAffect,
  targetYearEvidenceSet,
  targetYearStatusSet,
  userStatus,
} from "./model";

export default defineSchema({
  users: defineTable({
    auth_subject: v.optional(v.string()),
    email: v.optional(v.string()),
    display_name: v.optional(v.string()),
    initials: v.string(),
    roles: v.array(projectRole),
    status: userStatus,
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_auth_subject", ["auth_subject"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  task_batches: defineTable({
    batch_id: v.string(),
    country_code: v.string(),
    source_kind: taskBatchSourceKind,
    source_manifest_id: v.optional(v.string()),
    target_years: v.array(v.number()),
    status: taskBatchStatus,
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_country_status", ["country_code", "status"])
    .index("by_batch_id", ["batch_id"]),

  tasks: defineTable({
    task_id: v.string(),
    batch_id: v.string(),
    country_code: v.string(),
    task_type: taskType,
    priority: taskPriority,
    status: taskStatus,
    assigned_to: v.optional(v.id("users")),
    claimed_by: v.optional(v.id("users")),
    claimed_at: v.optional(v.number()),
    selected_target_year: v.optional(v.number()),
    target_years: v.array(v.number()),
    matched_current_site_id: v.optional(v.string()),
    candidate_site_id: v.optional(v.string()),
    source_record_id: v.optional(v.string()),
    matched_osm_id: v.optional(v.string()),
    osm_object_type: v.optional(v.union(v.literal("node"), v.literal("way"), v.literal("relation"))),
    name: v.string(),
    address: v.optional(v.string()),
    locality: v.optional(v.string()),
    geometry: v.any(),
    nearby_site_refs: v.optional(v.array(nearbySiteRef)),
    automated_checks: v.optional(v.array(automatedCheck)),
    task_brief: v.string(),
    source_context: v.optional(v.any()),
    intake_submission_key: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    last_event_at: v.optional(v.number()),
  })
    .index("by_task_id", ["task_id"])
    .index("by_status_priority", ["status", "priority"])
    .index("by_country_status", ["country_code", "status"])
    .index("by_assignee_status", ["assigned_to", "status"])
    .index("by_batch_status", ["batch_id", "status"])
    .index("by_source_record_id", ["source_record_id"])
    .index("by_matched_site", ["matched_current_site_id"])
    .index("by_candidate_site", ["candidate_site_id"])
    .index("by_osm", ["matched_osm_id"]),

  task_events: defineTable({
    event_id: v.string(),
    task_id: v.string(),
    event_type: taskEventType,
    actor_user_id: v.id("users"),
    actor_role: projectRole,
    occurred_at: v.number(),
    previous_status: v.optional(taskStatus),
    new_status: v.optional(taskStatus),
    reason: v.optional(v.string()),
    evidence_draft_id: v.optional(v.string()),
    review_decision_id: v.optional(v.string()),
    export_batch_id: v.optional(v.string()),
    client_context: v.optional(v.any()),
  })
    .index("by_task_time", ["task_id", "occurred_at"])
    .index("by_actor_time", ["actor_user_id", "occurred_at"])
    .index("by_event_type_time", ["event_type", "occurred_at"]),

  evidence_drafts: defineTable({
    evidence_draft_id: v.string(),
    task_id: v.string(),
    draft_status: evidenceDraftStatus,
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
    observation_contract_version: v.optional(observationContractVersion),
    source_type: v.optional(v.string()),
    provider: v.optional(v.string()),
    source_title: v.optional(v.string()),
    source_url_or_file: v.optional(v.string()),
    source_date_or_capture_date: v.optional(v.string()),
    address_raw: v.optional(v.string()),
    locality_raw: v.optional(v.string()),
    address_change_note: v.optional(v.string()),
    source_notes: v.optional(v.string()),
    action: v.optional(v.string()),
    change_class: v.optional(changeClass),
    target_year_statuses: v.optional(targetYearStatusSet),
    target_year_evidence: v.optional(targetYearEvidenceSet),
    existence_status: v.optional(v.string()),
    worship_use_status: v.optional(v.string()),
    assessment_confidence: v.optional(v.string()),
    match_confidence: v.optional(v.string()),
    geocoding_confidence: v.optional(v.string()),
    lifecycle_event: v.optional(v.string()),
    lifecycle_date: v.optional(v.string()),
    lifecycle_date_precision: v.optional(v.string()),
    lifecycle_note: v.optional(v.string()),
    related_ids_or_note: v.optional(v.string()),
    denomination_or_tradition_raw: v.optional(v.string()),
    denomination_label_basis: v.optional(denominationLabelBasis),
    denomination_relation: v.optional(denominationRelation),
    evidence_note: v.optional(v.string()),
    interpretation_note: v.optional(v.string()),
    uncertainty_note: v.optional(v.string()),
    current_observation_status: v.optional(currentObservationStatus),
    current_observation_basis: v.optional(currentObservationBasis),
    intake_submission_key: v.optional(v.string()),
    generated_wide_row: v.optional(v.any()),
    privacy_flag: privacyFlag,
    licence_flag: licenceFlag,
    validation_summary: v.optional(v.any()),
    // batch-import idempotency (docs/portal-batch-import-and-corrections.md):
    // a row is a duplicate when its (source, locator) key OR its content
    // hash matches an earlier import
    source_claim_key: v.optional(v.string()),
    claim_hash: v.optional(v.string()),
    import_batch_id: v.optional(v.string()),
  })
    .index("by_evidence_draft_id", ["evidence_draft_id"])
    .index("by_task_status", ["task_id", "draft_status"])
    .index("by_task_creator_status", ["task_id", "created_by", "draft_status"])
    .index("by_creator_time", ["created_by", "updated_at"])
    .index("by_source_url", ["source_url_or_file"])
    .index("by_source_claim_key", ["source_claim_key"])
    .index("by_claim_hash", ["claim_hash"])
    .index("by_intake_submission_key", ["intake_submission_key"]),

  historical_claims: defineTable({
    historical_claim_id: v.string(),
    task_id: v.string(),
    parent_evidence_draft_id: v.string(),
    claim_status: historicalClaimStatus,
    contract_version: historicalClaimContractVersion,
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
    claim_kind: historicalClaimKind,
    claim_timing: historicalClaimTiming,
    claim_text: v.string(),
    earliest_supported_date: v.optional(v.string()),
    latest_supported_date: v.optional(v.string()),
    continues_through_observation: v.boolean(),
    confidence: historicalClaimConfidence,
    confidence_basis: v.string(),
    source_basis: historicalClaimSourceBasis,
    source_title: v.string(),
    source_reference: v.optional(v.string()),
    source_account: v.string(),
    uncertainty_note: v.optional(v.string()),
    privacy_flag: privacyFlag,
    intake_submission_key: v.string(),
  })
    .index("by_historical_claim_id", ["historical_claim_id"])
    .index("by_parent_evidence_draft_id", ["parent_evidence_draft_id"])
    .index("by_task_and_created_at", ["task_id", "created_at"])
    .index("by_task_creator_and_created_at", ["task_id", "created_by", "created_at"])
    .index("by_intake_submission_key", ["intake_submission_key"]),

  review_decisions: defineTable({
    review_decision_id: v.string(),
    task_id: v.string(),
    evidence_draft_id: v.optional(v.string()),
    reviewer_user_id: v.id("users"),
    decision_status: reviewDecisionStatus,
    decision_note: v.optional(v.string()),
    accepted_action: v.optional(v.string()),
    identity_decision: v.optional(identityDecision),
    target_year_affects: v.optional(v.array(targetYearAffect)),
    required_follow_up: v.optional(v.string()),
    agent_review_id: v.optional(v.string()),
    agent_review_agreement: v.optional(agentReviewAgreement),
    created_at: v.number(),
    updated_at: v.number(),
    decision_hash: v.optional(v.string()),
  })
    .index("by_review_decision_id", ["review_decision_id"])
    .index("by_task", ["task_id"])
    .index("by_reviewer_time", ["reviewer_user_id", "created_at"])
    .index("by_decision_status", ["decision_status"]),

  // append-only AI review artifacts (docs/portal-claude-batch-review.md).
  // one row per (claim version, prompt version); re-reviews append with a
  // higher version, never overwrite. Advisory only: no function that
  // writes here may change tasks, drafts, or review decisions.
  agent_reviews: defineTable({
    agent_review_id: v.string(),
    task_id: v.string(),
    evidence_draft_id: v.string(),
    batch_id: v.string(),
    version: v.number(),
    recommendation: agentReviewRecommendation,
    reasoning: v.string(),
    sources_checked: v.array(agentSourceCheck),
    cultural_sensitivity: v.object({
      flagged: v.boolean(),
      basis: v.optional(v.string()),
    }),
    agent_name: v.string(),
    model_provider: v.string(),
    model_name: v.string(),
    source_check_model: v.optional(v.string()),
    prompt_version: v.string(),
    actor_user_id: v.id("users"),
    ai_generated: v.literal(true),
    created_at: v.number(),
  })
    .index("by_agent_review_id", ["agent_review_id"])
    .index("by_task", ["task_id"])
    .index("by_draft", ["evidence_draft_id"])
    .index("by_batch", ["batch_id"]),

  // run manifest per batch invocation: the ratified bulk-lane controls
  // (caps, trigger, counts) made inspectable.
  agent_review_batches: defineTable({
    batch_id: v.string(),
    trigger: v.union(v.literal("jb_cli"), v.literal("cron")),
    country_code: v.optional(v.string()),
    prompt_version: v.string(),
    model_name: v.string(),
    source_check_model: v.string(),
    max_items: v.number(),
    status: agentReviewBatchStatus,
    reviewed_count: v.number(),
    skipped_existing_count: v.number(),
    deferred_cultural_count: v.number(),
    failed_count: v.number(),
    error_notes: v.optional(v.array(v.string())),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
  })
    .index("by_batch_id", ["batch_id"])
    .index("by_started", ["started_at"]),

  export_batches: defineTable({
    export_batch_id: v.string(),
    country_code: v.string(),
    status: exportBatchStatus,
    created_by: v.id("users"),
    created_at: v.number(),
    frozen_at: v.optional(v.number()),
    exported_at: v.optional(v.number()),
    included_task_ids: v.array(v.string()),
    included_review_decision_ids: v.array(v.string()),
    schema_version: v.string(),
    export_format: exportFormat,
    output_manifest: v.optional(v.any()),
    pow_validation_status: v.optional(v.union(v.literal("not_run"), v.literal("passed"), v.literal("failed"))),
    notes: v.optional(v.string()),
  })
    .index("by_export_batch_id", ["export_batch_id"])
    .index("by_country_status", ["country_code", "status"])
    .index("by_created_time", ["created_at"]),
});
