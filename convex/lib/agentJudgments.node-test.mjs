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
      // index fields may be nested paths; convex walks a descending index newest first
      const selected = () => rows[table].filter(row => filters.every(([k, v]) => k.split(".").reduce((o, part) => o?.[part], row) === v));
      let descending = false;
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, order(direction) { descending = direction === "desc"; return chain; }, async take(n) { const found = selected(); return (descending ? found.reverse() : found).slice(0, n); }, async unique() { return selected()[0] ?? null; }, async collect() { return selected(); } };
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

// agent-judgment.v1.1: deterministic scorer judgments
const score = {
  edition_id: "osm-pow:nz:edition:2026-09-01:0123abcd4567",
  composite: 0.6567,
  components: { identity: 0.91, location: 0.88, status: 0.82, denomination: 0.74 },
  tier: "review",
  tier_reasons: ["composite_0.6_to_0.9"],
  tier_pending: [],
  cut_points: { screened_min_composite: 0.9, review_min_composite: 0.6, component_floor: 0.7 },
  calibrated: false,
  signals_fired: { identity: ["has_name"], location: [], status: ["long_history"], denomination: [] },
  signal_values: { tag_count: 9, has_name: true, node_in_building: null },
  indicators: { duplicate: false, conflict: false, conflict_reasons: [], generic_name: false, missing_name: false, cross_source_match: "not_computed", cross_source_sources_matched: null },
};
const deterministic = {
  schema_version: "agent-judgment.v1.1",
  subject: { kind: "place", ref: "osm:way/1002" },
  judgment_kind: "registration_confidence",
  outcome: "review",
  basis_note: "Synthetic.",
  score,
  judge: { agent_name: "osm-confidence-scorer", kind: "deterministic", prompt_version: "p2-heuristic-0.2.0", code_revision: "a1b2c3d4e5f6", signal_vector_sha256: "b".repeat(64), standard_version: "confidence-standard/0.3.0" },
  run: { agent_run_id: "osm-confidence:x:bbbbbbbbbbbb:0.1.0", attempt: 1, cost_basis: "no_model_call" },
  context: { place_ref: "osm:way/1002", country_code: "NZ" },
};

test("the v1 id of an existing input is pinned: optional v1.1 keys leave it unchanged", () => {
  assert.equal(judgmentIdFor(base), "563283a28547faf6dde02ce20b783e2d2b511553d5c3bd3da9afb7e850688af0");
  assert.equal(judgmentIdFor({ ...base, score: undefined, schema_version: undefined, judge: { ...base.judge, kind: undefined, standard_version: undefined, signal_vector_sha256: undefined } }), judgmentIdFor(base));
});

test("a valid deterministic row passes and its id is stable across key order", () => {
  validateJudgmentInput(deterministic);
  const reordered = { ...deterministic, score: { ...score, signal_values: { node_in_building: null, has_name: true, tag_count: 9 } }, judge: Object.fromEntries(Object.entries(deterministic.judge).reverse()) };
  assert.equal(judgmentIdFor(deterministic), judgmentIdFor(reordered));
  assert.notEqual(judgmentIdFor(deterministic), judgmentIdFor({ ...deterministic, score: { ...score, composite: 0.7 } }));
});

test("agent-judgment.v1.1 names the standard version for every judge kind", () => {
  const model = { ...base, schema_version: "agent-judgment.v1.1" };
  assert.throws(() => validateJudgmentInput(model), /standard version/);
  validateJudgmentInput({ ...model, judge: { ...model.judge, standard_version: "confidence-standard/0.3.1" } });
  assert.throws(() => validateJudgmentInput({ ...deterministic, judge: { ...deterministic.judge, standard_version: undefined } }), /standard version/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, judge: { ...deterministic.judge, standard_version: "0.3.0" } }), /standard version/);
});

