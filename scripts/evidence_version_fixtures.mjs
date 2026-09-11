// builds or checks the golden fixtures for evidence-version.v1 envelopes.
// the typescript builder produces each envelope from authored inputs; the
// typescript and rust verifiers must both accept every case and refuse
// every tampered envelope.
//
//   node scripts/evidence_version_fixtures.mjs --write
//   node scripts/evidence_version_fixtures.mjs --check
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { buildEvidenceVersion, EVIDENCE_VERSION_SCHEMA } = await import("../convex/lib/evidenceVersions.ts");
const { objectHash, HASH_CONTRACT } = await import("../convex/lib/canonicalJson.ts");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "schemas/fixtures/evidence-version.v1.json");

// invented evidence for contract tests only; no real place or person
const guidedRow = {
  _id: "row_1",
  _creationTime: 1789000000000,
  evidence_draft_id: "nz-temporal-001:user_ra:draft",
  task_id: "nz-temporal-001",
  draft_status: "submitted",
  created_by: "user_ra",
  created_at: 1789000000000,
  updated_at: 1789000001000,
  observation_contract_version: "guided_observation_v1",
  source_type: "denominational_directory",
  source_title: "Diocesan directory 2016",
  source_url_or_file: "https://example.org/directory/2016",
  source_date_or_capture_date: "2016-07",
  action: "confirm_current_record",
  change_class: "no_change",
  target_year_statuses: { "2013": "present", "2018": "present", "2023": "not_assessed" },
  denomination_or_tradition_raw: "Anglican (Te Hāhi Mihinare)",
  denomination_label_basis: "source_stated",
  denomination_relation: "same",
  evidence_note: "The directory lists regular Sunday services at Ōtautahi.",
  uncertainty_note: undefined,
  privacy_flag: "clear",
  licence_flag: "needs_review",
  guided_submission_key: "user_ra:sub-0001",
  pending_occupancy_cards: undefined,
  validation_summary: { status: "server_validated" },
  function_chain: {
    contract_version: "function_chain_v1",
    start: { denomination: "Anglican", date: { kind: "year", value: "1864" } },
    events: [],
  },
};

const occupancyBase = {
  _id: "occ_row",
  _creationTime: 1789000000500,
  task_id: "nz-temporal-001",
  parent_evidence_draft_id: guidedRow.evidence_draft_id,
  claim_status: "submitted",
  submission_key: "user_ra:sub-0001",
  created_by: "user_ra",
  created_at: 1789000000500,
  updated_at: 1789000000500,
  contract_version: "occupancy_v1",
  start_mode: "date",
  start_precision: "year",
  start_basis: "source_stated",
  end_mode: "ongoing",
  end_precision: "unknown",
  end_basis: "not_applicable",
  location_relation: "same_as_task_point",
  latitude: -43.532054,
  longitude: 172.636225,
  location_mode: "building_identified",
  location_basis: "map_placement",
  location_confidence: "high",
  confidence: "high",
  confidence_basis: "Directory entry with street address.",
  source_basis: "documentary",
  source_title: "Diocesan directory 2016",
  source_account: "Listed as a parish church with weekly services.",
  privacy_flag: "clear",
};
// authored out of order so the fixture shows the builder's pre-sort
const occupancyRows = [
  { ...occupancyBase, _id: "occ_row_2", occupancy_id: "nz-temporal-001:user_ra:occupancy:sub-0001:1", segment_index: 1, start_date: "1950", start_mode: "date", end_mode: "ongoing", still_active_asof: "2016-07" },
  { ...occupancyBase, _id: "occ_row_1", occupancy_id: "nz-temporal-001:user_ra:occupancy:sub-0001:0", segment_index: 0, start_date: "1864", end_mode: "date", end_date: "1949", end_precision: "year", end_basis: "source_stated", end_reason: "relocated" },
];

const recordedAt = Date.UTC(2026, 8, 11, 4, 30, 0, 0);

const first = buildEvidenceVersion({
  task_id: "nz-temporal-001",
  evidence_draft_id: guidedRow.evidence_draft_id,
  evidence_family_id: guidedRow.evidence_draft_id,
  version_index: 1,
  version_kind: "guided_submission",
  lineage: { relation: "first" },
  actor_user_id: "user_ra",
  recorded_at_ms: recordedAt,
  evidence_row: guidedRow,
  occupancy_rows: occupancyRows,
});

