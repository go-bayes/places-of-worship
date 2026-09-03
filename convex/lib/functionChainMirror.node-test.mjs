// holds the portal's function-chain mirror (apps/regions/nz/js/function-chain-contract.js)
// equal to the server (convex/lib/functionChain.ts) on the brief's worked
// case and a fixture set that fires every function rule, and asserts the
// exact per-year output for the kohekohe-shaped illustration (fictional dates)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertFunctionChain, compileChain, deriveFunctions, stateLabel } from "./functionChain.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const mirrorPath = path.join(here, "..", "..", "apps", "regions", "nz", "js", "function-chain-contract.js");
globalThis.window = {};
new Function(fs.readFileSync(mirrorPath, "utf8"))();
const mirror = globalThis.window.PowFunctionChain;

const NZ = [2013, 2018, 2023];
const REF = "2024-05";

// form-shaped fixtures, as the cards hold them
const FIXTURES = {
  "kohekohe illustration (brief section 4b, fictional dates)": {
    start: { label: "Presbyterian", labelBasis: "named_documentary_source", dateMode: "known", date: "1888", notEarlierThan: "", notLaterThan: "", around: true },
    changes: [
      { change: "shared_use_began", label: "Methodist", note: "", frequency: "", dateMode: "between", date: "", notEarlierThan: "1920", notLaterThan: "1929", around: false },
      { change: "shared_use_ended", label: "", note: "", frequency: "", dateMode: "by", date: "", notEarlierThan: "", notLaterThan: "1930", around: false },
      { change: "desacralised", label: "", note: "", frequency: "", dateMode: "known", date: "2014", notEarlierThan: "", notLaterThan: "", around: false },
      { change: "use_became_intermittent", label: "", note: "", frequency: "annual", dateMode: "known", date: "2014", notEarlierThan: "", notLaterThan: "", around: false },
    ],
  },
  "desacralised then resumed as anglican (r-f5)": {
    start: { label: "Presbyterian", labelBasis: "", dateMode: "known", date: "1888", notEarlierThan: "", notLaterThan: "", around: false },
    changes: [
      { change: "desacralised", label: "", note: "", frequency: "", dateMode: "known", date: "1930", notEarlierThan: "", notLaterThan: "", around: false },
      { change: "worship_resumed", label: "Anglican", note: "", frequency: "", dateMode: "known", date: "1950", notEarlierThan: "", notLaterThan: "", around: false },
    ],
  },
  "denomination changed with a dated window": {
    start: { label: "Wesleyan", labelBasis: "", dateMode: "known", date: "1900", notEarlierThan: "", notLaterThan: "", around: false },
    changes: [
      { change: "denomination_changed", label: "Uniting", note: "", frequency: "", dateMode: "between", date: "", notEarlierThan: "2017", notLaterThan: "2019", around: false },
      { change: "building_rebuilt", label: "", note: "", frequency: "", dateMode: "known", date: "2020", notEarlierThan: "", notLaterThan: "", around: false },
    ],
  },
  "start known only by a date": {
    start: { label: "Anglican", labelBasis: "", dateMode: "by", date: "", notEarlierThan: "", notLaterThan: "2015", around: false },
    changes: [],
  },
  "other change with a note": {
    start: { label: "Catholic", labelBasis: "", dateMode: "known", date: "1950", notEarlierThan: "", notLaterThan: "", around: false },
    changes: [{ change: "other", label: "", note: "Parish merged with its neighbour, same building.", frequency: "", dateMode: "known", date: "2016", notEarlierThan: "", notLaterThan: "", around: false }],
  },
};

const strip = (rows) => rows.map((r) => ({ y: r.target_year, s: r.derived_status, l: r.label ?? null, c: r.candidate_labels, r: r.rule_id }));

for (const [name, chain] of Object.entries(FIXTURES)) {
  test(`mirror equals server: ${name}`, () => {
    const payload = mirror.payload(chain);
    assert.doesNotThrow(() => assertFunctionChain(payload, REF));
    assert.equal(mirror.validateChain(chain, REF), "");
    assert.deepEqual(strip(mirror.deriveFunctions(chain, [...NZ, 1888, 1925, 1930, 1935, 1940, 1960, 2016, 2018])), strip(deriveFunctions(payload, [...NZ, 1888, 1925, 1930, 1935, 1940, 1960, 2016, 2018])));
    assert.deepEqual(mirror.compileChain(chain).states.map((s) => mirror.stateLabel(s)), compileChain(payload).states.map(stateLabel));
  });
}

test("every function rule fires at least once across the fixtures", () => {
  const fired = new Set();
  for (const chain of Object.values(FIXTURES)) {
    for (const row of mirror.deriveFunctions(chain, [1888, 1925, 2014, 2016, 2018, 2023])) fired.add(row.rule_id);
  }
  for (const rule of Object.keys(mirror.FUNCTION_RULE_WORDS)) assert.ok(fired.has(rule), `rule ${rule} never fired`);
});

