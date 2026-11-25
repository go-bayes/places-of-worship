// merge-review repairs to stage 1 of the deep-time dates (pull request #240):
// the write paths, against the in-memory handler harness. each test names the
// review finding it covers
import assert from "node:assert/strict";
import test from "node:test";

import { world } from "./testing/exportWorld.node-test.mjs";

const evidence = await import("./evidence.ts");
const batchImport = await import("./batchImport.ts");
const { sourceClaimKey } = await import("./lib/sources.ts");

const VU = { country_code: "VU", target_years: [1989, 1999, 2009, 2020], geometry: { type: "Point", coordinates: [168.32, -17.74] } };

// a guided record from a directory, with a lifecycle date; no real place
function guided(overrides = {}) {
  return {
    observation_contract_version: "guided_observation_v1",
    source_type: "denominational_directory",
    source_title: "Mission yearbook",
    source_url_or_file: "https://example.org/yearbook",
    action: "confirm_current_record",
    evidence_note: "The yearbook records the founding of the station.",
    lifecycle_event: "first_seen",
    lifecycle_date: "1700",
    lifecycle_date_precision: "year",
    privacy_flag: "clear",
    licence_flag: "needs_review",
    ...overrides,
  };
}

async function setup() {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const curator = await w.addUser("curator-subject", ["curator"]);
  const service = await w.addUser("service-subject", ["service"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const task = await w.addTask({ task_id: "task-vu-1", ...VU, assigned_to: ra._id });
  return { w, ra, curator, service, reviewer, task };
}

const save = (w, user, draftId, draft) => evidence.saveEvidenceDraftHandler(w.as(user), { taskId: "task-vu-1", evidenceDraftId: draftId, draft });

test("finding 1: a changed date drops its confirmation, so a restored date needs a new one", async () => {
  const { w, ra, curator } = await setup();
  await save(w, ra, "d1", guided({ lifecycle_date: "1700" }));
  await save(w, curator, "d1", guided({ lifecycle_date: "1590", confirmed_dates: [{ date: "1590", confirmed_by: "curator" }] }));
  assert.deepEqual(w.row("evidence_drafts", "evidence_draft_id", "d1").confirmed_dates, [{ date: "1590", confirmed_by: "curator" }]);
  await save(w, ra, "d1", guided({ lifecycle_date: "1591" }));
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "d1").confirmed_dates, undefined, "the 1590 entry leaves with the 1590 date");
  await save(w, ra, "d1", guided({ lifecycle_date: "1590" }));
  await assert.rejects(evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" }), /lifecycle date 1590 is earlier than 1600/);
});

test("finding 1: an unchanged confirmed date keeps its confirmation through an edit of another field", async () => {
  const { w, ra, curator } = await setup();
  await save(w, ra, "d1", guided({ lifecycle_date: "1700" }));
  await save(w, curator, "d1", guided({ lifecycle_date: "1590", confirmed_dates: [{ date: "1590", confirmed_by: "curator" }] }));
  await save(w, ra, "d1", guided({ lifecycle_date: "1590", evidence_note: "The yearbook records the station's founding." }));
  assert.deepEqual(w.row("evidence_drafts", "evidence_draft_id", "d1").confirmed_dates, [{ date: "1590", confirmed_by: "curator" }]);
  await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" });
});

test("finding 1: a saved list must match the record as saved", async () => {
  const { w, ra } = await setup();
  await assert.rejects(save(w, ra, "d1", guided({ confirmed_dates: [{ date: "9999", confirmed_by: "contributor" }] })), /matches no date in this record/);
});

test("finding 1: a reviewer's edit of a submitted record meets the date rules before it is versioned", async () => {
  const { w, ra, reviewer } = await setup();
  await save(w, ra, "d1", guided());
  await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" });
  const versions = w.rows.evidence_versions.length;
  await assert.rejects(save(w, reviewer, "d1", guided({ confirmed_dates: [{ date: "9999", confirmed_by: "contributor" }] })), /matches no date in this record/);
  await assert.rejects(save(w, reviewer, "d1", guided({ lifecycle_date: "1590" })), /lifecycle date 1590 is earlier than 1600/);
  assert.equal(w.rows.evidence_versions.length, versions);
});

function spreadsheet(w, user, drafts) {
  return evidence.importSubmittedEvidenceDrafts._handler(w.as(user), {
    batch: { batch_id: "sheet-1", country_code: "VU", source_kind: "spreadsheet_submission", target_years: VU.target_years },
    tasks: [],
    drafts,
  });
}

test("finding 1: a spreadsheet re-import does not keep a confirmation its row no longer carries", async () => {
  const { w, service } = await setup();
  await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: guided({ lifecycle_date: "1590", confirmed_dates: [{ date: "1590", confirmed_by: "curator" }] }) }]);
  await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: guided({ lifecycle_date: "1700" }) }]);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "s1").confirmed_dates, undefined);
});

