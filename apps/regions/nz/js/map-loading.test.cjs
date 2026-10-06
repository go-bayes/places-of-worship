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

// retiling a layer on the map sets the url without leaflet's redraw (which ignores minZoom), drops the tiles and re-views; off the map it sets options and url only
{
  const calls = [];
  const onMap = {
    options: { tileSize: 512, zoomOffset: -1 }, _map: { getCenter: () => "centre", getZoom: () => 7 },
    setUrl(url, noRedraw) { calls.push(["setUrl", url, noRedraw]); },
    _removeAllTiles() { calls.push(["removeAll"]); },
    _setView(centre, zoom) { calls.push(["setView", centre, zoom]); },
  };
  evaluate("retileLayer")(onMap, { tileSize: 256, zoomOffset: 0 }, "u");
  assert.deepEqual({ ...onMap.options }, { tileSize: 256, zoomOffset: 0 });
  assert.deepEqual(calls, [["setUrl", "u", true], ["removeAll"], ["setView", "centre", 7]], "no automatic redraw; tiles dropped; grid reset by the view");
  calls.length = 0;
  const off = { options: { tileSize: 512 }, _map: null, setUrl(url, noRedraw) { calls.push(["setUrl", url, noRedraw]); }, _removeAllTiles() { calls.push(["removeAll"]); }, _setView() { calls.push(["setView"]); } };
  evaluate("retileLayer")(off, { tileSize: 256 }, "u");
  assert.equal(off.options.tileSize, 256);
  assert.deepEqual(calls, [["setUrl", "u", false]], "a layer off the map is reset when it is next added");
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

// 5. a theme change must not draw the streets layer below its zoom floor. leaflet's
// setUrl() redraws without checking options.minZoom, so the real vendored leaflet 1.9.4
// is loaded here (in a stub dom) and the real syncStreetsTheme of both portals is run
(async () => {
  const mk = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, children: [], childNodes: [],
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
    clientWidth: 800, clientHeight: 600, parentNode: null, remove() {}, insertBefore() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, className: "", innerHTML: "",
  });
  let theme = "light";
  const themeHandlers = [];
  const leafletDocument = {
    documentElement: { ...mk(), getAttribute: name => (name === "data-theme-effective" ? theme : null) },
    createElement: () => mk(), createDocumentFragment: () => mk(), body: mk(), addEventListener() {}, removeEventListener() {},
    getElementById: () => mk(), querySelector: () => null,
  };
  const leafletWindow = {
    document: leafletDocument, navigator: { userAgent: "node", platform: "x", maxTouchPoints: 0 },
    devicePixelRatio: 1, MAPTILER_API_KEY: "test-key",
    addEventListener(type, fn) { if (type === "pow-theme-change") themeHandlers.push(fn); }, removeEventListener() {},
    matchMedia: () => ({ matches: false }), requestAnimationFrame: fn => setTimeout(fn, 0), cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }), screen: { width: 800, height: 600 }, location: { href: "" },
    setTimeout, clearTimeout, fetch: fetchStub,
  };
  leafletWindow.window = leafletWindow;
  const leafletContext = vm.createContext({
    window: leafletWindow, document: leafletDocument, navigator: leafletWindow.navigator, setTimeout, clearTimeout, console,
    Image: function () {}, HTMLElement: function () {}, XMLHttpRequest: function () {}, fetch: fetchStub,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../vendor/leaflet@1.9.4/dist/leaflet.js"), "utf8"), leafletContext);
  const L = leafletWindow.L;
  assert.equal(L.version, "1.9.4", "the vendored leaflet is the one under test");
  // tile zoom as the url sees it (coords.z is already the url zoom plus the offset)
  const check = (layer, map, label) => {
    const zooms = Object.values(layer._tiles).map(tile => tile.coords.z + layer.options.zoomOffset);
    assert.ok(zooms.every(z => z >= 0), `${label}: no negative tile zoom (${zooms})`);
    if (map.getZoom() < layer.options.minZoom) assert.equal(zooms.length, 0, `${label}: no tiles below the layer floor`);
    return zooms;
  };

  // contributor portal: the real syncStreetsTheme
  {
    window.devicePixelRatio = 1;
    document.documentElement = { getAttribute: name => (name === "data-theme-effective" ? theme : null) };
    const map = L.map(mk(), { center: [-41, 174], zoom: 5, minZoom: 0 });
    const layer = L.tileLayer(evaluate("STREETS_TILE_URL"), { minZoom: 5, maxZoom: 19 }).addTo(map);
    const app = fresh();
    app.map = map;
    app.streetsLayer = layer;
    app.streetsBaseMinZoom = 5;
    app.streetsUrl = evaluate("STREETS_TILE_URL");
    app.imageryBroken = false;
    app.probeImagery = () => Promise.resolve();
    for (const belowFloor of [0, 4]) {
      map.setZoom(belowFloor, { animate: false });
      theme = "dark"; app.syncStreetsTheme();
      check(layer, map, `contributor, dark at z${belowFloor}`);
      theme = "light"; app.syncStreetsTheme();
      check(layer, map, `contributor, light at z${belowFloor}`);
    }
    // above the floor, tiles do load, at the 512 px mapping one zoom lower
    map.setZoom(6, { animate: false });
    theme = "dark"; app.syncStreetsTheme();
    const zooms = check(layer, map, "contributor, dark at z6");
    assert.ok(zooms.length > 0 && zooms.every(z => z === 5), `dark tiles at z6 are tile zoom 5 (${zooms})`);
    assert.equal(layer.options.tileSize, 512);
    theme = "light"; app.syncStreetsTheme();
    assert.equal(layer.options.tileSize, 256, "back on the 256 px openstreetmap mapping");
  }

  // review portal: the real syncStreetsTheme, reached by the theme-change event
  {
    theme = "light";
    vm.runInContext(fs.readFileSync(path.join(__dirname, "review-map.js"), "utf8"), leafletContext, { filename: "review-map.js" });
    const portal = leafletWindow.PowReviewMap.create({ containerId: "reviewMap", countryCode: "nz", maptilerKey: "test-key", centre: [-41, 174], zoom: 5 });
    assert.ok(portal && portal.map, "the review map is created");
    const map = portal.map;
    let streets = null;
    map.eachLayer(layer => { if (layer.options && layer.options.className === "streets-tiles") streets = layer; });
    assert.ok(streets, "the streets layer is on the map");
    map.options.minZoom = 0;
    for (const belowFloor of [0, 4]) {
      map.setZoom(belowFloor, { animate: false });
      theme = "dark"; themeHandlers.forEach(fn => fn());
      check(streets, map, `review, dark at z${belowFloor}`);
      theme = "light"; themeHandlers.forEach(fn => fn());
      check(streets, map, `review, light at z${belowFloor}`);
    }
    map.setZoom(6, { animate: false });
    theme = "dark"; themeHandlers.forEach(fn => fn());
    const zooms = check(streets, map, "review, dark at z6");
    assert.ok(zooms.length > 0 && zooms.every(z => z === 5), `dark tiles at z6 are tile zoom 5 (${zooms})`);
  }
  console.log("map loading: theme change keeps the imagery zoom floor in both portals ok");
})().catch(error => { console.error(error); process.exit(1); });
