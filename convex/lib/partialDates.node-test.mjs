// the shared date test of the deep-time dates, stage 1
// (docs/development/deep-time-date-format-brief-2026-11-24.md, section 5):
// every copy of the partial-date validators runs against one file of test
// dates, schemas/fixtures/partial-dates.v1.json, each marked valid or invalid
// for each kind of date. the python copies run in
// scripts/agent_research/test_partial_dates.py and the rust copies in
// crates/pow-cli/src/partial_date.rs and main.rs, against the same file.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
  assertHistoricalDate,
  assertSourceDate,
  isValidHistoricalDate,
  isValidObservationDate,
  partialDateBounds,
  partialDateYear,
} from "./partialDates.ts";
import { partialDateLower, partialDateUpper } from "./historicalClaims.ts";
import { validateImportRow } from "./importRow.ts";
import { dateBounds } from "./agentIntake.ts";
import { isHistoricalDate as workbenchHistorical, isObservationDate as workbenchObservation } from "../../apps/workbench/src/data/partialDates.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const fixture = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/fixtures/partial-dates.v1.json"), "utf8"));
const rows = fixture.dates;
// a blank field means "no date" to the callers that skip it, so the blank
// row only applies to the copies that are handed a value
const given = rows.filter((row) => row.value !== "");

// loads portal scripts into one browser-like context, in page order
function portal(files, windowValues = {}) {
  const window = { ...windowValues };
  const context = vm.createContext({ window, console });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "apps/regions/nz/js", file), "utf8"), context, { filename: file });
  }
  return window;
}

function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function expectEach(copy, list, actual, expected) {
  for (const row of list) {
    assert.equal(actual(row.value), expected(row), `${copy}: ${JSON.stringify(row.value)} (${row.note})`);
  }
}

test("the fixture is internally consistent", () => {
  assert.equal(fixture.schema_version, "partial-dates.v1");
  assert.ok(rows.length >= 40);
  assert.equal(new Set(rows.map((row) => row.value)).size, rows.length, "each value appears once");
  for (const row of rows) {
    if (row.observation) assert.ok(row.historical, `${row.value}: an observation date is also a historical date`);
    if (row.historical) assert.ok(row.form && Array.isArray(row.bounds), `${row.value}: a historical date has the form and its bounds`);
  }
  for (const value of ["0920", "0000", "-0000", "2101", "1000", "0999"]) {
    assert.ok(rows.some((row) => row.value === value), `the fixture covers ${value}`);
  }
});

test("backend: the two validators, the bounds and the year", () => {
  expectEach("isValidHistoricalDate", rows, isValidHistoricalDate, (row) => row.historical);
  expectEach("isValidObservationDate", rows, isValidObservationDate, (row) => row.observation);
  for (const row of rows) {
    const bounds = partialDateBounds(row.value);
    assert.deepEqual(bounds === null ? null : [bounds.lower, bounds.upper], row.historical ? row.bounds : null, row.value);
    assert.equal(partialDateYear(row.value), row.historical ? Number(row.value.slice(0, 4)) : null, row.value);
  }
});

test("backend: the bounds helpers compare padded years as text", () => {
  for (const row of rows.filter((r) => r.historical)) {
    assert.deepEqual([partialDateLower(row.value), partialDateUpper(row.value)], row.bounds, row.value);
  }
});

test("backend: the historical and source-date checks that the record validators share", () => {
  // with no floor in the way (floor 1), the historical check is the validator
  expectEach("assertHistoricalDate", given, (value) => !throws(() => assertHistoricalDate("The date", value, 1, undefined)), (row) => row.historical);
  // a documentary source's date: the observation range, or below 1000 with a confirmation
  expectEach("assertSourceDate", given, (value) => !throws(() => assertSourceDate("The source date", value, undefined)), (row) => row.observation);
  expectEach(
    "assertSourceDate, confirmed",
    given,
    (value) => !throws(() => assertSourceDate("The source date", value, [{ date: value, confirmed_by: "contributor" }])),
    (row) => row.observation || (row.historical && Number(row.value.slice(0, 4)) < 1000),
  );
});

