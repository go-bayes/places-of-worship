import { v } from "convex/values";

export const projectRole = v.union(
  v.literal("ra"),
  v.literal("reviewer"),
  v.literal("curator"),
  v.literal("admin"),
  v.literal("service"),
);

export const userStatus = v.union(
  v.literal("active"),
  v.literal("disabled"),
  v.literal("pending"),
);

// keep in step with the taskStatus validator below; used for per-status
// indexed loops
export const taskStatusValues = [
  "open",
  "in_progress",
  "draft_saved",
  "skipped",
  "provisionally_closed",
  "needs_review",
  "unresolved_note",
  "changes_requested",
  "reviewed",
  "exported",
  "reopened",
] as const;

export const taskStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("draft_saved"),
  v.literal("skipped"),
  v.literal("provisionally_closed"),
  v.literal("needs_review"),
  v.literal("unresolved_note"),
  v.literal("changes_requested"),
  v.literal("reviewed"),
  v.literal("exported"),
  v.literal("reopened"),
);

export const taskPriority = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export const taskType = v.union(
  v.literal("verify_existing_site"),
  v.literal("missing_from_project_map"),
  v.literal("possible_duplicate"),
  v.literal("target_year_status"),
  v.literal("lifecycle_date_needed"),
  v.literal("denomination_or_shared_use"),
  v.literal("geometry_check"),
  v.literal("osm_identity_link"),
  v.literal("other"),
);

export const taskBatchSourceKind = v.union(
  v.literal("static_map_import"),
  v.literal("osm_refresh"),
  v.literal("spreadsheet_submission"),
  v.literal("ra_nomination"),
  v.literal("manual_curator"),
  v.literal("system_check"),
);

export const taskBatchStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("frozen"),
  v.literal("exported"),
  v.literal("archived"),
);

export const taskEventType = v.union(
  v.literal("imported"),
  v.literal("opened"),
  v.literal("claimed"),
  v.literal("unclaimed"),
  v.literal("draft_saved"),
  v.literal("row_copied"),
  v.literal("skipped"),
  v.literal("submitted_for_review"),
  v.literal("submitted_unresolved_note"),
  v.literal("provisionally_closed"),
  v.literal("review_started"),
  v.literal("review_decided"),
  v.literal("changes_requested"),
  v.literal("reopened"),
  v.literal("exported"),
  v.literal("note_added"),
  v.literal("draft_withdrawn"),
);

export const evidenceDraftStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("unresolved_note"),
  v.literal("superseded"),
  v.literal("withdrawn"),
  v.literal("accepted_for_export"),
  v.literal("rejected"),
);

export const privacyFlag = v.union(
  v.literal("clear"),
  v.literal("needs_review"),
  v.literal("restricted"),
);

export const licenceFlag = v.union(
  v.literal("clear"),
  v.literal("needs_review"),
  v.literal("restricted"),
);

export const targetYearStatus = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("uncertain"),
  v.literal("not_assessed"),
);

export const reviewDecisionStatus = v.union(
  v.literal("accepted_for_export"),
  v.literal("rejected"),
  v.literal("needs_more_evidence"),
  v.literal("duplicate_task"),
  v.literal("deferred"),
);

// distinguishes real-world gain/loss of a place of worship from correction
// of the map record; drives the annual census change accounting
export const changeClass = v.union(
  v.literal("genuine_change"),
  v.literal("map_correction"),
  v.literal("uncertain"),
);

export const denominationLabelBasis = v.union(
  v.literal("named_documentary_source"),
  v.literal("displayed_sign_or_notice"),
  v.literal("current_self_description"),
  v.literal("local_investigator_account"),
  v.literal("unknown"),
);

// describe the claim's relation to the project record separately from who supplied the label
export const denominationRelation = v.union(
  v.literal("label_only"),
  v.literal("record_correction"),
  v.literal("historical_change"),
  v.literal("shared_or_concurrent_use"),
  v.literal("uncertain"),
);

export const currentObservationStatus = v.union(
  v.literal("currently_used_for_worship"),
  v.literal("place_exists_worship_uncertain"),
  v.literal("place_exists_not_used_for_worship"),
  v.literal("could_not_determine"),
);

export const currentObservationBasis = v.union(
  v.literal("direct_field_observation"),
  v.literal("local_investigator_account"),
  v.literal("named_public_source"),
  v.literal("other"),
);

