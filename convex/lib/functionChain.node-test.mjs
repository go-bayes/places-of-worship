import assert from "node:assert/strict";
import test from "node:test";

import {
  assertChainAgreesWithPeriods,
  assertFunctionChain,
  chainDateBounds,
  compileChain,
  deriveFunctions,
  functionChainInputsHash,
  stateLabel,
} from "./functionChain.ts";
import { derivePresence } from "./occupancies.ts";

const REF = "2024-05";
const NZ = [2013, 2018, 2023];
const known = (date) => ({ mode: "known", date });
const between = (a, b) => ({ mode: "between", not_earlier_than: a, not_later_than: b });
const by = (date) => ({ mode: "by", not_later_than: date });

// the brief's worked case (section 4): presbyterian from 1888, shared with
// methodists in the 1920s, desacralised 2014, an annual service after
const KOHEKOHE = {
  contract_version: "function_chain_v1",
  start: { label: "Presbyterian", label_basis: "named_documentary_source", date: between("1887", "1889") },
  changes: [
    { change: "shared_use_began", label: "Methodist", date: between("1920", "1929") },
    { change: "shared_use_ended", date: by("1930") },
    { change: "desacralised", date: known("2014") },
    { change: "use_became_intermittent", date: known("2014"), use_frequency: "annual" },
  ],
};

const AT = { latitude: -37.2, longitude: 174.8, location_mode: "building_identified", location_basis: "map_placement" };
const provenance = {
  confidence: "moderate",
  confidence_basis: "Parish history read directly.",
  source_basis: "named_public_source",
  source_title: "Kohekohe parish history",
  source_reference: "https://example.org/kohekohe",
  source_account: "The history dates the church, the shared decade, and the 2014 deconsecration.",
  privacy_flag: "clear",
};
const KOHEKOHE_PERIODS = [
  {
    contract_version: "occupancy_v1", segment_index: 0,
    start_mode: "between", start_not_earlier_than: "1887", start_not_later_than: "1889", start_basis: "founding_stated",
    end_mode: "known", end_date: "2014", end_basis: "closure_stated", end_reason: "desacralised",
    use_frequency: "regular", location_relation: "same_as_task_point", ...provenance,
  },
  {
    contract_version: "occupancy_v1", segment_index: 1,
    start_mode: "known", start_date: "2014", start_basis: "first_seen_only",
    end_mode: "still_active", still_active_asof: REF, end_basis: "unknown",
    use_frequency: "annual", location_relation: "same_as_task_point", ...provenance,
  },
];

// ruling r-f5 (option 2): the same building deconsecrated 1930 and resumed
// as anglican in 1950 is one chain on one site
const RESUMED = {
  contract_version: "function_chain_v1",
  start: { label: "Presbyterian", date: known("1888") },
  changes: [
    { change: "desacralised", date: known("1930") },
    { change: "worship_resumed", label: "Anglican", date: known("1950") },
  ],
};
const RESUMED_PERIODS = [
  { ...KOHEKOHE_PERIODS[0], start_mode: "known", start_date: "1888", start_not_earlier_than: undefined, start_not_later_than: undefined, end_date: "1930" },
  { ...KOHEKOHE_PERIODS[1], start_date: "1950", start_basis: "reopening_stated", use_frequency: "regular" },
];