const correctionRow = {
  ...guidedRow,
  _id: "row_2",
  evidence_draft_id: "nz-temporal-001:user_ra:revision:1789000005000",
  evidence_note: "The directory lists regular Sunday services at Ōtautahi; the 2013 entry was a misprint.",
  target_year_statuses: { "2013": "uncertain", "2018": "present", "2023": "not_assessed" },
  revision_of_evidence_draft_id: guidedRow.evidence_draft_id,
  revision_intent: "correction",
  guided_submission_key: "user_ra:sub-0002",
};
const correction = buildEvidenceVersion({
  task_id: "nz-temporal-001",
  evidence_draft_id: correctionRow.evidence_draft_id,
  evidence_family_id: guidedRow.evidence_draft_id,
  version_index: 2,
  version_kind: "guided_submission",
  lineage: { relation: "child", parent_object_hash: first.object_hash },
  actor_user_id: "user_ra",
  recorded_at_ms: recordedAt + 3_600_000,
  evidence_row: correctionRow,
  occupancy_rows: occupancyRows.map((row) => ({ ...row, submission_key: "user_ra:sub-0002", parent_evidence_draft_id: correctionRow.evidence_draft_id, occupancy_id: row.occupancy_id.replace("sub-0001", "sub-0002") })),
});

const reviewerEdit = buildEvidenceVersion({
  task_id: "nz-temporal-001",
  evidence_draft_id: correctionRow.evidence_draft_id,
  evidence_family_id: guidedRow.evidence_draft_id,
  version_index: 3,
  version_kind: "reviewer_derivation_decision",
  lineage: { relation: "child", parent_object_hash: correction.object_hash },
  actor_user_id: "user_reviewer",
  recorded_at_ms: recordedAt + 7_200_000,
  evidence_row: { ...correctionRow, target_year_statuses: { "2013": "uncertain", "2018": "present", "2023": "present" }, target_year_basis: { "2023": "reviewer_confirmed_derivation" } },
  occupancy_rows: occupancyRows,
});

const preContractRevision = buildEvidenceVersion({
  task_id: "nz-temporal-002",
  evidence_draft_id: "nz-temporal-002:user_ra:revision:1789000009000",
  evidence_family_id: "nz-temporal-002:user_ra:revision:1789000009000",
  version_index: 1,
  version_kind: "submitted",
  lineage: { relation: "revises_pre_contract", revises_evidence_draft_id: "nz-temporal-002:user_ra:draft" },
  actor_user_id: "user_ra",
  recorded_at_ms: recordedAt,
  evidence_row: { ...guidedRow, task_id: "nz-temporal-002", evidence_draft_id: "nz-temporal-002:user_ra:revision:1789000009000", function_chain: undefined },
  occupancy_rows: [],
});

const newObservation = buildEvidenceVersion({
  task_id: "nz-temporal-001",
  evidence_draft_id: "nz-temporal-001:user_ra:revision:1789000012000",
  evidence_family_id: "nz-temporal-001:user_ra:revision:1789000012000",
  version_index: 1,
  version_kind: "submitted",
  lineage: { relation: "follows", follows_evidence_draft_id: guidedRow.evidence_draft_id, follows_object_hash: first.object_hash },
  actor_user_id: "user_ra",
  recorded_at_ms: recordedAt + 86_400_000,
  evidence_row: { ...guidedRow, evidence_draft_id: "nz-temporal-001:user_ra:revision:1789000012000", source_title: "Site visit", source_type: "field_observation", source_date_or_capture_date: "2026-09-10", revision_of_evidence_draft_id: guidedRow.evidence_draft_id, revision_intent: "new_observation" },
  occupancy_rows: [],
});

const rapid = buildEvidenceVersion({
  task_id: "vu-port-vila-004",
  evidence_draft_id: "vu-port-vila-004:user_ra:rapid:rapid-0007",
  evidence_family_id: "vu-port-vila-004:user_ra:rapid:rapid-0007",
  version_index: 1,
  version_kind: "rapid_current_observation",
  lineage: { relation: "first" },
  actor_user_id: "user_ra",
  recorded_at_ms: recordedAt,
  evidence_row: {
    evidence_draft_id: "vu-port-vila-004:user_ra:rapid:rapid-0007",
    task_id: "vu-port-vila-004",
    draft_status: "submitted",
    created_by: "user_ra",
    created_at: recordedAt,
    updated_at: recordedAt,
    observation_contract_version: "rapid_current_v1",
    provider: "Project RA",
    source_date_or_capture_date: "2026-09-01",
    action: "confirm_current_record",
    change_class: "uncertain",
    target_year_statuses: { "2020": "present" },
    existence_status: "exists",
    worship_use_status: "in_use",
    denomination_label_basis: "unknown",
    denomination_relation: "uncertain",
    current_observation_status: "active_worship",
    current_observation_basis: "direct_observation",
    privacy_flag: "clear",
    licence_flag: "needs_review",
    validation_summary: { status: "server_validated", contract: "rapid_current_v1" },
    intake_submission_key: "user_ra:rapid-0007",
  },
  occupancy_rows: [],
});

