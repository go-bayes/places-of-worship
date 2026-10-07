// behavioural checks of two shared-runtime functions, lifted from the source
// (PR #181 review round 2). 1. the counts label says "Total" only when every
// tile the places source is drawing is unsampled (z8 or above): at camera zoom
// 8 or more, a sampled z6 or z7 parent retained while the z8 tile loads or
// fails must still read "Places shown". 2. a malformed #f= (%ZZ) is an absent
// parameter and does not throw.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
function lift(startMarker) {
  const start = runtime.indexOf(startMarker);
  assert.ok(start > 0, `${startMarker} exists`);
  return runtime.slice(start, runtime.indexOf("\n}\n", start) + 2);
}

// counts label
{
  const context = vm.createContext({ SAMPLED_BELOW_ZOOM: 8 });
  vm.runInContext(`${lift("function placesCountsSampled(")}\nthis.placesCountsSampled = placesCountsSampled;`, context);
  const { placesCountsSampled } = context;
  assert.equal(placesCountsSampled(7.9, [8, 8]), true, "below zoom 8 is sampled whatever the tiles");
  assert.equal(placesCountsSampled(8.2, [8, 8, 9]), false, "all unsampled tiles read as a total");
  assert.equal(placesCountsSampled(8.2, [7, 8]), true, "a retained z7 parent keeps the sample label");
  assert.equal(placesCountsSampled(8.2, [6]), true, "z8 delayed: only a z6 parent is drawn");
  assert.equal(placesCountsSampled(8.2, []), true, "nothing drawn is not a total");
  assert.equal(placesCountsSampled(8.2, null), true, "unreachable source cache is not a total");

  // the lookup reads the drawn tiles of the places source and fails safe
  const drawn = (zs) => ({ style: { sourceCaches: { places: { getVisibleCoordinates: () => zs.map((z) => ({ canonical: { z } })) } } } });
  const withMap = (map) => {
    const ctx = vm.createContext({ SOURCES: { places: "places" }, map });
    vm.runInContext(`${lift("function drawnPlacesTileZooms(")}\nthis.f = drawnPlacesTileZooms;`, ctx);
    return ctx.f();
  };
  assert.deepEqual(Array.from(withMap(drawn([7, 8]))), [7, 8]);
  assert.equal(withMap({ style: { sourceCaches: {} } }), null, "no places cache");
  assert.equal(withMap({}), null, "no style");
  assert.equal(withMap({ style: { sourceCaches: { places: { getVisibleCoordinates() { throw new Error("x"); } } } } }), null);

  // the label follows the delayed or failed z8 sequence end to end
  const sequence = [[7.9, [7]], [8.2, [7]], [8.2, [7, 8]], [8.2, [8, 8]]].map(([z, t]) => placesCountsSampled(z, t));
  assert.deepEqual(sequence, [true, true, true, false]);
}
// updateCounts uses the drawn tiles, and a settling map refreshes the counts
assert.match(runtime, /placesCountsSampled\(zoom, drawnPlacesTileZooms\(\)\)/);
assert.match(runtime, /event\.sourceId === SOURCES\.places && event\.tile\) scheduleCountsRefresh\(\)/);
assert.match(runtime, /map\.on\("idle", scheduleCountsRefresh\);/);

// malformed fragment
{
  const run = (hash) => {
    const context = vm.createContext({ location: { hash } });
    vm.runInContext(`${lift("function readHashParam(")}\nthis.f = readHashParam;`, context);
    return context.f("f");
  };
  assert.equal(run("#f=muslim,catholic"), "muslim,catholic");
  assert.equal(run("#6.5/52/5&f=%E2%80%A2"), "•");
  assert.equal(run("#f=%ZZ"), null, "malformed escape is an absent parameter");
  assert.equal(run("#f=%E0%A4%A"), null, "truncated escape is an absent parameter");
  assert.equal(run("#6.5/52/5"), null);
  assert.equal(run("#f=%ZZ&d=x"), null);
}
console.log("counts-label.test.cjs ok");
