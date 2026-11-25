// replays across every write route of convex/ that can receive content
// already stored, for stage 1 of the deep-time dates (pull request #240).
// each stored record here carries a date the stage 1 rules refuse for a fresh
// write (a Vanuatu lifecycle date of 1590, a New Zealand claim from 1590, an
// observation in 0920); a replay must answer as it did before the change.
// these tests pass on main and on the change's head. the receipt-based routes
// of submissionReceipts.ts, internalAgentIntake:ingestBundle and
// firstPassReceipts:ingestFirstPass are covered by their own suites
import assert from "node:assert/strict";
import test from "node:test";

import { world } from "./testing/exportWorld.node-test.mjs";

const evidence = await import("./evidence.ts");
const historical = await import("./historicalClaims.ts");
const periods = await import("./occupancies.ts");
const rapidEntry = await import("./rapidEntry.ts");
const batchImport = await import("./batchImport.ts");
const { recordEvidenceVersion } = await import("./evidenceVersions.ts");
const { sourceClaimKey } = await import("./lib/sources.ts");

const VU = { country_code: "VU", target_years: [1989, 1999, 2009, 2020], geometry: { type: "Point", coordinates: [168.32, -17.74] } };
const id = (n) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;

function stored(overrides = {}) {
  return {
    observation_contract_version: "guided_observation_v1",
    source_type: "denominational_directory",
    source_title: "Mission yearbook",
    source_url_or_file: "https://example.org/yearbook",
    action: "confirm_current_record",
    evidence_note: "The yearbook records the founding of the station.",
    lifecycle_event: "first_seen",
    lifecycle_date: "1590",
    lifecycle_date_precision: "year",
    privacy_flag: "clear",
    licence_flag: "needs_review",
    ...overrides,
  };
}

async function setup() {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const service = await w.addUser("service-subject", ["service"]);
  const curator = await w.addUser("curator-subject", ["curator"]);
  await w.addTask({ task_id: "task-vu-1", ...VU, status: "needs_review" });
  return { w, ra, reviewer, service, curator };
}

// a stored record with its evidence version, as a submission before the change left it
async function versioned(w, author, draftId, status, overrides = {}, idempotencyKey) {
  const row = await w.addDraft({ ...stored(overrides), evidence_draft_id: draftId, task_id: "task-vu-1", draft_status: status, created_by: author._id });
  const version = await recordEvidenceVersion(w.as(author), { draftRowId: row._id, actor: author, kind: "submitted", now: Date.now(), idempotencyKey });
  return { row, version };
}

test("evidence:saveEvidenceDraft — a reviewer's save of a submitted record's own content", async () => {
  const { w, ra, reviewer } = await setup();
  const { version } = await versioned(w, ra, "d1", "submitted");
  const versions = w.rows.evidence_versions.length;
  await evidence.saveEvidenceDraftHandler(w.as(reviewer), { taskId: "task-vu-1", evidenceDraftId: "d1", draft: stored() });
  assert.equal(w.rows.evidence_versions.length, versions);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "d1").evidence_version_hash, version.object_hash);
});

function spreadsheet(w, user, drafts) {
  return evidence.importSubmittedEvidenceDrafts._handler(w.as(user), {
    batch: { batch_id: "sheet-1", country_code: "VU", source_kind: "spreadsheet_submission", target_years: VU.target_years },
    tasks: [],
    drafts,
  });
}

test("evidence:importSubmittedEvidenceDrafts — an exact re-import of a submitted row, and a decided row", async () => {
  const { w, service } = await setup();
  const { version } = await versioned(w, service, "s1", "submitted");
  const result = await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: stored() }]);
  assert.equal(result.drafts.updated, 1);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "s1").evidence_version_hash, version.object_hash);
  await versioned(w, service, "s2", "accepted_for_export");
  assert.equal((await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s2", draft: stored() }])).drafts.skipped_final, 1);
});

test("evidence:submitEvidenceDraft — a receipted retry, and an unchanged resubmission", async () => {
  const { w, ra } = await setup();
  const { version } = await versioned(w, ra, "d1", "submitted", {}, `submit:${ra._id}:${id(1)}`);
  const retry = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1", clientSubmissionId: id(1) });
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, version.object_hash);
  const { version: second } = await versioned(w, ra, "d2", "submitted");
  const again = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d2" });
  assert.equal(again.deduped, true);
  assert.equal(again.evidence_version_hash, second.object_hash);
});

test("evidence:submitEvidenceDraftWithOccupancies — a retry under its own submission key", async () => {
  const { w, ra } = await setup();
  await w.addDraft({ ...stored(), evidence_draft_id: "g1", task_id: "task-vu-1", draft_status: "submitted", created_by: ra._id, guided_submission_key: `${ra._id}:${id(2)}` });
  const retry = await evidence.submitEvidenceDraftWithOccupanciesHandler(w.as(ra), { evidenceDraftId: "g1", clientSubmissionId: id(2), segments: [] });
  assert.equal(retry.deduped, true);
});

