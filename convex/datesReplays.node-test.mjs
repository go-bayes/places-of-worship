// replays across the write routes of convex/ that can receive content already
// stored, for stage 1 of the deep-time dates (pull request #240). the rule
// under test: every date check main makes stays, on every write; the checks
// stage 1 adds apply to a date field only on a record's first submission, or
// when the write sets or changes that field's value. each stored record here
// carries a date the added checks refuse for a fresh write (a Vanuatu
// lifecycle date of 1590, a New Zealand claim from 1590, an observation in
// 0920). every test passes on main and on the change's head with the same
// outcome. the receipt routes of submissionReceipts.ts and the two agent
// intakes keep their own replay tests in their suites
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
  const record = {
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
  for (const [key, value] of Object.entries(record)) if (value === undefined) delete record[key];
  return record;
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

// a record as an earlier submission left it, with or without an evidence version
async function seed(w, author, draftId, status, { hash = true, overrides = {}, idempotencyKey } = {}) {
  const row = await w.addDraft({ ...stored(overrides), evidence_draft_id: draftId, task_id: "task-vu-1", draft_status: status, created_by: author._id });
  // a key given as undefined is absent from the stored row, whatever the harness defaults
  for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete row[key];
  if (!hash) return { row, version: null };
  const version = await recordEvidenceVersion(w.as(author), { draftRowId: row._id, actor: author, kind: "submitted", now: Date.now(), idempotencyKey });
  return { row, version };
}
const draft = (w, draftId) => w.row("evidence_drafts", "evidence_draft_id", draftId);

function spreadsheet(w, user, drafts) {
  return evidence.importSubmittedEvidenceDrafts._handler(w.as(user), {
    batch: { batch_id: "sheet-1", country_code: "VU", source_kind: "spreadsheet_submission", target_years: VU.target_years },
    tasks: [],
    drafts,
  });
}
const saveAs = (w, user, draftId, content) => evidence.saveEvidenceDraftHandler(w.as(user), { taskId: "task-vu-1", evidenceDraftId: draftId, draft: content });

// the third review's inputs (findings 4, 10 and 11)

test("review finding 4: exact replays of older records keep main's outcome", async () => {
  const { w, ra, reviewer, service } = await setup();
  await seed(w, service, "s1", "submitted", { hash: false });
  assert.equal((await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: stored() }])).drafts.updated, 1);
  await seed(w, ra, "u1", "unresolved_note", { hash: false, overrides: { uncertainty_note: "The founding year needs a second source." } });
  const note = await evidence.submitUnresolvedNote._handler(w.as(ra), { evidenceDraftId: "u1" });
  assert.match(note.evidence_version_hash, /^sha256:[0-9a-f]{64}$/);
  const { version } = await seed(w, service, "t1", "submitted", { overrides: { observation_contract_version: undefined, source_type: "field_observation", source_date_or_capture_date: "2020-01-01T12:34:56Z" } });
  await saveAs(w, reviewer, "t1", {});
  assert.equal(draft(w, "t1").evidence_version_hash, version.object_hash);
  assert.equal(draft(w, "t1").observation_contract_version, undefined);
});

test("review finding 10: a spreadsheet re-import that changes the record meets main's date check", async () => {
  const { w, service } = await setup();
  await seed(w, service, "s1", "submitted", { overrides: { privacy_flag: "restricted", source_date_or_capture_date: "2020-02-30" } });
  const versions = w.rows.evidence_versions.length;
  await assert.rejects(spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: stored({ privacy_flag: undefined, source_date_or_capture_date: "2020-02-30" }) }]), /source and capture dates|source or capture date/);
  assert.equal(w.rows.evidence_versions.length, versions);
  assert.equal(draft(w, "s1").privacy_flag, "restricted");
});

