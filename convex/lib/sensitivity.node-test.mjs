import assert from "node:assert/strict";
import test from "node:test";
import { evidenceSensitivityFor, isExternalAiReviewEligible } from "./sensitivity.ts";

test("Vanuatu evidence remains behind the country sensitivity gate", () => {
  const result = evidenceSensitivityFor({ country_code: "VU" }, { privacy_flag: "clear" });
  assert.equal(result.flagged, true);
  assert.match(result.basis, /Vanuatu country default/);
});

test("guided observation evidence remains outside the existing external AI lane", () => {
  assert.equal(isExternalAiReviewEligible({
    observation_contract_version: "guided_observation_v1",
  }), false);
  assert.equal(isExternalAiReviewEligible({}), true);
});

test("privacy review and restriction both prevent external processing", () => {
  assert.equal(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "needs_review" }).flagged, true);
  assert.equal(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "restricted" }).flagged, true);
});

test("either supported cultural-sensitivity field prevents external processing", () => {
  assert.equal(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "clear", generated_wide_row: { row: { culturally_sensitive: true } } }).flagged, true);
  assert.equal(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "clear", generated_wide_row: { row: { culturallySensitive: true } } }).flagged, true);
  assert.equal(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "clear", generated_wide_row: { culturally_sensitive: true } }).flagged, true);
});

test("clear non-Vanuatu evidence may enter bounded external checks", () => {
  assert.deepEqual(evidenceSensitivityFor({ country_code: "NZ" }, { privacy_flag: "clear" }), { flagged: false });
});
