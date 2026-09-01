const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/osm-history.js`, "utf8");
const context = { window: {}, fetch: () => Promise.reject(new Error("no network in tests")) };
vm.createContext(context);
vm.runInContext(source, context);
const raw = context.window.PowOsmHistory;
// values cross the vm boundary, so round-trip them for strict deep equality
const plain = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
const history = {
    ...raw,
    summarise: elements => plain(raw.summarise(elements)),
};

function ok(name) {
    console.log(`ok: ${name}`);
}

// the real st pauls glenmark node history, trimmed to the evidential tags
const glenmark = [
    { version: 1, timestamp: "2008-10-21T11:01:41Z", changeset: 483992, visible: true, tags: { amenity: "place_of_worship", name: "St Pauls Glenmark" } },
    { version: 2, timestamp: "2009-04-27T02:49:14Z", changeset: 982953, visible: true, tags: { amenity: "place_of_worship", name: "St Pauls Glenmark", religion: "christian" } },
    { version: 3, timestamp: "2024-06-26T02:20:20Z", changeset: 153181127, visible: true, tags: { amenity: "place_of_worship", name: "St Pauls Glenmark", religion: "christian" } },
];

const summary = history.summarise(glenmark);
assert.equal(summary.versions, 3);
assert.equal(summary.created, "2008-10-21");
assert.equal(summary.first_pow, "2008-10-21");
assert.equal(summary.first_pow_version, 1);
assert.equal(summary.last_edited, "2024-06-26");
assert.equal(summary.deleted, false);
assert.equal(summary.pow_removed, false);
// version 3 changed nothing evidential, so it is not an event
assert.deepEqual(summary.events.map(e => e.version), [1, 2]);
assert.deepEqual(summary.events[1].changes, [{ key: "religion", from: "", to: "christian", kind: "tag" }]);
ok("first place-of-worship tagging and tag additions are dated");

// out-of-order input is sorted by version
const shuffled = history.summarise([glenmark[2], glenmark[0], glenmark[1]]);
assert.equal(shuffled.first_pow, "2008-10-21");
ok("history order does not depend on api order");

// a later retagging and deletion
const closed = [
    { version: 1, timestamp: "2010-01-01T00:00:00Z", changeset: 1, visible: true, tags: { building: "yes" } },
    { version: 2, timestamp: "2012-05-05T00:00:00Z", changeset: 2, visible: true, tags: { building: "church", amenity: "place_of_worship", name: "Old Chapel" } },
    { version: 3, timestamp: "2020-02-02T00:00:00Z", changeset: 3, visible: true, tags: { building: "church", "disused:amenity": "place_of_worship", name: "Old Chapel" } },
    { version: 4, timestamp: "2023-03-03T00:00:00Z", changeset: 4, visible: false },
];
const closedSummary = history.summarise(closed);
assert.equal(closedSummary.first_pow, "2012-05-05");
assert.equal(closedSummary.first_pow_version, 2);
assert.equal(closedSummary.deleted, true);
// deleted last version: pow_removed is about a still-visible object
assert.equal(closedSummary.pow_removed, false);
const v3 = closedSummary.events.find(e => e.version === 3);
assert.deepEqual(v3.changes, [
    { key: "amenity", from: "place_of_worship", to: "", kind: "tag" },
    { key: "disused:amenity", from: "", to: "place_of_worship", kind: "tag" },
]);
const v4 = closedSummary.events.find(e => e.version === 4);
assert.equal(v4.changes[0].kind, "deleted");
ok("retagging as disused and deletion are surfaced as dated events");

const retagged = history.summarise(closed.slice(0, 3));
assert.equal(retagged.pow_removed, true);
assert.equal(retagged.deleted, false);
ok("a visible object that lost the tag is flagged");

assert.equal(history.summarise([]), null);
assert.equal(history.summarise(undefined), null);
ok("empty history summarises to null");

// rendering: escapes tag values, omits usernames, links the history page
const html = history.renderHtml(history.summarise([
    { version: 1, timestamp: "2011-01-01T00:00:00Z", changeset: 9, visible: true, user: "someone", tags: { amenity: "place_of_worship", name: "<b>Bad</b>" } },
]), { type: "node", id: 42 });
assert.ok(html.includes("First tagged as a place of worship on OSM: <strong>2011-01-01</strong>"));
assert.ok(html.includes("not a founding date"));
assert.ok(html.includes("&lt;b&gt;Bad&lt;/b&gt;"));
assert.ok(!html.includes("someone"));
assert.ok(html.includes("https://www.openstreetmap.org/node/42/history"));
ok("render escapes values, drops editor names, links the osm history page");

const never = history.renderHtml(history.summarise([
    { version: 1, timestamp: "2011-01-01T00:00:00Z", changeset: 9, visible: true, tags: { building: "yes" } },
]), { type: "way", id: 7 });
assert.ok(never.includes("never carried the place-of-worship tag"));
ok("objects without the tag say so");

assert.equal(history.normaliseType("Node"), "node");
assert.equal(history.normaliseType("w"), "way");
assert.equal(history.normaliseType("point"), "");
ok("object types normalise");

console.log("ALL OSM HISTORY TESTS PASSED");
