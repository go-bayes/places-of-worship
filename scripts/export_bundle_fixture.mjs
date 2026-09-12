// Builds or checks the golden fixture bundle for pow-export-bundle.v1
// (docs/development/frozen-exports.md): the real TypeScript freeze and
// retrieval pipeline (convex/exports.ts's prepareFreeze/completeFreeze,
// through the real freezeExportBatch and getExportBundle actions) is run
// once, through the shared in-memory harness in
// convex/testing/exportWorld.node-test.mjs, and the sixteen files
// getExportBundle serves are written byte for byte to
// schemas/fixtures/pow-export-bundle.v1/. `pow export verify` (crates/pow-cli)
// checks the same directory in Rust, so this fixture pins the two
// languages' agreement on the contract.
//
//   node scripts/export_bundle_fixture.mjs --write
//   node scripts/export_bundle_fixture.mjs --check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { world, draftContent, fakeStorage, actionCtx } from "../convex/testing/exportWorld.node-test.mjs";

// the exportWorld module registers the extensionless-import resolve hook,
// the fixed clock, and the rate limiter stub as import-time side effects, so
// every dynamic import below (and everything they import transitively)
// resolves and runs deterministically
const { submitEvidenceDraft } = await import("../convex/evidence.ts");
const { submitOccupancies, decideDerivedYear } = await import("../convex/occupancies.ts");
const { recordReviewDecision, getReviewSnapshot } = await import("../convex/reviews.ts");
const { recordAcceptance } = await import("../convex/acceptances.ts");
const { createExportBatch, freezeExportBatch, getExportBundle } = await import("../convex/exports.ts");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(repoRoot, "schemas/fixtures/pow-export-bundle.v1");

// an invented occupancy segment; no real place or person. Spans every VU
// target year (1989, 1999, 2009, 2020) so the derived per-year tables are
// non-empty in the fixture.
const occupancySegment = {
  contract_version: "occupancy_v1",
  segment_index: 0,
  start_mode: "known",
  start_date: "1985",
  start_basis: "founding_stated",
  end_mode: "known",
  end_date: "2020-12",
  end_basis: "closure_stated",
  end_reason: "closed",
  location_relation: "same_as_task_point",
  confidence: "high",
  confidence_basis: "The dated directory entry was read directly.",
  source_basis: "named_public_source",
  source_title: "Diocesan directory 2016",
  source_reference: "https://example.org/directory/2016",
  source_account: "The directory records worship use through 2020.",
  privacy_flag: "clear",
};

// scenario 1 of docs/development/frozen-exports-brief-2026-09-12.md section 9:
// one VU task, a submitted guided draft with an occupancy set and a
// confirmed derived location, a snapshot-linked accepted decision, a PI
// acceptance, a frozen export batch, and the bytes getExportBundle serves.
async function buildBundleFiles() {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const pi = await w.addUser("pi-subject", ["pi"]);
  const admin = await w.addUser("admin-subject", ["admin"]);

  await w.addTask({
    task_id: "task_1",
    country_code: "VU",
    status: "in_progress",
    target_years: [1989, 1999, 2009, 2020],
  });
  await w.addDraft({
    evidence_draft_id: "task_1:draft_a",
    task_id: "task_1",
    created_by: ra._id,
    // the occupancy segment below runs through 2020-12, which must not be
    // later than the evidence's own reference date
    ...draftContent({ source_date_or_capture_date: "2021-06" }),
  });

  await submitEvidenceDraft._handler(w.as(ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(ra), {
    clientSubmissionId: "11111111-1111-4111-8111-000000000001",
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [occupancySegment],
  });
  await decideDerivedYear._handler(w.as(reviewer), {
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    targetYear: 1999,
    action: "confirm",
  });

  const snapshot = await getReviewSnapshot._handler(w.as(reviewer), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
  });
  await recordReviewDecision._handler(w.as(reviewer), {
    taskId: "task_1",
    decision: {
      evidence_draft_id: "task_1:draft_a",
      decision_status: "accepted_for_export",
      decision_note: "Checked the directory entry and the confirmed 1999 location for the fixture bundle.",
    },
    snapshotHash: snapshot.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(pi), {
    taskId: "task_1",
    outcome: "accepted",
    note: "Ratifying the reviewer's decision for the fixture bundle.",
  });

  const batch = await createExportBatch._handler(w.as(admin), { countryCode: "VU", taskIds: ["task_1"] });
  const storage = fakeStorage();
  const frozen = await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: batch.export_batch_id });
  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: batch.export_batch_id });

  if (frozen.status !== "frozen" || bundle.disposition.stored_bytes !== true || bundle.disposition.verified !== true) {
    throw new Error("the fixture batch did not freeze and verify as expected; refusing to write a bundle");
  }

  return bundle.files;
}

