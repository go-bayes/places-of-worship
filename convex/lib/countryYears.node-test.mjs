import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { DATE_FLOOR_YEARS, DEFAULT_DATE_FLOOR_YEAR, DEFAULT_TARGET_YEARS, dateFloorYear } from "./countryYears.ts";
import { assertHistoricalClaim } from "./historicalClaims.ts";
import { assertOccupancySegment } from "./occupancies.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function portalMirror(pageFloor) {
  const source = fs.readFileSync(path.join(repoRoot, "apps/regions/nz/js/date-floor.js"), "utf8");
  const context = { window: pageFloor === undefined ? {} : { POW_DATE_FLOOR_YEAR: pageFloor } };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.PowDateFloor;
}

test("every country with census waves has a date floor, and the mirror matches", () => {
  const mirror = portalMirror();
  assert.equal(mirror.DEFAULT_DATE_FLOOR_YEAR, DEFAULT_DATE_FLOOR_YEAR);
  assert.deepEqual({ ...mirror.DATE_FLOOR_YEARS }, DATE_FLOOR_YEARS);
  for (const code of Object.keys(DEFAULT_TARGET_YEARS)) {
    assert.ok(Number.isInteger(DATE_FLOOR_YEARS[code]), `${code} lacks a date floor`);
  }
  for (const [code, floor] of Object.entries(DATE_FLOOR_YEARS)) {
    assert.ok(floor >= 1000 && floor <= DEFAULT_DATE_FLOOR_YEAR, `${code} floor ${floor} outside 1000..${DEFAULT_DATE_FLOOR_YEAR}`);
    assert.equal(mirror.yearFor(code.toLowerCase()), floor);
  }
});

test("unknown or missing countries keep the default floor", () => {
  assert.equal(dateFloorYear("ZZ"), DEFAULT_DATE_FLOOR_YEAR);
  assert.equal(dateFloorYear(undefined), DEFAULT_DATE_FLOOR_YEAR);
  assert.equal(portalMirror().yearFor("zz"), DEFAULT_DATE_FLOOR_YEAR);
  assert.equal(portalMirror().current(), DEFAULT_DATE_FLOOR_YEAR);
  assert.equal(portalMirror(1000).current(), 1000);
});

const claim = {
  claim_kind: "structure",
  claim_timing: "event",
  claim_text: "The chapel was consecrated.",
  earliest_supported_date: "1450",
  latest_supported_date: "1452",
  confidence: "moderate",
  confidence_basis: "Diocesan register entry.",
  source_basis: "named_public_source",
  source_title: "Diocesan register",
  source_reference: "https://example.org/register",
  continues_through_observation: false,
  source_account: "The register records the consecration in 1450 or shortly after.",
  uncertainty_note: "",
  privacy_flag: "clear",
};

test("a historical claim before the floor is refused with the floor named", () => {
  assert.throws(() => assertHistoricalClaim(claim, "2026-09-02"), /from 1600 onward/);
  assert.throws(() => assertHistoricalClaim(claim, "2026-09-02", dateFloorYear("NZ")), /from 1600 onward/);
  assert.doesNotThrow(() => assertHistoricalClaim(claim, "2026-09-02", dateFloorYear("IE")));
});

test("an occupancy segment honours the country floor", () => {
  const segment = {
    contract_version: "occupancy_v1",
    segment_index: 0,
    start_mode: "known",
    start_date: "1520",
    start_basis: "building_dedication",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2020-01-01",
    location_relation: "same_as_task_point",
    confidence: "moderate",
    confidence_basis: "Parish records agree.",
    source_basis: "named_public_source",
    source_title: "Parish register",
    source_reference: "https://example.org/reg",
    source_account: "The register lists the congregation here from 1520.",
    privacy_flag: "clear",
  };
  assert.throws(() => assertOccupancySegment(segment, "2026-09-02"), /from 1600 onward/);
  assert.throws(() => assertOccupancySegment(segment, "2026-09-02", dateFloorYear("VU")), /from 1600 onward/);
  assert.doesNotThrow(() => assertOccupancySegment(segment, "2026-09-02", dateFloorYear("MX")));
});