test("review finding 11: an unchanged resubmission keeps main's date check", async () => {
  const { w, ra } = await setup();
  // as a reviewer's edit before stage 1 could leave it
  await seed(w, ra, "d1", "submitted", { overrides: { source_date_or_capture_date: "2020-02-30" } });
  await assert.rejects(evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" }), /source and capture dates|source or capture date/);
});

// per route: an unchanged write to a submitted record without a version
// hash, the same with a hash, and a write that changes a non-date field
// while a stored date would fail the added checks

for (const hash of [false, true]) {
  test(`evidence:saveEvidenceDraft — a reviewer's unchanged save of a submitted record ${hash ? "with" : "without"} a version`, async () => {
    const { w, ra, reviewer } = await setup();
    const { version } = await seed(w, ra, "d1", "submitted", { hash });
    await saveAs(w, reviewer, "d1", stored());
    assert.equal(draft(w, "d1").lifecycle_date, "1590");
    if (hash) assert.equal(draft(w, "d1").evidence_version_hash, version.object_hash);
  });
  test(`evidence:importSubmittedEvidenceDrafts — an exact re-import ${hash ? "with" : "without"} a version`, async () => {
    const { w, service } = await setup();
    await seed(w, service, "s1", "submitted", { hash });
    assert.equal((await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: stored() }])).drafts.updated, 1);
  });
  test(`evidence:submitEvidenceDraft — an unchanged resubmission ${hash ? "with" : "without"} a version`, async () => {
    const { w, ra } = await setup();
    await seed(w, ra, "d1", "submitted", { hash });
    const again = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" });
    assert.match(again.evidence_version_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(again.deduped, hash);
  });
  test(`evidence:submitEvidenceDraftWithOccupancies — a retry under its own key ${hash ? "with" : "without"} a version`, async () => {
    const { w, ra } = await setup();
    const { row } = await seed(w, ra, "g1", "submitted", { hash });
    await w.db.patch(row._id, { guided_submission_key: `${ra._id}:${id(2)}` });
    const retry = await evidence.submitEvidenceDraftWithOccupanciesHandler(w.as(ra), { evidenceDraftId: "g1", clientSubmissionId: id(2), segments: [] });
    assert.equal(retry.deduped, true);
  });
  test(`evidence:submitUnresolvedNote — an unchanged note ${hash ? "with" : "without"} a version`, async () => {
    const { w, ra } = await setup();
    const { version } = await seed(w, ra, "u1", "unresolved_note", { hash, overrides: { uncertainty_note: "The founding year needs a second source." } });
    const again = await evidence.submitUnresolvedNote._handler(w.as(ra), { evidenceDraftId: "u1" });
    if (hash) assert.equal(again.evidence_version_hash, version.object_hash);
  });
}

test("evidence:saveEvidenceDraft — a reviewer's change to a non-date field", async () => {
  const { w, ra, reviewer } = await setup();
  await seed(w, ra, "d1", "submitted");
  const versions = w.rows.evidence_versions.length;
  await saveAs(w, reviewer, "d1", stored({ evidence_note: "The yearbook records the station's founding." }));
  assert.equal(w.rows.evidence_versions.length, versions + 1);
});

test("evidence:importSubmittedEvidenceDrafts — a re-import that changes a non-date field", async () => {
  const { w, service } = await setup();
  await seed(w, service, "s1", "submitted");
  assert.equal((await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: stored({ source_title: "Mission yearbook, second edition" }) }])).drafts.updated, 1);
});

test("evidence:submitEvidenceDraft — a resubmission after a reviewer changed a non-date field", async () => {
  const { w, ra } = await setup();
  const { row } = await seed(w, ra, "d1", "submitted");
  await w.db.patch(row._id, { evidence_note: "The yearbook records the station's founding." });
  const again = await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" });
  assert.equal(again.deduped, false);
});

test("evidence:submitEvidenceDraftWithOccupancies — a retry under its own key after a non-date field changed", async () => {
  const { w, ra } = await setup();
  const { row } = await seed(w, ra, "g1", "submitted");
  await w.db.patch(row._id, { guided_submission_key: `${ra._id}:${id(2)}`, evidence_note: "The yearbook records the station's founding." });
  assert.equal((await evidence.submitEvidenceDraftWithOccupanciesHandler(w.as(ra), { evidenceDraftId: "g1", clientSubmissionId: id(2), segments: [] })).deduped, true);
});

test("evidence:submitUnresolvedNote — a note resubmitted after a non-date field changed", async () => {
  const { w, ra } = await setup();
  const { row, version } = await seed(w, ra, "u1", "unresolved_note", { overrides: { uncertainty_note: "The founding year needs a second source." } });
  await w.db.patch(row._id, { uncertainty_note: "The founding year needs a second, independent source." });
  const again = await evidence.submitUnresolvedNote._handler(w.as(ra), { evidenceDraftId: "u1" });
  assert.notEqual(again.evidence_version_hash, version.object_hash);
});

const claim = (overrides = {}) => ({
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
  ...overrides,
});

