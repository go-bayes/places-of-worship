// the possible or former places (jb ruling 2026-11-23, "strict + flagged
// extras"): worship-type buildings osm does not tag as places of worship are
// a separate archive, switched on by one checkbox row in the key on every
// page (off by default), drawn as hollow rings beneath the place dots only
// while the dots show today's snapshot, and never counted. runs the shared
// runtime's own functions, lifted from region-map.js, against stubs: the
// layer wiring, the lazy source, the popup text, the key row and its
// qualifier either side of zoom 8, and the exclusion from the counts
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
function lift(startMarker) {
  const start = runtime.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} exists`);
  return runtime.slice(start, runtime.indexOf("\n}\n", start) + 2);
}
function constant(name) {
  const match = runtime.match(new RegExp(`^const ${name} = [^\\n]*;$`, "m"));
  assert.ok(match, `${name} exists`);
  return match[0];
}
const POSSIBLE_CONSTANTS = [
  "POSSIBLE_MIN_ZOOM", "POSSIBLE_RING_COLOUR", "POSSIBLE_HALO_COLOUR", "POSSIBLE_RING_WIDTH",
  "POSSIBLE_HALO_WIDTH", "POSSIBLE_RING_RADII", "POSSIBLE_KIND_LABEL", "POSSIBLE_KIND_NOTE",
  "POSSIBLE_ZOOM_QUALIFIER", "POSSIBLE_COUNT_QUALIFIER", "UNNAMED_PLACE"
].map(constant).join("\n");
const LAYERS = {
  overview: "pow-overview-points",
  places: "pow-places-points",
  possibleHalo: "pow-possible-halo",
  possible: "pow-possible-rings"
};
const SOURCES = { possible: "pow-possible" };
const DATED = {
  source: "dated", layer: "dated-point", futureLayer: "dated-future", windowLayer: "dated-window",
  areaLayer: "dated-area", transitionLayer: "dated-transition"
};
const PULOTU = { source: "pulotu", layer: "pulotu-point" };
const CENSUS = { source: "census", fill: "census-fill", line: "census-line", hover: "census-hover" };
let checks = 0;

// a stand-in maplibre map: sources, ordered layers, layout and paint
// properties, filters and handlers, and a rendered-feature query that
// answers by layer
function fakeMap(rendered = {}) {
  const map = {
    sources: {}, order: [], layers: {}, filters: {}, handlers: [], zoom: 12,
    canvas: { style: { cursor: "" } }, popupOpens: [], builds: 0,
    addSource(id, spec) { this.sources[id] = spec; },
    removeSource(id) { delete this.sources[id]; },
    getSource(id) { return this.sources[id]; },
    addLayer(spec, beforeId) {
      const at = beforeId ? this.order.indexOf(beforeId) : -1;
      if (at >= 0) this.order.splice(at, 0, spec.id); else this.order.push(spec.id);
      this.layers[spec.id] = { ...spec, layout: { ...(spec.layout || {}) }, paint: { ...(spec.paint || {}) } };
    },
    getLayer(id) { return this.layers[id]; },
    removeLayer(id) { delete this.layers[id]; this.order = this.order.filter((layer) => layer !== id); },
    setLayoutProperty(id, key, value) { this.layers[id].layout[key] = value; },
    setPaintProperty(id, key, value) { this.layers[id].paint[key] = value; },
    setFilter(id, filter) { this.filters[id] = filter; },
    on(type, layer, fn) {
      this.handlers.push(typeof layer === "function" ? [type, null, layer] : [type, layer, fn]);
    },
    once(type, fn) {
      const handler = (e) => {
        this.handlers = this.handlers.filter(([, , candidate]) => candidate !== handler);
        fn(e);
      };
      this.on(type, handler);
    },
    fire(type, e = {}) {
      for (const [name, layer, fn] of this.handlers.slice()) {
        if (name !== type) continue;
        const features = layer ? this.queryRenderedFeatures(e.point, { layers: [layer] }) : [];
        if (!layer || features.length) fn({ ...e, features });
      }
    },
    setStyle() {
      this.sources = {};
      this.layers = {};
      this.filters = {};
      this.order = [];
    },
    finishStyle() {
      this.fire("style.load");
      this.fire("idle");
    },
    getCanvas() { return this.canvas; },
    isStyleLoaded() { return true; },
    getCenter() { return { lng: 12.5, lat: 41.9 }; },
    jumpTo() {},
    triggerRepaint() {},
    getZoom() { return this.zoom; },
    setZoom(zoom) { this.zoom = zoom; this.fire("zoom"); },
    queryRenderedFeatures(geometryOrOptions, maybeOptions) {
      const options = maybeOptions || geometryOrOptions || {};
      const point = maybeOptions ? geometryOrOptions : null;
      const contains = (screen) => {
        if (!point || !screen) return true;
        if (!Array.isArray(point)) return screen[0] === point.x && screen[1] === point.y;
        return screen.every((value, i) => value >= point[0][i] && value <= point[1][i]);
      };
      return (options.layers || []).flatMap((id) =>
        this.layers[id]?.layout.visibility === "none" ? [] : (rendered[id] || [])
          .filter((f) => contains(f.screen)).map((f) => ({ ...f, layer: { id } }))
      );
    }
  };
  return map;
}
function context(map, extra = {}) {
  class Popup {
    setLngLat(coords) { this.point = coords; return this; }
    getLngLat() { return { lng: this.point[0], lat: this.point[1] }; }
    setHTML(html) {
      this.html = html;
      const href = html.match(/class="popup-revise" href="([^"]+)"/)?.[1];
      this.reviseLink = href ? { href: href.replaceAll("&amp;", "&") } : null;
      return this;
    }
    addTo(map) { this.open = true; map.popupOpens.push(this); return this; }
    isOpen() { return this.open; }
    on(type, fn) { if (type === "close") this.onClose = fn; }
    remove() { if (this.open) { this.open = false; this.onClose?.(); } }
    getElement() { return { querySelector: (selector) => selector === ".popup-revise" ? this.reviseLink : null }; }
  }
  const ctx = vm.createContext({
    map, LAYERS, SOURCES, DATED, PULOTU, CENSUS, POSSIBLE_LAYER: "places_possible", IS_MOBILE: false,
    CONFIG: { tiles: { possible: "https://tiles.placemap.org/places-v2-20260901-possible/{z}/{x}/{y}" } },
    currentFilterClauses: () => ["==", ["get", "religion"], "muslim"],
    maplibregl: { Popup },
    placesDotState: { mode: null, future: false, possible: false },
    countsList: { style: {} },
    document: { getElementById: () => null },
    ...extra
  });
  vm.runInContext([
    POSSIBLE_CONSTANTS,
    lift("function escText("),
    lift("function osmObjectUrl("),
    lift("function osmLinkHref("),
    lift("function placeDisplayName("),
    lift("function placeLabelHtml("),
    lift("function possibleRadiusExpression("),
    lift("function possibleLayerSpecs("),
    lift("function possiblePlacePopupHtml("),
    lift("function featuresAt("),
    lift("function historicalPointLayers("),
    "let possibleHoverProps = null;",
    "let activePossiblePopup = null;",
    lift("function clearPossibleHover("),
    lift("function clearPossiblePopups("),
    lift("function addPossibleLayers("),
    lift("function syncPossiblePlaces("),
    lift("function possibleWaitingForZoom("),
    lift("function possibleQualifier("),
    lift("function syncPossibleQualifier("),
    "let possibleHover = null;",
    "this.api = { possibleLayerSpecs, possiblePlacePopupHtml, addPossibleLayers, syncPossiblePlaces, possibleWaitingForZoom, possibleQualifier, syncPossibleQualifier, possibleRadiusExpression, placeDisplayName };",
    "this.consts = { POSSIBLE_MIN_ZOOM, POSSIBLE_RING_RADII, POSSIBLE_RING_WIDTH, POSSIBLE_HALO_WIDTH, POSSIBLE_ZOOM_QUALIFIER, POSSIBLE_COUNT_QUALIFIER, POSSIBLE_KIND_LABEL, POSSIBLE_KIND_NOTE, POSSIBLE_RING_COLOUR };"
  ].join("\n"), ctx);
  return ctx;
}
// evaluate a maplibre ["interpolate", ["linear"], ["zoom"], z0, v0, ...] at z
function interpolate(expr, z) {
  const stops = expr.slice(3);
  if (z <= stops[0]) return stops[1];
  for (let i = 0; i + 3 < stops.length; i += 2) {
    const [z0, v0, z1, v1] = stops.slice(i, i + 4);
    if (z <= z1) return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
  }
  return stops[stops.length - 1];
}

// 1. the layer wiring: two circle layers on the places_possible layer of the
// possible archive, from zoom 8, hollow, neutral, and smaller than a dot
{
  const { api, consts } = context(fakeMap());
  const [halo, ring] = api.possibleLayerSpecs(false);
  assert.deepEqual([halo.id, ring.id], [LAYERS.possibleHalo, LAYERS.possible]);
  for (const layer of [halo, ring]) {
    assert.equal(layer.type, "circle");
    assert.equal(layer.source, SOURCES.possible);
    assert.equal(layer["source-layer"], "places_possible");
    assert.equal(layer.minzoom, 8);
    assert.equal(layer.layout.visibility, "none", "off unless the mode is on");
    assert.equal(layer.paint["circle-color"], "rgba(0, 0, 0, 0)", "no fill");
    checks += 6;
  }
  assert.equal(api.possibleLayerSpecs(true)[1].layout.visibility, "visible");
  assert.equal(ring.paint["circle-stroke-color"], "#334155", "a neutral slate ring, no religion colour");
  assert.equal(halo.paint["circle-stroke-color"], "#ffffff", "a white inner ring");
  assert.doesNotMatch(JSON.stringify([halo.paint, ring.paint]), /religion/, "the paint never reads the religion");
  // the white ring sits just inside the slate one
  for (const z of [8, 10, 12.5, 16]) {
    const ringInner = interpolate(ring.paint["circle-radius"], z);
    const haloInner = interpolate(halo.paint["circle-radius"], z);
    assert.ok(Math.abs(haloInner + consts.POSSIBLE_HALO_WIDTH - ringInner) < 1e-9, `the rings meet at zoom ${z}`);
    // the place dot's paint: radius 6 2.1, 10 3.85, 16 5.95, with a 0.8 stroke
    const placeOuter = interpolate(["interpolate", ["linear"], ["zoom"], 6, 2.1, 10, 3.85, 16, 5.95], z) + 0.8;
    const ringOuter = ringInner + consts.POSSIBLE_RING_WIDTH;
    assert.ok(ringOuter < placeOuter, `a ring is smaller than a place dot at zoom ${z} (${ringOuter} < ${placeOuter})`);
    checks += 2;
  }
  // the place dot paint the comparison assumes is the runtime's own
  assert.match(runtime, /"circle-radius": \[\s*"interpolate",\s*\["linear"\],\s*\["zoom"\],\s*6, 2\.1,\s*10, 3\.85,\s*16, 5\.95\s*\],\s*"circle-color": religionColors,\s*"circle-stroke-width": 0\.8,/);
  checks += 6;
}

// 2. the source is lazy: nothing is added, so nothing requested, until the
// mode is on; then the rings go beneath the place dots and follow the
// filters; turning the mode off hides them without a new request
{
  const map = fakeMap();
  map.addLayer({ id: LAYERS.overview });
  map.addLayer({ id: LAYERS.places });
  map.addLayer({ id: "pow-home-shade-fill" });
  const { api } = context(map);
  api.syncPossiblePlaces(false);
  assert.deepEqual(Object.keys(map.sources), [], "the mode off requests nothing");
  assert.equal(map.getLayer(LAYERS.possible), undefined);
  api.syncPossiblePlaces(true);
  assert.equal(map.sources[SOURCES.possible].tiles[0], "https://tiles.placemap.org/places-v2-20260901-possible/{z}/{x}/{y}");
  assert.equal(map.sources[SOURCES.possible].minzoom, 8);
  assert.deepEqual(map.order, [LAYERS.overview, LAYERS.possibleHalo, LAYERS.possible, LAYERS.places, "pow-home-shade-fill"], "the rings sit beneath the place dots");
  assert.equal(map.layers[LAYERS.possible].layout.visibility, "visible");
  assert.deepEqual(map.filters[LAYERS.possible], ["==", ["get", "religion"], "muslim"], "the religion filters apply");
  assert.deepEqual(map.filters[LAYERS.possibleHalo], ["==", ["get", "religion"], "muslim"]);
  const handlers = map.handlers.map(([type, layer]) => `${type}:${layer}`);
  assert.ok(handlers.includes(`mousemove:${LAYERS.possible}`), "the ring can show a hover label");
  api.syncPossiblePlaces(false);
  assert.equal(map.layers[LAYERS.possible].layout.visibility, "none");
  assert.equal(map.layers[LAYERS.possibleHalo].layout.visibility, "none");
  api.syncPossiblePlaces(true, true);
  assert.equal(map.layers[LAYERS.possible].paint["circle-stroke-opacity"], 0.45, "a historical year steps the rings down");
  api.syncPossiblePlaces(true);
  assert.equal(map.order.filter((id) => id === LAYERS.possible).length, 1, "shown again, never added twice");
  assert.equal(map.handlers.length, handlers.length, "the handlers attach once");
  checks += 13;
}

// the popup: the name or the unnamed wording, the kind and one sentence,
// the osm record, and no action that assumes a counted place
{
  const { api, consts } = context(fakeMap());
  const html = api.possiblePlacePopupHtml(
    { id: "w42", osm_id: 42, osm_type: "way", name: "St <Jude>", religion: "unknown", denomination: "" },
    [174.75, -41.28]
  );
  assert.match(html, /<span class="popup-title">St &lt;Jude&gt;<\/span>/, "the name, escaped");
  assert.match(html, /<div class="place-note"><strong>Possible or former place of worship<\/strong><\/div>/);
  assert.match(html, /OpenStreetMap maps a church, mosque, temple, synagogue or chapel building here without tagging it as a place of worship, so it may be a former, converted or unconfirmed place, and it is not counted in the totals\./);
  assert.equal((consts.POSSIBLE_KIND_NOTE.match(/\. |\.$/g) || []).length, 1, "one sentence");
  assert.match(html, /href="https:\/\/www\.openstreetmap\.org\/way\/42"[^>]*>Open OSM</, "the osm record itself");
  assert.doesNotMatch(html, /Revise this place|popup-revise/);
  assert.match(html, />Street View</);
  assert.doesNotMatch(html, /Directions|From you|From pin/, "nothing that assumes a place in use");
  assert.doesNotMatch(html, /Religion/, "an unknown religion is not shown");
  // the title precedes the kind, which precedes the sentence
  assert.ok(html.indexOf("popup-title") < html.indexOf(consts.POSSIBLE_KIND_LABEL));
  assert.ok(html.indexOf(consts.POSSIBLE_KIND_LABEL) < html.indexOf("OpenStreetMap maps"));
  const unnamed = api.possiblePlacePopupHtml({ name: "", osm_id: 7, osm_type: "node", religion: "christian", denomination: "anglican" }, [0, 0]);
  assert.match(unnamed, /<span class="popup-title">Unnamed place<\/span>/, "never an empty title");
  assert.match(unnamed, /Religion<\/span><span class="place-attr-val">christian/);
  assert.match(unnamed, /Denomination<\/span><span class="place-attr-val">anglican/);
  assert.match(unnamed, /openstreetmap\.org\/node\/7/);
  const keyless = api.possiblePlacePopupHtml({}, [174.5, -41.5]);
  assert.match(keyless, /openstreetmap\.org\/\?mlat=-41\.500000&amp;mlon=174\.500000/, "no key: the map at the point");
  checks += 17;
}

// 5. the unnamed wording on every place title, and the name rule
{
  const { api } = context(fakeMap());
  assert.equal(api.placeDisplayName({ name: "" }), "Unnamed place");
  assert.equal(api.placeDisplayName({}), "Unnamed place");
  assert.equal(api.placeDisplayName(null), "Unnamed place");
  assert.equal(api.placeDisplayName({ name: "Kirche", name_en: "Church" }), "Church");
  assert.equal(api.placeDisplayName({ name: "Kirche", "name:en": "Church" }), "Church");
  assert.doesNotMatch(runtime, /"Loading place…"/, "no title waits on a name that never comes");
  assert.doesNotMatch(runtime, /props\.name \|\| "Unnamed"/);
  checks += 7;
}

// 6. the key's switch: a real checkbox row under the religion list and
// above the total, on every page (the markup is not gated on a census),
// unchecked by default; checked below zoom 8 its qualifier says where the
// rings appear, otherwise that they are not counted
{
  const panel = runtime.slice(runtime.indexOf('<ul id="countsList"></ul>'), runtime.indexOf('<div class="count-total" id="countsTotal">'));
  assert.match(panel, /<ul id="countsPossible">\s*<li class="count-possible">\s*<label class="legend" for="countsPossibleToggle"><span class="dot dot-possible" aria-hidden="true"><\/span>Possible or former places<\/label>\s*<input id="countsPossibleToggle" type="checkbox" aria-describedby="countsPossibleNote">\s*<span class="count-possible-note" id="countsPossibleNote">not counted<\/span>/);
  assert.doesNotMatch(panel, /checked/, "unchecked in the markup");
  const chrome = runtime.slice(runtime.indexOf("root.innerHTML = `"), runtime.indexOf("`;\n})();"));
  assert.ok(chrome.includes('<ul id="countsPossible">') && !/hasCensusConfig[^\n]*countsPossible/.test(chrome), "the row renders on every page");
  // the swatch is the map's mark
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "global", "styles", "maplibre-flat.css"), "utf8");
  assert.match(css, /#counts \.dot\.dot-possible \{[^}]*background: transparent;\s*border: 2px solid #334155;\s*box-shadow: inset 0 0 0 1\.5px #ffffff;/);
  const { api, consts } = context(fakeMap());
  assert.equal(api.possibleWaitingForZoom(true, 7.99), true);
  assert.equal(api.possibleWaitingForZoom(true, 8), false);
  assert.equal(api.possibleWaitingForZoom(false, 5), false);
  assert.equal(api.possibleQualifier(true, 5), "appear when you zoom in");
  assert.equal(api.possibleQualifier(true, 7.5), "appear when you zoom in");
  assert.equal(api.possibleQualifier(true, 8), "not counted");
  assert.equal(api.possibleQualifier(true, 12), "not counted");
  assert.equal(api.possibleQualifier(false, 5), "not counted", "unchecked, the row only names the mark");
  // the live note follows the switch and the zoom, and hides with the list
  const note = { textContent: "not counted" };
  const row = { style: {} };
  const map = fakeMap();
  const live = context(map, { document: { getElementById: (id) => ({ countsPossibleNote: note, countsPossible: row }[id] || null) } });
  live.placesDotState.possible = true;
  map.zoom = 5;
  live.api.syncPossibleQualifier();
  assert.equal(note.textContent, "appear when you zoom in");
  map.zoom = 12;
  live.api.syncPossibleQualifier();
  assert.equal(note.textContent, "not counted");
  live.countsList.style.display = "none";
  live.api.syncPossibleQualifier();
  assert.equal(row.style.display, "none", "below zoom 4 on a computer the row hides with the list");
  // the checkbox wiring: off by default, and a change sets the state, draws
  // or hides the rings and updates the qualifier; no toast
  const block = runtime.slice(runtime.indexOf("{\n  const possibleToggle"), runtime.indexOf("\n}\n", runtime.indexOf("{\n  const possibleToggle")) + 2);
  const listeners = {};
  const toggle = { checked: true, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const calls = [];
  const wired = vm.createContext({
    document: { getElementById: (id) => (id === "countsPossibleToggle" ? toggle : null) },
    placesDotState: { mode: null, future: false, possible: false },
    possibleRingsWanted: () => wired.placesDotState.possible && wired.mode === "all",
    placeSnapshotStale: () => false,
    syncPossiblePlaces: (show) => calls.push(["rings", show]),
    syncPossibleQualifier: () => calls.push(["qualifier"]),
    showClickHint: () => calls.push(["toast"]),
    mode: "all"
  });
  vm.runInContext(block, wired);
  assert.equal(toggle.checked, false, "unchecked when the page loads");
  toggle.checked = true;
  listeners.change();
  assert.equal(wired.placesDotState.possible, true);
  assert.deepEqual(calls, [["rings", true], ["qualifier"]]);
  wired.mode = "off";
  listeners.change();
  assert.deepEqual(calls.slice(2), [["rings", false], ["qualifier"]], "points off: no rings even with the switch on");
  toggle.checked = false;
  wired.mode = "all";
  listeners.change();
  assert.deepEqual(calls.slice(4), [["rings", false], ["qualifier"]]);
  assert.ok(!calls.some(([c]) => c === "toast"), "no toast");
  assert.doesNotMatch(runtime, /POSSIBLE_ZOOM_NOTE|showClickHint\([^)]*zoom in/, "the centre toast is gone");
  checks += 25;
}

// 7. never counted: the counts read one layer, the overview or the places,
// so a ring under the camera adds nothing to any total, switch on or off
{
  const map = fakeMap({
    [LAYERS.places]: [{ properties: { religion: "christian" } }, { properties: { religion: "muslim", n: 3 } }],
    [LAYERS.possible]: [{ properties: { religion: "christian" } }, { properties: { religion: "unknown" } }],
    [LAYERS.possibleHalo]: [{ properties: { religion: "christian" } }]
  });
  map.zoom = 12;
  map.addLayer({ id: LAYERS.places });
  map.addLayer({ id: LAYERS.possible });
  const listItems = [];
  const note = { textContent: "" };
  const totals = [];
  for (const possible of [false, true]) {
    const sandbox = context(map, {
      countsScheduled: false, countsLastUpdate: 0, COUNTS_MIN_INTERVAL_MS: 0,
      performance: { now: () => 1e9 },
      requestAnimationFrame: (fn) => fn(),
      keyDotsOff: false, keyStripLive: false, keyStripWanted: () => false,
      countsToggle: null, countsUserEnabled: true,
      countsPanel: { style: {} }, countsHint: null,
      countsList: { style: {}, set innerHTML(v) { listItems.length = 0; }, appendChild(el) { listItems.push(el); } },
      countsTotal: { style: {}, textContent: "" },
      document: { createElement: () => ({ className: "", innerHTML: "" }), getElementById: (id) => (id === "countsPossibleNote" ? note : null) },
      EMPTY_COUNTS: { christian: 0, muslim: 0, hindu: 0, buddhist: 0, jewish: 0, sikh: 0, shinto: 0, taoist: 0, unknown: 0 },
      countLabels: ["christian", "muslim", "hindu", "buddhist", "jewish", "sikh", "shinto", "taoist", "unknown"].map((key) => ({ key, label: key, color: "#000" })),
      placesCountsSampled: () => false, drawnPlacesTileZooms: () => [12],
      syncCountsToggleLabel: () => {}, countsTopThree: null, countsSampled: false
    });
    sandbox.placesDotState.possible = possible;
    vm.runInContext(`${lift("function renderCounts(")}\n${lift("function updateCounts(")}\nthis.updateCounts = updateCounts;`, sandbox);
    sandbox.updateCounts();
    totals.push(sandbox.countsTotal.textContent);
    assert.equal(listItems.length, 9, "the nine religion rows; the ring row is not a count");
    assert.equal(note.textContent, "not counted");
  }
  assert.deepEqual(totals, ["Total: 4", "Total: 4"], "one christian and a dot of three muslims, switch off or on; the rings add nothing");
  // the source holds the line: nothing that sums places names the rings
  const countsBody = lift("function updateCounts(");
  assert.doesNotMatch(countsBody.replace(/syncPossibleQualifier\(\);/g, ""), /possible/i);
  const nReads = [...runtime.matchAll(/properties\?\.n\b|\["get", "n"\]|props\.n\b/g)].map((m) => m.index);
  const countsStart = runtime.indexOf("function updateCounts(");
  assert.ok(nReads.length >= 1 && nReads.every((i) => i > countsStart && i < countsStart + countsBody.length), "n is summed only in updateCounts");
  // the representative-dot logic reads only the place tiers
  assert.doesNotMatch(lift("function isRepresentativeDot("), /possible/i);
  checks += 9;
}

// 8. the points select keeps exactly its modes, the global map gains no
// pill, the switch state is the session's only, and a basemap switch brings
// the rings back only while they are wanted
{
  assert.match(runtime, /const modes = RC\.datedPlaces\n\s*\? \[\["period", "Points: period"\], \["all", "Points: all"\], \["off", "Points: off"\]\]\n\s*: \[\["all", "Points: all"\], \["off", "Points: off"\]\];/);
  assert.doesNotMatch(runtime, /"possible", "Points|points-pill|fitSelectToValue/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "..", "global", "styles", "maplibre-flat.css"), "utf8"), /points-pill/);
  assert.match(runtime, /const placesDotState = \{ mode: null, future: false, possible: false \};/, "off by default, carried in no link or storage");
  assert.match(lift("function addCustomLayers("), /if \(possibleRingsWanted\(\)\) addPossibleLayers\(true\);\n\s*addPlacesLayer\(\);/);
  assert.match(lift("function possibleRingsWanted("), /return Boolean\(placesDotState\.possible\) && mode === "all";/, "rings only beside the snapshot dots");
  checks += 6;
}

// 9. a hover label never shows over the open popup of the same feature,
// for the rings and the place dots alike
{
  const popup = (open, lng, lat) => ({ isOpen: () => open, getLngLat: () => ({ lng, lat }) });
  const ctx = vm.createContext({ activePlacePopup: popup(true, 174.5, -41.2) });
  vm.runInContext(`${lift("function popupOpenAt(")}\nthis.f = popupOpenAt;`, ctx);
  assert.equal(ctx.f([174.5, -41.2]), true);
  assert.equal(ctx.f([174.6, -41.2]), false, "another feature keeps its label");
  ctx.activePlacePopup = popup(false, 174.5, -41.2);
  assert.equal(ctx.f([174.5, -41.2]), false, "a closed popup hides nothing");
  ctx.activePlacePopup = null;
  assert.equal(ctx.f([174.5, -41.2]), false);
  assert.match(lift("function addPossibleLayers("), /if \(popupOpenAt\(coords\)\) \{\n\s*hover\.remove\(\);\n\s*return;/);
  assert.match(lift("function openPossiblePopup("), /if \(possibleHover\) possibleHover\.remove\(\);/);
  const placesBody = lift("function addPlacesLayer(");
  assert.match(placesBody, /if \(popupOpenAt\(coords\)\) \{\n\s*hoverPopup\.remove\(\);\n\s*return;/);
  assert.match(lift("function handleMapPlaceClick("), /placeHover\?\.remove\(\);\n\s*pinnedLabel\?\.remove\(\);/);
  checks += 8;
}

function interactiveMap(rendered, isMobile) {
  const map = fakeMap(rendered);
  const controls = {};
  const checkbox = { checked: false, addEventListener(type, fn) { controls.toggle = fn; } };
  const select = { appendChild() {}, addEventListener(type, fn) { controls.basemap = fn; } };
  const queued = [];
  const ctx = context(map, {
    IS_MOBILE: isMobile,
    RC: { countryCode: "IT", datedPlaces: true, pulotuCultures: true },
    window: {}, URLSearchParams,
    Element: class {},
    document: {
      createElement: () => ({}),
      getElementById: (id) => id === "countsPossibleToggle" ? checkbox : null
    },
    PORTAL_BASE: "../nz/", CONTRIBUTE_ROUTES: {}, SHARED_BASE: "../../shared/",
    CONFIG: { streetViewMinZoom: 13, tiles: { possible: "possible/tiles" } },
    GOOGLE_MAPS_KEY: "", pinLocation: null, userLocation: null, focusPlace() {}, distanceRowsHtml: () => "",
    makePopupDraggable() {}, clampPopupToViewport() {}, showClickHint() {},
    openCensusPopup(feature) { controls.census = feature; },
    requestAnimationFrame: (fn) => fn(),
    setTimeout: (fn) => queued.push(fn),
    basemapSelect: select, basemapOptions: [{ id: "light" }, { id: "satellite", style: {} }],
    defaultBasemapId: "light", activeBasemapId: "light", setTerrainStateFromBasemap() {},
    updateTerrainToggleAvailability() {}, filtersBootstrapped: false,
    censusState: { enabled: true, year: 2000 }, activeDomainId: "religion",
    countLabels: ["christian", "muslim", "unknown"].map((key) => ({ key })),
    KNOWN_RELIGIONS: ["christian", "muslim"],
    religionFilterState: { christian: true, muslim: false, unknown: true },
    christianBuckets: [{ code: "christian.catholic", aliases: ["catholic", "roman_catholic"] }],
    denomFilterState: { "christian.catholic": true, __other: true },
    updateCounts() {}, ensureNearestLine() {},
    OVERVIEW_ENABLED: true, HOME_SHADE: { fill: "shade", outline: "shade-outline" },
    addCensusLayers() { map.addLayer({ id: CENSUS.fill }); },
    addOverviewLayer() { map.addLayer({ id: LAYERS.overview }); map.builds += 1; },
    addPolygonsLayer() {}, addBuildingsLayer() {}, addHomeShadeLayers() {},
    addPlacesLayer() { map.addLayer({ id: LAYERS.places }); },
    syncDatedPlaces() {}, syncPulotuCultures() {}, syncPointsControl() {}, syncKeyToDots() {},
    datedGeojson: {}, datedHandlersAttached: false, ensureDashedRingImage() {}, DATED_AMBER: "#d68910",
    religionColors: {},
    datedPlacePopupHtml: (props) => props.name,
    loadPulotuData: async () => ({ data: {} }), pulotuColourExpression: () => "#fff",
    PULOTU_GROUPS: [], safeHttpUrl: () => "", pulotuHandlersAttached: false
  });
  const mapListener = (event) => {
    const start = runtime.indexOf(`map.on("${event}", () => {`);
    assert.ok(start >= 0, `the ${event} listener exists`);
    return runtime.slice(start, runtime.indexOf("\n});", start) + 4);
  };
  vm.runInContext([
    "let activePlacePopup = null, activePlaceReviseArgs = null, placeHover = null, pinnedLabel = null;",
    runtime.match(/^let placeCountryOverrides = .*;$/m)[0],
    runtime.match(/^const PLACE_COUNTRY_OVERRIDE_RULES = .*;$/m)[0],
    lift("async function loadPlaceCountryOverrides("),
    lift("function popupOpenAt("), lift("function trackPlacePopup("), lift("function coordsFromFeature("),
    constant("PROJECT_CODE_FOR_ISO"),
    lift("function projectCountryCode("), lift("function countryForPlace("), lift("function portalReviseHref("),
    lift("function reviseLinkHtml("), lift("function directionsUrl("),
    lift("function isRepresentativeDot("), lift("function handlePlaceFeatureClick("),
    lift("function showMobileStreetViewPopup("), lift("function openPossiblePopup("),
    lift("function handleMapPlaceClick("), 'map.on("click", handleMapPlaceClick);',
    lift("function initBasemapSelect("), lift("function rebuildCustomLayers("), lift("function addCustomLayers("),
    lift("function ensureCustomLayers("), lift("function refreshMapLayers("), lift("function nudgeMap("),
    mapListener("zoom"),
    lift("function christianTotals("), lift("function allFiltersOn("), lift("function denominationMatch("),
    lift("function placeFilterSelection("), lift("function currentFilterClauses("),
    lift("function placePassesFilters("), lift("function applyFilters("), mapListener("style.load"),
    constant("PLACE_SNAPSHOT_HORIZON"), lift("function placeSnapshotStale("),
    lift("function effectivePointsMode("), lift("function effectiveDotMode("),
    lift("function possibleRingsWanted("), lift("function syncPlaceDotEra("),
    lift("{\n  const possibleToggle"), lift("function addDatedPlacesLayer("), lift("async function addPulotuLayer("),
    "const SAMPLED_BELOW_ZOOM = 8;",
    "initBasemapSelect();"
  ].join("\n"), ctx);
  const toggle = (on) => { checkbox.checked = on; controls.toggle(); };
  const click = (x, y) => map.fire("click", { point: { x, y }, lngLat: { lng: 12.5, lat: 41.9 } });
  const hover = (x, y) => map.fire("mousemove", { point: { x, y } });
  const finish = () => {
    map.finishStyle();
    while (queued.length) queued.shift()();
  };
  finish();
  toggle(true);
  return { map, controls, ctx, click, hover, toggle, finish, filter: ctx.currentFilterClauses() };
}

(async () => {
  // rome tile 9/273/190: the ring is 10.83 screen pixels from a counted node
  const at = [12.5, 41.9];
  const feature = (id, name, x, y) => ({
    screen: [x, y], geometry: { coordinates: at },
    properties: { id, name, osm_type: id[0] === "w" ? "way" : "node", osm_id: Number(id.slice(1)) }
  });
  const romeRing = feature("w814470552", "", 100, 100);
  romeRing.properties.religion = "unknown";
  const romeNode = feature("n1973645380", "Counted place", 110.83, 100);
  romeNode.geometry.coordinates = [12.5002, 41.9];
  const unnamedWay = feature("w269736970", "", 25, 25);
  const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, "../../shared/data/place-country-overrides.json"), "utf8"));
  const jerusalemNode = feature("n291872774", "Counted place", 50, 50);
  jerusalemNode.properties.country_code = "IL";
  jerusalemNode.geometry.coordinates = [35.229411, 31.776174];
  for (const isMobile of [false, true]) {
    for (const ok of [true, false]) {
      const { map, ctx, click } = interactiveMap({ [LAYERS.places]: [jerusalemNode] }, isMobile);
      delete ctx.RC.countryCode;
      ctx.CONFIG.tiles.places = "https://example.test/places-v2-20260901-grid/{z}/{x}/{y}";
      ctx.window.POW_COUNTRY_REGISTRY = { countries: [{ code: "il" }, { code: "ps" }] };
      let respond;
      ctx.fetch = () => new Promise((resolve) => { respond = resolve; });
      const pending = ctx.loadPlaceCountryOverrides();
      click(50, 50);
      const popup = map.popupOpens.at(-1);
      const link = popup.getElement().querySelector(".popup-revise");
      assert.match(link.href, /\bcountry=il&/);
      respond({ ok, json: async () => overrides });
      await pending;
      assert.equal(popup.getElement().querySelector(".popup-revise"), link);
      assert.equal(map.popupOpens.length, 1);
      assert.equal(popup.isOpen(), true);
      const props = jerusalemNode.properties;
      assert.equal(link.href, ctx.portalReviseHref(props.name, "31.776174", "35.229411", props));
      assert.match(link.href, ok ? /\bcountry=ps&/ : /\bcountry=il&/);
      checks += 6;
    }
  }
  for (const isMobile of [false, true]) {
    const area = { properties: { name: "Area" } };
    const rendered = {
      [LAYERS.places]: [romeNode, unnamedWay], [LAYERS.possible]: [romeRing], [CENSUS.fill]: [area]
    };
    const { map, controls, ctx, toggle, click, hover } = interactiveMap(rendered, isMobile);
    const lastPopup = () => map.popupOpens.at(-1);
    toggle(false);
    click(100, 100);
    assert.match(lastPopup().html, /openstreetmap\.org\/node\/1973645380/);
    toggle(true);
    let ringLabel;
    if (!isMobile) {
      hover(100, 100);
      ringLabel = lastPopup();
      assert.match(ringLabel.html, /Possible or former place/);
      assert.equal(ringLabel.isOpen(), true);
      checks += 2;
    }
    const beforeClick = map.popupOpens.length;
    click(100, 100);
    assert.match(lastPopup().html, /openstreetmap\.org\/node\/1973645380/);
    assert.equal(map.popupOpens.length - beforeClick, 1, "a direct ring hit only opens the nearby counted dot");
    if (ringLabel) {
      assert.equal(ringLabel.isOpen(), false, "the ring label clears when the counted node takes the click");
      checks += 1;
    }
    click(25, 25);
    assert.match(lastPopup().html, /popup-title">Unnamed place</);
    assert.match(lastPopup().html, /class="popup-revise" href="[^"]*osm_type=way&amp;osm_id=269736970"/);
    assert.match(lastPopup().html, /<a href="https:\/\/www\.openstreetmap\.org\/way\/269736970"[^>]*>Open OSM</);
    click(90, 100);
    assert.match(lastPopup().html, /openstreetmap\.org\/way\/814470552/);
    assert.doesNotMatch(lastPopup().html, /popup-revise/);
    assert.equal(controls.census, undefined, "a padded ring hit over a census polygon opens only the ring");
    click(50, 50);
    assert.equal(controls.census.properties, area.properties);
    assert.equal(map.popupOpens.length, beforeClick + 3);
    checks += 10;

    // replay the delegated handlers for each historical symbol over the ring
    ctx.addDatedPlacesLayer();
    await ctx.addPulotuLayer();
    for (const layer of [DATED.layer, DATED.futureLayer, DATED.windowLayer, PULOTU.layer]) {
      rendered[layer] = [feature("w814470552", "Historical symbol", 100, 100)];
      map.setLayoutProperty(layer, "visibility", "visible");
      const before = map.popupOpens.length;
      click(100, 100);
      assert.equal(map.popupOpens.length - before, 1);
      assert.match(lastPopup().html, /Historical symbol/);
      map.setLayoutProperty(layer, "visibility", "none");
      checks += 2;
    }
    if (isMobile) {
      click(90, 100);
      const phoneRing = lastPopup();
      toggle(false);
      assert.equal(phoneRing.isOpen(), false, "unchecking rings closes the phone popup");
      checks += 1;
    }
  }

  // a basemap selection drops the style and restores filters and era once
  const live = interactiveMap({ [LAYERS.possible]: [romeRing] }, false);
  live.click(100, 100);
  const popup = live.map.popupOpens.at(-1);
  const rebuild = () => {
    const before = live.map.builds;
    live.controls.basemap({ target: { value: "satellite" } });
    live.finish();
    assert.equal(live.map.builds - before, 1, "one layer rebuild per basemap change");
    checks += 1;
  };
  rebuild();
  assert.equal(popup.isOpen(), true);
  assert.notEqual(live.filter, null, "the basemap test starts with a religion filter");
  checks += 1;
  for (const layer of [LAYERS.places, LAYERS.overview, LAYERS.possible, LAYERS.possibleHalo]) {
    assert.deepEqual(live.map.filters[layer], live.filter);
    checks += 1;
  }
  for (const layer of [LAYERS.possible, LAYERS.possibleHalo]) {
    assert.equal(live.map.layers[layer].paint["circle-stroke-opacity"], 0.45);
    checks += 1;
  }
  assert.equal(live.map.layers[LAYERS.places].paint["circle-opacity"][6], 0.45);
  assert.equal(live.map.handlers.filter(([type, layer]) => type === "mousemove" && layer === LAYERS.possible).length, 1);
  checks += 3;

  // the checkbox, points modes and overlay domain clear the ring affordances
  for (const hide of ["checkbox", "period", "off", "another domain"]) {
    const { map, ctx, click, hover, toggle, finish, controls } = interactiveMap({ [LAYERS.possible]: [romeRing] }, false);
    hover(100, 100);
    const label = map.popupOpens.at(-1);
    assert.equal(label.isOpen(), true);
    assert.equal(map.canvas.style.cursor, "pointer");
    click(100, 100);
    const ringPopup = map.popupOpens.at(-1);
    assert.equal(ringPopup.isOpen(), true);
    assert.equal(label.isOpen(), false);
    if (hide === "checkbox") {
      toggle(false);
    } else {
      if (hide === "another domain") ctx.activeDomainId = "population";
      else ctx.placesDotState.mode = hide;
      ctx.syncPlaceDotEra();
    }
    assert.equal(ringPopup.isOpen(), false);
    assert.equal(map.canvas.style.cursor, "");
    assert.equal(map.layers[LAYERS.possible].layout.visibility, "none");
    if (hide === "period" || hide === "off") {
      controls.basemap({ target: { value: "satellite" } });
      finish();
      assert.equal(map.layers[LAYERS.places].layout.visibility, "none");
      assert.equal(map.layers[LAYERS.overview].layout.visibility, "none");
      assert.equal(map.getLayer(LAYERS.possible), undefined);
      checks += 3;
    }
    checks += 7;
  }

  const hoverOnly = interactiveMap({ [LAYERS.possible]: [romeRing] }, false);
  hoverOnly.hover(100, 100);
  const label = hoverOnly.map.popupOpens.at(-1);
  hoverOnly.toggle(false);
  assert.equal(label.isOpen(), false, "hiding rings clears an open hover label too");
  assert.equal(hoverOnly.map.canvas.style.cursor, "");
  checks += 2;

  // a popup and a hover may belong to different rings. apply the real filter
  // or zoom event while both are open, with the reviewer’s unknown ring selected.
  const secondRing = feature("w44", "Another ring", 140, 100);
  secondRing.geometry.coordinates = [12.51, 41.9];
  secondRing.properties.religion = "unknown";
  for (const change of ["christian-only filter", "zoom below 8"]) {
    const { map, ctx, click, hover } = interactiveMap({ [LAYERS.possible]: [romeRing, secondRing] }, false);
    click(100, 100);
    const popup = map.popupOpens.at(-1);
    hover(140, 100);
    const label = map.popupOpens.at(-1);
    assert.notEqual(label, popup);
    assert.equal(popup.isOpen(), true);
    assert.equal(label.isOpen(), true);
    if (change === "christian-only filter") {
      ctx.religionFilterState.unknown = false;
      ctx.applyFilters();
    } else {
      map.setZoom(8);
      assert.equal(popup.isOpen(), true, "the ring still draws at zoom 8");
      assert.equal(label.isOpen(), true);
      map.setZoom(7);
      checks += 2;
    }
    assert.equal(popup.isOpen(), false, change);
    assert.equal(label.isOpen(), false, change);
    assert.equal(map.canvas.style.cursor, "");
    checks += 6;
  }

  // a surviving christian label stays open when the filter excludes only the
  // selected catholic alias, even though other christian remains on.
  const catholicRing = {
    ...romeRing, properties: { ...romeRing.properties, religion: "christian", denomination: "Roman_Catholic" }
  };
  const otherChristianRing = { ...secondRing, properties: { ...secondRing.properties, religion: "christian" } };
  const selected = interactiveMap({ [LAYERS.possible]: [catholicRing, otherChristianRing] }, false);
  selected.click(100, 100);
  const catholicPopup = selected.map.popupOpens.at(-1);
  selected.hover(140, 100);
  const christianLabel = selected.map.popupOpens.at(-1);
  selected.ctx.denomFilterState["christian.catholic"] = false;
  selected.ctx.applyFilters();
  assert.equal(catholicPopup.isOpen(), false);
  assert.equal(christianLabel.isOpen(), true);
  assert.equal(selected.map.canvas.style.cursor, "pointer");
  checks += 3;

  console.log(`possible places: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
