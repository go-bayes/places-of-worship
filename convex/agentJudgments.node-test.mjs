import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { recordJudgmentDisposition, listJudgmentsForTask, listDispositionsForJudgment } = await import("./agentJudgments.ts");

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
    async insert(table, value) { const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
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