test("worked case: kohekohe derives presbyterian in 2013 and nothing after the desacralisation", () => {
  const rows = mirror.deriveFunctions(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], NZ);
  assert.deepEqual(rows.map((r) => `${r.target_year}:${r.derived_status}:${r.label}`), ["2013:stated:Presbyterian"]);
  // p2-3: shared use ended by 1930, so 1930 is uncertain between both labels on both sides
  const y1930 = mirror.deriveFunctions(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], [1930]);
  assert.deepEqual(y1930.map((r) => `${r.target_year}:${r.derived_status}:${r.candidate_labels.join("|")}:${r.rule_id}`), [
    "1930:uncertain:Presbyterian, shared with Methodist|Presbyterian:within_change_window",
  ]);
  assert.equal(mirror.describeFunctions(rows, NZ), "Denomination: 2013 Presbyterian (inside the recorded state); 2018 not assessed; 2023 not assessed.");
});

test("worked case (r-f5): the gap derives nothing and the resumed state derives the new label on both sides", () => {
  const chain = FIXTURES["desacralised then resumed as anglican (r-f5)"];
  const expected = ["1925:stated:Presbyterian:inside_state", "1960:stated:Anglican:inside_state"];
  const words = (rows) => rows.map((r) => `${r.target_year}:${r.derived_status}:${r.label}:${r.rule_id}`);
  assert.deepEqual(words(mirror.deriveFunctions(chain, [1925, 1940, 1960])), expected);
  assert.deepEqual(words(deriveFunctions(mirror.payload(chain), [1925, 1940, 1960])), expected);
  // the same refusal on both sides when the desacralisation is missing
  const noGap = { ...chain, changes: [chain.changes[1]] };
  const message = mirror.validateChain(noGap, REF);
  assert.match(message, /only after a recorded desacralisation/);
  assert.throws(() => assertFunctionChain(mirror.payload(noGap), REF), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // the resumption opens a period with the stated reopening
  const cards = [{ startMode: "known", startDate: "1888", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: REF, useFrequency: "regular", sameAsPin: true, location: null }];
  const applied = mirror.applyToPeriods(chain, cards, REF);
  assert.equal(applied.segments.length, 2);
  assert.equal(applied.segments[0].endReason, "desacralised");
  assert.equal(applied.segments[1].startDate, "1950");
  assert.equal(applied.segments[1].startBasis, "reopening_stated");
  assert.equal(applied.segments[1].endMode, "still_active");
  assert.deepEqual(mirror.applyToPeriods(chain, applied.segments, REF).notes, []);
});

test("the mirror refuses what the server refuses", () => {
  const bad = { ...FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], start: { ...FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"].start, label: "" } };
  assert.match(mirror.validateChain(bad, REF), /Name the tradition/);
  assert.throws(() => assertFunctionChain(mirror.payload(bad), REF), /Name the tradition/);
  // p2-2: a latest-only desacralisation is refused with the same words on both sides
  const byDesacralised = { ...FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], changes: [{ change: "desacralised", label: "", note: "", frequency: "", dateMode: "by", date: "", notEarlierThan: "", notLaterThan: "2014", around: false }] };
  const message = mirror.validateChain(byDesacralised, REF);
  assert.match(message, /latest date alone cannot close the period/);
  assert.throws(() => assertFunctionChain(mirror.payload(byDesacralised), REF), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // and applying it to the cards forges nothing
  const untouched = mirror.applyToPeriods(byDesacralised, [{ startMode: "known", startDate: "1888", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: REF, useFrequency: "regular", sameAsPin: true }], REF);
  assert.equal(untouched.segments[0].endMode, "still_active");
  assert.deepEqual(untouched.notes, []);
  const unordered = { ...FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], changes: [FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"].changes[2], FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"].changes[0]] };
  assert.match(mirror.validateChain(unordered, REF), /date order/);
  assert.throws(() => assertFunctionChain(mirror.payload(unordered), REF), /date order/);
});

test("the chain writes the period it closes and the period it splits (brief 2.2, 2.3)", () => {
  const cards = [{ startMode: "known", startDate: "1888", startAround: true, startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: REF, endBasis: "", endReason: "", useFrequency: "regular", sameAsPin: true, location: null }];
  const applied = mirror.applyToPeriods(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], cards, REF);
  assert.equal(applied.segments.length, 2);
  assert.equal(applied.segments[0].endMode, "known");
  assert.equal(applied.segments[0].endDate, "2014");
  assert.equal(applied.segments[0].endBasis, "closure_stated");
  assert.equal(applied.segments[0].endReason, "desacralised");
  assert.equal(applied.segments[1].startDate, "2014");
  assert.equal(applied.segments[1].startBasis, "first_seen_only");
  assert.equal(applied.segments[1].endMode, "still_active");
  assert.equal(applied.segments[1].useFrequency, "annual");
  // applying again changes nothing
  const again = mirror.applyToPeriods(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"], applied.segments, REF);
  assert.equal(again.segments.length, 2);
  assert.deepEqual(again.notes, []);
  // the stored payload round-trips to the form shape
  const back = mirror.chainFromPayload(mirror.payload(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"]));
  assert.equal(back.start.label, "Presbyterian");
  assert.equal(back.changes.length, 4);
  assert.equal(back.changes[3].frequency, "annual");
  assert.deepEqual(mirror.payload(back).changes, mirror.payload(FIXTURES["kohekohe illustration (brief section 4b, fictional dates)"]).changes);
});
