import assert from "node:assert/strict";
import test from "node:test";
import { assertEvidenceDraftSubmission } from "./limits.ts";

const validDraft = {
  observation_contract_version: "guided_observation_v1",
  source_title: "Local sign observation",
  evidence_note: "The sign displays an exact denomination label.",
  denomination_or_tradition_raw: "Example Fellowship",
  denomination_label_basis: "displayed_sign_or_notice",
  denomination_relation: "label_only",
  action: "denomination_or_shared_use",
  source_type: "other",
  source_url_or_file: "https://example.org/source",
};

test("guided denomination evidence passes when the raw label and both dimensions are present", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission(validDraft, false));
});

test("label basis cannot be submitted without an exact raw label", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, denomination_or_tradition_raw: "" }, false),
    /label basis requires/,
  );
});

test("denomination relation cannot be submitted without an exact raw label", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, denomination_or_tradition_raw: "", denomination_label_basis: "unknown" }, false),
    /relation requires/,
  );
});

test("an unresolved denomination lead may use an uncertainty explanation instead of a label", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({
    observation_contract_version: "guided_observation_v1",
    action: "denomination_or_shared_use",
    denomination_label_basis: "unknown",
    denomination_relation: "uncertain",
    evidence_note: "Checked the available sign.",
    uncertainty_note: "The wording is unreadable and needs a local follow-up.",
  }, true));
});

test("legacy drafts retain their earlier submission contract", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ source_type: "other" }, false));
});

test("legacy revisions may preserve empty guided defaults without reclassification", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({
    source_type: "other",
    denomination_or_tradition_raw: "",
    denomination_label_basis: "unknown",
    denomination_relation: "uncertain",
    interpretation_note: "",
    uncertainty_note: "",
  }, false));
});

test("legacy spreadsheet imports retain timestamp and generic date-summary compatibility", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({
    source_type: "other",
    source_date_or_capture_date: "2026-08-25T03:38:13.597Z",
    lifecycle_note: "Target-year evidence from the legacy wide row.",
    evidence_note: "Legacy spreadsheet evidence note.",
  }, false));
});

test("legacy spreadsheet denomination actions remain importable without guided fields", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({
    source_type: "organisation_website",
    action: "denomination_or_shared_use",
    evidence_note: "Legacy spreadsheet denomination evidence note.",
  }, false));
});

test("unknown observation contracts are rejected", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ observation_contract_version: "future_contract" }, false),
    /not supported/,
  );
});

test("guided fields cannot bypass validation by omitting the contract", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ denomination_or_tradition_raw: "Example Fellowship" }, false),
    /require the guided observation contract/,
  );
});

test("a denomination correction cannot also be classed as genuine change", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, denomination_relation: "record_correction", change_class: "genuine_change" }, false),
    /cannot also be classed as a genuine change/,
  );
});

test("a possible historical denomination change cannot also be classed as a map correction", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, denomination_relation: "historical_change", change_class: "map_correction" }, false),
    /cannot also be classed as a map correction/,
  );
});

test("provisional denomination relations require an uncertain change class", () => {
  for (const denomination_relation of ["label_only", "shared_or_concurrent_use", "uncertain"]) {
    assert.throws(
      () => assertEvidenceDraftSubmission({ ...validDraft, denomination_relation, change_class: "genuine_change" }, false),
      /requires an uncertain change class/,
    );
  }
});

test("the denomination matrix applies even when another portal action is selected", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, action: "confirm_current_record", change_class: "genuine_change" }, false),
    /requires an uncertain change class/,
  );
});

test("a field observation cannot be used as evidence for a different target year", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({
      observation_contract_version: "guided_observation_v1",
      source_title: "Field visit",
      source_type: "field_observation",
      source_date_or_capture_date: "2026-08-25",
      evidence_note: "The sign was visible during the visit.",
      target_year_statuses: { "2020": "present", "2026": "present" },
    }, false),
    /mark 2020 not assessed/,
  );
});

test("a field observation may support its observation year", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({
    observation_contract_version: "guided_observation_v1",
    source_title: "Field visit",
    source_type: "field_observation",
    source_date_or_capture_date: "2026-08-25",
    evidence_note: "The sign was visible during the visit.",
    target_year_statuses: { "2020": "not_assessed", "2026": "present" },
  }, false));
});

test("a guided non-field submission requires a source reference", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, source_url_or_file: "" }, false),
    /source URL or agreed file reference/,
  );
});

test("a field observation rejects text that merely begins with a year", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({
      observation_contract_version: "guided_observation_v1",
      source_title: "Field visit",
      source_type: "field_observation",
      source_date_or_capture_date: "2026-garbage",
      evidence_note: "The sign was visible during the visit.",
      target_year_statuses: { "2023": "not_assessed" },
    }, false),
    /Use YYYY, YYYY-MM, or YYYY-MM-DD/,
  );
});