test("backend: the batch import row (convex/lib/importRow.ts)", () => {
  const base = { row_number: 1, name: "St Example", country_code: "NZ", source_locator: "entry 1", containing_area: "Wellington", claim_hash: "0" };
  for (const column of ["first_date", "last_date"]) {
    expectEach(
      `validateImportRow ${column}`,
      given,
      (value) => !validateImportRow({ ...base, [column]: value }, "NZ").some((problem) => problem.startsWith(`Write ${column}`)),
      (row) => row.historical,
    );
  }
});

test("backend: the agent intake (convex/lib/agentIntake.ts dateBounds)", () => {
  for (const row of given) {
    let bounds = null;
    try {
      bounds = dateBounds(row.value);
    } catch {
      bounds = null;
    }
    assert.deepEqual(bounds, row.historical ? row.bounds : null, `dateBounds: ${row.value} (${row.note})`);
  }
});

test("portal: the three contract scripts at floor 1 are historical-date checks", () => {
  const window = portal(["historical-claim-contract.js", "occupancy-contract.js", "function-chain-contract.js"], { POW_DATE_FLOOR_YEAR: 1 });
  expectEach("PowHistoricalClaim.isValidPartialDate", given, window.PowHistoricalClaim.isValidPartialDate, (row) => row.historical);
  expectEach("PowOccupancy.isValidPartialDate", given, window.PowOccupancy.isValidPartialDate, (row) => row.historical);
  expectEach("PowFunctionChain.isValidPartialDate", given, window.PowFunctionChain.isValidPartialDate, (row) => row.historical);
  for (const row of rows.filter((r) => r.historical)) {
    assert.deepEqual([window.PowOccupancy.partialDateLower(row.value), window.PowOccupancy.partialDateUpper(row.value)], row.bounds, row.value);
  }
});

test("portal: the observation-date check (partial-date.js) and the rapid entry", () => {
  const window = portal(["partial-date.js", "rapid-entry-contract.js"]);
  expectEach("PowPartialDate.isObservationDate", rows, window.PowPartialDate.isObservationDate, (row) => row.observation);
  const today = window.PowRapidEntry.localIsoDate();
  const valid = { currentStatus: "currently_used_for_worship", observationBasis: "direct_field_observation", observedOn: "2026-08-26", privacyFlag: "needs_review" };
  expectEach(
    "PowRapidEntry.validateObservation",
    rows,
    (value) => window.PowRapidEntry.validateObservation({ ...valid, observedOn: value }) === "",
    (row) => row.observation && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.value) && row.value <= today,
  );
});

test("portal: the review page's date helpers (occupancy-review.js)", () => {
  const window = portal(["occupancy-review.js"]);
  for (const row of rows.filter((r) => r.historical)) {
    assert.deepEqual([window.PowOccupancyReview.partialDateLower(row.value), window.PowOccupancyReview.partialDateUpper(row.value)], row.bounds, row.value);
  }
});

test("workbench: the prototype's copy (apps/workbench/src/data/partialDates.ts)", () => {
  expectEach("workbench isHistoricalDate", rows, workbenchHistorical, (row) => row.historical);
  expectEach("workbench isObservationDate", rows, workbenchObservation, (row) => row.observation);
});

test("json schema date patterns check the form only", () => {
  const files = [
    "schemas/change-event.schema.json",
    "schemas/inspection-case.v1.schema.json",
    "schemas/inspection-collection.v1.schema.json",
    "scripts/agent_research/schemas/agent-dossier.v1.json",
    "scripts/agent_research/schemas/agent-review-bundle.v1.json",
  ];
  const datePattern = "^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$";
  for (const file of files) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.ok(text.includes(JSON.stringify(datePattern).slice(1, -1)), `${file} carries the partial-date pattern`);
  }
  const pattern = new RegExp(datePattern);
  expectEach("schema pattern", rows, (value) => pattern.test(value), (row) => row.form);
});

test("no copy of the validators keeps a pattern of its own", () => {
  // the patterns this stage replaced; a new copy should call a validator the
  // shared test reaches, or join this test
  const retired = ["PARTIAL_DATE = /", "1\\d{3}|20\\d{2}|2100"];
  const roots = ["convex", "apps/workbench/src", "apps/regions/nz/js"];
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "_generated") walk(rel);
      } else if (/\.(?:ts|tsx|js|cjs|mjs)$/.test(entry.name) && !entry.name.includes("node-test")) {
        const text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
        for (const needle of retired) if (text.includes(needle)) found.push(`${rel}: ${needle}`);
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual(found, []);
});