export const locationAssertionContractVersion = v.literal("location_assertion_v1");

export const locationAssertionMode = v.union(
  v.literal("building_identified"),
  v.literal("approximate_area"),
);

export const locationAssertionBasis = v.union(
  v.literal("map_placement"),
  v.literal("address_or_locality"),
  v.literal("named_source_description"),
  v.literal("local_investigator_account"),
  v.literal("other"),
);

export const locationAssertionConfidence = v.union(
  v.literal("high"),
  v.literal("moderate"),
  v.literal("low"),
  v.literal("uncertain"),
);

export const locationAssertionInput = v.object({
  contract_version: locationAssertionContractVersion,
  mode: locationAssertionMode,
  basis: locationAssertionBasis,
  latitude: v.number(),
  longitude: v.number(),
  uncertainty_radius_m: v.optional(v.number()),
  source_wording: v.optional(v.string()),
  confidence: locationAssertionConfidence,
  contributor_confirmed: v.literal(true),
});

export const historicalClaimContractVersion = v.literal("historical_claim_v1");

export const historicalClaimStatus = v.union(
  v.literal("submitted"),
  v.literal("superseded"),
  v.literal("withdrawn"),
);

export const historicalClaimKind = v.union(
  v.literal("structure"),
  v.literal("worship_function"),
  v.literal("denomination_or_affiliation"),
  v.literal("leadership"),
  v.literal("shared_use"),
  v.literal("other"),
);

export const historicalClaimTiming = v.union(
  v.literal("event"),
  v.literal("state"),
);

export const historicalClaimConfidence = v.union(
  v.literal("high"),
  v.literal("moderate"),
  v.literal("low"),
  v.literal("uncertain"),
);

export const historicalClaimSourceBasis = v.union(
  v.literal("inscription_or_document_observed"),
  v.literal("local_investigator_account"),
  v.literal("named_public_source"),
  v.literal("other"),
);

export const historicalClaimReferenceDateBasis = v.union(
  v.literal("parent_evidence_date"),
  v.literal("claim_recorded_date"),
);

export const observationContractVersion = v.union(
  v.literal("guided_observation_v1"),
  v.literal("rapid_current_v1"),
);

export const identityDecision = v.union(
  v.literal("same_site"),
  v.literal("new_candidate"),
  v.literal("duplicate"),
  v.literal("split"),
  v.literal("merge"),
  v.literal("relocation"),
  v.literal("uncertain"),
);

export const exportBatchStatus = v.union(
  v.literal("draft"),
  v.literal("frozen"),
  v.literal("exported"),
  v.literal("validated"),
  v.literal("failed"),
  v.literal("archived"),
);

export const exportFormat = v.union(
  v.literal("site_evidence_wide_csv"),
  v.literal("change_events_jsonl"),
  v.literal("review_decisions_jsonl"),
  v.literal("bundle"),
);

export const sourceType = v.union(
  v.literal("official_register"),
  v.literal("denominational_directory"),
  v.literal("charity_register"),
  v.literal("charities_register"),
  v.literal("incorporated_societies"),
  v.literal("historic_map"),
  v.literal("aerial_or_street_imagery"),
  v.literal("street_imagery"),
  v.literal("aerial_imagery"),
  v.literal("field_observation"),
  v.literal("osm"),
  v.literal("osm_history"),
  v.literal("osm_date_tags"),
  v.literal("archived_website"),
  v.literal("local_council"),
  v.literal("heritage_list"),
  v.literal("linz_building_outlines"),
  v.literal("linz_property"),
  v.literal("news_or_web"),
  v.literal("other"),
);

export const targetYearStatusSet = v.record(v.string(), targetYearStatus);

// per-year confidence in the recorded status; only assessed years carry one
export const targetYearConfidence = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export const targetYearConfidenceSet = v.record(v.string(), targetYearConfidence);

export const targetYearEvidenceSet = v.record(v.string(), v.string());

export const targetYearAffect = v.object({
  target_year: v.number(),
  previous_target_year_status: v.optional(targetYearStatus),
  target_year_status: targetYearStatus,
  basis: v.optional(v.string()),
});

export const automatedCheck = v.object({
  check_id: v.string(),
  severity: v.optional(v.string()),
  message: v.string(),
  suggested_action: v.optional(v.string()),
});