test("any supplied source date must use the partial-date contract", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, source_date_or_capture_date: "yesterday" }, false),
    /Use YYYY, YYYY-MM, or YYYY-MM-DD for source and capture dates/,
  );
});

test("lifecycle details require a valid event, date, and precision", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, lifecycle_date: "2020" }, false),
    /Choose a lifecycle event/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, lifecycle_event: "site_opened", lifecycle_date_precision: "year" }, false),
    /requires a date or bounded date/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, lifecycle_event: "site_opened", lifecycle_date: "2020", lifecycle_date_precision: "roughly" }, false),
    /recognised date precision/,
  );
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ ...validDraft, lifecycle_event: "site_opened", lifecycle_date: "2020", lifecycle_date_precision: "year" }, false));
});

test("guided text caps match the focused browser fields", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, evidence_note: "x".repeat(2_001) }, false),
    /direct observation is too long/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, interpretation_note: "x".repeat(1_001) }, false),
    /interpretation is too long/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validDraft, uncertainty_note: "x".repeat(2_001) }, false),
    /uncertainty or follow-up is too long/,
  );
});

const rapidCurrentDraft = {
  observation_contract_version: "rapid_current_v1",
  source_type: "field_observation",
  source_title: "RA field observation",
  source_date_or_capture_date: "2026-08-26",
  action: "confirm_current_record",
  change_class: "uncertain",
  target_year_statuses: {
    "1989": "not_assessed",
    "1999": "not_assessed",
    "2009": "not_assessed",
    "2020": "not_assessed",
  },
  existence_status: "present",
  worship_use_status: "confirmed_worship",
  current_observation_status: "currently_used_for_worship",
  current_observation_basis: "direct_field_observation",
};

test("rapid current observations leave Vanuatu historical target years unassessed", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission(rapidCurrentDraft, false));
  assert.throws(
    () => assertEvidenceDraftSubmission({
      ...rapidCurrentDraft,
      target_year_statuses: { ...rapidCurrentDraft.target_year_statuses, "2020": "present" },
    }, false),
    /cannot assess historical target years/,
  );
});

test("rapid current observations require an exact valid observation date", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...rapidCurrentDraft, source_date_or_capture_date: "2026-02-30" }, false),
    /valid YYYY-MM-DD observation date/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...rapidCurrentDraft, source_date_or_capture_date: "2100-01-01" }, false),
    /cannot use a future observation date/,
  );
});

test("an uncertain rapid observation requires an uncertainty account", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({
      ...rapidCurrentDraft,
      current_observation_status: "could_not_determine",
      action: "needs_review",
      existence_status: "uncertain",
      worship_use_status: "uncertain",
    }, false),
    /Explain what remains uncertain/,
  );
});

test("named-source rapid observations require title and reference", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({
      ...rapidCurrentDraft,
      source_type: "other",
      source_title: "",
      current_observation_basis: "named_public_source",
    }, false),
    /requires its title/,
  );
});

test("rapid denomination wording with unknown provenance is accepted (jb 2026-09-01)", () => {
  assert.doesNotThrow(
    () => assertEvidenceDraftSubmission({
      ...rapidCurrentDraft,
      denomination_or_tradition_raw: "Example Fellowship",
      denomination_label_basis: "unknown",
    }, false),
  );
});

test("per-year confidence requires an assessed status for that year", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({
      ...rapidCurrentDraft,
      target_year_statuses: { "2023": "not_assessed" },
      target_year_confidence: { "2023": "high" },
    }, false),
    /Confidence for 2023 requires an assessed status/,
  );
});

const validRapidDraft = {
  observation_contract_version: "rapid_current_v1",
  current_observation_status: "place_exists_worship_uncertain",
  current_observation_basis: "direct_field_observation",
  source_type: "field_observation",
  source_title: "RA field observation",
  source_date_or_capture_date: "2026-08-20",
  action: "needs_review",
  existence_status: "present",
  worship_use_status: "uncertain",
  target_year_statuses: { "1989": "not_assessed", "2020": "not_assessed" },
};

test("a consistent rapid draft passes submission validation", () => {
  assert.doesNotThrow(() => assertEvidenceDraftSubmission(validRapidDraft, false));
});

test("a rapid draft whose derived fields contradict its status is rejected", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validRapidDraft, worship_use_status: "confirmed_worship" }, false),
    /does not follow from status/,
  );
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validRapidDraft, action: "confirm_current_record" }, false),
    /does not follow from status/,
  );
});

test("a rapid draft cannot assess historical target years", () => {
  assert.throws(
    () => assertEvidenceDraftSubmission({ ...validRapidDraft, target_year_statuses: { "2020": "present" } }, false),
    /cannot assess historical target years/,
  );
});
