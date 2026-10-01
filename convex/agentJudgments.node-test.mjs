import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { recordJudgmentDisposition, listJudgmentsForTask, listDispositionsForJudgment, listJudgmentsForTaskPlace, ingestDeterministicJudgments } = await import("./agentJudgments.ts");

function context(roles = ["reviewer"]) {
  const rows = {
    users: [{ _id: "users_1", auth_subject: "human", status: "active", roles }],
    agent_judgments: [
      { _id: "j_1", judgment_id: "1".repeat(64), judgment_kind: "claim_support", "context.task_id": "task_1", context: { task_id: "task_1", evidence_draft_id: "draft_1" }, created_at: 5 },
      { _id: "j_2", judgment_id: "2".repeat(64), judgment_kind: "recommendation", "context.task_id": "task_1", context: { task_id: "task_1", evidence_draft_id: "draft_1" }, created_at: 9 },
      { _id: "j_3", judgment_id: "3".repeat(64), judgment_kind: "status_assessment", context: { place_ref: "osm:way/1" }, created_at: 11 },
    ],
    review_decisions: [
      { _id: "rd_1", review_decision_id: "decision_1", task_id: "task_1", evidence_draft_id: "draft_1" },
      { _id: "rd_2", review_decision_id: "decision_other_task", task_id: "task_2", evidence_draft_id: "draft_9" },
      { _id: "rd_3", review_decision_id: "decision_other_draft", task_id: "task_1", evidence_draft_id: "draft_2" },
    ],
    judgment_dispositions: [],
    tasks: [
      { _id: "t_1", task_id: "task_1", osm_object_type: "way", matched_osm_id: "1002", source_record_id: "src:nz:7" },
      { _id: "t_2", task_id: "task_2" },
    ],
  };
  const db = {
    query(table) {
      let filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      // index fields may be nested paths; convex walks a descending index newest first
      const selected = () => rows[table].filter(row => filters.every(([k, v]) => k.split(".").reduce((o, part) => o?.[part], row) === v));
      let desc = false;
      const ordered = () => { const rows = selected(); return desc ? rows.slice().sort((a, b) => b.created_at - a.created_at) : rows; };
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, order(direction) { desc = direction === "desc"; return chain; }, async unique() { return selected()[0] ?? null; }, async collect() { return selected(); }, async take(n) { return ordered().slice(0, n); } };
      return chain;
    },
    async insert(table, value) { rows[table] ??= []; const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
    async get(id) { for (const table of Object.values(rows)) { const found = table.find(row => row._id === id); if (found) return found; } return null; },
  };
  return { db, rows, auth: { async getUserIdentity() { return { tokenIdentifier: "human" }; } } };
}

test("a reviewer records agreement without a note and disagreement with one", async () => {
  const ctx = context();
  const agreed = await recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "agreed" });
  assert.match(agreed.disposition_id, /:disposition:/);
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "disagreed", note: "short" }), /eight characters/);
  await recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "disagreed", note: "The page names a different chapel.", reviewDecisionId: "decision_1" });
  assert.equal(ctx.rows.judgment_dispositions.length, 2);
  assert.equal(ctx.rows.judgment_dispositions[1].review_decision_id, "decision_1");
  assert.equal(ctx.rows.judgment_dispositions[1].reviewer_user_id, "users_1");
  const listed = await listDispositionsForJudgment._handler(ctx, { judgmentId: "1".repeat(64) });
  assert.equal(listed.length, 2);
});

test("dispositions refuse unknown judgments, unknown or unrelated decisions, and unauthorised roles", async () => {
  const ctx = context();
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "9".repeat(64), disposition: "agreed" }), /not found/);
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "agreed", reviewDecisionId: "missing" }), /decision not found/i);
  // a decision about another task or another draft cannot be attached
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "agreed", reviewDecisionId: "decision_other_task" }), /different task/);
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "1".repeat(64), disposition: "agreed", reviewDecisionId: "decision_other_draft" }), /different evidence draft/);
  // a place-level judgment names no task, so no decision can claim it
  await assert.rejects(recordJudgmentDisposition._handler(ctx, { judgmentId: "3".repeat(64), disposition: "agreed", reviewDecisionId: "decision_1" }), /different task/);
  assert.equal(ctx.rows.judgment_dispositions.length, 0);
  for (const roles of [["ra"], ["service"]]) {
    const other = context(roles);
    await assert.rejects(recordJudgmentDisposition._handler(other, { judgmentId: "1".repeat(64), disposition: "agreed" }), /role/);
    await assert.rejects(listJudgmentsForTask._handler(other, { taskId: "task_1" }), /role/);
  }
});

test("task listing walks the index newest first so the cap drops the oldest", async () => {
  const ctx = context();
  const listed = await listJudgmentsForTask._handler(ctx, { taskId: "task_1" });
  assert.deepEqual(listed.map(j => j.judgment_kind), ["recommendation", "claim_support"]);
  for (let i = 0; i < 250; i += 1) ctx.rows.agent_judgments.push({ _id: `bulk_${i}`, judgment_id: `bulk_${i}`, judgment_kind: "claim_support", "context.task_id": "task_1", context: { task_id: "task_1" }, created_at: 100 + i });
  const capped = await listJudgmentsForTask._handler(ctx, { taskId: "task_1" });
  assert.equal(capped.length, 200);
  assert.equal(capped[0].created_at, 349, "the newest row is present");
  assert.ok(capped.every(j => j.created_at >= 150), "only the oldest rows fall outside the cap");
});