const migration = buildEvidenceVersion({
  task_id: "nz-temporal-003",
  evidence_draft_id: "nz-temporal-003:user_ra:draft",
  evidence_family_id: "nz-temporal-003:user_ra:draft",
  version_index: 1,
  version_kind: "migration_copy",
  lineage: { relation: "first" },
  actor_user_id: "user_admin",
  recorded_at_ms: recordedAt + 172_800_000,
  evidence_row: { ...guidedRow, task_id: "nz-temporal-003", evidence_draft_id: "nz-temporal-003:user_ra:draft" },
  occupancy_rows: [],
  migration: {
    run_id: "evidence-version-migration-2026-09",
    copied_at: new Date(recordedAt + 172_800_000).toISOString(),
    source_created_by: "actor:user_ra",
    source_created_at: new Date(1789000000000).toISOString(),
    source_updated_at: new Date(1789000001000).toISOString(),
  },
});

const cases = [
  ["first_guided_submission_with_sorted_occupancies", first],
  ["child_correction_in_same_family", correction],
  ["reviewer_derivation_decision_child", reviewerEdit],
  ["revision_of_pre_contract_submission_without_invented_parent", preContractRevision],
  ["new_dated_observation_follows_earlier_family", newObservation],
  ["rapid_current_observation", rapid],
  ["migration_copy_records_run_and_copy_time", migration],
].map(([name, built]) => ({ name, envelope: built.envelope, content_hash: built.content_hash }));

function restamped(envelope, mutate) {
  const { object_hash: _hash, ...unhashed } = structuredClone(envelope);
  mutate(unhashed);
  return { ...unhashed, object_hash: objectHash(unhashed) };
}

const tampered = [
  { name: "changed_note_without_recomputed_hash", reason: "object_hash mismatch", envelope: (() => { const copy = structuredClone(first.envelope); copy.payload.evidence.evidence_note = "edited after submission"; return copy; })() },
  { name: "reordered_occupancies", reason: "payload.occupancies unsorted", envelope: restamped(first.envelope, (e) => { e.payload.occupancies.reverse(); }) },
  { name: "duplicate_occupancy_id", reason: "duplicate occupancy_id", envelope: restamped(first.envelope, (e) => { e.payload.occupancies[1].occupancy_id = e.payload.occupancies[0].occupancy_id; e.payload.occupancies[1].segment_index = 0; }) },
  { name: "unsorted_parent_hashes", reason: "parent_object_hashes unsorted", envelope: restamped(correction.envelope, (e) => { e.parent_object_hashes = [reviewerEdit.object_hash, first.object_hash].sort().reverse(); }) },
  { name: "wrong_hash_contract", reason: "hash_contract", envelope: restamped(first.envelope, (e) => { e.hash_contract = "pow-object.v0"; }) },
  { name: "wrong_schema_version", reason: "schema_version", envelope: restamped(first.envelope, (e) => { e.schema_version = "evidence-version.v2"; }) },
  { name: "recorded_at_without_milliseconds", reason: "recorded_at format", envelope: restamped(first.envelope, (e) => { e.recorded_at = "2026-09-11T04:30:00Z"; }) },
  { name: "malformed_parent_hash", reason: "parent hash format", envelope: restamped(correction.envelope, (e) => { e.parent_object_hashes = ["sha256:notahash"]; }) },
  { name: "object_hash_missing", reason: "object_hash absent", envelope: (() => { const { object_hash: _h, ...rest } = structuredClone(first.envelope); return rest; })() },
];

const built = { contract: EVIDENCE_VERSION_SCHEMA, hash_contract: HASH_CONTRACT, cases, tampered };
const rendered = `${JSON.stringify(built, null, 2)}\n`;
if (process.argv.includes("--write")) {
  fs.writeFileSync(fixturePath, rendered);
  console.log(`wrote ${cases.length} cases and ${tampered.length} tampered envelopes to ${path.relative(repoRoot, fixturePath)}`);
} else {
  if (fs.readFileSync(fixturePath, "utf8") !== rendered) {
    console.error("fixture file is stale; run with --write");
    process.exit(1);
  }
  console.log("fixtures are current");
}
