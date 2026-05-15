import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  automatedCheck,
  evidenceDraftStatus,
  exportBatchStatus,
  exportFormat,
  identityDecision,
  licenceFlag,
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
    evidence_note: v.optional(v.string()),
    generated_wide_row: v.optional(v.any()),
    privacy_flag: privacyFlag,
    licence_flag: licenceFlag,
    validation_summary: v.optional(v.any()),
  })
    .index("by_evidence_draft_id", ["evidence_draft_id"])
    .index("by_task_status", ["task_id", "draft_status"])
    .index("by_creator_time", ["created_by", "updated_at"])
    .index("by_source_url", ["source_url_or_file"]),

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
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_review_decision_id", ["review_decision_id"])
    .index("by_task", ["task_id"])
    .index("by_reviewer_time", ["reviewer_user_id", "created_at"])
    .index("by_decision_status", ["decision_status"]),

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
