import assert from "node:assert/strict";
import test from "node:test";
import { world } from "./testing/exportWorld.node-test.mjs";
const { getReviewSnapshot, recordReviewDecision, batchRecordReviewDecisions, assertDecisionSnapshotConsistent } = await import("./reviews.ts");
const { listJudgmentsForTaskPlace } = await import("./agentJudgments.ts");
const { canonicalJson, sha256 } = await import("./lib/sha256.ts");

async function scene() {
  const w = world();
  w.rows.agent_judgments = [];
  w.rows.judgment_dispositions = [];
  const reviewer = await w.addUser("reviewer", ["reviewer"]);
  const task = await w.addTask({ task_id: "t", status: "needs_review", osm_object_type: "way", matched_osm_id: "1001" });
  const draft = await w.addDraft({ evidence_draft_id: "d", task_id: "t", draft_status: "submitted", created_by: "another-user" });
  await w.db.insert("agent_judgments", { judgment_id: "j", subject_ref: "osm:way/1001", outcome: "screened", created_at: 1 });
  await w.db.insert("agent_judgments", { judgment_id: "other", subject_ref: "osm:way/9999", outcome: "review", created_at: 2 });
  const ctx = w.as(reviewer);
  const args = { taskId: "t", evidenceDraftId: "d" };
  const decision = { evidence_draft_id: "d", decision_status: "accepted_for_export", decision_note: "Checked the evidence and displayed judgments." };
  return { ...w, ctx, task, draft, args, decision };
}
async function decide(w, snapshot, batch, include = true) {
  if (batch) return batchRecordReviewDecisions._handler(w.ctx, { items: [{ task_id: "t", evidence_draft_id: "d", snapshot_hash: snapshot.snapshot_hash, include_judgments: include, decision: w.decision }] });
  return recordReviewDecision._handler(w.ctx, { taskId: "t", snapshotHash: snapshot.snapshot_hash, includeJudgments: include, decision: w.decision });
}

test("omitting the optional binding retains the historical snapshot input, even with judgments", async () => {
  const w = await scene();
  const legacy = await getReviewSnapshot._handler(w.ctx, w.args);
  assert.equal("recorded_judgments" in legacy.snapshot, false);
  assert.equal("base_snapshot_hash" in legacy, false);
  assert.equal("displayed_judgments" in legacy, false);
  const bound = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
  const { recorded_judgments, ...oldInput } = bound.snapshot;
  assert.equal(sha256(canonicalJson(oldInput)), legacy.snapshot_hash);
  assert.equal(bound.base_snapshot_hash, legacy.snapshot_hash);
  assert.deepEqual(bound.displayed_judgments, await listJudgmentsForTaskPlace._handler(w.ctx, { taskId: "t" }));
  assert.deepEqual(recorded_judgments, [{ judgment_id: "j", created_at: 1, dispositions: [] }]);
  assert.equal("displayed_judgments" in bound.snapshot, false);
  assert.equal(sha256(canonicalJson(bound.snapshot)), bound.snapshot_hash);
  assert.deepEqual(recorded_judgments.map((row) => row.judgment_id), ["j"]);
  assert.notEqual(bound.snapshot_hash, legacy.snapshot_hash);
  await recordReviewDecision._handler(w.ctx, { taskId: "t", snapshotHash: legacy.snapshot_hash, decision: w.decision });
  assert.equal(w.rows.review_decisions[0].decision_hash_version, 1);
});

test("new judgments and dispositions invalidate opted-in snapshots on both decision routes", async () => {
  for (const batch of [false, true]) for (const change of ["judgment", "disposition", "note"]) {
    const w = await scene();
    if (change === "note") await w.db.insert("judgment_dispositions", { disposition_id: "disp", judgment_id: "j", reviewer_user_id: "reviewer", disposition: "agreed", note: "before", created_at: 3 });
    const before = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
    if (change === "judgment") await w.db.insert("agent_judgments", { judgment_id: "j2", subject_ref: "osm:way/1001", outcome: "review", created_at: 4 });
    else if (change === "disposition") await w.db.insert("judgment_dispositions", { disposition_id: "disp", judgment_id: "j", reviewer_user_id: "reviewer", disposition: "agreed", created_at: 3 });
    else w.rows.judgment_dispositions[0].note = "after";
    const after = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
    assert.equal(after.base_snapshot_hash, before.base_snapshot_hash);
    assert.notEqual(after.snapshot_hash, before.snapshot_hash);
    await assert.rejects(decide(w, before, batch), /stale/);
    assert.equal(w.rows.review_decisions.length, 0);
    await decide(w, after, batch);
    assert.equal(w.rows.review_decisions[0].review_snapshot_hash, after.snapshot_hash);
    assert.deepEqual(JSON.parse(w.rows.review_snapshots[0].snapshot_json).recorded_judgments, after.snapshot.recorded_judgments);
    await assertDecisionSnapshotConsistent(w.ctx, w.rows.review_decisions[0]);
  }
});

test("an opted-in hash cannot be submitted through the legacy path", async () => {
  const w = await scene();
  const bound = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
  await assert.rejects(decide(w, bound, false, false), /stale/);
});

test("many large displayed rows stay well below the snapshot cap on both decision routes", async () => {
  for (const batch of [false, true]) {
    const w = await scene();
    w.rows.agent_judgments = [];
    const empty = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
    assert.deepEqual(empty.snapshot.recorded_judgments, []);
    assert.deepEqual(empty.displayed_judgments, []);
    for (let i = 0; i < 200; i += 1) {
      const judgment_id = sha256(`judgment-${i}`);
      await w.db.insert("agent_judgments", { judgment_id, subject_ref: "osm:way/1001", basis_note: "x".repeat(4000), score: { signal_values: { tag_count: 9 } }, created_at: i });
      await w.db.insert("judgment_dispositions", { disposition_id: sha256(`disposition-${i}`), judgment_id, reviewer_user_id: "reviewer", disposition: "agreed", note: "Checked the source.", created_at: i });
    }
    await assert.rejects(decide(w, empty, false), /stale/);
    const large = await getReviewSnapshot._handler(w.ctx, { ...w.args, includeJudgments: true });
    assert.equal(large.displayed_judgments.length, 200);
    assert.ok(Buffer.byteLength(canonicalJson(large.displayed_judgments)) > 128 * 1024);
    assert.ok(Buffer.byteLength(canonicalJson(large.snapshot)) < 80 * 1024);
    for (const binding of large.snapshot.recorded_judgments) {
      assert.deepEqual(Object.keys(binding), ["judgment_id", "created_at", "dispositions"]);
      assert.deepEqual(Object.keys(binding.dispositions[0]), ["disposition_id", "reviewer_user_id", "disposition", "note", "created_at"]);
    }
    await decide(w, large, batch);
    assert.deepEqual(JSON.parse(w.rows.review_snapshots[0].snapshot_json).recorded_judgments, large.snapshot.recorded_judgments);
  }
});