test("evidence:submitUnresolvedNote — an unchanged unresolved note", async () => {
  const { w, ra } = await setup();
  const { version } = await versioned(w, ra, "u1", "unresolved_note", { uncertainty_note: "The founding year needs a second source." });
  const again = await evidence.submitUnresolvedNote._handler(w.as(ra), { evidenceDraftId: "u1" });
  assert.equal(again.evidence_version_hash, version.object_hash);
});

const claim = {
  claim_kind: "worship_function",
  claim_timing: "state",
  claim_text: "Worship at the station.",
  earliest_supported_date: "1590",
  continues_through_observation: false,
  latest_supported_date: "1600",
  confidence: "moderate",
  confidence_basis: "The yearbook gives the years.",
  source_basis: "named_public_source",
  source_title: "Mission yearbook",
  source_reference: "https://example.org/yearbook",
  source_account: "The yearbook gives worship from 1590.",
  privacy_flag: "clear",
};

test("historicalClaims:submitHistoricalClaim — a retry under its own submission key", async () => {
  const { w, ra } = await setup();
  await w.db.insert("historical_claims", { ...claim, historical_claim_id: "h1", task_id: "task-vu-1", parent_evidence_draft_id: "d1", claim_status: "submitted", contract_version: "historical_claim_v1", created_by: ra._id, created_at: 1, updated_at: 1, reference_date: "2016-07", reference_date_basis: "parent_evidence_date", intake_submission_key: `${ra._id}:${id(3)}` });
  const retry = await historical.submitHistoricalClaimHandler(w.as(ra), { clientSubmissionId: id(3), taskId: "task-vu-1", parentEvidenceDraftId: "d1", claim: { ...claim, earliest_supported_date: "1500" } });
  assert.equal(retry.deduped, true);
});

test("occupancies:submitOccupancies — a retry under its own submission key", async () => {
  const { w, ra } = await setup();
  await w.db.insert("site_occupancies", { occupancy_id: "o1", task_id: "task-vu-1", parent_evidence_draft_id: "d1", claim_status: "submitted", submission_key: `${ra._id}:${id(4)}`, segment_index: 0, created_by: ra._id });
  const segment = { contract_version: "occupancy_v1", segment_index: 0, start_mode: "known", start_date: "1590", start_basis: "founding_stated", end_mode: "unknown", end_basis: "unknown", location_relation: "same_as_task_point", confidence: "moderate", confidence_basis: "Yearbook.", source_basis: "named_public_source", source_title: "Mission yearbook", source_account: "The yearbook gives the founding in 1590.", privacy_flag: "clear" };
  const retry = await periods.submitOccupanciesHandler(w.as(ra), { clientSubmissionId: id(4), taskId: "task-vu-1", parentEvidenceDraftId: "d1", segments: [segment] });
  assert.equal(retry.deduped, true);
});

test("rapidEntry:submitCurrentObservation — a retry under its own submission key", async () => {
  const { w, ra } = await setup();
  await w.addDraft({ ...stored(), evidence_draft_id: "r1", task_id: "task-vu-1", draft_status: "submitted", created_by: ra._id, intake_submission_key: `${ra._id}:${id(5)}` });
  const observation = { current_status: "currently_used_for_worship", observation_basis: "local_investigator_account", observed_on: "0920-05-01", direct_observation: "Seen in use.", privacy_flag: "clear" };
  const retry = await rapidEntry.submitCurrentObservationHandler(w.as(ra), { clientSubmissionId: id(5), taskId: "task-vu-1", observation });
  assert.equal(retry.deduped, true);
});

const importSource = { source_type: "other", title: "Mission atlas", url_or_file: "https://example.org/atlas", consulted_date: "2026-09-01" };
const nominationRow = (overrides = {}) => ({ row_number: 1, name: "Mission station", country_code: "VU", source_locator: "entry 1", containing_area: "Efate", culturally_sensitive: "no", claim_hash: "h1", ...overrides });

test("batchImport:importNominationBatch — a row already imported", async () => {
  const { w, curator } = await setup();
  await w.addDraft({ evidence_draft_id: "earlier", task_id: "task-vu-1", source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1", created_by: curator._id });
  const result = await batchImport.importNominationBatch._handler(w.as(curator), { batchId: "nom-1", countryCode: "VU", targetYears: VU.target_years, source: importSource, rows: [nominationRow({ first_date: "1590", last_date: "1920-02-30" })] });
  assert.equal(result.skipped_existing, 1);
});

test("batchImport:adminImportOccupancyBatch — a place already imported", async () => {
  const { w, service } = await setup();
  await w.db.patch(service._id, { email: "service@example.org" });
  await w.addDraft({ evidence_draft_id: "earlier", task_id: "task-vu-1", source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1", created_by: service._id });
  const row = { ...nominationRow({ first_date: "1590", last_date: "1920-02-30" }), lat: -17.74, lng: 168.32, geocoding_basis: "map_georeference", start_mode: "known", start_date: "1590", start_basis: "founding_stated", end_mode: "still_active", still_active_asof: "2010" };
  const result = await batchImport.adminImportOccupancyBatch._handler(w.anonymous(), { actor_email: "service@example.org", batchId: "occ-1", countryCode: "VU", source: importSource, rows: [row] });
  assert.equal(result.skipped_existing, 1);
});