test("r-f5: worship resumed after a desacralisation is one chain, deriving the new label after the gap", () => {
  assert.doesNotThrow(() => assertFunctionChain(RESUMED, REF));
  const { states, events } = compileChain(RESUMED);
  assert.deepEqual(states.map(stateLabel), ["Presbyterian", "Anglican"]);
  assert.equal(states[0].ended_by, "desacralised");
  assert.equal(states[1].began_by, "worship_resumed");
  assert.deepEqual(events.map((e) => e.change), ["desacralised"]);
  assert.deepEqual(deriveFunctions(RESUMED, [1925, 1940, 1960, 2013]).map((r) => `${r.target_year}:${r.derived_status}:${r.label}:${r.rule_id}`), [
    "1925:stated:Presbyterian:inside_state",
    "1960:stated:Anglican:inside_state",
    "2013:stated:Anglican:inside_state",
  ]);
  // a resumption dated by bounds has its own start window
  const bounded = { ...RESUMED, changes: [RESUMED.changes[0], { change: "worship_resumed", label: "Anglican", date: between("1948", "1952") }] };
  assert.deepEqual(deriveFunctions(bounded, [1950]).map((r) => `${r.target_year}:${r.derived_status}:${r.candidate_labels.join("|")}:${r.rule_id}`), ["1950:uncertain:Anglican:within_start_window"]);
  // after the resumption ordinary changes are permitted again
  const again = { ...RESUMED, changes: [...RESUMED.changes, { change: "denomination_changed", label: "Uniting", date: known("1970") }] };
  assert.doesNotThrow(() => assertFunctionChain(again, REF));
  assert.deepEqual(deriveFunctions(again, [1980]).map((r) => r.label), ["Uniting"]);
  // and the resumption is refused without a desacralisation, or without its label
  assert.throws(() => assertFunctionChain({ ...RESUMED, changes: [RESUMED.changes[1]] }, REF), /only after a recorded desacralisation/);
  assert.throws(() => assertFunctionChain({ ...RESUMED, changes: [RESUMED.changes[0], { change: "worship_resumed", date: known("1950") }] }, REF), /denomination that resumed worship/);
  // the periods must carry the stated reopening
  assert.doesNotThrow(() => assertChainAgreesWithPeriods(RESUMED, RESUMED_PERIODS));
  const notReopened = RESUMED_PERIODS.map((s) => (s.segment_index === 1 ? { ...s, start_basis: "first_seen_only" } : s));
  assert.throws(() => assertChainAgreesWithPeriods(RESUMED, notReopened), /basis reopening stated/);
  // presence across the gap: absent between the stated closure and the stated reopening
  const segments = RESUMED_PERIODS.map((s, i) => ({ ...s, occupancy_id: `s${i}`, ...AT }));
  assert.deepEqual(derivePresence(segments, [1925, 1940, 1960]).map((r) => `${r.target_year}:${r.derived_status}`), ["1925:present", "1940:absent", "1960:present"]);
});

test("kohekohe compiles to three states and two events", () => {
  const { states, events } = compileChain(KOHEKOHE);
  assert.deepEqual(states.map(stateLabel), ["Presbyterian", "Presbyterian, shared with Methodist", "Presbyterian"]);
  assert.equal(states[2].ended_by, "desacralised");
  assert.deepEqual(events.map((e) => e.change), ["desacralised", "use_became_intermittent"]);
});

test("kohekohe derives presbyterian in 2013 and nothing after the desacralisation", () => {
  assert.deepEqual(deriveFunctions(KOHEKOHE, NZ).map((r) => `${r.target_year}:${r.derived_status}:${r.label ?? r.candidate_labels.join("|")}:${r.rule_id}`), [
    "2013:stated:Presbyterian:inside_state",
  ]);
  // the shared decade is uncertain at its window and stated inside it
  assert.deepEqual(deriveFunctions(KOHEKOHE, [1920, 1925, 1929, 1935]).map((r) => `${r.target_year}:${r.derived_status}:${r.label ?? r.candidate_labels.join("|")}`), [
    "1920:uncertain:Presbyterian|Presbyterian, shared with Methodist",
    "1925:uncertain:Presbyterian|Presbyterian, shared with Methodist",
    "1929:uncertain:Presbyterian|Presbyterian, shared with Methodist",
    "1935:stated:Presbyterian",
  ]);
  // before the first state's window: nothing; inside it: the start window
  assert.deepEqual(deriveFunctions(KOHEKOHE, [1880, 1888]).map((r) => `${r.target_year}:${r.derived_status}:${r.rule_id}`), [
    "1888:uncertain:within_start_window",
  ]);
});

test("kohekohe periods derive present, uncertain, uncertain under rule 11", () => {
  const segments = KOHEKOHE_PERIODS.map((s, i) => ({ ...s, occupancy_id: `s${i}`, ...AT }));
  assert.deepEqual(derivePresence(segments, NZ).map((r) => `${r.target_year}:${r.derived_status}:${r.rule_id}`), [
    "2013:present:inside_interval",
    "2018:uncertain:intermittent_use",
    "2023:uncertain:intermittent_use",
  ]);
  // several times a year still counts as in use (ruling r-f1)
  const monthly = segments.map((s) => (s.segment_index === 1 ? { ...s, use_frequency: "several_times_a_year" } : s));
  assert.equal(derivePresence(monthly, [2018])[0].derived_status, "present");
});

