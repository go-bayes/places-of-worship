import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOccupancySegment,
  assertOccupancySet,
  combinePresence,
  deriveLocations,
  derivePresence,
  gapYears,
  occupancyInputsHash,
  presenceForSegment,
  segmentBounds,
  startPrecision,
  endPrecision,
} from "./occupancies.ts";

const REF = "2026-09-02";
const VU_YEARS = [1989, 1999, 2009, 2020];
const PIN = { latitude: -17.74, longitude: 168.32 };

const provenance = {
  confidence: "moderate",
  confidence_basis: "Survey entry read directly.",
  source_basis: "named_public_source",
  source_title: "Churches in Port Vila (2010)",
  source_account: "The survey lists the founding year and says the congregation still meets.",
  privacy_flag: "clear",
};

function input(overrides) {
  return {
    contract_version: "occupancy_v1",
    segment_index: 0,
    start_mode: "known",
    start_date: "1980",
    start_basis: "founding_stated",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2010-06-01",
    location_relation: "same_as_task_point",
    ...provenance,
    ...overrides,
  };
}

// a stored segment as the derivation sees it
function stored(id, overrides) {
  return {
    occupancy_id: id,
    segment_index: 0,
    start_mode: "known",
    start_date: "1980",
    start_basis: "founding_stated",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2010-06-01",
    latitude: PIN.latitude,
    longitude: PIN.longitude,
    location_mode: "building_identified",
    location_basis: "map_placement",
    ...overrides,
  };
}

test("the worked example: founded 1980, still going in 2010", () => {
  const rows = derivePresence([stored("a")], VU_YEARS);
  assert.deepEqual(rows.map((r) => [r.target_year, r.derived_status, r.rule_id]), [
    [1989, "present", "inside_interval"],
    [1999, "present", "inside_interval"],
    [2009, "present", "inside_interval"],
    [2020, "uncertain", "beyond_active_anchor"],
  ]);
});

test("a stated founding licenses absence before it; a first record does not", () => {
  const founded = stored("a", { start_date: "1995" });
  assert.equal(presenceForSegment(founded, 1989).rule_id, "before_stated_founding");
  const reopened = { ...founded, start_basis: "reopening_stated" };
  assert.equal(presenceForSegment(reopened, 1989).rule_id, "before_stated_reopening");
  assert.equal(presenceForSegment(reopened, 1989).status, "absent");
  const dedicatedStart = { ...founded, start_basis: "building_dedication" };
  assert.equal(presenceForSegment(dedicatedStart, 1989).rule_id, "before_first_record");
  assert.equal(presenceForSegment(dedicatedStart, 1989).status, "uncertain");
  assert.equal(presenceForSegment(founded, 1989).status, "absent");
  const seen = stored("a", { start_date: "1995", start_basis: "first_seen_only" });
  assert.equal(presenceForSegment(seen, 1989).rule_id, "before_first_record");
  assert.equal(presenceForSegment(seen, 1989).status, "uncertain");
  const dedicated = stored("a", { start_date: "1995", start_basis: "building_dedication" });
  assert.equal(presenceForSegment(dedicated, 1989).status, "uncertain");
});

test("a stated closure licenses absence after it; a last record does not", () => {
  const closed = stored("a", { end_mode: "known", end_date: "2000", end_basis: "closure_stated", end_reason: "closed", still_active_asof: undefined });
  assert.equal(presenceForSegment(closed, 2009).rule_id, "after_stated_closure");
  assert.equal(presenceForSegment(closed, 2009).status, "absent");
  const lastSeen = stored("a", { end_mode: "known", end_date: "2000", end_basis: "last_seen_only", end_reason: "unknown", still_active_asof: undefined });
  assert.equal(presenceForSegment(lastSeen, 2009).rule_id, "after_last_record");
  assert.equal(presenceForSegment(lastSeen, 2009).status, "uncertain");
});

