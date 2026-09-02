import assert from "node:assert/strict";
import test from "node:test";

import { assertOccupancySet } from "./occupancies.ts";
import {
  OCCUPANCY_IMPORT_COLUMNS,
  assertionConfidence,
  groupImportRows,
  rowHasOccupancy,
  segmentFromImportRow,
} from "./occupancyImport.ts";

const REF = "2026-09-02";
const POINT = { latitude: -15.304, longitude: 167.863 };
const DEFAULTS = {
  sourceTitle: "Woodberry, Catholic Mission Stations in Vanuatu (2026)",
  sourceLocator: "station 11: Ambae / Lolopuepue",
  taskPoint: POINT,
  privacyFlag: "clear",
};

test("column list is stable and starts with the segment index", () => {
  assert.equal(OCCUPANCY_IMPORT_COLUMNS[0], "segment_index");
  assert.equal(new Set(OCCUPANCY_IMPORT_COLUMNS).size, OCCUPANCY_IMPORT_COLUMNS.length);
  assert.ok(OCCUPANCY_IMPORT_COLUMNS.includes("occupancy_source_account"));
});

test("a row without either mode carries no period", () => {
  assert.equal(rowHasOccupancy({ latitude: -15, longitude: 167 }), false);
  assert.equal(rowHasOccupancy({ start_mode: "known" }), true);
  assert.equal(rowHasOccupancy({ end_mode: " after " }), true);
});

test("a known founding with a stated closure reads as one segment at the task point", () => {
  const { segment, problems } = segmentFromImportRow({
    segment_index: "0",
    start_mode: "known",
    start_date: "1903",
    start_basis: "founding_stated",
    end_mode: "known",
    end_date: "1988",
    end_basis: "closure_stated",
    end_reason: "closed",
    occupancy_source_account: "open station 1903; close station 1988 (compiler's event log).",
  }, DEFAULTS);
  assert.deepEqual(problems, []);
  assert.equal(segment.segment_index, 0);
  assert.equal(segment.location_relation, "same_as_task_point");
  assert.equal(segment.location, undefined);
  assert.equal(segment.source_title, DEFAULTS.sourceTitle);
  assert.equal(segment.source_reference, DEFAULTS.sourceLocator);
  assert.equal(segment.confidence, "moderate");
  assert.equal(segment.privacy_flag, "clear");
  assert.doesNotThrow(() => assertOccupancySet([segment], REF, POINT));
});

test("a point at the task point with a radius describes the task point as an approximate area", () => {
  const { segment, problems } = segmentFromImportRow({
    start_mode: "known",
    start_date: "1903",
    start_basis: "first_seen_only",
    end_mode: "after",
    end_not_earlier_than: "1925",
    end_basis: "last_seen_only",
    end_reason: "unknown",
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    uncertainty_radius_m: "1000",
    location_wording: "Georeferenced by the compiler from an atlas map.",
    occupancy_source_account: "Printed in the 1903, 1911, 1916 and 1925 atlases.",
  }, DEFAULTS);
  assert.deepEqual(problems, []);
  assert.equal(segment.location_relation, "same_as_task_point");
  assert.equal(segment.location.mode, "approximate_area");
  assert.equal(segment.location.uncertainty_radius_m, 1000);
  assert.equal(segment.location.basis, "map_placement");
  assert.equal(segment.location.confidence, "low");
  assert.doesNotThrow(() => assertOccupancySet([segment], REF, POINT));
});

test("a different point makes the period distinct", () => {
  const { segment, problems } = segmentFromImportRow({
    segment_index: 1,
    start_mode: "known",
    start_date: "1951",
    start_basis: "founding_stated",
    end_mode: "unknown",
    latitude: -16.1,
    longitude: 168.16,
    location_mode: "approximate_area",
    uncertainty_radius_m: 500,
    location_basis: "named_source_description",
    location_wording: "Described in the history as near the mission school.",
    occupancy_source_account: "Reopened at the new site in 1951 per the history.",
  }, DEFAULTS);
  assert.deepEqual(problems, []);
  assert.equal(segment.location_relation, "distinct");
  assert.equal(segment.location.latitude, -16.1);
  assert.equal(segment.location.confidence, "low");
  assert.equal(segment.end_basis, "unknown");
});

