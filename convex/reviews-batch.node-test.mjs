import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { recordReviewDecision, batchRecordReviewDecisions, getReviewSnapshot, getRecordedReviewSnapshot } = await import("./reviews.ts");

function context({ intake = false, agentReview = null } = {}) {
  const user = { _id: "reviewer_1", auth_subject: "reviewer-subject", status: "active", roles: ["reviewer"] };
  const task = { _id: "task_row", task_id: "task_1", status: "needs_review", review_claimed_by: undefined, pending_reviewer_comment: undefined, extra_opinions_required: 0, geometry: { type: "Point", coordinates: [172, -43] } };
  const draft = { _id: "draft_row", evidence_draft_id: "draft_1", task_id: "task_1", draft_status: "submitted", created_by: "ra_1", pending_occupancy_cards: [], agent_intake_only: intake };
  const rows = { users: [user], tasks: [task], evidence_drafts: [draft], review_decisions: [], task_events: [], agent_reviews: agentReview === null ? [] : [agentReview], historical_claims: [], site_occupancies: [], derived_target_year_states: [], derived_year_locations: [], derived_target_year_functions: [], derived_state_events: [], review_snapshots: [] };
  const q = { eq() { return q; }, gte() { return q; } };
  const db = {
    query(table) { return { withIndex(_index, select) { if (select) select(q); return { async unique() { if (table === "users") return rows.users[0]; if (table === "tasks") return rows.tasks[0]; if (table === "evidence_drafts") return rows.evidence_drafts[0]; if (table === "agent_reviews") return rows.agent_reviews[0] ?? null; if (table === "review_snapshots") return rows.review_snapshots[0] ?? null; return null; }, async collect() { return rows[table] ?? []; }, async first() { return (rows[table] ?? [])[0] ?? null; } }; } }; },
    async insert(table, value) { rows[table].push(value); return `${table}_${rows[table].length}`; },
    async patch(_id, value) { for (const table of Object.values(rows)) { const row = table.find((candidate) => candidate._id === _id); if (row) Object.assign(row, value); } },
  };
  return { auth: { async getUserIdentity() { return { tokenIdentifier: "reviewer-subject" }; } }, db, rows, task, draft };
}

const item = (hash, status = "accepted_for_export") => ({ task_id: "task_1", evidence_draft_id: "draft_1", snapshot_hash: hash, decision: { evidence_draft_id: "draft_1", decision_status: status, decision_note: "Checked the complete dossier and sources." } });

test("batch acceptance refuses a stale snapshot before writing", async () => {
  const ctx = context();
  await assert.rejects(batchRecordReviewDecisions._handler(ctx, { items: [item("0".repeat(64))] }), /stale/);
  assert.equal(ctx.rows.review_decisions.length, 0);
  assert.equal(ctx.task.status, "needs_review");
});