test("uncertainty windows make the census year uncertain, not present", () => {
  const between = stored("a", { start_mode: "between", start_date: undefined, start_not_earlier_than: "1985", start_not_later_than: "1992" });
  assert.equal(presenceForSegment(between, 1989).rule_id, "within_start_window");
  assert.equal(presenceForSegment(between, 1999).rule_id, "inside_interval");
  const endWindow = stored("a", { end_mode: "between", end_not_earlier_than: "2005", end_not_later_than: "2012", end_basis: "last_seen_only", end_reason: "unknown", still_active_asof: undefined });
  assert.equal(presenceForSegment(endWindow, 2009).rule_id, "within_end_window");
  assert.equal(presenceForSegment(endWindow, 2020).rule_id, "after_last_record");
});

test("partial-date bounds resolve conservatively", () => {
  // a year-precision start of 1989 overlaps the 1989 census year: uncertain
  const sameYear = stored("a", { start_date: "1989" });
  assert.equal(presenceForSegment(sameYear, 1989).rule_id, "within_start_window");
  // a day-precision start on 1 january is inside
  const firstDay = stored("a", { start_date: "1989-01-01" });
  assert.equal(presenceForSegment(firstDay, 1989).rule_id, "inside_interval");
});

test("undated ends and starts are judgements, not silence", () => {
  const openEnd = stored("a", { end_mode: "unknown", end_basis: "unknown", still_active_asof: undefined });
  assert.equal(presenceForSegment(openEnd, 1999).rule_id, "end_unknown");
  const openStart = stored("a", { start_mode: "unknown", start_date: undefined, start_basis: "unknown", end_mode: "known", end_date: "2000", end_basis: "closure_stated", end_reason: "closed", still_active_asof: undefined });
  assert.equal(presenceForSegment(openStart, 1989).rule_id, "start_unknown");
  assert.equal(presenceForSegment(openStart, 2009).rule_id, "after_stated_closure");
});

test("a by-date start makes every earlier year uncertain", () => {
  const by = stored("a", { start_mode: "by", start_date: undefined, start_not_later_than: "1995", start_basis: "first_seen_only" });
  assert.equal(presenceForSegment(by, 1989).rule_id, "within_start_window");
  assert.equal(presenceForSegment(by, 1999).rule_id, "inside_interval");
});

test("segments combine: present beats uncertain beats absent; no firing means no row", () => {
  assert.equal(combinePresence(1999, []), null);
  const rows = derivePresence([
    stored("a", { end_mode: "known", end_date: "1990", end_basis: "closure_stated", end_reason: "relocated", still_active_asof: undefined }),
    stored("b", { segment_index: 1, start_date: "1992", latitude: -17.7, longitude: 168.3 }),
  ], VU_YEARS);
  assert.deepEqual(rows.map((r) => [r.target_year, r.derived_status]), [
    [1989, "present"],
    [1999, "present"],
    [2009, "present"],
    [2020, "uncertain"],
  ]);
});

test("relocation: the year's location follows the occupancy in force", () => {
  const a = stored("a", { start_date: "1978", end_mode: "between", end_not_earlier_than: "1994", end_not_later_than: "1997", end_basis: "closure_stated", end_reason: "relocated", still_active_asof: undefined, location_mode: "approximate_area", uncertainty_radius_m: 500 });
  const b = stored("b", { segment_index: 1, start_mode: "between", start_date: undefined, start_not_earlier_than: "1994", start_not_later_than: "1997", latitude: -17.70, longitude: 168.30 });
  const presences = derivePresence([a, b], VU_YEARS);
  const locations = deriveLocations([a, b], presences, VU_YEARS);
  const byYear = (year) => locations.filter((l) => l.target_year === year);
  assert.deepEqual(byYear(1989).map((l) => [l.rule_id, l.occupancy_id, l.location_status, l.uncertainty_radius_m]), [["occupancy_covers_year", "a", "located", 500]]);
  // 1999 is inside b's core (start window closes 1997-12-31)
  assert.deepEqual(byYear(1999).map((l) => [l.rule_id, l.occupancy_id]), [["occupancy_covers_year", "b"]]);
  assert.deepEqual(byYear(2009).map((l) => [l.rule_id, l.occupancy_id]), [["occupancy_covers_year", "b"]]);
  // 2020 is beyond b's anchor: its own window, uncertain
  assert.deepEqual(byYear(2020).map((l) => [l.rule_id, l.occupancy_id, l.location_status]), [["within_own_window", "b", "located_uncertain"]]);
});

