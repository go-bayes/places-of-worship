// logic tests for occupancy-review.js: loads the browser module in node
// and asserts the bar geometry from segment bounds, the pill mapping, the
// plain-words descriptions, the scatter layout, and the confirm-all mirror
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/occupancy-review.js`, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const raw = context.window.PowOccupancyReview;
// values cross the vm boundary, so round-trip them for strict deep equality
const plain = (value) => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
const occ = Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    key,
    typeof value === "function" ? (...args) => plain(value(...args)) : plain(value),
]));

function ok(name) {
    console.log(`ok: ${name}`);
}

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// a two-period history: a dated first period that relocated, then a
// bounded-start second period still active
const first = {
    occupancy_id: "t:u:occupancy:s:0",
    segment_index: 0,
    claim_status: "submitted",
    parent_evidence_draft_id: "draft-a",
    created_by: "user-ra",
    created_at: 100,
    start_mode: "known",
    start_date: "1885-03",
    start_basis: "building_dedication",
    end_mode: "known",
    end_date: "1920",
    end_basis: "closure_stated",
    end_reason: "relocated",
    location_relation: "same_as_task_point",
    latitude: -41.29,
    longitude: 174.78,
    location_mode: "building_identified",
    location_basis: "map_placement",
};
const second = {
    occupancy_id: "t:u:occupancy:s:1",
    segment_index: 1,
    claim_status: "submitted",
    parent_evidence_draft_id: "draft-a",
    created_by: "user-ra",
    created_at: 100,
    start_mode: "between",
    start_not_earlier_than: "1920",
    start_not_later_than: "1925",
    start_basis: "first_seen_only",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2024-06-01",
    location_relation: "distinct",
    latitude: -41.2905,
    longitude: 174.7830,
    location_mode: "approximate_area",
    location_basis: "described_area",
    uncertainty_radius_m: 150,
};

// segment bounds mirror the server
const b1 = occ.segmentBounds(first);
assert.equal(b1.startLower, "1885-03-01");
assert.equal(b1.startUpper, "1885-03-31");
assert.equal(b1.endLower, "1920-01-01");
assert.equal(b1.endUpper, "1920-12-31");
assert.equal(b1.open, false);
const b2 = occ.segmentBounds(second);
assert.equal(b2.startLower, "1920-01-01");
assert.equal(b2.startUpper, "1925-12-31");
assert.equal(b2.endLower, "2024-06-01");
assert.equal(b2.endUpper, undefined);
assert.equal(b2.open, true);
assert.equal(b2.asof, "2024-06-01");
ok("segment bounds mirror the server rules");

// bar geometry: the axis covers census years and every bound, the core is
// [startUpper, endLower], the windows are dashed spans, still-active runs open
const geometry = occ.barGeometry([second, first], [2013, 2018, 2023], { width: 640 });
assert.equal(geometry.bars.length, 2);
assert.deepEqual(geometry.bars.map((bar) => bar.segment_index), [0, 1]);
assert.equal(geometry.ticks.length, 3);
assert.ok(geometry.domain.min < 1885 && geometry.domain.max > 2024);
assert.ok(geometry.height <= 120, `height ${geometry.height} stays small`);
const [barA, barB] = geometry.bars;
assert.ok(barA.core && barA.core.x1 < barA.core.x2, "first period has a certain core");
assert.ok(barA.startWindow && barA.startWindow.x2 <= barA.core.x1 + 1e-9, "start window ends where the core begins");
assert.ok(barA.endWindow && barA.endWindow.x1 >= barA.core.x2 - 1e-9, "end window begins where the core ends");
assert.equal(barA.open, null);
assert.equal(barA.asof, null);
assert.ok(barB.core && barB.core.x1 < barB.core.x2, "second period has a core up to the as-of date");
assert.ok(barB.open && near(barB.open.x1, barB.asof), "the open run starts at the as-of marker");
assert.equal(barB.endWindow, null);
assert.ok(barB.startWindow.x1 < barB.startWindow.x2);
// pixel order follows the calendar
assert.ok(barA.core.x2 <= barB.startWindow.x2);
const tick2013 = geometry.ticks.find((t) => t.year === 2013);
assert.ok(tick2013.x > barB.core.x1 && tick2013.x < barB.core.x2, "2013 falls inside the second period's core");
ok("bar geometry draws core, windows, open run, and census ticks in calendar order");

// unknown and by bounds draw to the axis edge as windows, never as core
const undated = { ...first, occupancy_id: "u", start_mode: "unknown", start_date: undefined, start_basis: "unknown", end_mode: "unknown", end_date: undefined, end_basis: "unknown", end_reason: undefined };
const undatedGeometry = occ.barGeometry([undated], [2013]);
assert.equal(undatedGeometry.bars[0].core, null);
assert.ok(undatedGeometry.bars[0].startWindow, "unknown start draws a window from the axis edge");
assert.ok(undatedGeometry.bars[0].endWindow, "unknown end draws a window to the axis edge");
const byStart = { ...first, start_mode: "by", start_date: undefined, start_not_later_than: "1890" };
const byParts = occ.segmentParts(byStart, { min: 1870, max: 1930 });
assert.ok(near(byParts.startWindow[0], 1870), "by-start window begins at the axis edge");
assert.ok(near(byParts.core[0], occ.yearFraction("1890-12-31")), "core begins at the latest possible start");
ok("missing bounds become windows to the axis edge");

// pill mapping
assert.deepEqual(occ.reviewStatePill("derived_unconfirmed"), { label: "awaiting review", cls: "amber" });
assert.deepEqual(occ.reviewStatePill("reviewer_confirmed"), { label: "confirmed", cls: "green" });
assert.deepEqual(occ.reviewStatePill("reviewer_overridden"), { label: "overridden", cls: "blue" });
assert.deepEqual(occ.reviewStatePill("reviewer_rejected"), { label: "rejected", cls: "grey" });
assert.equal(occ.statusPillClass("present", "derived_unconfirmed"), "", "present is not green until reviewed");
assert.equal(occ.statusPillClass("present", "reviewer_confirmed"), "green");
assert.equal(occ.statusPillClass("uncertain", "derived_unconfirmed"), "amber");
assert.equal(occ.statusPillClass("absent", "reviewer_confirmed"), "");
assert.equal(occ.effectiveStatus({ derived_status: "present", review_state: "reviewer_overridden", override_status: "absent" }), "absent");
assert.equal(occ.effectiveStatus({ derived_status: "present", review_state: "reviewer_confirmed" }), "present");
ok("review-state and status pills map as ruled");

// plain words
assert.equal(occ.describeStart(first), "began 1885-03 (building dedication)");
assert.equal(occ.describeStart(second), "began between 1920 and 1925 (first seen only)");
assert.equal(occ.describeEnd(first), "ended 1920 (closure stated; relocated)");
assert.equal(occ.describeEnd(second), "still active as of 2024-06-01");
assert.equal(occ.describeEnd(undated), "end unknown");
const taskPoint = { latitude: -41.29, longitude: 174.78 };
assert.equal(occ.describeLocation(first, taskPoint), "building at the pin");
assert.match(occ.describeLocation(second, taskPoint), /^distinct point \d+ m from the pin, area 150 m radius$/);
assert.equal(occ.PRESENCE_RULE_TEXT.inside_interval, "the year falls inside the recorded period");
assert.equal(occ.LOCATION_RULE_TEXT.imputed_from_nearest, "no dated period reaches the year; location carried from the nearest period");
ok("start, end, location, and rule words read plainly");

// scatter: the pin sits at the centre, a distinct point is offset, an
// approximate area is drawn with a radius, everything fits inside the box
const scatter = occ.scatterGeometry([first, second], taskPoint, { size: 120, margin: 14 });
assert.equal(scatter.points.length, 2);
assert.ok(near(scatter.points[0].cx, 60) && near(scatter.points[0].cy, 60), "same-as-pin period sits at the centre");
assert.equal(scatter.points[0].distance_m, 0);
assert.ok(scatter.points[1].cx > 60, "east offset moves right");
assert.ok(scatter.points[1].cy > 60, "south offset moves down");
assert.ok(scatter.points[1].approximate && scatter.points[1].r > 4);
assert.ok(scatter.points[1].distance_m > 200 && scatter.points[1].distance_m < 400);
scatter.points.forEach((p) => {
    assert.ok(p.cx - p.r >= 0 && p.cx + p.r <= 120 && p.cy - p.r >= 0 && p.cy + p.r <= 120, "point stays inside the box");
});
ok("scatter places the pin at the centre and fits every period");

// grouping: latest active parent first, superseded rows dropped
const older = { ...first, occupancy_id: "old", parent_evidence_draft_id: "draft-z", created_at: 50 };
const superseded = { ...first, occupancy_id: "gone", parent_evidence_draft_id: "draft-y", claim_status: "superseded", created_at: 900 };
const groups = occ.groupByParent([older, superseded, second, first]);
assert.deepEqual(groups.map((g) => g.parent_evidence_draft_id), ["draft-a", "draft-z"]);
assert.deepEqual(groups[0].segments.map((s) => s.segment_index), [0, 1]);
ok("parents group with the latest active submission first");

// confirm-all mirror: rule 1/2/4, no conflict, only l1 locations
const presence = [
    { target_year: 2013, rule_id: "inside_interval", review_state: "derived_unconfirmed", conflicts_observation: false },
    { target_year: 2018, rule_id: "inside_interval", review_state: "derived_unconfirmed", conflicts_observation: true },
    { target_year: 2023, rule_id: "inside_interval", review_state: "derived_unconfirmed", conflicts_observation: false },
    { target_year: 2001, rule_id: "within_start_window", review_state: "derived_unconfirmed", conflicts_observation: false },
    { target_year: 1996, rule_id: "before_stated_founding", review_state: "reviewer_confirmed", conflicts_observation: false },
];
const locations = [
    { target_year: 2013, rule_id: "occupancy_covers_year", review_state: "derived_unconfirmed" },
    { target_year: 2023, rule_id: "imputed_from_nearest", review_state: "derived_unconfirmed" },
    { target_year: 2023, rule_id: "occupancy_covers_year", review_state: "superseded" },
];
assert.deepEqual(occ.confirmAllEligibleYears(presence, locations), [2013]);
assert.equal(
    occ.confirmAllSummary({ confirmed: [2013], skipped: [{ target_year: 2018, reason: "conflicts with an observed status" }] }),
    "Confirmed 2013. Skipped 2018 (conflicts with an observed status).",
);
assert.equal(occ.confirmAllSummary({ confirmed: [], skipped: [] }), "No years confirmed.");
ok("confirm-all eligibility and summary mirror the server");

console.log("occupancy-review tests passed");
