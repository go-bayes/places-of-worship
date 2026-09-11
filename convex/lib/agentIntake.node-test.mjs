import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assertNoDuplicateJsonKeys, validateAgentReviewBundle } from "./agentIntake.ts";
const fixturePath = new URL("../../scripts/agent_research/fixtures/internal-review-bundle.json", import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const bundle = () => structuredClone(fixture);

test("valid bundle validates and hashes", () => {
  const json = JSON.stringify(bundle());
  const result = validateAgentReviewBundle(JSON.parse(json), json);
  assert.match(result.bundleHash, /^[0-9a-f]{64}$/);
});

test("unknown root fields, duplicate coverage, and same backend are rejected", () => {
  const value = bundle(); value.extra = true;
  assert.throws(() => validateAgentReviewBundle(value, JSON.stringify(value)), /unknown field/);
  const duplicate = bundle(); duplicate.review.claim_checks.push({ ...duplicate.review.claim_checks[0] });
  assert.throws(() => validateAgentReviewBundle(duplicate, JSON.stringify(duplicate)), /cover every/);
  const same = bundle(); same.review_run.backend = "codex";
  assert.throws(() => validateAgentReviewBundle(same, JSON.stringify(same)), /backends must differ/);
});

test("personal details, private URLs, and invalid dates are refused", () => {
  const privateUrl = bundle(); privateUrl.review.claim_checks[0].source_url = "https://localhost/private";
  assert.throws(() => validateAgentReviewBundle(privateUrl, JSON.stringify(privateUrl)), /public HTTPS URL|source_url/);
  const personal = bundle(); personal.dossier.personal_details_quarantine.item_count = 1;
  assert.throws(() => validateAgentReviewBundle(personal, JSON.stringify(personal)), /personal_details/);
  const invalidDate = bundle(); invalidDate.dossier.claims[0].date_start = "2026-02-30";
  assert.throws(() => validateAgentReviewBundle(invalidDate, JSON.stringify(invalidDate)), /calendar date/);
});

test("oversized bundles are rejected before semantic processing", () => {
  const value = bundle(); value.review.reasoning = "x".repeat(8000);
  const json = JSON.stringify(value) + " ".repeat(60_000);
  assert.throws(() => validateAgentReviewBundle(value, json), /64 KB/);
});

test("duplicate JSON keys are rejected before JSON.parse can collapse them", () => {
  assert.throws(() => assertNoDuplicateJsonKeys('{"a":1,"a":2}'), /duplicate JSON object key/);
  assert.doesNotThrow(() => assertNoDuplicateJsonKeys('{"a":{"b":1},"c":[{"b":2}]}'));
});

test("claim extras and missing required dossier fields are refused", () => {
  const extra = bundle(); extra.dossier.claims[0].hostile = true;
  assert.throws(() => validateAgentReviewBundle(extra, JSON.stringify(extra)), /unknown field hostile/);
  const missing = bundle(); delete missing.dossier.claims[0].reader;
  assert.throws(() => validateAgentReviewBundle(missing, JSON.stringify(missing)), /reader/);
});


test("schema and semantic gates cover hostile and incomplete inputs", () => {
  const mutations = [
    b => { b.review.claim_checks[0].outcome = "whatever"; },
    b => { b.review.recommendation = "accept"; },
    b => { b.research_run.model_requested = "sonnet"; },
    b => { b.dossier.claims[0].claim_type = "execute"; },
    b => { b.dossier.claims[0].source.locator = "file:///etc/passwd"; },
    b => { b.dossier.claims[0].date_start = "2000"; b.dossier.claims[0].date_end = "1900"; },
    b => { b.dossier.claims[0].reader.model_id = "other"; },
    b => { b.research_run.ended_at = "2026-02-30T00:00:00Z"; },
    b => { b.dossier.status_assessment.supporting_claim_ids = ["missing"]; },
    b => { b.review.cultural_sensitivity.flagged = true; },
    b => { b.review_run.usage = {constructor: "bad"}; },
  ];
  for (const mutate of mutations) {
    const b = bundle(); mutate(b);
    assert.throws(() => validateAgentReviewBundle(b, JSON.stringify(b)));
  }
  for (const url of ["https://10.0.0.1/", "https://2130706433/", "https://0x7f000001/", "https://[::1]/", "https://user:pass@example.org/", "https://example.local/"]) {
    const b = bundle(); b.dossier.claims[0].source.locator = url; b.review.claim_checks[0].source_url = url;
    assert.throws(() => validateAgentReviewBundle(b, JSON.stringify(b)));
  }
});

test("duplicate-key scanner distinguishes array strings from keys", () => {
  assert.doesNotThrow(() => assertNoDuplicateJsonKeys('{"x":["same","same"],"y":{"x":"same"}}'));
  assert.throws(() => assertNoDuplicateJsonKeys('{"x":1,"\\u0078":2}'));
});