test("the chain must agree with the periods it closes and splits", () => {
  assert.doesNotThrow(() => assertChainAgreesWithPeriods(KOHEKOHE, KOHEKOHE_PERIODS));
  const noDesacralisedEnd = KOHEKOHE_PERIODS.map((s) => (s.segment_index === 0 ? { ...s, end_reason: "closed" } : s));
  assert.throws(() => assertChainAgreesWithPeriods(KOHEKOHE, noDesacralisedEnd), /period it closes/);
  const wrongFrequency = KOHEKOHE_PERIODS.map((s) => (s.segment_index === 1 ? { ...s, use_frequency: "occasional" } : s));
  assert.throws(() => assertChainAgreesWithPeriods(KOHEKOHE, wrongFrequency), /needs its period/);
});

test("chain validation: labels, notes, frequency, order, and the desacralisation rule", () => {
  assert.doesNotThrow(() => assertFunctionChain(KOHEKOHE, REF));
  const blankLabel = { ...KOHEKOHE, start: { ...KOHEKOHE.start, label: " " } };
  assert.throws(() => assertFunctionChain(blankLabel, REF), /Name the tradition or denomination/);
  const unnamedChange = { ...KOHEKOHE, changes: [{ change: "denomination_changed", date: known("1950") }] };
  assert.throws(() => assertFunctionChain(unnamedChange, REF), /name the new denomination/);
  const otherWithoutNote = { ...KOHEKOHE, changes: [{ change: "other", date: known("1950"), note: "short" }] };
  assert.throws(() => assertFunctionChain(otherWithoutNote, REF), /at least 12 characters/);
  const intermittentWithoutFrequency = { ...KOHEKOHE, changes: [{ change: "use_became_intermittent", date: known("1950") }] };
  assert.throws(() => assertFunctionChain(intermittentWithoutFrequency, REF), /how often/);
  const outOfOrder = { ...KOHEKOHE, changes: [{ change: "desacralised", date: known("2014") }, { change: "denomination_changed", label: "Anglican", date: known("1990") }] };
  assert.throws(() => assertFunctionChain(outOfOrder, REF), /date order/);
  const afterDesacralisation = { ...KOHEKOHE, changes: [{ change: "desacralised", date: known("2000") }, { change: "denomination_changed", label: "Anglican", date: known("2010") }] };
  assert.throws(() => assertFunctionChain(afterDesacralisation, REF), /after a desacralisation/);
  const endedWithoutShared = { ...KOHEKOHE, changes: [{ change: "shared_use_ended", date: known("1930") }] };
  assert.throws(() => assertFunctionChain(endedWithoutShared, REF), /no shared use is in force/);
  const future = { ...KOHEKOHE, changes: [{ change: "desacralised", date: known("2030") }] };
  assert.throws(() => assertFunctionChain(future, REF), /reference date/);
  // p2-2: a latest-only desacralisation cannot close a period, so it is refused
  const byDesacralised = { ...KOHEKOHE, changes: [{ change: "desacralised", date: by("2014") }] };
  assert.throws(() => assertFunctionChain(byDesacralised, REF), /latest date alone cannot close the period/);
});

test("p2-3: a by-dated change window runs from the state's certain start", () => {
  // shared use ended by 1930: 1930 falls inside that window with both labels
  assert.deepEqual(deriveFunctions(KOHEKOHE, [1930]).map((r) => `${r.target_year}:${r.derived_status}:${r.candidate_labels.join("|")}:${r.rule_id}`), [
    "1930:uncertain:Presbyterian, shared with Methodist|Presbyterian:within_change_window",
  ]);
});

test("chain date bounds and the inputs hash", () => {
  assert.deepEqual(chainDateBounds(known("2014-03")), { lower: "2014-03-01", upper: "2014-03-31" });
  assert.deepEqual(chainDateBounds(by("1930")), { upper: "1930-12-31" });
  const a = functionChainInputsHash(KOHEKOHE);
  const b = functionChainInputsHash({ ...KOHEKOHE, start: { ...KOHEKOHE.start, label: "Presbyterian " } });
  assert.equal(a, b, "trailing space does not change the derivation");
  const c = functionChainInputsHash({ ...KOHEKOHE, start: { ...KOHEKOHE.start, label: "Anglican" } });
  assert.notEqual(a, c);
});