test("defaults fill the basis for undated ends and the provenance text", () => {
  const { segment, problems } = segmentFromImportRow({
    start_mode: "unknown",
    end_mode: "unknown",
    occupancy_uncertainty_note: "No event or year recorded in the source for this station.",
  }, DEFAULTS);
  assert.deepEqual(problems, []);
  assert.equal(segment.start_basis, "unknown");
  assert.equal(segment.end_basis, "unknown");
  assert.match(segment.source_account, /period as recorded/);
  assert.ok(segment.confidence_basis.length > 12);
  assert.doesNotThrow(() => assertOccupancySet([segment], REF, POINT));
});

test("vocabulary problems are reported together and produce no segment", () => {
  const { segment, problems } = segmentFromImportRow({
    start_mode: "roughly",
    start_basis: "guess",
    end_mode: "known",
    end_date: "1988",
    end_reason: "burnt",
    occupancy_confidence: "sure",
    latitude: -15.3,
    location_mode: "island",
  }, DEFAULTS);
  assert.equal(segment, null);
  assert.ok(problems.some((p) => p.includes("start_mode")));
  assert.ok(problems.some((p) => p.includes("start_basis")));
  assert.ok(problems.some((p) => p.includes("end_basis")));
  assert.ok(problems.some((p) => p.includes("end_reason")));
  assert.ok(problems.some((p) => p.includes("occupancy_confidence")));
  assert.ok(problems.some((p) => p.includes("both latitude and longitude")));
  assert.ok(problems.some((p) => p.includes("location_mode")));
});

test("date rules stay with the shared validator", () => {
  const { segment, problems } = segmentFromImportRow({
    start_mode: "known",
    start_basis: "founding_stated",
    end_mode: "unknown",
    occupancy_source_account: "A known start with no date should fail downstream.",
  }, DEFAULTS);
  assert.deepEqual(problems, []);
  assert.throws(() => assertOccupancySet([segment], REF, POINT), /start date/);
});

test("assertion confidence follows mode and radius", () => {
  assert.equal(assertionConfidence("building_identified", undefined), "high");
  assert.equal(assertionConfidence("approximate_area", 100), "moderate");
  assert.equal(assertionConfidence("approximate_area", 2000), "low");
  assert.equal(assertionConfidence("approximate_area", 5000), "uncertain");
  assert.equal(assertionConfidence("approximate_area", undefined), "uncertain");
});

test("rows group by locator in first-appearance order and sort by segment index", () => {
  const groups = groupImportRows([
    { source_locator: "b", segment_index: 1 },
    { source_locator: "a", segment_index: 0 },
    { source_locator: "b", segment_index: 0 },
    { source_locator: " a ", segment_index: "1" },
  ]);
  assert.deepEqual([...groups.keys()], ["b", "a"]);
  assert.deepEqual(groups.get("b").map((r) => r.segment_index), [0, 1]);
  assert.equal(groups.get("a").length, 2);
});

test("a multi-segment place passes the set rules end to end", () => {
  const rows = [
    { segment_index: 0, start_mode: "known", start_date: "1896", start_basis: "founding_stated", end_mode: "known", end_date: "1938", end_basis: "closure_stated", end_reason: "closed", occupancy_source_account: "open 1896, close 1938 (with status changes 1913, 1923)." },
    { segment_index: 1, start_mode: "known", start_date: "1951", start_basis: "founding_stated", end_mode: "known", end_date: "1951", end_basis: "closure_stated", end_reason: "closed", occupancy_source_account: "open 1951, close 1951 the same year." },
    { segment_index: 2, start_mode: "known", start_date: "1964", start_basis: "founding_stated", end_mode: "after", end_not_earlier_than: "1973", end_basis: "last_seen_only", end_reason: "unknown", occupancy_source_account: "open 1964; still open when the sources stop (censored 1973)." },
  ];
  const segments = rows.map((row) => segmentFromImportRow(row, DEFAULTS).segment);
  assert.ok(segments.every(Boolean));
  assert.doesNotThrow(() => assertOccupancySet(segments, REF, POINT));
});