for (const changed of [false, true]) {
  const note = changed ? "with a non-date field changed" : "unchanged";
  test(`historicalClaims:submitHistoricalClaim — a retry under its own key, ${note}`, async () => {
    const { w, ra } = await setup();
    await w.db.insert("historical_claims", { ...claim(), historical_claim_id: "h1", task_id: "task-vu-1", parent_evidence_draft_id: "d1", claim_status: "submitted", contract_version: "historical_claim_v1", created_by: ra._id, created_at: 1, updated_at: 1, reference_date: "2016-07", reference_date_basis: "parent_evidence_date", intake_submission_key: `${ra._id}:${id(3)}` });
    const retry = await historical.submitHistoricalClaimHandler(w.as(ra), { clientSubmissionId: id(3), taskId: "task-vu-1", parentEvidenceDraftId: "d1", claim: claim(changed ? { claim_text: "Worship at the mission station." } : {}) });
    assert.equal(retry.deduped, true);
  });
  test(`occupancies:submitOccupancies — a retry under its own key, ${note}`, async () => {
    const { w, ra } = await setup();
    await w.db.insert("site_occupancies", { occupancy_id: "o1", task_id: "task-vu-1", parent_evidence_draft_id: "d1", claim_status: "submitted", submission_key: `${ra._id}:${id(4)}`, segment_index: 0, created_by: ra._id });
    const segment = { contract_version: "occupancy_v1", segment_index: 0, start_mode: "known", start_date: "1590", start_basis: "founding_stated", end_mode: "unknown", end_basis: "unknown", location_relation: "same_as_task_point", confidence: "moderate", confidence_basis: "Yearbook.", source_basis: "named_public_source", source_title: "Mission yearbook", source_account: changed ? "The yearbook gives the station's founding in 1590." : "The yearbook gives the founding in 1590.", privacy_flag: "clear" };
    const retry = await periods.submitOccupanciesHandler(w.as(ra), { clientSubmissionId: id(4), taskId: "task-vu-1", parentEvidenceDraftId: "d1", segments: [segment] });
    assert.equal(retry.deduped, true);
  });
  test(`rapidEntry:submitCurrentObservation — a retry under its own key, ${note}`, async () => {
    const { w, ra } = await setup();
    await w.addDraft({ ...stored(), evidence_draft_id: "r1", task_id: "task-vu-1", draft_status: "submitted", created_by: ra._id, intake_submission_key: `${ra._id}:${id(5)}` });
    const observation = { current_status: "currently_used_for_worship", observation_basis: "local_investigator_account", observed_on: "0920-05-01", direct_observation: changed ? "Seen in use on a Sunday." : "Seen in use.", privacy_flag: "clear" };
    const retry = await rapidEntry.submitCurrentObservationHandler(w.as(ra), { clientSubmissionId: id(5), taskId: "task-vu-1", observation });
    assert.equal(retry.deduped, true);
  });
}

const importSource = { source_type: "other", title: "Mission atlas", url_or_file: "https://example.org/atlas", consulted_date: "2026-09-01" };
const nominationRow = (overrides = {}) => ({ row_number: 1, name: "Mission station", country_code: "VU", source_locator: "entry 1", containing_area: "Efate", culturally_sensitive: "no", claim_hash: "h1", first_date: "1590", last_date: "1920-02-30", ...overrides });

for (const [hash, changed] of [[false, false], [true, false], [true, true]]) {
  const note = `${hash ? "with" : "without"} a version${changed ? ", a non-date field changed" : ""}`;
  test(`batchImport:importNominationBatch — a row already imported, ${note}`, async () => {
    const { w, curator } = await setup();
    await seed(w, curator, "earlier", "submitted", { hash, overrides: { source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1" } });
    const result = await batchImport.importNominationBatch._handler(w.as(curator), { batchId: "nom-1", countryCode: "VU", targetYears: VU.target_years, source: importSource, rows: [nominationRow(changed ? { notes: "Founding year from the atlas." } : {})] });
    assert.equal(result.skipped_existing, 1);
  });
  test(`batchImport:adminImportOccupancyBatch — a place already imported, ${note}`, async () => {
    const { w, service } = await setup();
    await w.db.patch(service._id, { email: "service@example.org" });
    await seed(w, service, "earlier", "submitted", { hash, overrides: { source_claim_key: sourceClaimKey(importSource.title, "entry 1"), claim_hash: "h1" } });
    const row = { ...nominationRow(changed ? { notes: "Founding year from the atlas." } : {}), lat: -17.74, lng: 168.32, geocoding_basis: "map_georeference", start_mode: "known", start_date: "1590", start_basis: "founding_stated", end_mode: "still_active", still_active_asof: "2010" };
    const result = await batchImport.adminImportOccupancyBatch._handler(w.anonymous(), { actor_email: "service@example.org", batchId: "occ-1", countryCode: "VU", source: importSource, rows: [row] });
    assert.equal(result.skipped_existing, 1);
  });
}
