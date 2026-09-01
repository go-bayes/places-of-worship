import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
  assertWideEvidenceRowFields,
  wideEvidenceFields,
  wideEvidenceRowValues,
} from "./wideEvidenceFields.ts";
import { DEFAULT_TARGET_YEARS } from "./countryYears.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function portalMirror() {
  const source = fs.readFileSync(path.join(repoRoot, "apps/regions/nz/js/wide-evidence-fields.js"), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.PowWideEvidenceFields;
}

test("the portal mirror reproduces the server column list for every shipped country", () => {
  const mirror = portalMirror();
  for (const [country, years] of Object.entries(DEFAULT_TARGET_YEARS)) {
    assert.deepEqual([...mirror.fields(years)], wideEvidenceFields(years), `mirror differs for ${country}`);
  }
});

test("the ra template header is the nz column list", () => {
  const header = fs
    .readFileSync(path.join(repoRoot, "docs/templates/ra-historical-site-evidence/site_evidence_wide.csv"), "utf8")
    .split(/\r?\n/)[0]
    .split(",");
  assert.deepEqual(header, wideEvidenceFields(DEFAULT_TARGET_YEARS.NZ));
});

test("target-year columns follow the country's waves in order", () => {
  const vu = wideEvidenceFields([1989, 1999, 2009, 2020]);
  const nz = wideEvidenceFields([2013, 2018, 2023]);
  assert.equal(vu.length, nz.length + 8);
  assert.ok(vu.includes("target_year_1989_status"));
  assert.ok(!nz.includes("target_year_1989_status"));
  assert.equal(vu.indexOf("target_year_2020_location_basis") + 1, vu.indexOf("quality_flag"));
});

const nzFields = wideEvidenceFields([2013, 2018, 2023]);
// 86 fixed columns plus eight per wave

test("a row built from the shared list passes", () => {
  assert.doesNotThrow(() => assertWideEvidenceRowFields({ fields: nzFields, row: { evidence_row_id: "x" } }, [2013, 2018, 2023]));
  // rapid drafts carry no wide row
  assert.doesNotThrow(() => assertWideEvidenceRowFields(undefined, [2013, 2018, 2023]));
});

test("a stale portal list is refused with a reload message", () => {
  const stale = nzFields.filter((field) => field !== "candidate_match_notes");
  assert.throws(
    () => assertWideEvidenceRowFields({ fields: stale, row: {} }, [2013, 2018, 2023]),
    /out of date \(missing candidate_match_notes\)\. Reload the portal/,
  );
  assert.throws(
    () => assertWideEvidenceRowFields({ fields: [...nzFields, "uncertainty_radius_m"], row: {} }, [2013, 2018, 2023]),
    /unexpected uncertainty_radius_m/,
  );
  // another country's waves are a mismatch, not a near miss
  assert.throws(
    () => assertWideEvidenceRowFields({ fields: nzFields, row: {} }, [1989, 1999, 2009, 2020]),
    /out of date/,
  );
});

test("out-of-order columns are refused", () => {
  const reordered = [...nzFields];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => assertWideEvidenceRowFields({ fields: reordered, row: {} }, [2013, 2018, 2023]),
    /columns out of order/,
  );
});

test("row columns outside the list are refused", () => {
  assert.throws(
    () => assertWideEvidenceRowFields({ fields: nzFields, row: { evidence_row_id: "x", secret: 1 } }, [2013, 2018, 2023]),
    /outside the export list: secret/,
  );
});

test("malformed generated rows are refused", () => {
  assert.throws(() => assertWideEvidenceRowFields("nope", [2013]), /must be an object/);
  assert.throws(() => assertWideEvidenceRowFields({ row: {} }, [2013]), /must list its fields/);
  assert.throws(() => assertWideEvidenceRowFields({ fields: nzFields, row: [] }, [2013]), /must carry a row object/);
});

test("export values follow the header and blank missing columns", () => {
  const values = wideEvidenceRowValues({ evidence_row_id: "r1", latitude: -41.2, review_note: null }, ["evidence_row_id", "latitude", "review_note", "quality_flag"]);
  assert.deepEqual(values, ["r1", -41.2, "", ""]);
});
