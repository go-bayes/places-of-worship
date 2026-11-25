// second merge review of pull request #240 (deep-time dates, stage 1): the
// write paths, against the in-memory handler harness. each test names the
// round 2 finding it covers
import assert from "node:assert/strict";
import test from "node:test";

import { world } from "./testing/exportWorld.node-test.mjs";

const evidence = await import("./evidence.ts");

const VU = { country_code: "VU", target_years: [1989, 1999, 2009, 2020], geometry: { type: "Point", coordinates: [168.32, -17.74] } };

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
  await w.addTask({ task_id: "task-vu-1", ...VU, assigned_to: ra._id });
  await w.addTask({ task_id: "task-cz-1", country_code: "CZ", target_years: [2021], assigned_to: ra._id });
  return { w, ra, curator, service, reviewer };
}

const save = (w, user, draftId, draft, taskId = "task-vu-1") => evidence.saveEvidenceDraftHandler(w.as(user), { taskId, evidenceDraftId: draftId, draft });

function spreadsheet(w, user, drafts) {
  return evidence.importSubmittedEvidenceDrafts._handler(w.as(user), {
    batch: { batch_id: "sheet-1", country_code: "VU", source_kind: "spreadsheet_submission", target_years: VU.target_years },
    tasks: [],
    drafts,
  });
}

test("round 2, finding 1: a confirmation does not follow its date text into another field", async () => {
  const { w, ra, curator } = await setup();
  await save(w, ra, "d1", guided());
  await save(w, curator, "d1", guided({ lifecycle_date: "0731", confirmed_dates: [{ date: "0731", confirmed_by: "curator" }] }));
  await save(w, ra, "d1", guided({ lifecycle_date: "1700", source_date_or_capture_date: "0731" }));
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "d1").confirmed_dates, undefined);
  await assert.rejects(evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" }), /source or capture date 0731 is earlier than 1000/);
});

test("round 2, finding 1: a source date whose purpose changes loses its confirmation", async () => {
  const { w, ra } = await setup();
  await save(w, ra, "d1", guided({ source_date_or_capture_date: "0731", confirmed_dates: [{ date: "0731", confirmed_by: "contributor" }] }));
  await save(w, ra, "d1", guided({ source_type: "street_imagery", source_date_or_capture_date: "0731" }));
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "d1").confirmed_dates, undefined);
});

test("round 2, finding 2: a partial spreadsheet update keeps and accepts its retained confirmation", async () => {
  const { w, service } = await setup();
  const legacy = guided({ lifecycle_date: "1590", confirmed_dates: [{ date: "1590", confirmed_by: "curator" }] });
  delete legacy.observation_contract_version;
  await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: legacy }]);
  const result = await spreadsheet(w, service, [{ task_id: "task-vu-1", evidence_draft_id: "s1", draft: { source_title: "Mission yearbook, second edition" } }]);
  assert.equal(result.drafts.updated, 1);
  assert.deepEqual(w.row("evidence_drafts", "evidence_draft_id", "s1").confirmed_dates, [{ date: "1590", confirmed_by: "curator" }]);
});

test("round 2, finding 3: a reviewer's edit is bound to the draft's own task", async () => {
  const { w, ra, reviewer } = await setup();
  await save(w, ra, "d1", guided());
  await evidence.submitEvidenceDraftHandler(w.as(ra), { evidenceDraftId: "d1" });
  await assert.rejects(save(w, reviewer, "d1", guided({ lifecycle_date: "1200" }), "task-cz-1"), /belongs to another task/);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "d1").lifecycle_date, "1700");
});

test("round 2, finding 5: a saved date field refuses the year 0000, and an incomplete draft still saves", async () => {
  const { w, ra } = await setup();
  await assert.rejects(save(w, ra, "d1", guided({ lifecycle_date: "0000" })), /0000/);
  await assert.rejects(save(w, ra, "d2", guided({ source_date_or_capture_date: "0000-01-01" })), /0000/);
  await save(w, ra, "d3", { source_title: "Mission yearbook", privacy_flag: "clear" });
  await save(w, ra, "d4", guided({ lifecycle_date: "15" }));
});
