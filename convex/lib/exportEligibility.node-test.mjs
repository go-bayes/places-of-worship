import assert from "node:assert/strict";
import test from "node:test";
import { isWideEvidenceExportEligible } from "./exportEligibility.ts";

test("a present-day field observation with no assessed target year remains JSONL-only", () => {
  assert.equal(isWideEvidenceExportEligible({
    source_type: "field_observation",
    target_year_statuses: { "2013": "not_assessed", "2018": "not_assessed", "2023": "not_assessed" },
  }), false);
});

test("a field observation may form a wide row when its capture year is a target year", () => {
  assert.equal(isWideEvidenceExportEligible({
    source_type: "field_observation",
    target_year_statuses: { "2023": "present" },
  }), true);
});

test("raw-label denomination evidence with no assessed target year remains JSONL-only", () => {
  assert.equal(isWideEvidenceExportEligible({
    action: "denomination_or_shared_use",
    source_type: "other",
    target_year_statuses: { "2023": "not_assessed" },
  }), false);
});

test("denomination evidence may form a wide row when independent evidence assesses a target year", () => {
  assert.equal(isWideEvidenceExportEligible({
    action: "denomination_or_shared_use",
    source_type: "other",
    target_year_statuses: { "2023": "present" },
  }), true);
});

test("no source forms a wide row without an assessed target year", () => {
  assert.equal(isWideEvidenceExportEligible({
    source_type: "street_imagery",
    target_year_statuses: { "2023": "not_assessed" },
  }), false);
});

test("a non-field source forms a wide row when it assesses a target year", () => {
  assert.equal(isWideEvidenceExportEligible({
    source_type: "street_imagery",
    target_year_statuses: { "2023": "uncertain" },
  }), true);
});