// getExportBundle's flat keys, in the order the manifest's own `files[]`
// lists them (export_manifest.json first, then alphabetical)
const FILE_NAMES = {
  export_manifest_json: "export_manifest.json",
  derived_state_events_jsonl: "derived_state_events.jsonl",
  derived_target_year_functions_jsonl: "derived_target_year_functions.jsonl",
  derived_target_year_states_jsonl: "derived_target_year_states.jsonl",
  derived_year_locations_jsonl: "derived_year_locations.jsonl",
  evidence_drafts_jsonl: "evidence_drafts.jsonl",
  evidence_head_changes_jsonl: "evidence_head_changes.jsonl",
  evidence_versions_jsonl: "evidence_versions.jsonl",
  historical_claims_jsonl: "historical_claims.jsonl",
  review_decisions_jsonl: "review_decisions.jsonl",
  review_snapshots_jsonl: "review_snapshots.jsonl",
  site_evidence_wide_csv: "site_evidence_wide.csv",
  site_occupancies_jsonl: "site_occupancies.jsonl",
  task_acceptances_jsonl: "task_acceptances.jsonl",
  task_events_jsonl: "task_events.jsonl",
  tasks_jsonl: "tasks.jsonl",
};

const files = await buildBundleFiles();
const rendered = new Map();
for (const [key, filename] of Object.entries(FILE_NAMES)) {
  const text = files[key];
  if (typeof text !== "string") {
    throw new Error(`getExportBundle did not return a files.${key} string.`);
  }
  rendered.set(filename, text);
}

if (process.argv.includes("--write")) {
  fs.mkdirSync(fixtureDir, { recursive: true });
  // the directory holds exactly the served files and nothing else; drop any
  // file an earlier version of this script wrote that the bundle no longer
  // serves
  for (const existing of fs.readdirSync(fixtureDir)) {
    if (!rendered.has(existing)) fs.rmSync(path.join(fixtureDir, existing));
  }
  for (const [filename, text] of rendered) {
    fs.writeFileSync(path.join(fixtureDir, filename), text);
  }
  console.log(`wrote ${rendered.size} files to ${path.relative(repoRoot, fixtureDir)}`);
} else {
  const problems = [];
  for (const [filename, text] of rendered) {
    const filePath = path.join(fixtureDir, filename);
    if (!fs.existsSync(filePath)) {
      problems.push(`${filename} is missing`);
      continue;
    }
    if (fs.readFileSync(filePath, "utf8") !== text) {
      problems.push(`${filename} is stale`);
    }
  }
  const extra = fs.existsSync(fixtureDir)
    ? fs.readdirSync(fixtureDir).filter((name) => !rendered.has(name))
    : [];
  for (const name of extra) problems.push(`${name} is present but no longer part of the bundle`);
  if (problems.length > 0) {
    console.error(`fixture bundle is stale; run with --write (${problems.join(", ")})`);
    process.exit(1);
  }
  console.log("fixture bundle is current");
}
