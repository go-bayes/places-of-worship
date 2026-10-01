import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { validateScorerJudgment, SCORER_AGENT_NAME } = await import("./scorerJudgments.ts");

const expected = JSON.parse(fs.readFileSync(new URL("../../schemas/fixtures/agent-judgment-v1-1/expected-judgments.json", import.meta.url), "utf8"));
const rows = expected.batches.flat();
const tier = rows.find((row) => row.judgment_kind === "registration_confidence");
const clone = (value) => structuredClone(value);

test("the fixture's rows are accepted", () => {
  assert.ok(rows.length > 0);
  for (const row of rows) validateScorerJudgment(row);
});

test("a scorer row is closed and place-level", () => {
  assert.throws(() => validateScorerJudgment({ ...clone(tier), extra: 1 }), /no field extra/);
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
