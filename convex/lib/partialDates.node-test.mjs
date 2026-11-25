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
import { importRowDateProblems, NOMINATION_CONFIRMABLE_COLUMNS, validateImportRow } from "./importRow.ts";
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

test("backend: the batch import row (convex/lib/importRow.ts), as both routes apply it", () => {
  const base = { row_number: 1, name: "St Example", country_code: "NZ", source_locator: "entry 1", containing_area: "Wellington", claim_hash: "0" };
  for (const column of ["first_date", "last_date"]) {
    // before the duplicate check: the form only, as before stage 1, so a row
    // already imported keeps its skip
    expectEach(
      `validateImportRow ${column}`,
      given,
      (value) => !validateImportRow({ ...base, [column]: value }, "NZ").some((problem) => problem.startsWith(`Write ${column}`)),
      (row) => row.form,
    );
    // after it, for a fresh row: a historical date (floor 1 leaves the floor out)
    expectEach(
      `importRowDateProblems ${column}`,
      given,
      (value) => !importRowDateProblems({ ...base, [column]: value }, 1, NOMINATION_CONFIRMABLE_COLUMNS).some((problem) => problem.startsWith(`Write ${column}`)),
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

test("portal: the guided form's date bindings (verification-map.js evidenceInputError), as they stand until the portal step", () => {
  // the production method, run with the observation check it calls; the
  // guided form checks the source date and the lifecycle date with the
  // observation range. for the source date that matches the backend without
  // a confirmation. for the lifecycle date it is stricter than the backend,
  // which takes a historical date with the floor: the portal step (step 2 of
  // the build order) rebinds it with the confirmation prompt
  const source = fs.readFileSync(path.join(repoRoot, "apps/regions/nz/js/verification-map.js"), "utf8");
  const declaration = (name) => {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf("\n}\n", start) + 3);
  };
  const methodStart = source.indexOf("    evidenceInputError(values, options = {}) {");
  const method = source.slice(methodStart, source.indexOf("\n    }\n", methodStart) + 7);
  const window = portal(["partial-date.js"]);
  const evidenceInputError = new Function("window", `${declaration("isPlaceholderText")}\n${declaration("isValidPartialDateText")}\nreturn function ${method.trim()}`)(window);
  const app = { observationContractVersionFor: () => "guided_observation_v1" };
  const values = {
    denominationRaw: "", denominationLabelBasis: "unknown", denominationRelation: "uncertain", interpretationNote: "", uncertaintyNote: "",
    targetYearConfidence: {}, targetYearStatuses: {}, sourceTitle: "Mission yearbook", sourceUrl: "https://example.org/yearbook", sourceType: "denominational_directory",
    note: "The yearbook records the founding.", sourceDate: "", lifecycleEvent: "", lifecycleDate: "", lifecycleNote: "", action: "confirm_current_record",
    relatedIds: "", changeClass: "uncertain",
  };
  const check = (changes) => evidenceInputError.call(app, { ...values, ...changes }, { submit: true });
  assert.equal(check({}), "");
  for (const row of given) {
    const lifecycle = check({ lifecycleEvent: "first_seen", lifecycleDate: row.value });
    assert.equal(!/opening\/closure\/change dates/.test(lifecycle), row.observation || row.value.trim() !== row.value, `lifecycle ${row.value}`);
    const sourceDate = check({ sourceDate: row.value });
    assert.equal(!/source and capture dates/.test(sourceDate), row.observation || row.value.trim() !== row.value, `source date ${row.value}`);
  }
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

test("workbench: the evidence form binds each source date by its purpose", async () => {
  const { isSourceDate } = await import("../../apps/workbench/src/data/partialDates.ts");
  for (const row of given) {
    const early = row.historical && Number(row.value.slice(0, 4)) < 1000;
    for (const sourceType of ["street_imagery", "aerial_imagery", "field_observation"]) {
      assert.equal(isSourceDate(sourceType, row.value), row.observation, `${sourceType} ${row.value}`);
    }
    assert.equal(isSourceDate("denominational_yearbook", row.value), row.observation || early, `documentary ${row.value}`);
  }
  // the form calls it with the source's own type (a .tsx file node does not load)
  const form = fs.readFileSync(path.join(repoRoot, "apps/workbench/src/screens/EvidenceForm.tsx"), "utf8");
  assert.match(form, /isSourceDate\(source\.sourceType, source\.sourceDate\)/);
  assert.doesNotMatch(form, /isHistoricalDate\(source\.sourceDate\)/);
});

test("json schemas: every partial-date property checks the form only", async () => {
  // the properties bound to the partial-date pattern, found by walking each
  // schema; a new date property must join this list, and every one is run
  // against the fixture through the backend's own schema checker
  const { schemaCheck } = await import("./agentIntake.ts");
  const PATTERN = "^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$";
  const expected = {
    "schemas/change-event.schema.json": [
      "#/$defs/BoundedDate/properties/value",
      "#/$defs/BoundedDate/properties/not_earlier_than",
      "#/$defs/BoundedDate/properties/not_later_than",
      "#/$defs/ArchiveRef/properties/consulted_date",
      "#/$defs/SourceReference/properties/source_date",
      "#/$defs/SourceReference/properties/consulted_date"
    ],
    "schemas/inspection-case.v1.schema.json": [
      "#/properties/source_snapshot_date",
      "#/$defs/source/properties/publication_date",
      "#/$defs/source/properties/returned_date",
      "#/$defs/claim/properties/described_date",
      "#/$defs/claim/properties/observation_date"
    ],
    "schemas/inspection-collection.v1.schema.json": [
      "#/properties/source_snapshot_date"
    ],
    "scripts/agent_research/schemas/agent-dossier.v1.json": [
      "#/properties/status_assessment/properties/asof_date",
      "#/$defs/claim/properties/date_start",
      "#/$defs/claim/properties/date_end",
      "#/$defs/claim/properties/confirmed_dates/items/properties/date"
    ],
    "scripts/agent_research/schemas/agent-review-bundle.v1.json": [
      "#/$defs/dossier/properties/status_assessment/properties/asof_date",
      "#/$defs/dossier/$defs/claim/properties/date_start",
      "#/$defs/dossier/$defs/claim/properties/date_end",
      "#/$defs/dossier/$defs/claim/properties/confirmed_dates/items/properties/date"
    ]
  };
  for (const [file, pointers] of Object.entries(expected)) {
    const root = JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
    const resolve = (node) => {
      let current = node;
      for (let guard = 0; current && typeof current.$ref === "string" && current.$ref.startsWith("#/") && guard < 10; guard += 1) {
        current = current.$ref.slice(2).split("/").reduce((value, key) => value?.[key], root);
      }
      return current;
    };
    const branches = (node) => {
      const resolved = resolve(node);
      return [resolved, ...(resolved?.oneOf ?? resolved?.anyOf ?? []).map(resolve)].filter((branch) => branch?.pattern === PATTERN);
    };
    const bound = [];
    const visit = (node, pointer) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach((item, index) => visit(item, `${pointer}/${index}`));
      for (const [key, value] of Object.entries(node)) {
        if (key === "properties" && value && typeof value === "object") {
          for (const [name, property] of Object.entries(value)) {
            if (branches(property).length > 0) bound.push(`${pointer}/properties/${name}`);
            visit(property, `${pointer}/properties/${name}`);
          }
        } else visit(value, `${pointer}/${key}`);
      }
    };
    visit(root, "#");
    assert.deepEqual(bound, pointers, `${file}: the partial-date properties`);
    for (const pointer of pointers) {
      const property = pointer.slice(2).split("/").reduce((value, key) => value?.[key], root);
      const [branch] = branches(property);
      expectEach(`${file} ${pointer}`, rows, (value) => !throws(() => schemaCheck(value, branch, "$", root)), (row) => row.form);
    }
  }
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
        let text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
        // the date check kept from before stage 1, applied on every write
        if (rel === path.join("convex", "lib", "limits.ts")) {
          const start = text.indexOf("function isValidPartialDateBeforeStage1(");
          text = text.slice(0, start) + text.slice(text.indexOf("\n}\n", start));
        }
        for (const needle of retired) if (text.includes(needle)) found.push(`${rel}: ${needle}`);
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual(found, []);
});
