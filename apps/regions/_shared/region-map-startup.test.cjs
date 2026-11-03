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
// one read of the manifest serves the border handoff and the home shade
const manifestRead = runtime.slice(runtime.indexOf("function readRegionManifest() {"));
const arm = runtime.slice(runtime.indexOf("function afterLoadWhenIdle(arm) {"));
ok((runtime.match(/region-bboxes\.json/g) || []).length === 1, "the runtime fetches the manifest in one place");
ok(/fetch\(`\$\{REGIONS_BASE\}_shared\/data\/region-bboxes\.json`, HANDOFF_HOME \? \{ cache: "no-cache" \} : undefined\)/.test(manifestRead),
  "the manifest fetch keeps no-cache on country pages");
ok(/if \(!regionManifestRead\) \{\n\s*regionManifestRead = fetch\(/.test(manifestRead), "the read is made once and shared");
ok(/requestIdleCallback\(arm, \{ timeout: 5000 \}\)/.test(arm) && /setTimeout\(arm, 1\)/.test(arm), "idle callback with a timeout fallback");
ok(/map\.once\("load", armWhenIdle\)/.test(arm), "arming waits for map load");
ok(/afterLoadWhenIdle\(armOffers\);/.test(runtime), "the handoff arms after load and idle");
ok(/if \(HANDOFF_HOME\) afterLoadWhenIdle\(\(\) => readRegionManifest\(\)\.then\(applyHomeShade\)\);/.test(runtime),
  "the home shade reads the manifest after load and idle, on country pages only");
ok((runtime.match(/(?<!function )readRegionManifest\(\)/g) || []).length === 2, "the handoff and the home shade are the manifest's only readers");
ok(!/^\s*armOffers\(\);/m.test(runtime) && !/addEventListener\("load", armOffers/.test(runtime), "no direct or window-load arming remains");
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
  assert.deepEqual(t.log, ["census:false"], "a foreign fix received before the manifest turns the census off on arrival");
  // the off layer hides the panel itself; its open state is kept for the return
  assert.equal(t.censusPanelOpen, true, "the remembered panel state is left alone");
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
  assert.deepEqual(t.log, ["census:false"], "only the crossing acts");
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

// 4. switcher rows are prerendered on moderate intent; a prerendered page
// holds its own speculative work until activation (item 6, 2026-10-13)
{
  const rule = switcher.slice(switcher.indexOf("function addRowPrerenderRule() {"));
  const ruleHead = rule.slice(0, rule.indexOf("document.head.appendChild(rules)"));
  ok(/function buildPanel\(\) \{[\s\S]*?addRowPrerenderRule\(\);\n\s*\}/.test(switcher), "the panel adds the prerender rule when it is built");
  ok(/if \(!connectionAllowsPrefetch\(\)\) return;/.test(ruleHead), "the rule honours the data-saver and 2g guard");
  ok(/HTMLScriptElement\.supports\("speculationrules"\)/.test(ruleHead), "the rule is feature-detected");
  ok(/document\.createElement\("script"\);\n\s*rules\.type = "speculationrules";/.test(ruleHead) && !/innerHTML/.test(ruleHead),
    "the rule script is built as an element, never through innerHTML");
  ok(/selector_matches: "#dm-list a\.dm-item"/.test(ruleHead), "the rule selects the list's rows only, so the handoff pill is outside it");
  ok(/not: \{ selector_matches: '\[aria-current="page"\]' \}/.test(ruleHead), "the current page's row is excluded");
  ok(/prerender: \[\{\n\s*source: "document",/.test(ruleHead) && /eagerness: "moderate"/.test(ruleHead), "a moderate document-source prerender rule");
  ok(/document\.head\.appendChild\(rules\);\n\s*rowsPrerender = true;/.test(rule) &&
    /if \(includePage\) queuePrefetch\(pageUrl, region\.html_bytes\);/.test(switcher) &&
    (switcher.match(/prefetchCountry\([^)]*, true, true, !rowsPrerender\)/g) || []).length === 2,
    "row hovers skip the page-shell prefetch the prerender already fetches, and keep the census pair");
  ok(/function markPrefetchReady\(\) \{[\s\S]*?if \(document\.prerendering\) \{\n\s*document\.addEventListener\("prerenderingchange", markPrefetchReady, \{ once: true \}\);\n\s*return;\n\s*\}\n\s*prefetchReady = true;/.test(switcher),
    "warming, the home and neighbour warms included, waits for activation");
  ok(/let prefetchReady = false;/.test(switcher) && /if \(readyAtInit\) markPrefetchReady\(\);/.test(switcher) &&
    !/if \(prefetchReady\) \{ warmHome\(\)/.test(switcher), "a late script start passes through the same gate");
  ok(/const armWhenIdle = \(\) => \{\n\s*if \(document\.prerendering\) \{\n\s*document\.addEventListener\("prerenderingchange", armWhenIdle, \{ once: true \}\);\n\s*return;/.test(arm),
    "the handoff manifest waits for activation");
}

// 6. the home shade (ui review item 9, jb ruling 2026-11-03): the world with
// the page's country cut out, above the dots, and the country's outline; both
// fade out between zooms 6 and 7, and a page without an outline draws none
{
  const vm = require("node:vm");
  const grab = (name) => {
    const start = runtime.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} is in the runtime`);
    return runtime.slice(start, runtime.indexOf("\n}\n", start) + 3);
  };
  const constant = (name) => {
    const start = runtime.indexOf(`const ${name} = `);
    assert.ok(start >= 0, `${name} is in the runtime`);
    return runtime.slice(start, runtime.indexOf(";\n", start) + 2);
  };
  const manifest = JSON.parse(read("regions", "_shared", "data", "region-bboxes.json"));
  // a stub map that keeps a layer stack, enough for the layer builder
  const makeMap = (layerIds, background) => {
    const stack = layerIds.map((id) => ({ id, type: "circle" }));
    if (background) stack.unshift({ id: "bg", type: "background", paint: { "background-color": background } });
    const sources = {};
    const painted = [];
    let onRender = null;
    return {
      stack, sources, painted,
      getStyle: () => ({ layers: stack.map((layer) => ({ ...layer })) }),
      getLayer: (id) => stack.find((layer) => layer.id === id),
      getSource: (id) => sources[id],
      addSource: (id, spec) => { sources[id] = spec; },
      addLayer: (layer, beforeId) => {
        const at = beforeId ? stack.findIndex((l) => l.id === beforeId) : stack.length;
        stack.splice(at < 0 ? stack.length : at, 0, layer);
      },
      setPaintProperty: (id, prop, value) => painted.push([id, prop, value]),
      once: (name, fn) => { if (name === "render") onRender = fn; },
      render: () => onRender && onRender()
    };
  };
  const make = (map) => {
    const sandbox = {
      map, HANDOFF_HOME: null,
      LAYERS: { places: "pow-places-points", overview: "pow-overview-points" },
      window: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(read("shared", "region-resolve.js"), sandbox);
    vm.runInContext([
      "HOME_SHADE", "HOME_SHADE_OPACITY", "HOME_SHADE_FADE_ZOOMS", "HOME_SHADE_TONE", "HOME_OUTLINE_COLOUR"
    ].map(constant).join("") + "let homeShadeData = null;\n" + [
      "homeShadeFeatures", "homeShadeTone", "homeShadeLayers", "addHomeShadeLayers", "applyHomeShade"
    ].map(grab).join("") +
      // the sandbox's objects belong to another realm; hand them out as json
      "this.features = (code) => JSON.stringify(homeShadeFeatures(this.regions.find((r) => r.code === code)));\n" +
      "this.layers = (tone) => JSON.stringify(homeShadeLayers(tone));\n" +
      "this.apply = (home, doc) => { HANDOFF_HOME = home; applyHomeShade(doc); return homeShadeData !== null; };\n" +
      "this.tone = () => homeShadeTone();", sandbox);
    sandbox.regions = manifest.regions;
    return sandbox;
  };
  const sandbox = make(makeMap([]));
  const shadeOf = (code) => JSON.parse(sandbox.features(code));
  const regionOf = (code) => manifest.regions.find((r) => r.code === code);

  // the builder: one shade polygon whose exterior is the world and whose
  // holes are the country's polygons, enclaves shaded again, and an outline
  for (const code of ["se", "nz", "fj", "ki", "za", "us"]) {
    const doc = shadeOf(code);
    const [shade, outline] = doc.features;
    assert.equal(shade.properties.part, "shade");
    assert.equal(outline.properties.part, "outline");
    const polygons = shade.geometry.coordinates;
    assert.deepEqual(polygons[0][0], [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]], `${code}: the world is the exterior`);
    const rings = regionOf(code).rings;
    // every manifest ring is a hole of the world or an enclave polygon
    const holes = polygons[0].length - 1;
    const enclaves = polygons.length - 1;
    assert.equal(holes + enclaves, rings.length, `${code}: every ring is cut out or shaded back`);
    assert.ok(polygons.slice(1).every((polygon) => polygon.length === 1), `${code}: an enclave is a plain polygon`);
    // no ring crosses the antimeridian in the manifest, so the shade stays inside [-180, 180]
    assert.ok(polygons.flat(2).every(([lng]) => lng >= -180 && lng <= 180), `${code}: the shade stays in one world`);
    assert.ok(outline.geometry.coordinates.length >= rings.length, `${code}: every ring is outlined`);
    checks += 5;
  }
  // new zealand: the chatham islands, east of the antimeridian, are a hole too
  const nz = shadeOf("nz").features[0].geometry.coordinates[0].slice(1);
  ok(nz.some((ring) => ring.every(([lng]) => lng < -175)), "the chathams are cut out of the shade");
  ok(nz.some((ring) => ring.every(([lng]) => lng > 166)), "the main islands are cut out of the shade");
  // fiji: the islands cut at the antimeridian keep no outline along the cut
  const fjOutline = shadeOf("fj").features[1].geometry.coordinates;
  ok(fjOutline.every((line) => line.every((point, i) => i === 0 ||
    !(Math.abs(point[0]) >= 180 && Math.abs(line[i - 1][0]) >= 180))), "fiji's outline draws no edge along the antimeridian");
  ok(fjOutline.length > regionOf("fj").rings.length, "fiji's cut rings split into open lines");

  // no outline: an absent entry, an entry without rings, and the global map
  ok(sandbox.features("cf") === "null", "the staged central african republic page has no manifest entry and no shade");
  ok(sandbox.apply("cf", manifest) === false, "a page without an outline keeps no shade data");
  ok(sandbox.apply(null, manifest) === false, "the global map draws no shade");
  ok(sandbox.apply("se", null) === false, "a failed manifest read draws no shade");

  // the layers: the zoom fade, the tone, and nothing hit-testable
  const [fill, line] = JSON.parse(sandbox.layers("#abcdef"));
  ok(fill.type === "fill" && fill.maxzoom === 7 && line.type === "line" && line.maxzoom === 7, "both layers stop at zoom 7");
  assert.deepEqual(fill.paint["fill-opacity"], ["interpolate", ["linear"], ["zoom"], 6, 0.5, 7, 0]);
  assert.deepEqual(line.paint["line-opacity"], ["interpolate", ["linear"], ["zoom"], 6, 0.85, 7, 0]);
  assert.deepEqual(line.paint["line-width"], ["interpolate", ["linear"], ["zoom"], 2, 1.6, 6, 2.4]);
  ok(fill.paint["fill-color"] === "#abcdef" && line.paint["line-color"] === "#1e293b", "shade in the given tone, outline in dark slate");
  checks += 3;
  ok(make(makeMap([], "hsl(0, 0%, 100%)")).tone() === "hsl(0, 0%, 100%)", "the tone is the basemap's background");
  ok(make(makeMap([], { stops: [[6, "rgba(252, 247, 229, 1)"], [14, "#fff"]] })).tone() === "rgba(252, 247, 229, 1)",
    "a zoom-function background gives its first stop");
  ok(make(makeMap([])).tone() === "#ffffff", "a basemap without a background layer (satellite, openstreetmap) takes the light veil");
  ok(!/map\.on\("(click|mousemove|mouseenter)", HOME_SHADE/.test(runtime), "the shade takes no clicks or hover");

  // placement: directly above the place dots, below what was drawn over them,
  // eased in from transparent on arrival and drawn at once after a style switch
  const map = makeMap(["census", "pow-overview-points", "pow-places-points", "pow-dated-places"], "#fff");
  const live = make(map);
  ok(live.apply("se", manifest) === true, "sweden has a shade");
  assert.deepEqual(map.stack.map((layer) => layer.id),
    ["bg", "census", "pow-overview-points", "pow-places-points", "pow-home-shade-fill", "pow-home-shade-outline", "pow-dated-places"]);
  ok(map.sources["pow-home-shade"].maxzoom === 6, "the shade's source tiles stop at zoom 6");
  ok(map.getLayer("pow-home-shade-fill").paint["fill-opacity"] === 0 && map.painted.length === 0, "the shade starts transparent");
  map.render();
  assert.deepEqual(map.painted.map(([id, prop]) => [id, prop]),
    [["pow-home-shade-fill", "fill-opacity"], ["pow-home-shade-outline", "line-opacity"]]);
  ok(map.painted[0][2][4] === 0.5, "after one frame the shade eases to its curve");
  checks += 2;
  const before = map.stack.length;
  live.apply("se", manifest);
  ok(map.stack.length === before, "the shade is added once");
  const again = makeMap(["pow-places-points"]);
  const switched = make(again);
  vm.runInContext("homeShadeData = { type: 'FeatureCollection', features: [] }; addHomeShadeLayers();", switched);
  ok(again.getLayer("pow-home-shade-fill").paint["fill-opacity"][0] === "interpolate", "after a basemap switch the shade draws at once");
  const bare = makeMap(["census"]);
  const noPlaces = make(bare);
  vm.runInContext("homeShadeData = { type: 'FeatureCollection', features: [] }; addHomeShadeLayers();", noPlaces);
  ok(bare.stack.length === 1, "no shade before the place layer exists");
  ok(/addPlacesLayer\(\);\n[^\n]*\n\s*addHomeShadeLayers\(\);\n\}/.test(runtime), "a rebuilt layer stack restores the shade over the dots");
}

Promise.all(pending).then(() => {
  console.log(`region-map startup: ${checks} checks passed`);
}).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