export const nearbySiteRef = v.object({
  site_id: v.optional(v.string()),
  task_id: v.optional(v.string()),
  name: v.optional(v.string()),
  distance_m: v.optional(v.number()),
});

export const taskBatchInput = v.object({
  batch_id: v.string(),
  country_code: v.string(),
  source_kind: taskBatchSourceKind,
  source_manifest_id: v.optional(v.string()),
  target_years: v.array(v.number()),
  status: v.optional(taskBatchStatus),
  notes: v.optional(v.string()),
});

export const taskInput = v.object({
  task_id: v.string(),
  batch_id: v.string(),
  country_code: v.string(),
  task_type: taskType,
  priority: taskPriority,
  status: v.optional(taskStatus),
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
});

export const evidenceDraftInput = v.object({
  observation_contract_version: v.optional(observationContractVersion),
  source_type: v.optional(sourceType),
  provider: v.optional(v.string()),
  source_title: v.optional(v.string()),
  source_url_or_file: v.optional(v.string()),
  source_date_or_capture_date: v.optional(v.string()),
  source_id: v.optional(v.string()),
  source_locator: v.optional(v.string()),
  address_raw: v.optional(v.string()),
  locality_raw: v.optional(v.string()),
  address_change_note: v.optional(v.string()),
  source_notes: v.optional(v.string()),
  action: v.optional(v.string()),
  change_class: v.optional(changeClass),
  target_year_statuses: v.optional(targetYearStatusSet),
  target_year_confidence: v.optional(targetYearConfidenceSet),
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
  generated_wide_row: v.optional(v.any()),
  privacy_flag: v.optional(privacyFlag),
  licence_flag: v.optional(licenceFlag),
  validation_summary: v.optional(v.any()),
});

export const rapidCurrentObservationInput = v.object({
  current_status: currentObservationStatus,
  observation_basis: currentObservationBasis,
  observed_on: v.string(),
  source_title: v.optional(v.string()),
  source_reference: v.optional(v.string()),
  source_id: v.optional(v.string()),
  source_locator: v.optional(v.string()),
  denomination_or_tradition_raw: v.optional(v.string()),
  denomination_label_basis: v.optional(denominationLabelBasis),
  direct_observation: v.optional(v.string()),
  uncertainty_note: v.optional(v.string()),
  privacy_flag: privacyFlag,
});

export const historicalClaimInput = v.object({
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
});

// batch-review lane (docs/portal-claude-batch-review.md): AI review
// artifacts are advisory annotations on the queue; they never change a
// task, draft, or decision. Humans decide; Claude recommends.
export const agentReviewRecommendation = v.union(
  v.literal("accept"),
  v.literal("revise"),
  v.literal("reject"),
  v.literal("defer_cultural"),
);

// per-source verification record: what was checked, how, and what the
// check found. An unchecked source is recorded as unchecked, never
// silently passed (JB attribution directive, 2026-07-07).
export const agentSourceCheck = v.object({
  source_title: v.optional(v.string()),
  url_or_file: v.optional(v.string()),
  check: v.union(
    v.literal("existence"),
    v.literal("date_support"),
    v.literal("location_plausibility"),
  ),
  method: v.union(
    v.literal("http_fetch"),
    v.literal("model_assessment"),
    v.literal("not_checked"),
  ),
  outcome: v.union(
    v.literal("supported"),
    v.literal("not_supported"),
    v.literal("unclear"),
    v.literal("unreachable"),
    v.literal("requires_human_access"),
  ),
  note: v.optional(v.string()),
});

export const agentReviewAgreement = v.union(
  v.literal("followed"),
  v.literal("disagreed"),
  v.literal("not_considered"),
);

export const agentReviewBatchStatus = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

export const reviewDecisionInput = v.object({
  evidence_draft_id: v.optional(v.string()),
  decision_status: reviewDecisionStatus,
  decision_note: v.optional(v.string()),
  accepted_action: v.optional(v.string()),
  identity_decision: v.optional(identityDecision),
  target_year_affects: v.optional(v.array(targetYearAffect)),
  required_follow_up: v.optional(v.string()),
  agent_review_id: v.optional(v.string()),
  agent_review_agreement: v.optional(agentReviewAgreement),
});
