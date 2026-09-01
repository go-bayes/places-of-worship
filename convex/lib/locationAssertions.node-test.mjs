import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssertionMatchesTaskPoint,
  assertCountryAllowsAssertionMode,
  assertLocationAssertion,
  locationConfidenceGrade,
} from "./locationAssertions.ts";

const building = {
  contract_version: "location_assertion_v1",
  mode: "building_identified",
  basis: "map_placement",
  latitude: -41.2865,
  longitude: 174.7762,
  confidence: "high",
  contributor_confirmed: true,
};

test("accepts a contributor-confirmed building point", () => {
  assert.doesNotThrow(() => assertLocationAssertion(building));
});

test("accepts an approximate area with retained source wording", () => {
  assert.doesNotThrow(() => assertLocationAssertion({
    ...building,
    mode: "approximate_area",
    basis: "named_source_description",
    uncertainty_radius_m: 2_000,
    source_wording: "The church was described as somewhere within roughly two kilometres of the settlement centre.",
    confidence: "low",
  }));
});

test("rejects an approximate area without an uncertainty radius", () => {
  assert.throws(
    () => assertLocationAssertion({
      ...building,
      mode: "approximate_area",
      source_wording: "Near the settlement centre.",
    }),
    /uncertainty radius/,
  );
});

test("rejects an approximate area without retained location wording", () => {
  assert.throws(
    () => assertLocationAssertion({
      ...building,
      mode: "approximate_area",
      uncertainty_radius_m: 500,
    }),
    /Record what the source or informant establishes/,
  );
});

test("rejects a building point carrying an uncertainty radius", () => {
  assert.throws(
    () => assertLocationAssertion({ ...building, uncertainty_radius_m: 100 }),
    /must not include an uncertainty radius/,
  );
});

test("rejects a location assertion that differs from the submitted point", () => {
  assert.throws(
    () => assertAssertionMatchesTaskPoint(building, -41.2864, 174.7762),
    /does not match/,
  );
});

test("every registry country accepts an approximate area (jb ruling r1, 2026-09-02)", () => {
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("VU", "approximate_area"));
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("vu", "approximate_area"));
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("VU", "building_identified"));
});

test("the location grade derives from mode and radius (jb ruling r2, 2026-09-02)", () => {
  assert.equal(locationConfidenceGrade({ mode: "building_identified" }), "building");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 50 }), "parcel_or_compound");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 100 }), "parcel_or_compound");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 250 }), "street");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 300 }), "street");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 1_000 }), "locality");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 2_000 }), "locality");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 5_000 }), "area");
  assert.equal(locationConfidenceGrade({ mode: "approximate_area", uncertainty_radius_m: 100_000 }), "area");
});

test("other countries keep both location modes, matching the portal form", () => {
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("NZ", "approximate_area"));
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("NZ", "building_identified"));
});
