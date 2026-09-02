// holds the portal's presence-rule mirror (apps/regions/nz/js/occupancy-contract.js,
// derivePresence) equal to the server's (convex/lib/occupancies.ts) on a fixture
// set that fires every rule 1-10 and both combining outcomes
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { derivePresence } from "./occupancies.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const mirrorPath = path.join(here, "..", "..", "apps", "regions", "nz", "js", "occupancy-contract.js");
globalThis.window = {};
new Function(fs.readFileSync(mirrorPath, "utf8"))();
const mirror = globalThis.window.PowOccupancy;

const YEARS = [1989, 1999, 2009, 2020];
const AT = { latitude: -17.74, longitude: 168.32, location_mode: "building_identified", location_basis: "map_placement" };

// server shape ⇄ card shape for the same period
function serverSegment(index, card) {
  return {
    occupancy_id: `s${index}`,
    segment_index: index,
    start_mode: card.startMode,
    start_date: card.startDate,
    start_not_earlier_than: card.startNotEarlierThan,
    start_not_later_than: card.startNotLaterThan,
    start_basis: card.startMode === "unknown" ? "unknown" : card.startBasis,
    end_mode: card.endMode,
    end_date: card.endDate,
    end_not_earlier_than: card.endNotEarlierThan,
    end_not_later_than: card.endNotLaterThan,
    end_basis: card.endMode === "still_active" || card.endMode === "unknown" ? "unknown" : card.endBasis,
    end_reason: card.endReason || undefined,
    still_active_asof: card.stillActiveAsof,
    ...AT,
  };
}

const FIXTURES = {
  "founding stated, closure stated (rules 1, 2, 4)": [
    { startMode: "known", startDate: "1995", startBasis: "founding_stated", endMode: "known", endDate: "2012", endBasis: "closure_stated", endReason: "closed" },
  ],
  "first seen, last seen (rules 3, 5)": [
    { startMode: "known", startDate: "1995", startBasis: "first_seen_only", endMode: "known", endDate: "2012", endBasis: "last_seen_only", endReason: "unknown" },
  ],
  "start window (rule 6)": [
    { startMode: "between", startNotEarlierThan: "1985", startNotLaterThan: "1992", startBasis: "first_seen_only", endMode: "still_active", stillActiveAsof: "2026-09-02" },
  ],
  "still active anchor (rule 8)": [
    { startMode: "known", startDate: "1950", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: "2000-06-01" },
  ],
  "end window (rule 7)": [
    { startMode: "known", startDate: "1950", startBasis: "founding_stated", endMode: "after", endNotEarlierThan: "1995", endBasis: "last_seen_only", endReason: "unknown" },
  ],
  "start unknown (rule 9)": [
    { startMode: "unknown", endMode: "known", endDate: "2005", endBasis: "closure_stated", endReason: "closed" },
  ],
  "end unknown (rule 10)": [
    { startMode: "known", startDate: "1990", startBasis: "founding_stated", endMode: "unknown" },
  ],
  "gap: demolished then rebuilt (absent, absent, present)": [
    { startMode: "known", startDate: "1905", startBasis: "founding_stated", endMode: "known", endDate: "2011", endBasis: "closure_stated", endReason: "demolished" },
    { startMode: "known", startDate: "2019", startBasis: "reopening_stated", endMode: "still_active", stillActiveAsof: "2026-09-02" },
  ],
  "gap: rebuilt, reopening dated only by dedication (uncertain, uncertain, present)": [
    { startMode: "known", startDate: "1905", startBasis: "founding_stated", endMode: "known", endDate: "2011", endBasis: "closure_stated", endReason: "demolished" },
    { startMode: "known", startDate: "2019", startBasis: "building_dedication", endMode: "still_active", stillActiveAsof: "2026-09-02" },
  ],
  "closed, never reopened (absent, absent, absent)": [
    { startMode: "known", startDate: "1905", startBasis: "founding_stated", endMode: "known", endDate: "2011", endBasis: "closure_stated", endReason: "closed" },
  ],
  "gap: not established (bounds, ruling r-e4)": [
    { startMode: "known", startDate: "1905", startBasis: "founding_stated", endMode: "between", endNotEarlierThan: "2011", endNotLaterThan: "2011", endBasis: "last_seen_only", endReason: "unknown" },
    { startMode: "by", startNotLaterThan: "2016", startBasis: "first_seen_only", endMode: "still_active", stillActiveAsof: "2026-09-02" },
  ],
  "around a year (between)": [
    { startMode: "known", startDate: "1999", startAround: true, startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: "2026-09-02" },
  ],
};

const strip = (rows) => rows.map((r) => ({ y: r.target_year, s: r.derived_status, r: r.rule_id, n: r.segment_rules.length }));

