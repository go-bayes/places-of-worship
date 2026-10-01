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
  assert.throws(() => validateScorerJudgment(edit((sc) => { sc.tier_reasons.push("duplicate"); })), /tier/);
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

test("calibration and component outcomes cannot be asserted", () => {
  const put = (row, patch) => { const copy = clone(row); patch(copy); return copy; };
  assert.throws(() => validateScorerJudgment(put(tier, (r) => { r.score.calibrated = true; })), /uncalibrated/);
  const status = rows.find((row) => row.judgment_kind === "status_assessment");
  const location = rows.find((row) => row.judgment_kind === "location");
  assert.throws(() => validateScorerJudgment(put(status, (r) => { r.outcome = "likely_active"; })), /outcome unknown/);
  assert.throws(() => validateScorerJudgment(put(location, (r) => { r.outcome = "implausible"; })), /outcome unclear/);
  const duplicate = rows.find((row) => row.judgment_kind === "duplicate");
  if (duplicate !== undefined) assert.throws(() => validateScorerJudgment(put(duplicate, (r) => { r.score.indicators.duplicate = false; })), /duplicate indicator/);
});

test("digit runs inside valid digests and scores do not trip the personal-detail screen", () => {
  const row = clone(tier);
  row.judge.code_revision = `012345678901${"a".repeat(28)}`;
  row.basis_note = scorerBasisNote(row);
  validateScorerJudgment(row);
  const low = clone(tier);
  low.score.composite = 0.0123;
  low.score.components = { ...low.score.components, identity: 0.3, location: 0.41, status: 0.1 };
  low.score.tier = "escalate";
  low.score.tier_reasons = ["composite_below_0.6", "identity_below_0.7", "location_below_0.7", "status_below_0.7"];
  low.score.tier_pending = [];
  low.score.components.denomination = 0.9;
  low.score.indicators = { ...low.score.indicators, duplicate: false, conflict: false, generic_name: false };
  low.outcome = "escalate";
  low.basis_note = scorerBasisNote(low);
  validateScorerJudgment(low);
});

test("composite and screened tier are consistent with their fields", () => {
  const off = clone(tier);
  off.score.composite = 0.5;
  assert.throws(() => validateScorerJudgment(off), /product/);
  const bad = clone(tier);
  Object.assign(bad.score, { tier: "screened", composite: 0.01, tier_reasons: [], tier_pending: [] });
  bad.score.components = { identity: 0.1, location: 0.1, status: 1, denomination: 0.1 };
  bad.score.indicators.duplicate = true;
  bad.outcome = "screened";
  assert.throws(() => validateScorerJudgment(bad), /tier/);
});

const compositeRow = (components, composite, expectedTier, reasons) => {
  const row = clone(tier);
  Object.assign(row.score, {
    components: { denomination: 1, ...components }, composite,
    tier: expectedTier, tier_reasons: reasons, tier_pending: [],
  });
  Object.assign(row.score.indicators, { duplicate: false, conflict: false, generic_name: false });
  row.outcome = expectedTier;
  row.basis_note = scorerBasisNote(row);
  return row;
};

test("a supplied composite cannot cross the 0.9 or 0.6 tier cut point by one decimal unit", () => {
  const cases = [
    { components: { identity: 0.9, location: 0.9999, status: 1 }, rounded: 0.8999, cut: 0.9, expectedTier: "review", reasons: ["composite_0.6_to_0.9"], raisedTier: "screened", raisedReasons: [] },
    { components: { identity: 0.965, location: 0.965, status: 0.9664 }, rounded: 0.8999, cut: 0.9, expectedTier: "review", reasons: ["composite_0.6_to_0.9"], raisedTier: "screened", raisedReasons: [] },
    { components: { identity: 0.6, location: 0.9999, status: 1 }, rounded: 0.5999, cut: 0.6, expectedTier: "escalate", reasons: ["composite_below_0.6", "identity_below_0.7"], raisedTier: "review", raisedReasons: ["composite_0.6_to_0.9", "identity_below_0.7"] },
  ];
  for (const c of cases) {
    assert.doesNotThrow(() => validateScorerJudgment(compositeRow(c.components, c.rounded, c.expectedTier, c.reasons)));
    assert.throws(() => validateScorerJudgment(compositeRow(c.components, c.cut, c.raisedTier, c.raisedReasons)), /product/);
  }
});

test("composite rounding matches R's nearest-value and ties-to-even rule", () => {
  // expected values checked with round(x, 4) in the scorer's R runtime
  for (const [identity, rounded] of [[0.78125, 0.7812], [0.84375, 0.8438], [0.90005, 0.9]]) {
    const components = { identity, location: 1, status: 1 };
    const expectedTier = rounded < 0.9 ? "review" : "screened";
    const reasons = expectedTier === "review" ? ["composite_0.6_to_0.9"] : [];
    assert.doesNotThrow(() => validateScorerJudgment(compositeRow(components, rounded, expectedTier, reasons)));
    const wrong = rounded === 0.7812 ? 0.7813 : rounded === 0.8438 ? 0.8437 : 0.9001;
    assert.throws(() => validateScorerJudgment(compositeRow(components, wrong, expectedTier, reasons)), /product/);
  }
});

test("only representation error is accepted and tiers use the verified composite", () => {
  for (const [components, composite, expectedTier, reasons, lowerTier, lowerReasons] of [
    [{ identity: 0.9, location: 1, status: 1 }, 0.9, "screened", [], "review", ["composite_0.6_to_0.9"]],
    [{ identity: 0.8, location: 0.75, status: 1 }, 0.6, "review", ["composite_0.6_to_0.9"], "escalate", ["composite_below_0.6"]],
  ]) {
    for (const delta of [-Number.EPSILON, Number.EPSILON]) {
      assert.doesNotThrow(() => validateScorerJudgment(compositeRow(components, composite + delta, expectedTier, reasons)));
    }
    assert.throws(() => validateScorerJudgment(compositeRow(components, composite - Number.EPSILON, lowerTier, lowerReasons)), /tier/);
    for (const delta of [-1e-8, 1e-8]) {
      assert.throws(() => validateScorerJudgment(compositeRow(components, composite + delta, expectedTier, reasons)), /product/);
    }
  }
});

test("the tier, its reasons and its pending condition follow from the fields", () => {
  const edit = (change) => { const row = clone(tier); change(row.score); row.outcome = row.score.tier; row.basis_note = scorerBasisNote(row); return row; };
  const screened = (sc) => { Object.assign(sc, { tier: "screened", tier_reasons: [], tier_pending: [], composite: 0.95 }); sc.components = { identity: 1, location: 0.95, status: 1, denomination: 0.95 }; };
  assert.throws(() => validateScorerJudgment(edit((sc) => { screened(sc); sc.components.denomination = 0.1; })), /tier/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { screened(sc); sc.indicators.generic_name = true; sc.indicators.cross_source_match = "no_match"; })), /tier/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { screened(sc); sc.indicators.generic_name = true; sc.indicators.cross_source_match = "not_computed"; })), /tier/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { Object.assign(sc, { tier: "review", tier_reasons: ["composite_0.6_to_0.9"], tier_pending: [], composite: 0.06 }); sc.components = { identity: 0.4, location: 0.5, status: 0.3, denomination: 1 }; })), /tier/);
  assert.throws(() => validateScorerJudgment(edit((sc) => { Object.assign(sc, { tier: "review", tier_reasons: ["conflict"] }); })), /tier/);
});