test("a transition year lists both locations as one group", () => {
  const a = stored("a", { start_date: "1978", end_mode: "between", end_not_earlier_than: "1998", end_not_later_than: "2001", end_basis: "closure_stated", end_reason: "relocated", still_active_asof: undefined });
  const b = stored("b", { segment_index: 1, start_mode: "between", start_date: undefined, start_not_earlier_than: "1998", start_not_later_than: "2001", latitude: -17.70, longitude: 168.30 });
  const presences = derivePresence([a, b], [1999]);
  assert.equal(presences[0].derived_status, "uncertain");
  const locations = deriveLocations([a, b], presences, [1999]);
  assert.equal(locations.length, 2);
  assert.ok(locations.every((l) => l.rule_id === "transition_window" && l.location_status === "located_uncertain"));
  assert.equal(locations[0].transition_group, locations[1].transition_group);
});

test("l4 imputes from the nearest period, radius unchanged, gap recorded", () => {
  // first seen 1995, still active 2010: 1989 is uncertain (before first record) with no segment reaching it
  const a = stored("a", { start_date: "1995", start_basis: "first_seen_only", location_mode: "approximate_area", uncertainty_radius_m: 1000 });
  const presences = derivePresence([a], [1989]);
  assert.equal(presences[0].derived_status, "uncertain");
  const locations = deriveLocations([a], presences, [1989]);
  assert.deepEqual(locations.map((l) => [l.rule_id, l.location_status, l.gap_years, l.uncertainty_radius_m]), [["imputed_from_nearest", "imputed", 6, 1000]]);
  assert.equal(gapYears(a, 1989), 6);
  assert.equal(gapYears(a, 2020), 10);
});

test("absence yields no location rows", () => {
  const a = stored("a", { start_date: "1995" });
  const presences = derivePresence([a], [1989]);
  assert.equal(presences[0].derived_status, "absent");
  assert.deepEqual(deriveLocations([a], presences, [1989]), []);
});

test("bounds and precision follow the modes", () => {
  const b = segmentBounds(stored("a", { start_date: "1980-03", end_mode: "after", end_not_earlier_than: "2001", end_basis: "last_seen_only", end_reason: "unknown", still_active_asof: undefined }));
  assert.deepEqual(b, { startLower: "1980-03-01", startUpper: "1980-03-31", endLower: "2001-01-01", open: false });
  assert.equal(startPrecision({ start_mode: "known", start_date: "1980-03" }), "month");
  assert.equal(startPrecision({ start_mode: "between" }), "bounded");
  assert.equal(endPrecision({ end_mode: "still_active" }), "unknown");
  assert.equal(endPrecision({ end_mode: "known", end_date: "2001-05-04" }), "day");
});

test("the inputs hash changes with any consumed field and ignores provenance", () => {
  const base = stored("a");
  const h1 = occupancyInputsHash([base]);
  assert.equal(occupancyInputsHash([{ ...base }]), h1);
  assert.notEqual(occupancyInputsHash([{ ...base, start_date: "1981" }]), h1);
  assert.notEqual(occupancyInputsHash([{ ...base, uncertainty_radius_m: 50 }]), h1);
  assert.notEqual(occupancyInputsHash([{ ...base, latitude: -17.0 }]), h1);
});

// --- validation

test("a well-formed segment validates and a set validates against the pin", () => {
  assert.doesNotThrow(() => assertOccupancySegment(input({}), REF));
  assert.doesNotThrow(() => assertOccupancySet([input({})], REF, PIN));
});

test("basis asymmetry is enforced, not merely recorded", () => {
  assert.throws(() => assertOccupancySegment(input({ start_mode: "unknown", start_date: undefined }), REF), /cannot carry a start basis/);
  assert.throws(() => assertOccupancySegment(input({ start_basis: "unknown" }), REF), /dated start needs its basis/);
  assert.throws(() => assertOccupancySegment(input({ end_basis: "closure_stated" }), REF), /undated end cannot carry an end basis/);
  assert.throws(() => assertOccupancySegment(input({ end_mode: "known", end_date: "2000", end_basis: "unknown", end_reason: "closed", still_active_asof: undefined }), REF), /dated end needs its basis/);
});

