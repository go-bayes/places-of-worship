import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { judgmentIdFor, recordJudgments, validateJudgmentInput, OUTCOMES_BY_KIND } = await import("./agentJudgments.ts");

function context() {
  const rows = { agent_judgments: [] };
  const db = {
    query(table) {
      let filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      const selected = () => rows[table].filter(row => filters.every(([k, v]) => row[k] === v));
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, async unique() { return selected()[0] ?? null; }, async collect() { return selected(); } };
      return chain;
    },
    async insert(table, value) { const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
  };
  return { db, rows };
}

const base = {
  subject: { kind: "claim", ref: `${"a".repeat(64)}#osm:way/1:codex:c01` },
  judgment_kind: "claim_support",
  outcome: "unclear",
  access_method: "not_checked",
  source_locator: "https://example.org/history",
  basis_note: "Synthetic.",
  judge: { agent_name: "claude-advisory-reviewer-internal", model_provider: "claude", model_requested: "sonnet", model_unreported_reason: "The client did not report a model id for this run.", prompt_version: "agent-review.v1" },
  run: { agent_run_id: "run-1", attempt: 1, cost_basis: "unknown" },
  context: { task_id: "task_1", place_ref: "osm:way/1", country_code: "NZ" },
};

test("the judgment id is the hash of the envelope and ignores field order", () => {
  const reordered = { ...base, judge: { prompt_version: "agent-review.v1", model_unreported_reason: base.judge.model_unreported_reason, model_requested: "sonnet", model_provider: "claude", agent_name: base.judge.agent_name } };
  assert.equal(judgmentIdFor(base), judgmentIdFor(reordered));
  assert.match(judgmentIdFor(base), /^[0-9a-f]{64}$/);
  assert.notEqual(judgmentIdFor(base), judgmentIdFor({ ...base, outcome: "supported" }));
});

test("an identical write collapses onto one row and a changed batch appends with parents", async () => {
  const ctx = context();
  const first = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [base, base], now: 1 });
  assert.deepEqual(first.map(r => r.created), [true, false]);
  const again = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [base], now: 2 });
  assert.equal(again[0].created, false);
  assert.equal(ctx.rows.agent_judgments.length, 1);
  assert.deepEqual(ctx.rows.agent_judgments[0].parents, []);
  const rerun = { ...base, run: { ...base.run, agent_run_id: "run-2" } };
  const second = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [rerun], now: 3 });
  assert.equal(second[0].created, true);
  assert.equal(ctx.rows.agent_judgments.length, 2);
  assert.deepEqual(ctx.rows.agent_judgments[1].parents, [first[0].judgment_id]);
  // a different lane on the same subject is a sibling, not a revision
  const otherLane = { ...base, judge: { ...base.judge, agent_name: "claude-batch-reviewer" } };
  const third = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [otherLane], now: 4 });
  assert.equal(third[0].created, true);
  assert.deepEqual(ctx.rows.agent_judgments[2].parents, []);
});

test("the outcome vocabulary is fixed per kind", () => {
  for (const [kind, outcomes] of Object.entries(OUTCOMES_BY_KIND)) {
    for (const outcome of outcomes) validateJudgmentInput({ ...base, subject: { kind: "place", ref: "osm:way/1" }, judgment_kind: kind, outcome });
  }
  assert.throws(() => validateJudgmentInput({ ...base, outcome: "accept" }), /vocabulary/);
  assert.throws(() => validateJudgmentInput({ ...base, judgment_kind: "recommendation", outcome: "supported" }), /vocabulary/);
});

test("attribution and cost rules refuse contradictory input", () => {
  assert.throws(() => validateJudgmentInput({ ...base, judge: { ...base.judge, model_reported: "claude-sonnet-5" } }), /reports a model id or/);
  assert.throws(() => validateJudgmentInput({ ...base, judge: { ...base.judge, model_unreported_reason: undefined } }), /reports a model id or/);
  assert.throws(() => validateJudgmentInput({ ...base, run: { ...base.run, cost_usd: 0 } }), /never zero/);
  assert.throws(() => validateJudgmentInput({ ...base, run: { ...base.run, cost_basis: "api_invoice" } }), /requires a cost value/);
  validateJudgmentInput({ ...base, run: { ...base.run, cost_basis: "api_invoice", cost_usd: 0.02 } });
  assert.throws(() => validateJudgmentInput({ ...base, subject: { kind: "claim", ref: "no-hash#c01" } }), /<sha256>#<claim_id>/);
  assert.throws(() => validateJudgmentInput({ ...base, subject: { kind: "evidence_version", ref: "draft_1" } }), /object hash/);
  assert.throws(() => validateJudgmentInput({ ...base, basis_note: "x".repeat(2_049) }), /too long/);
  assert.throws(() => validateJudgmentInput({ ...base, run: { ...base.run, attempt: 0 } }), /positive integer/);
});

test("a write is bounded", async () => {
  const ctx = context();
  const many = Array.from({ length: 101 }, (_, i) => ({ ...base, subject: { kind: "claim", ref: `${"a".repeat(64)}#c${i}` } }));
  await assert.rejects(recordJudgments(ctx, { actorUserId: "users_1", judgments: many }), /At most 100/);
  assert.equal(ctx.rows.agent_judgments.length, 0);
  assert.deepEqual(await recordJudgments(ctx, { actorUserId: "users_1", judgments: [] }), []);
});