test("a deterministic judge is refused where it breaks the contract", () => {
  const judge = (patch) => ({ ...deterministic, judge: { ...deterministic.judge, ...patch } });
  assert.throws(() => validateJudgmentInput({ ...deterministic, schema_version: undefined }), /requires agent-judgment.v1.1/);
  assert.throws(() => validateJudgmentInput(judge({ model_provider: "claude" })), /no model fields/);
  assert.throws(() => validateJudgmentInput(judge({ model_requested: "sonnet" })), /no model fields/);
  assert.throws(() => validateJudgmentInput(judge({ model_unreported_reason: "none" })), /no model fields/);
  assert.throws(() => validateJudgmentInput(judge({ instruction_sha256: "c".repeat(64) })), /no model fields/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, access_method: "not_checked" }), /no access method/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, confidence: "high" }), /no access method/);
  assert.throws(() => validateJudgmentInput(judge({ code_revision: undefined })), /code revision/);
  assert.throws(() => validateJudgmentInput(judge({ signal_vector_sha256: undefined })), /signal vectors/);
  assert.throws(() => validateJudgmentInput(judge({ signal_vector_sha256: "B".repeat(64) })), /signal vectors/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, score: undefined }), /score block/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, run: { ...deterministic.run, cost_basis: "unknown" } }), /no_model_call/);
  assert.throws(() => validateJudgmentInput({ ...deterministic, run: { ...deterministic.run, cost_usd: 0 } }), /no cost value/);
});

test("a model judge carries no score and no_model_call is for deterministic judges", () => {
  assert.throws(() => validateJudgmentInput({ ...base, schema_version: "agent-judgment.v1.1", score, judge: { ...base.judge, standard_version: "confidence-standard/0.3.0" } }), /Only a deterministic/);
  assert.throws(() => validateJudgmentInput({ ...base, run: { ...base.run, cost_basis: "no_model_call" } }), /no_model_call/);
  assert.throws(() => validateJudgmentInput({ ...base, judge: { ...base.judge, model_provider: undefined } }), /provider/);
  assert.throws(() => validateJudgmentInput({ ...base, judge: { ...base.judge, kind: "model", model_requested: undefined } }), /provider/);
});

test("the score block is range, tier and vocabulary checked", () => {
  const withScore = (patch) => ({ ...deterministic, score: { ...score, ...patch } });
  assert.throws(() => validateJudgmentInput(withScore({ tier: "screened" })), /equals the score tier/);
  assert.throws(() => validateJudgmentInput(withScore({ composite: 1.1 })), /composite/);
  assert.throws(() => validateJudgmentInput(withScore({ composite: Number.NaN })), /composite/);
  assert.throws(() => validateJudgmentInput(withScore({ components: { ...score.components, status: -0.1 } })), /status component/);
  assert.throws(() => validateJudgmentInput(withScore({ cut_points: { ...score.cut_points, component_floor: 2 } })), /component_floor/);
  assert.throws(() => validateJudgmentInput(withScore({ signals_fired: { ...score.signals_fired, identity: ["Rev John Smith"] } })), /term names/);
  assert.throws(() => validateJudgmentInput(withScore({ tier_reasons: Array.from({ length: 41 }, () => "a") })), /at most 40/);
  assert.throws(() => validateJudgmentInput(withScore({ signal_values: { creation_editor: true } })), /allowlist/);
  assert.throws(() => validateJudgmentInput(withScore({ signal_values: { tag_count: "9" } })), /finite number/);
  assert.throws(() => validateJudgmentInput(withScore({ signal_values: { tag_count: Infinity } })), /finite number/);
});

test("every registration_confidence outcome is accepted and accept is refused", () => {
  for (const outcome of OUTCOMES_BY_KIND.registration_confidence) validateJudgmentInput({ ...deterministic, outcome, score: { ...score, tier: outcome } });
  assert.deepEqual(OUTCOMES_BY_KIND.registration_confidence, ["screened", "review", "escalate"]);
  assert.throws(() => validateJudgmentInput({ ...deterministic, outcome: "accept" }), /vocabulary/);
});

test("a re-score under a new signal-vector hash appends with the earlier id as parent; an identical rerun collapses", async () => {
  const ctx = context();
  const first = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [deterministic], now: 1 });
  const again = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [deterministic], now: 2 });
  assert.equal(again[0].created, false);
  const rescored = { ...deterministic, judge: { ...deterministic.judge, signal_vector_sha256: "d".repeat(64) } };
  const second = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [rescored], now: 3 });
  assert.equal(second[0].created, true);
  assert.deepEqual(ctx.rows.agent_judgments[1].parents, [first[0].judgment_id]);
  assert.equal(ctx.rows.agent_judgments[0].schema_version, "agent-judgment.v1.1");
  assert.deepEqual(ctx.rows.agent_judgments[0].score, score);
  // a v1 row stays v1 and carries no score key value
  const v1 = await recordJudgments(ctx, { actorUserId: "users_1", judgments: [base], now: 4 });
  assert.equal(v1[0].created, true);
  assert.equal(ctx.rows.agent_judgments[2].schema_version, "agent-judgment.v1");
  assert.equal(ctx.rows.agent_judgments[2].score, undefined);
});
