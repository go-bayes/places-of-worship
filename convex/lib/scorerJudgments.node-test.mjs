import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { validateScorerJudgment, scorerBasisNote, SCORER_AGENT_NAME } = await import("./scorerJudgments.ts");

const expected = JSON.parse(fs.readFileSync(new URL("../../schemas/fixtures/agent-judgment-v1-1/expected-judgments.json", import.meta.url), "utf8"));
const rows = expected.batches.flat();
const tier = rows.find((row) => row.judgment_kind === "registration_confidence");
const clone = (value) => structuredClone(value);

test("the fixture's rows are accepted", () => {
  assert.ok(rows.length > 0);
  for (const row of rows) validateScorerJudgment(row);
});

test("a scorer row is closed and place-level", () => {
  assert.throws(() => validateScorerJudgment({ ...clone(tier), extra: 1 }), /no field input.extra/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), subject: { kind: "first_pass", ref: "a".repeat(64) } }), /osm place/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), subject: { kind: "place", ref: "place:1" }, context: { ...tier.context, place_ref: "place:1" } }), /osm place/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), context: { ...tier.context, place_ref: "osm:way/9" } }), /equals its subject/);
  for (const key of ["task_id", "evidence_draft_id", "evidence_version_hash"]) {
    assert.throws(() => validateScorerJudgment({ ...clone(tier), context: { ...tier.context, [key]: "x" } }), /place-level/);
  }
  assert.throws(() => validateScorerJudgment({ ...clone(tier), context: { ...tier.context, country_code: "nz" } }), /country code/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), source_locator: "https://example.org" }), /source locator/);
});

test("agent name, facet, run and kind are fixed", () => {
  assert.equal(SCORER_AGENT_NAME, "osm-confidence-scorer");
  assert.throws(() => validateScorerJudgment({ ...clone(tier), judge: { ...tier.judge, agent_name: "claude-batch-reviewer" } }), /osm-confidence-scorer/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), facet: "status" }), /facet/);
  const status = rows.find((row) => row.judgment_kind === "status_assessment");
  assert.throws(() => validateScorerJudgment({ ...clone(status), facet: "location" }), /facet status/);
  assert.throws(() => validateScorerJudgment({ ...clone(status), facet: undefined }), /facet status/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), judgment_kind: "annotation", outcome: "follow_up" }), /not of kind/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), run: { ...tier.run, attempt: 2 } }), /attempt 1/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), run: { ...tier.run, agent_run_id: "run-1" } }), /run id/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), judge: { ...tier.judge, prompt_version: "P2 Heuristic" } }), /configuration version/);
});

test("the edition names the judgment's country", () => {
  const other = clone(tier);
  other.score.edition_id = "osm-pow:au:edition:2026-09-01:0123abcd4567";
  assert.throws(() => validateScorerJudgment(other), /edition is in the judgment's country/);
});

test("the basis note is required, personal-detail free and in a closed alphabet", () => {
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: undefined }), /basis note/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: `${tier.basis_note}; Rev John Smith` }), /personal details/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: `${tier.basis_note}; call 021 555 0188` }), /personal details/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: `${tier.basis_note}; <b>` }), /closed character set/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: `${tier.basis_note}\nnext` }), /closed character set/);
});

test("scorer metadata has exact formats and no unused free-text field", () => {
  const revised = (patch) => ({ ...clone(tier), judge: { ...tier.judge, ...patch } });
  assert.throws(() => validateScorerJudgment(revised({ code_revision: `${tier.judge.code_revision} Rev John Smith john.smith@example.org` })), /code revision/);
  assert.throws(() => validateScorerJudgment(revised({ code_revision: "abc" })), /code revision/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), run: { ...tier.run, batch_id: "call 021 555 0188" } }), /batch id/);
  const edition = clone(tier);
  edition.score.edition_id = "osm-pow:nz:edition:2026-09-01:john.smith";
  assert.throws(() => validateScorerJudgment(edition), /edition/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), run: { ...tier.run, agent_run_id: `${tier.run.agent_run_id}:extra` } }), /run id/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), run: { ...tier.run, agent_run_id: tier.run.agent_run_id.replace(tier.judge.signal_vector_sha256.slice(0, 12), "c".repeat(12)) } }), /run id/);
  assert.throws(() => validateScorerJudgment(revised({ prompt_version: "john-smith" })), /configuration version/);
});

test("score terms come from the scorer's closed vocabularies", () => {
  const edit = (change) => { const row = clone(tier); change(row.score); row.basis_note = scorerBasisNote(row); return row; };
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.signals_fired.identity.push("john.smith"); })), /identity vocabulary/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.signals_fired.status.push("name_specific"); })), /status vocabulary/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.tier_reasons.push("st.andrews"); })), /Tier reason/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.tier_pending.push("st.andrews"); })), /Pending condition/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.indicators.conflict_reasons.push("st.andrews"); })), /Conflict reason/);
  validateScorerJudgment(edit((sc) => { sc.tier_reasons.push("duplicate"); }));
});

test("the basis note is exactly the generated text", () => {
  assert.equal(tier.basis_note, scorerBasisNote(tier));
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: `${tier.basis_note}; John Smith` }), /generated text/);
  assert.throws(() => validateScorerJudgment({ ...clone(tier), basis_note: tier.basis_note.replace("tier screened", "tier review") }), /generated text/);
});

test("the standalone validator is closed below the root and checks types", () => {
  const put = (patch) => { const row = clone(tier); patch(row); return row; };
  assert.throws(() => validateScorerJudgment(put((r) => { r.judge.private_note = "Rev John Smith"; })), /no field input.judge.private_note/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.run.private_note = "x"; })), /input.run.private_note/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.context.private_note = "x"; })), /input.context.private_note/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.score.extra = 1; })), /input.score.extra/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.score.indicators.note = "x"; })), /input.score.indicators.note/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.score.calibrated = "Rev John Smith"; })), /wrong type/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.score.indicators.cross_source_sources_matched = "Rev John Smith"; })), /wrong type/);
  assert.throws(() => validateScorerJudgment(put((r) => { r.score.signal_values.has_name = "x"; })), /wrong type/);
});

test("each signal value stays in its own domain", () => {
  const put = (values) => { const row = clone(tier); row.score.signal_values = values; row.basis_note = scorerBasisNote(row); return row; };
  assert.throws(() => validateScorerJudgment(put({ has_name: 64215550188 })), /boolean or null/);
  assert.throws(() => validateScorerJudgment(put({ tag_count: 64215550188 })), /domain/);
  assert.throws(() => validateScorerJudgment(put({ n_versions: 1.5 })), /domain/);
  assert.throws(() => validateScorerJudgment(put({ "tag_completeness.score": 2 })), /domain/);
  assert.throws(() => validateScorerJudgment(put({ footprint_area_m2: -1 })), /domain/);
  validateScorerJudgment(put({ has_name: null, tag_count: 9, footprint_area_m2: 412.5, "tag_completeness.score": 0.857 }));
});

test("the cross-source indicator count is a bounded integer", () => {
  for (const bad of [64215550188, -3, 0.5]) {
    const row = clone(tier);
    row.score.indicators.cross_source_sources_matched = bad;
    assert.throws(() => validateScorerJudgment(row), /count from 0 to 100/);
  }
});
