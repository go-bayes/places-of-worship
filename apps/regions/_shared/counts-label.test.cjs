// behavioural checks of two shared-runtime functions, lifted from the source
// (PR #181 review round 2). 1. the counts label says "Total" only when every
// tile the places source is drawing is unsampled (z8 or above): at camera zoom
// 8 or more, a sampled z6 or z7 parent retained while the z8 tile loads or
// fails must still read "Places shown". 2. a malformed #f= (%ZZ) is an absent
// parameter and does not throw. 3. the key's accessible name lists its
// categories, and 4. the onboarding copy keeps two sentences and up to three
// bullets on the card (ui suggestions items 1 and 3, 2026-11-03).
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

// the key's accessible name lists the categories its dots show (ui
// suggestions item 3), with their counts when the strip shows counts
{
  const context = vm.createContext({ countsUserEnabled: false, countsSampled: false });
  vm.runInContext(`${lift("function countsToggleName(")}\nthis.name = countsToggleName;`, context);
  const top = [
    { label: "Christian", count: 3159 },
    { label: "Muslim", count: 72 },
    { label: "Hindu", count: 9 }
  ];
  assert.equal(context.name(top, "dots"), "Show denomination key: Christian, Muslim, Hindu");
  assert.equal(context.name(top, "names"), "Show denomination key: Christian, Muslim, Hindu");
  assert.match(context.name(top, "counts"), /^Show denomination key: Christian 3.?159, Muslim 72, Hindu 9$/);
  // below zoom 8 the counts are sampled, and the name says so
  context.countsSampled = true;
  assert.match(context.name(top, "counts"), /^Show denomination key: Christian about 3.?159, Muslim about 72, Hindu about 9$/);
  assert.equal(context.name(top, "names"), "Show denomination key: Christian, Muslim, Hindu");
  context.countsUserEnabled = true;
  assert.match(context.name(top, "dots"), /^Hide denomination key: /);
}

// the onboarding card leads with two sentences of its intro and up to
// three bullets; the rest folds into Source notes (ui suggestions item 1)
{
  const context = vm.createContext({});
  vm.runInContext(
    `const ONBOARD_LEAD_SENTENCES = 2;\nconst ONBOARD_OPEN_BULLETS = 3;\n${lift("function onboardCopy(")}\nthis.copy = onboardCopy;`,
    context
  );
  const short = context.copy({ intro: "One. Two.", bullets: ["a", "b", "c"] });
  assert.equal(short.lead, "One. Two.");
  assert.equal(short.notesIntro, "");
  assert.deepEqual([...short.openBullets], ["a", "b", "c"]);
  assert.equal(short.notesBullets.length, 0, "three bullets stay on the card");
  const long = context.copy({ intro: "Church of Sweden data, 1972–2025. It is a register. See <strong>notes</strong>.", bullets: ["1", "2", "3", "4"] });
  assert.equal(long.lead, "Church of Sweden data, 1972–2025. It is a register.");
  assert.equal(long.notesIntro, "See <strong>notes</strong>.");
  assert.equal(long.openBullets.length, 0, "a fourth bullet moves the list into the notes");
  assert.deepEqual([...long.notesBullets], ["1", "2", "3", "4"]);
  // abbreviations followed by a lower-case word do not end a sentence
  assert.equal(context.copy({ intro: "Data from e.g. the census. Second. Third." }).lead, "Data from e.g. the census. Second.");
  assert.equal(context.copy(null).lead, "");
}
console.log("counts-label.test.cjs ok");