test("mode and date fields must agree", () => {
  assert.throws(() => assertOccupancySegment(input({ start_date: undefined }), REF), /start date must be a real date/);
  assert.throws(() => assertOccupancySegment(input({ start_not_later_than: "1985" }), REF), /must be blank when the start date is known/);
  assert.throws(() => assertOccupancySegment(input({ start_mode: "between", start_date: undefined, start_not_earlier_than: "1990", start_not_later_than: "1985" }), REF), /earliest possible start must not be after/);
  assert.throws(() => assertOccupancySegment(input({ still_active_asof: "2030" }), REF), /cannot be later than the submission date/);
  assert.throws(() => assertOccupancySegment(input({ end_mode: "known", end_date: "1970", end_basis: "closure_stated", end_reason: "closed", still_active_asof: undefined }), REF), /cannot end before it begins/);
  assert.throws(() => assertOccupancySegment(input({ start_date: "1500" }), REF), /from 1600 onward/);
});

test("still-active periods carry an as-of date and no end reason", () => {
  assert.throws(() => assertOccupancySegment(input({ still_active_asof: undefined }), REF), /still-active date/);
  assert.throws(() => assertOccupancySegment(input({ end_reason: "closed" }), REF), /still-active period has no end reason/);
  assert.throws(() => assertOccupancySegment(input({ end_mode: "known", end_date: "2000", end_basis: "closure_stated", still_active_asof: undefined }), REF), /dated end needs its reason/);
});

test("a wholly undated period needs its uncertainty wording", () => {
  const undated = input({ start_mode: "unknown", start_date: undefined, start_basis: "unknown", end_mode: "unknown", end_basis: "unknown", still_active_asof: undefined });
  assert.throws(() => assertOccupancySegment(undated, REF), /uncertainty note of at least 12/);
  assert.doesNotThrow(() => assertOccupancySegment({ ...undated, uncertainty_note: "Elders recall worship here at some time before the war." }, REF));
});

test("a distinct location needs a valid assertion; a relocation needs a successor and the same identity", () => {
  assert.throws(() => assertOccupancySegment(input({ location_relation: "distinct" }), REF), /needs its location/);
  assert.doesNotThrow(() => assertOccupancySegment(input({
    location_relation: "distinct",
    location: { contract_version: "location_assertion_v1", mode: "approximate_area", basis: "address_or_locality", latitude: -17.7, longitude: 168.3, uncertainty_radius_m: 500, source_wording: "the old village site", confidence: "moderate", contributor_confirmed: true },
  }), REF));
  assert.throws(() => assertOccupancySegment(input({ end_mode: "known", end_date: "1990", end_basis: "closure_stated", end_reason: "relocated", successor_site_id: "x", still_active_asof: undefined }), REF), /successor identifier is only for a split/);
});

test("a set must be numbered, non-overlapping, and relocations must move", () => {
  const first = input({ end_mode: "known", end_date: "1990", end_basis: "closure_stated", end_reason: "relocated", still_active_asof: undefined });
  const secondSamePlace = input({ segment_index: 1, start_date: "1992" });
  assert.throws(() => assertOccupancySet([first, secondSamePlace], REF, PIN), /must be followed by a period at a different place/);
  const secondMoved = input({
    segment_index: 1, start_date: "1992", location_relation: "distinct",
    location: { contract_version: "location_assertion_v1", mode: "building_identified", basis: "map_placement", latitude: -17.70, longitude: 168.30, confidence: "high", contributor_confirmed: true },
  });
  assert.doesNotThrow(() => assertOccupancySet([first, secondMoved], REF, PIN));
  assert.throws(() => assertOccupancySet([first, { ...secondMoved, segment_index: 2 }], REF, PIN), /numbered 0, 1, 2/);
  assert.throws(() => assertOccupancySet([first], REF, PIN), /needs the following period/);
  const overlapping = input({ segment_index: 1, start_date: "1985", location_relation: "distinct", location: secondMoved.location });
  assert.throws(() => assertOccupancySet([first, overlapping], REF, PIN), /one place at a time/);
  assert.throws(() => assertOccupancySet([input({}), input({ segment_index: 1, start_date: "2011" })], REF, PIN), /still-active period must be the last/);
  assert.throws(() => assertOccupancySet([], REF, PIN), /at least one period/);
});
