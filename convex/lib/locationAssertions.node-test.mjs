import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssertionMatchesTaskPoint,
  assertCountryAllowsAssertionMode,
  assertLocationAssertion,
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

test("building-level countries refuse an approximate area from a crafted call", () => {
  assert.throws(
    () => assertCountryAllowsAssertionMode("VU", "approximate_area"),
    /Nominations for VU must identify the building/,
  );
  // lower-case codes normalise to the same rule
  assert.throws(
    () => assertCountryAllowsAssertionMode("vu", "approximate_area"),
    /Nominations for VU must identify the building/,
  );
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("VU", "building_identified"));
});

test("other countries keep both location modes, matching the portal form", () => {
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("NZ", "approximate_area"));
  assert.doesNotThrow(() => assertCountryAllowsAssertionMode("NZ", "building_identified"));
});
