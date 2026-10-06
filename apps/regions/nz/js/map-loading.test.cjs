// map-loading changes of 2026-10-06, held by the actual portal class in a
// stub dom: imagery tiles sized to the screen (512 px tiles one zoom lower
// below 1.5 device pixels per css pixel), webp only where it saves bytes, the
// key probe as a small tiles.json request after the first imagery tile, and
// a debounced search box
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const timers = [];
const fakeSetTimeout = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; };
const fakeClearTimeout = id => { if (timers[id - 1]) timers[id - 1].live = false; };
const runTimers = ms => timers.filter(t => t.live && t.ms <= ms).forEach(t => { t.live = false; t.fn(); });

const elements = new Map();
const makeElement = () => {
  const listeners = {};
  return {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type) { (listeners[type] || []).forEach(fn => fn()); },
  };
};
for (const id of ["searchInput", "priorityFilter", "actionFilter", "statusFilter"]) elements.set(id, makeElement());
const classList = () => ({ add() {}, remove() {}, toggle() {}, contains() { return false; } });
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", remove() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const store = new Map();
const localStorage = {
  get length() { return store.size; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  key(index) { return [...store.keys()][index] ?? null; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage,
  sessionStorage: localStorage,
  MAPTILER_API_KEY: "test-key",
  devicePixelRatio: 1,
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout,
};
const fetched = [];
let nextStatus = 200;
const fetchStub = url => { fetched.push(url); return Promise.resolve({ ok: nextStatus >= 200 && nextStatus < 300, status: nextStatus }); };
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, fetch: fetchStub,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, Promise, console,
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
const evaluate = code => vm.runInContext(code, context);
const fresh = () => Object.create(window.NzVerificationMap.prototype);
const settle = () => new Promise(resolve => setImmediate(resolve));

// 1. imagery tile mapping follows the device pixel ratio
{
  const at = ratio => { window.devicePixelRatio = ratio; return evaluate("imageryTileOptions(5)"); };
  assert.deepEqual({ ...at(1) }, { tileSize: 512, zoomOffset: -1, minZoom: 5 }, "DPR 1: 512 px tiles one zoom lower");
  assert.deepEqual({ ...at(1.49) }, { tileSize: 512, zoomOffset: -1, minZoom: 5 }, "just below the threshold");
  assert.deepEqual({ ...at(1.5) }, { tileSize: 256, zoomOffset: 0, minZoom: 5 }, "DPR 1.5: default mapping, already @2x");
  assert.deepEqual({ ...at(3) }, { tileSize: 256, zoomOffset: 0, minZoom: 5 }, "DPR 3: unchanged");
  window.devicePixelRatio = 1;
  assert.equal(evaluate("imageryTileOptions(0).minZoom"), 1, "tile zoom never goes negative");
  window.devicePixelRatio = undefined;
  assert.equal(evaluate("imageryTileOptions(5).tileSize"), 512, "an unreported ratio counts as 1");
  window.devicePixelRatio = 1;
  const options = evaluate("imageryTileOptions(5)");
  assert.equal(options.maxNativeZoom, undefined, "no maxNativeZoom, so z19 tiles serve map zoom 20");
  assert.equal(options.detectRetina, undefined, "no detectRetina, which would lower maxZoom");
}

// retiling a layer on the map resets leaflet's grid (its tile range follows the tile size); off the map it does not
{
  const reset = [];
  const onMap = { options: { tileSize: 512, zoomOffset: -1 }, _map: {}, _resetGrid() { reset.push("on"); } };
  evaluate("retileLayer")(onMap, { tileSize: 256, zoomOffset: 0 });
  assert.deepEqual({ ...onMap.options }, { tileSize: 256, zoomOffset: 0 });
  assert.deepEqual(reset, ["on"], "a layer on the map has its grid reset");
  const off = { options: { tileSize: 512 }, _map: null, _resetGrid() { reset.push("off"); } };
  evaluate("retileLayer")(off, { tileSize: 256 });
  assert.equal(off.options.tileSize, 256);
  assert.deepEqual(reset, ["on"], "a layer off the map is reset when it is next added");
}

// 2. webp only for hybrid and the dark streets raster; satellite stays jpeg
{
  assert.match(evaluate("HYBRID_TILE_URL"), /\/maps\/hybrid\/\{z\}\/\{x\}\/\{y\}\.webp\?key=test-key$/);
  assert.match(evaluate("STREETS_DARK_TILE_URL"), /\/maps\/streets-v2-dark\/\{z\}\/\{x\}\/\{y\}\.webp\?key=test-key$/);
  assert.match(evaluate("SATELLITE_TILE_URL"), /\/tiles\/satellite-v2\/\{z\}\/\{x\}\/\{y\}\.jpg\?key=test-key$/, "satellite-v2 webp returns the same jpeg bytes");
  assert.equal(evaluate("IMAGERY_PROBE_URL"), "https://api.maptiler.com/maps/hybrid/tiles.json?key=test-key");
}

// 3. the key probe waits for the first imagery tile, asks for tiles.json, and a refusal retires imagery
(async () => {
  const app = fresh();
  let broken = 0;
  app.markImageryBroken = () => { broken += 1; };
  const probe = app.probeImagery();
  assert.equal(app.probeImagery(), probe, "one probe per session");
  await settle();
  assert.deepEqual(fetched, [], "no request before the first imagery tile paints");
  nextStatus = 403;
  app.noteImageryTilePainted();
  await probe;
  assert.deepEqual(fetched, ["https://api.maptiler.com/maps/hybrid/tiles.json?key=test-key"], "one small tiles.json request, not a tile");
  assert.equal(broken, 1, "a 403 marks imagery broken");

  // a tile painted before the probe is wanted lets it go at once
  fetched.length = 0;
  nextStatus = 200;
  const later = fresh();
  later.markImageryBroken = () => { broken += 1; };
  later.noteImageryTilePainted();
  await later.probeImagery();
  assert.equal(fetched.length, 1);
  assert.equal(broken, 1, "a 200 leaves imagery on");

  // a layer that never paints still gets probed, by the timer
  fetched.length = 0;
  timers.length = 0;
  const idle = fresh();
  idle.markImageryBroken = () => { broken += 1; };
  const waiting = idle.probeImagery();
  await settle();
  assert.deepEqual(fetched, []);
  runTimers(8000);
  await waiting;
  assert.equal(fetched.length, 1, "the fallback timer releases the probe");

  // 4. the search box waits for a pause; selects run at once
  timers.length = 0;
  const filtering = fresh();
  let applied = 0;
  filtering.applyFilters = () => { applied += 1; };
  filtering.targetYear = "";
  filtering.setupFilters();
  const search = elements.get("searchInput");
  for (let i = 0; i < 10; i += 1) search.fire("input");
  assert.equal(applied, 0, "ten keystrokes run no filter yet");
  assert.equal(timers.filter(t => t.live).length, 1, "one pending run, the earlier ones cancelled");
  assert.equal(timers.find(t => t.live).ms, 150, "150 ms debounce");
  runTimers(150);
  assert.equal(applied, 1, "one run per pause");
  elements.get("statusFilter").fire("input");
  assert.equal(applied, 2, "a select applies at once");
  search.fire("change");
  assert.equal(applied, 3, "a committed search applies at once");

  console.log("map loading: imagery tile mapping, webp scope, tiles.json probe, search debounce ok");
})().catch(error => { console.error(error); process.exit(1); });