// listJudgmentsForTaskPlace
function place(ctx, ref, n, createdAt) { for (let i = 0; i < n; i += 1) ctx.rows.agent_judgments.push({ _id: `${ref}_${i}`, judgment_id: `${ref}_${i}`, subject_ref: ref, judgment_kind: "registration_confidence", created_at: createdAt + i, context: { place_ref: ref } }); }

test("the place read resolves both refs, newest first, with dispositions embedded", async () => {
  const ctx = context();
  place(ctx, "osm:way/1002", 2, 100);
  place(ctx, "src:nz:7", 1, 200);
  place(ctx, "osm:way/9999", 1, 300);
  for (let i = 0; i < 12; i += 1) ctx.rows.judgment_dispositions.push({ _id: `d_${i}`, judgment_id: "osm:way/1002_1", disposition: "agreed", created_at: i });
  const listed = await listJudgmentsForTaskPlace._handler(ctx, { taskId: "task_1" });
  assert.deepEqual(listed.map(j => j.judgment_id), ["src:nz:7_0", "osm:way/1002_1", "osm:way/1002_0"]);
  assert.equal(listed[1].dispositions.length, 10, "at most ten dispositions per row");
  assert.equal(listed[1].dispositions[0].created_at, 11, "dispositions are newest first");
  assert.deepEqual(listed[0].dispositions, []);
  assert.deepEqual(await listJudgmentsForTaskPlace._handler(ctx, { taskId: "task_2" }), []);
  assert.deepEqual(await listJudgmentsForTaskPlace._handler(ctx, { taskId: "missing" }), []);
});

test("the place read honours the cap and refuses ra and service roles", async () => {
  const ctx = context();
  place(ctx, "osm:way/1002", 250, 1000);
  const capped = await listJudgmentsForTaskPlace._handler(ctx, { taskId: "task_1" });
  assert.equal(capped.length, 200);
  assert.equal(capped[0].created_at, 1249);
  for (const roles of [["ra"], ["service"]]) await assert.rejects(listJudgmentsForTaskPlace._handler(context(roles), { taskId: "task_1" }), /role/);
  for (const roles of [["curator"], ["admin"], ["pi"]]) assert.deepEqual(await listJudgmentsForTaskPlace._handler(context(roles), { taskId: "task_2" }), []);
});

// ingestDeterministicJudgments
const expected = JSON.parse(fs.readFileSync(new URL("../schemas/fixtures/agent-judgment-v1-1/expected-judgments.json", import.meta.url), "utf8"));
const batch = expected.batches[0];
const vectorHash = expected.source.sha256;
function enable(on) { if (on) process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true"; else delete process.env.POW_INTERNAL_AGENT_INGEST_ENABLED; }

test("ingest is gated, writes through the service user, and an identical retry creates nothing", async () => {
  const ctx = context();
  enable(false);
  await assert.rejects(ingestDeterministicJudgments._handler(ctx, { judgments: batch, signalVectorSha256: vectorHash }), /disabled/);
  enable(true);
  try {
    const first = await ingestDeterministicJudgments._handler(ctx, { judgments: batch, signalVectorSha256: vectorHash });
    assert.equal(first.length, batch.length);
    assert.ok(first.every(r => r.created));
    const service = ctx.rows.users.find(u => u.email === "internal-agent-intake@service.local");
    assert.ok(service.roles.includes("service"));
    assert.ok(ctx.rows.agent_judgments.slice(3).every(j => j.actor_user_id === service._id && j.schema_version === "agent-judgment.v1.1"));
    assert.deepEqual(first.map(r => r.judgment_id), expected.judgment_ids.slice(0, batch.length));
    const again = await ingestDeterministicJudgments._handler(ctx, { judgments: batch, signalVectorSha256: vectorHash });
    assert.ok(again.every(r => r.created === false));
    assert.equal(ctx.rows.agent_judgments.length, 3 + batch.length);
    // it creates no task, draft, version, event or decision
    assert.equal(ctx.rows.tasks.length, 2);
    assert.equal(ctx.rows.review_decisions.length, 3);
  } finally { enable(false); }
});

test("ingest refuses a mismatched hash, mixed countries, v1 and model rows, and oversize calls", async () => {
  enable(true);
  try {
    const run = (judgments, hash = vectorHash) => ingestDeterministicJudgments._handler(context(), { judgments, signalVectorSha256: hash });
    await assert.rejects(run(batch, "0".repeat(64)), /names the signal-vector hash/);
    await assert.rejects(run(batch, "short"), /sha256/);
    const au = structuredClone(batch[0]);
    au.context.country_code = "AU";
    au.score.edition_id = "osm-pow:au:edition:2026-09-01:0123abcd4567";
    await assert.rejects(run([batch[0], au]), /one country/);
    await assert.rejects(run([{ ...structuredClone(batch[0]), schema_version: "agent-judgment.v1" }]), /schema_version/);
    const model = { ...structuredClone(batch[0]), judge: { agent_name: "claude-batch-reviewer", model_provider: "claude", model_requested: "sonnet", model_unreported_reason: "none", prompt_version: "agent-review.v1", standard_version: "confidence-standard/0.3.0" }, run: { attempt: 1, cost_basis: "unknown" } };
    await assert.rejects(run([model]), /scorer judgment|model|score/i);
    await assert.rejects(run(Array.from({ length: 101 }, () => batch[0])), /At most 100/);
  } finally { enable(false); }
});