test("finding 2: a fresh unversioned spreadsheet submission meets the lifecycle floor", async () => {
  const { w, service } = await setup();
  const legacy = guided({ lifecycle_date: "1590" });
  delete legacy.observation_contract_version;
  await assert.rejects(spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s2", draft: legacy }]), /lifecycle date 1590 is earlier than 1600/);
});

test("finding 4: a final spreadsheet row is skipped before the new date rules", async () => {
  const { w, service } = await setup();
  await w.addDraft({ evidence_draft_id: "s3", task_id: "task-vu-1", draft_status: "accepted_for_export", created_by: service._id });
  const result = await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s3", draft: guided({ lifecycle_date: "1590" }) }]);
  assert.equal(result.drafts.skipped_final, 1);
});

test("finding 4: an exact retry of a receipted submission answers from its receipt", async () => {
  const { w, ra } = await setup();
  await save(w, ra, "d1", guided());
  const first = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1", clientSubmissionId: "11111111-1111-4111-8111-111111111111" });
  // the stored record carries a date the new rules refuse, as a record committed before them can
  await w.db.patch(w.row("evidence_drafts", "evidence_draft_id", "d1")._id, { lifecycle_date: "1590" });
  const retry = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1", clientSubmissionId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, first.evidence_version_hash);
});

test("finding 4: a guided retry under its submission key answers before the new date rules", async () => {
  const { w, ra } = await setup();
  const key = `${ra._id}:22222222-2222-4222-8222-222222222222`;
  await w.addDraft({ ...guided({ lifecycle_date: "1590" }), evidence_draft_id: "g1", task_id: "task-vu-1", draft_status: "submitted", created_by: ra._id, guided_submission_key: key });
  const retry = await evidence.submitEvidenceDraftWithOccupanciesHandler(w.as(ra), { evidenceDraftId: "g1", clientSubmissionId: "22222222-2222-4222-8222-222222222222", segments: [] });
  assert.equal(retry.deduped, true);
});

const importSource = { source_type: "other", title: "Mission atlas", url_or_file: "https://example.org/atlas", consulted_date: "2026-09-01" };
const nominationRow = (overrides = {}) => ({ row_number: 1, name: "Mission station", country_code: "VU", source_locator: "entry 1", containing_area: "Efate", culturally_sensitive: "no", claim_hash: "h1", ...overrides });

function nominate(w, user, rows, source = importSource) {
  return batchImport.importNominationBatch._handler(w.as(user), { batchId: "nom-1", countryCode: "VU", targetYears: VU.target_years, source, rows });
}

test("finding 3: a nomination accepts a confirmation only for a date it stores as a date", async () => {
  const { w, curator } = await setup();
  const result = await nominate(w, curator, [nominationRow({ last_date: "1590", confirmed_dates: ["1590"] })]);
  assert.equal(result.rejected, 1);
  assert.match(result.row_reports[0].problems.join(" "), /1590/);
});

test("finding 3: a nomination below the floor needs the curator's confirmation", async () => {
  const { w, curator } = await setup();
  const refused = await nominate(w, curator, [nominationRow({ first_date: "1590" })]);
  assert.equal(refused.rejected, 1);
  assert.match(refused.row_reports[0].problems.join(" "), /earlier than 1600/);
  const confirmed = await nominate(w, curator, [nominationRow({ row_number: 2, source_locator: "entry 2", claim_hash: "h2", first_date: "1590", confirmed_dates: ["1590"] })]);
  assert.equal(confirmed.imported, 1);
  assert.deepEqual(w.row("evidence_drafts", "source_locator", "entry 2").confirmed_dates, [{ date: "1590", confirmed_by: "curator" }]);
});

test("finding 3: an invalid consulted date stays in the register and does not become the evidence date", async () => {
  const { w, curator } = await setup();
  const result = await nominate(w, curator, [nominationRow()], { ...importSource, consulted_date: "0000-01-01" });
  assert.equal(result.imported, 1);
  assert.equal(w.row("evidence_drafts", "source_locator", "entry 1").source_date_or_capture_date, undefined);
  assert.equal(w.rows.sources[0].consulted_date, "0000-01-01");
});

test("finding 4: a nomination already imported is skipped before the new date rules", async () => {
  const { w, curator } = await setup();
  await w.addDraft({ evidence_draft_id: "earlier", task_id: "task-vu-1", source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1", created_by: curator._id });
  const result = await nominate(w, curator, [nominationRow({ last_date: "1920-02-30" })]);
  assert.equal(result.skipped_existing, 1);
});

const occupancyRow = (overrides = {}) => ({
  ...nominationRow(),
  lat: -17.74,
  lng: 168.32,
  geocoding_basis: "map_georeference",
  start_mode: "known",
  start_date: "1890",
  start_basis: "founding_stated",
  end_mode: "still_active",
  still_active_asof: "2010",
  ...overrides,
});

async function importOccupancy(w, rows) {
  await w.db.patch(w.rows.users.find((u) => u.auth_subject === "service-subject")._id, { email: "service@example.org" });
  return batchImport.adminImportOccupancyBatch._handler(w.anonymous(), { actor_email: "service@example.org", batchId: "occ-1", countryCode: "VU", source: importSource, rows });
}

test("finding 3: an occupancy row whose first date is below the floor is a rejected row, not a failed batch", async () => {
  const { w } = await setup();
  const result = await importOccupancy(w, [occupancyRow({ first_date: "1590" }), occupancyRow({ row_number: 2, source_locator: "entry 2", claim_hash: "h2" })]);
  assert.equal(result.rejected, 1);
  assert.equal(result.imported, 1);
  assert.match(result.row_reports.find((r) => r.row_number === 1).problems.join(" "), /earlier than 1600/);
  const confirmed = await importOccupancy(w, [occupancyRow({ row_number: 3, source_locator: "entry 3", claim_hash: "h3", first_date: "1590", confirmed_dates: ["1590"] })]);
  assert.equal(confirmed.imported, 1);
});

test("finding 4: an occupancy place already imported is skipped before the new date rules", async () => {
  const { w, service } = await setup();
  await w.addDraft({ evidence_draft_id: "earlier", task_id: "task-vu-1", source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1", created_by: service._id });
  const result = await importOccupancy(w, [occupancyRow({ last_date: "1920-02-30" })]);
  assert.equal(result.skipped_existing, 1);
});

test("finding 5: a claim compiled from a confirmed chain date carries that confirmation", async () => {
  const { w, ra } = await setup();
  await save(w, ra, "c1", guided({ source_date_or_capture_date: "2016-07", lifecycle_event: undefined, lifecycle_date: undefined, lifecycle_date_precision: undefined }));
  const confirm = [{ date: "0597", confirmed_by: "contributor" }];
  const segment = {
    contract_version: "occupancy_v1",
    segment_index: 0,
    start_mode: "known",
    start_date: "0597",
    start_basis: "founding_stated",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2016-07",
    location_relation: "same_as_task_point",
    confidence: "moderate",
    confidence_basis: "The yearbook gives the founding.",
    source_basis: "named_public_source",
    source_title: "Mission yearbook",
    source_reference: "https://example.org/yearbook",
    source_account: "The yearbook gives the founding of the station in 597.",
    privacy_flag: "clear",
    confirmed_dates: confirm,
  };
  const chain = { contract_version: "function_chain_v1", start: { label: "Mission church", date: { mode: "known", date: "0597" } }, changes: [], confirmed_dates: confirm };
  await evidence.submitEvidenceDraftWithOccupanciesHandler(w.as(ra), { evidenceDraftId: "c1", clientSubmissionId: "33333333-3333-4333-8333-333333333333", segments: [segment], chain });
  const claims = w.rows.historical_claims.filter((row) => row.chain_id !== undefined);
  assert.ok(claims.length > 0);
  assert.deepEqual(claims[0].confirmed_dates, confirm);
});