test("batch acceptance succeeds with the current snapshot and records an audit hash", async () => {
  const ctx = context();
  const inspected = await getReviewSnapshot._handler(ctx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  const result = await batchRecordReviewDecisions._handler(ctx, { items: [item(inspected.snapshot_hash)] });
  assert.equal(result.count, 1);
  assert.equal(ctx.task.status, "reviewed");
  assert.equal(ctx.rows.review_decisions.length, 1);
  assert.equal(ctx.rows.review_decisions[0].review_snapshot_hash, inspected.snapshot_hash);
  assert.equal(ctx.rows.review_snapshots.length, 1);
  const recorded = await getRecordedReviewSnapshot._handler(ctx, { snapshotHash: inspected.snapshot_hash });
  ctx.task.status = "changed_after_review";
  assert.match(recorded.snapshot_json, /needs_review/);
});

test("batch acceptance refuses intake-only drafts before writing", async () => {
  const ctx = context({ intake: true });
  const inspected = await getReviewSnapshot._handler(ctx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  await assert.rejects(batchRecordReviewDecisions._handler(ctx, { items: [item(inspected.snapshot_hash)] }), /ordinary human evidence/);
  assert.equal(ctx.rows.review_decisions.length, 0);
});

test("a changed related period invalidates the inspected snapshot", async () => {
  const ctx = context();
  const inspected = await getReviewSnapshot._handler(ctx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  ctx.rows.site_occupancies.push({ _id: "period_1", task_id: "task_1", segment_index: 0, start_date: "1900" });
  await assert.rejects(batchRecordReviewDecisions._handler(ctx, { items: [item(inspected.snapshot_hash)] }), /stale/);
  assert.equal(ctx.rows.review_decisions.length, 0);
});

test("ordinary author, note, and additional-opinion gates remain active", async () => {
  const authorCtx = context(); authorCtx.draft.created_by = authorCtx.user?._id ?? "reviewer_1";
  const authorSnapshot = await getReviewSnapshot._handler(authorCtx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  await assert.rejects(batchRecordReviewDecisions._handler(authorCtx, { items: [item(authorSnapshot.snapshot_hash)] }), /submitted this evidence/);
  const noteCtx = context(); const noteSnapshot = await getReviewSnapshot._handler(noteCtx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  const short = item(noteSnapshot.snapshot_hash); short.decision.decision_note = "short";
  await assert.rejects(batchRecordReviewDecisions._handler(noteCtx, { items: [short] }), /short decision note/);
  const opinionCtx = context(); opinionCtx.task.extra_opinions_required = 1;
  const opinionSnapshot = await getReviewSnapshot._handler(opinionCtx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  await assert.rejects(batchRecordReviewDecisions._handler(opinionCtx, { items: [item(opinionSnapshot.snapshot_hash)] }), /additional opinion/);
});

test("an AI artifact from another draft cannot be attached to acceptance", async () => {
  const ctx = context({ agentReview: { agent_review_id: "agent_wrong", task_id: "task_1", evidence_draft_id: "draft_other" } });
  const inspected = await getReviewSnapshot._handler(ctx, { taskId: "task_1", evidenceDraftId: "draft_1" });
  const withWrongArtifact = item(inspected.snapshot_hash); withWrongArtifact.decision.agent_review_id = "agent_wrong"; withWrongArtifact.decision.agent_review_agreement = "followed";
  await assert.rejects(batchRecordReviewDecisions._handler(ctx, { items: [withWrongArtifact] }), /different evidence draft/);
  assert.equal(ctx.rows.review_decisions.length, 0);
});

test("batch size is bounded before any reads or writes", async () => {
  const ctx = context();
  await assert.rejects(batchRecordReviewDecisions._handler(ctx, { items: Array.from({ length: 21 }, (_, i) => item(`${i}`.padStart(64, "0"))) }), /1 to 20/);
  assert.equal(ctx.rows.review_decisions.length, 0);
});


test("individual decisions cannot bypass closed-task lifecycle gates", async () => {
  for (const status of ["reviewed", "pi_accepted", "exported"]) {
    const ctx = context(); ctx.task.status = status;
    await assert.rejects(recordReviewDecision._handler(ctx, {taskId: "task_1", decision: item("0".repeat(64)).decision}), /not open for review/);
    assert.equal(ctx.rows.review_decisions.length, 0);
    assert.equal(ctx.task.status, status);
  }
});

const { canonicalJson, sha256 } = await import("./lib/sha256.ts");

test("batch and individual decisions accept provisionally closed tasks with reproducible versioned hashes", async () => {
  for (const batch of [false, true]) {
    const ctx = context(); ctx.task.status = "provisionally_closed";
    const snapshot = await getReviewSnapshot._handler(ctx, {taskId: "task_1", evidenceDraftId: "draft_1"});
    if (batch) await batchRecordReviewDecisions._handler(ctx, {items: [item(snapshot.snapshot_hash)]});
    else await recordReviewDecision._handler(ctx, {taskId: "task_1", decision: item(snapshot.snapshot_hash).decision});
    const row = ctx.rows.review_decisions[0];
    const {decision_hash, decision_hash_version, review_snapshot_hash, ...decision} = row;
    const input = batch ? {schema_version: "review-decision.v1", decision, review_snapshot_hash} : decision;
    assert.equal(decision_hash_version, batch ? 1 : undefined);
    assert.equal(decision_hash, sha256(canonicalJson(input)));
    assert.equal(ctx.task.status, "reviewed");
  }
});
