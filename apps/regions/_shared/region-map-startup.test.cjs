// startup contract for the public maps (perf lane, 2026-10-06): the shared
// runtime requests a polygon tileset only where the page config names one, the
// border-handoff manifest loads after the map has loaded and the browser is
// idle, and the data-maps switcher warms the home country only after the
// overview source has loaded. these are source-level checks; the browser
// checks live in the pull request
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appsDir = path.join(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(appsDir, ...parts), "utf8");
const runtime = read("regions", "_shared", "region-map.js");
const switcher = read("shared", "datamaps-switcher.js");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

// 1. polygons are gated on REGION_CONFIG.polygonsTileset, never on country
ok(!/nz-polygons/.test(runtime), "the shared runtime names no tileset");
ok(/polygons: RC\.polygonsTileset\s*\n?\s*\? `https:\/\/tiles\.placemap\.org\/\$\{RC\.polygonsTileset\}\/\{z\}\/\{x\}\/\{y\}`\s*\n?\s*: null/.test(runtime),
  "the polygon tile url derives from the config key");
ok(/function addPolygonsLayer\(\) \{\n[^\n]*\n\s*if \(!CONFIG\.tiles\.polygons\) return;\n\s*map\.addSource\(SOURCES\.polygons/.test(runtime),
  "addPolygonsLayer returns before adding the source when no tileset is configured");
ok(!/countryCode\s*(===|==|!==)\s*["']nz["']/i.test(runtime), "no country-conditional branch for the polygons");

const pagesWithTileset = [];
for (const entry of fs.readdirSync(path.join(appsDir, "regions"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const page = path.join(appsDir, "regions", entry.name, "index.html");
  if (fs.existsSync(page) && /polygonsTileset/.test(fs.readFileSync(page, "utf8"))) pagesWithTileset.push(entry.name);
}
assert.deepEqual(pagesWithTileset, ["nz"], "only the NZ country page names the polygon tileset");
checks += 1;
ok(/polygonsTileset: "nz-polygons"/.test(read("regions", "nz", "index.html")), "NZ page names its tileset");
ok(/polygonsTileset: "nz-polygons"/.test(read("global", "index.html")), "the world map keeps the NZ outlines it always drew");

// every layer lookup that could meet an absent polygon layer is presence-guarded
ok(/CENSUS_POINT_ANCHORS\.includes\(layers\[i\]\.id\)/.test(runtime), "the census anchor scan matches ids present in the style");

// 2. the manifest waits for map load and an idle slot, and revalidates
const arm = runtime.slice(runtime.indexOf("const armOffers = () => {"));
ok(/fetch\(`\$\{REGIONS_BASE\}_shared\/data\/region-bboxes\.json`, HANDOFF_HOME \? \{ cache: "no-cache" \} : undefined\)/.test(arm),
  "the manifest fetch keeps no-cache on country pages");
ok(/requestIdleCallback\(armOffers/.test(arm) && /setTimeout\(armOffers/.test(arm), "idle callback with a timeout fallback");
ok(/map\.once\("load", armOffersWhenIdle\)/.test(arm), "arming waits for map load");
ok(!/^\s*armOffers\(\);/m.test(arm) && !/addEventListener\("load", armOffers/.test(arm), "no direct or window-load arming remains");
// late arrival: each consumer of the manifest copes with null
ok(/if \(!handoffRegions\) return null;/.test(runtime), "neighbour lookup tolerates a missing manifest");
ok(/function updateBorderHandoff\(\) \{\n\s*if \(!handoffRegions\) return;/.test(runtime), "handoff refresh tolerates a missing manifest");
ok(/if \(!handoffRegions \|\| !latestFix\) return;/.test(runtime), "geolocate abroad check tolerates a missing manifest");
ok(/handoffRegions \? handoffRegions\.find/.test(runtime), "contribute decision tolerates a missing manifest");
ok(/if \(handoffRegions\) setOffer\(/.test(runtime), "reset tolerates a missing manifest");
ok(/\n\s+updateBorderHandoff\(\);\n\s+\}\)\n\s+\.catch/.test(runtime), "arrival re-derives the pill");

// late arrival keeps the latest fix and judges it when the manifest lands
ok(/handoffRegions = doc\.regions;\n[^\n]*\n\s*judgeFix\(\);/.test(runtime), "arrival judges a fix received earlier");
ok(/if \(lastFixWasAbroad\) foldCensusForAbroad\(\);/.test(runtime), "the default census enable respects a foreign fix");
{
  // behavioural: run the real fix handler and judge function against stubs
  const vm = require("node:vm");
  const from = runtime.indexOf("let lastFixWasAbroad = false;");
  const to = runtime.indexOf("if (offerGo && !RC.disableBorderHandoff) {");
  const body = runtime.slice(from, to);
  const make = () => {
    const log = [];
    const sandbox = {
      HANDOFF_HOME: "nz", handoffRegions: null, censusPanelOpen: true,
      censusState: { enabled: true },
      normaliseLng: (x) => x,
      setCensusEnabled: (on) => { log.push(`census:${on}`); sandbox.censusState.enabled = on; return Promise.resolve(); },
      syncCensusPanel: () => log.push("panel"),
      geolocate: { on: (name, fn) => { sandbox.handler = fn; } },
      // longitude above zero counts as home in this stub
      window: { RegionResolve: { regionHasPoint: (r, lng) => lng > 0, boxContains: () => false } },
      handler: null,
      log
    };
    vm.createContext(sandbox);
    vm.runInContext(`${body}\nthis.arrive = () => { handoffRegions = [{ code: "nz", boxes: [] }]; judgeFix(); };`, sandbox);
    return sandbox;
  };
  const foreign = (lng) => ({ coords: { longitude: lng, latitude: 50 } });
  const home = (lng) => ({ coords: { longitude: lng, latitude: -40 } });
  // a foreign fix before the manifest folds the census on arrival
  let t = make();
  t.handler(foreign(-10));
  assert.deepEqual(t.log, [], "no judgement without a manifest");
  t.arrive();
  assert.deepEqual(t.log, ["census:false", "panel"], "a foreign fix received before the manifest folds the census on arrival");
  assert.equal(t.censusPanelOpen, false, "the census panel closes");
  checks += 3;
  // a home fix before the manifest changes nothing
  t = make();
  t.handler(home(10));
  t.arrive();
  assert.deepEqual(t.log, [], "a home fix leaves the census alone");
  checks += 1;
  // the latest fix wins
  t = make();
  t.handler(foreign(-10));
  t.handler(home(10));
  t.arrive();
  assert.deepEqual(t.log, [], "only the latest fix is judged");
  checks += 1;
  // after arrival only the crossing acts, and a re-enabled layer is not fought
  t = make();
  t.arrive();
  t.handler(foreign(-10));
  t.censusState.enabled = true;
  t.handler(foreign(-11));
  assert.deepEqual(t.log, ["census:false", "panel"], "only the crossing acts");
  checks += 1;
}

// 3. the switcher's home warm waits for the overview source and honours saveData
ok(/document\.addEventListener\("datamap:overview-loaded", markPrefetchReady/.test(switcher), "global map warms after the overview loads");
ok(!/addEventListener\("load", markPrefetchReady/.test(switcher), "no window-load gate remains");
ok(/!connection\.saveData/.test(switcher) && /function warmHome\(\) \{\n\s*if \(currentCode \|\| homeWarmed \|\| !connectionAllowsPrefetch\(\)\) return;/.test(switcher),
  "the home warm is skipped under saveData");
ok(/__DATAMAP_OVERVIEW_LOADED__/.test(runtime) && /datamap:overview-loaded/.test(runtime), "the runtime announces the overview load");

// 4. the census starts loading during script evaluation (2026-10-13 plan,
// item 1): the default level's fetch is a top-level call placed after the
// carried #d= view is read and after the columnar transport's constants, and
// the default enable runs from map load rather than first idle
const vm = require("node:vm");
const settle = () => new Promise((r) => setImmediate(r));
const pending = [];
{
  const startup = "\nif (HAS_CENSUS) void loadCensusData(censusState.level);\n";
  const at = runtime.indexOf(startup);
  ok(at > 0 && runtime.indexOf(startup, at + 1) === -1, "one top-level startup census fetch");
  ok(at > runtime.indexOf("(function applyCarriedCensusView() {"), "the startup fetch follows the carried census view");
  ok(at > runtime.indexOf("const SHA256_PATTERN = "), "the startup fetch follows the columnar transport constants");
  ok(at > runtime.indexOf("// @columnar-transport-end"), "the startup fetch sits outside the columnar transport block");
  ok(/function showClickHint\(message, options = \{\}\) \{\n\s*if \(!clickHint\) return;/.test(runtime), "the loading hint tolerates a missing element");
  ok(!/map\.once\("idle", async \(\) => \{\n\s*if \(HAS_CENSUS\) await setCensusEnabled\(true\);/.test(runtime), "the default enable no longer waits for first idle");
}
{
  // behavioural: run the real load handler against a stub map
  const from = runtime.indexOf('map.on("load", () => {');
  const body = runtime.slice(from, runtime.indexOf("\n});\n", from) + 5);
  const make = (abroad) => {
    const log = [];
    const handlers = { load: [], idle: [] };
    let resolveEnable = null;
    const sandbox = {
      HAS_CENSUS: true, lastFixWasAbroad: abroad,
      map: { on: (name, fn) => handlers[name].push(fn), once: (name, fn) => handlers[name].push(fn) },
      initBasemapSelect: () => {}, updateCounts: () => {},
      ensureCustomLayers: () => {}, nudgeMap: () => {}, refreshMapLayers: () => {},
      setCensusEnabled: (on) => { log.push(`census:${on}`); return new Promise((r) => { resolveEnable = r; }); },
      foldCensusForAbroad: () => log.push("fold"),
      CustomEvent: class { constructor(type) { this.type = type; } },
      window: {},
      document: { dispatchEvent: (event) => log.push(event.type) }
    };
    vm.createContext(sandbox);
    vm.runInContext(body, sandbox);
    return {
      sandbox, log,
      load: () => handlers.load.splice(0).forEach((fn) => fn()),
      idle: () => handlers.idle.splice(0).forEach((fn) => fn()),
      enabled: () => resolveEnable()
    };
  };
  pending.push((async () => {
    // the census completes before the first idle: first-idle waits for the idle
    let t = make(false);
    t.load();
    assert.deepEqual(t.log, ["census:true"], "map load enables the census at once");
    t.enabled();
    await settle();
    assert.deepEqual(t.log, ["census:true"], "first-idle waits for the map's first idle");
    t.idle();
    await settle();
    assert.deepEqual(t.log, ["census:true", "datamap:first-idle"], "first-idle follows the idle once the census is in");
    assert.equal(t.sandbox.window.__DATAMAP_FIRST_IDLE__, true, "the first-idle flag is set");
    checks += 4;
    // the first idle comes before the census completes: first-idle waits for the census
    t = make(false);
    t.load();
    t.idle();
    await settle();
    assert.deepEqual(t.log, ["census:true"], "first-idle waits for the census load");
    t.enabled();
    await settle();
    assert.deepEqual(t.log, ["census:true", "datamap:first-idle"], "first-idle follows the census load");
    checks += 2;
    // a foreign fix judged before load folds the census the default switched on
    t = make(true);
    t.load();
    t.enabled();
    await settle();
    t.idle();
    await settle();
    assert.deepEqual(t.log, ["census:true", "fold", "datamap:first-idle"], "a foreign fix folds the census after the default enable");
    checks += 1;
  })());
}

// 5. dated places only when shown (2026-10-13 plan, item 5): a hidden tier
// adds no source and fetches nothing; the first show fetches once and hands
// the parsed product to the source, which also feeds the legend's counts
{
  const from = runtime.indexOf("let datedHandlersAttached = false;");
  const body = runtime.slice(from, runtime.indexOf("// ── pulotu cultures layer"));
  const make = () => {
    const log = [];
    const sources = {};
    const layers = {};
    let resolveFetch = null;
    const sandbox = {
      RC: { datedPlaces: "data/dated_places.geojson" },
      DATED: { source: "s", layer: "l", futureLayer: "f", windowLayer: "w", areaLayer: "a", transitionLayer: "t", ringImage: "r" },
      DATED_AMBER: "#d68910", religionColors: "#000", censusState: { year: 2000, enabled: true },
      map: {
        getSource: (id) => sources[id], getLayer: (id) => layers[id],
        addSource: (id, def) => { sources[id] = def; log.push(`source:${typeof def.data}`); },
        addLayer: (def) => { layers[def.id] = def; },
        setFilter: () => {}, setLayoutProperty: (id, key, value) => { layers[id].visibility = value; },
        hasImage: () => true, on: () => {}, once: () => {}
      },
      fetch: (url) => { log.push(`fetch:${url}`); return new Promise((r) => { resolveFetch = r; }); },
      updateCensusLegend: () => log.push("legend"),
      log
    };
    vm.createContext(sandbox);
    vm.runInContext(`${body}\nthis.state = () => ({ datedStartYears, datedHasReviewed });`, sandbox);
    const respond = (features) => resolveFetch({ ok: true, json: () => Promise.resolve({ type: "FeatureCollection", features }) });
    return { sandbox, log, layers, respond };
  };
  pending.push((async () => {
    const t = make();
    t.sandbox.syncDatedPlaces(false, false);
    assert.deepEqual(t.log, [], "a hidden dated tier adds no source and fetches nothing");
    t.sandbox.syncDatedPlaces(true, false);
    t.sandbox.syncDatedPlaces(true, true);
    assert.deepEqual(t.log, ["fetch:data/dated_places.geojson"], "the first show fetches once, however often it syncs");
    t.respond([
      { properties: { start_year: 1990 } },
      { properties: { start_year: 2010, source: "reviewed_occupancy" } },
      { properties: {} }
    ]);
    await settle();
    assert.deepEqual(t.log, ["fetch:data/dated_places.geojson", "source:object", "legend"], "the parsed product becomes the source's data");
    assert.deepEqual([...t.sandbox.state().datedStartYears], [1990, 2010], "start years come from the same fetch");
    assert.equal(t.sandbox.state().datedHasReviewed, true, "reviewed occupancy is detected from the same fetch");
    assert.equal(t.layers.l.visibility, "visible", "the latest show applies when the fetch lands");
    assert.equal(t.layers.f.visibility, "visible", "the future tier follows the latest request");
    t.sandbox.syncDatedPlaces(false, false);
    assert.equal(t.layers.l.visibility, "none", "an existing tier still hides");
    checks += 8;
  })());
}

Promise.all(pending).then(() => {
  console.log(`region-map startup: ${checks} checks passed`);
}).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