for (const [name, cards] of Object.entries(FIXTURES)) {
  test(`mirror equals server: ${name}`, () => {
    const fromMirror = mirror.derivePresence(cards, YEARS);
    const normalised = cards.map((card) => mirror.normalise(card));
    const fromServer = derivePresence(normalised.map((card, i) => serverSegment(i, card)), YEARS);
    assert.deepEqual(strip(fromMirror), strip(fromServer));
  });
}

test("every presence rule fires at least once across the fixtures", () => {
  const fired = new Set();
  for (const cards of Object.values(FIXTURES)) {
    for (const row of mirror.derivePresence(cards, [...YEARS, 1900, 1960, 2026])) {
      for (const f of row.segment_rules) fired.add(f.rule_id);
    }
  }
  for (const rule of Object.keys(mirror.PRESENCE_RULE_WORDS)) assert.ok(fired.has(rule), `rule ${rule} never fired`);
});

// the worked cases of the pr-e brief, section 4, asserted year by year
const NZ = [2013, 2018, 2023];
const statuses = (cards) => mirror.derivePresence(cards, NZ).map((r) => `${r.target_year}:${r.derived_status}:${r.rule_id}`);

test("worked case: demolished 2011, reopening stated 2019", () => {
  assert.deepEqual(statuses(FIXTURES["gap: demolished then rebuilt (absent, absent, present)"]), [
    "2013:absent:after_stated_closure",
    "2018:absent:after_stated_closure",
    "2023:present:inside_interval",
  ]);
  assert.ok(mirror.derivePresence(FIXTURES["gap: demolished then rebuilt (absent, absent, present)"], [2015])[0].segment_rules.some((f) => f.rule_id === "before_stated_reopening"));
});

test("worked case: a dedication does not license absence before it", () => {
  // uncertain outranks absent when the firings combine: the dedication says
  // nothing about the years before it, so the closure's absence cannot stand
  assert.deepEqual(statuses(FIXTURES["gap: rebuilt, reopening dated only by dedication (uncertain, uncertain, present)"]), [
    "2013:uncertain:before_first_record",
    "2018:uncertain:before_first_record",
    "2023:present:inside_interval",
  ]);
});

test("worked case: closed 2011, never reopened", () => {
  assert.deepEqual(statuses(FIXTURES["closed, never reopened (absent, absent, absent)"]), [
    "2013:absent:after_stated_closure",
    "2018:absent:after_stated_closure",
    "2023:absent:after_stated_closure",
  ]);
});

test("worked case: gap not established (bounds) derives uncertain, present, present", () => {
  assert.deepEqual(statuses(FIXTURES["gap: not established (bounds, ruling r-e4)"]), [
    "2013:uncertain:after_last_record",
    "2018:present:inside_interval",
    "2023:present:inside_interval",
  ]);
});

test("worked case: still in use as of the evidence date, not today", () => {
  const cards = [{ startMode: "known", startDate: "1905", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: "2016-05" }];
  assert.deepEqual(statuses(cards), [
    "2013:present:inside_interval",
    "2018:uncertain:beyond_active_anchor",
    "2023:uncertain:beyond_active_anchor",
  ]);
});

test("describePresence names years, rules, and conflicts", () => {
  const derived = mirror.derivePresence(FIXTURES["gap: demolished then rebuilt (absent, absent, present)"], [2013, 2018, 2023]);
  const out = mirror.describePresence(derived, [2013, 2018, 2023], { 2013: "present", 2018: "not_assessed" });
  assert.match(out.sentence, /^From your periods: 2013 absent \(after the stated closure\); 2018 absent \(after the stated closure\); 2023 present \(inside the period\)\.$/);
  assert.deepEqual(out.conflicts, ["2013: your status present differs from the periods (absent)"]);
  const none = mirror.describePresence([], [2013], {});
  assert.equal(none.sentence, "From your periods: 2013 not assessed.");
});

test("gapBounds puts the doubt into bounds, never a date", () => {
  const both = mirror.gapBounds({ earliest: "2011", latest: "2012" }, { by: "2016" });
  assert.equal(both.first.endMode, "between");
  assert.equal(both.first.endBasis, "last_seen_only");
  assert.equal(both.first.endReason, "unknown");
  assert.equal(both.second.startMode, "by");
  assert.equal(both.second.startBasis, "first_seen_only");
  const latestOnly = mirror.gapBounds({ latest: "2012" }, { by: "2016" });
  assert.match(latestOnly.problem, /both the earliest and latest/);
  const none = mirror.gapBounds({}, {});
  assert.equal(none.first.endMode, "unknown");
  assert.equal(none.second.startMode, "unknown");
  assert.equal(none.second.startBasis, "");
  const dated = mirror.gapBounds({ date: "2011-02" }, { date: "2016" });
  assert.equal(dated.first.endMode, "known");
  assert.equal(dated.second.startMode, "known");
  const onlyEarliest = mirror.gapBounds({ earliest: "2011" }, {});
  assert.equal(onlyEarliest.first.endMode, "after");
});
