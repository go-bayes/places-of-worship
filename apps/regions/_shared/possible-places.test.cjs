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
let checks = 0;

// a stand-in maplibre map: sources, ordered layers, layout and paint
// properties, filters and handlers, and a rendered-feature query that
// answers by layer
function fakeMap(rendered = {}) {
  const map = {
    sources: {}, order: [], layers: {}, filters: {}, handlers: [], zoom: 12,
    addSource(id, spec) { this.sources[id] = spec; },
    getSource(id) { return this.sources[id]; },
    addLayer(spec, beforeId) {
      const at = beforeId ? this.order.indexOf(beforeId) : -1;
      if (at >= 0) this.order.splice(at, 0, spec.id); else this.order.push(spec.id);
      this.layers[spec.id] = { ...spec, layout: { ...(spec.layout || {}) }, paint: { ...(spec.paint || {}) } };
    },
    getLayer(id) { return this.layers[id]; },
    setLayoutProperty(id, key, value) { this.layers[id].layout[key] = value; },
    setPaintProperty(id, key, value) { this.layers[id].paint[key] = value; },
    setFilter(id, filter) { this.filters[id] = filter; },
    on(type, layer, fn) { this.handlers.push([type, layer, fn]); },
    getZoom() { return this.zoom; },
    queryRenderedFeatures(geometryOrOptions, maybeOptions) {
      const options = maybeOptions || geometryOrOptions || {};
      return (options.layers || []).flatMap((id) => (rendered[id] || []).map((f) => ({ ...f, layer: { id } })));
    }
  };
  return map;
}
function context(map, extra = {}) {
  const ctx = vm.createContext({
    map, LAYERS, SOURCES, POSSIBLE_LAYER: "places_possible", IS_MOBILE: false,
    CONFIG: { tiles: { possible: "https://tiles.placemap.org/places-v2-20260901-possible/{z}/{x}/{y}" } },
    currentFilterClauses: () => ["==", ["get", "religion"], "muslim"],
    maplibregl: { Popup: function () { return { setLngLat() { return this; }, setHTML() { return this; }, addTo() { return this; }, remove() {} }; } },
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
    lift("function placeDotAt("),
    "let possibleHandlersAttached = false;",
    lift("function addPossibleLayers("),
    lift("function syncPossiblePlaces("),
    lift("function possibleWaitingForZoom("),
    lift("function possibleQualifier("),
    lift("function syncPossibleQualifier("),
    "let possibleHover = null;",
    "this.api = { possibleLayerSpecs, possiblePlacePopupHtml, placeDotAt, addPossibleLayers, syncPossiblePlaces, possibleWaitingForZoom, possibleQualifier, syncPossibleQualifier, possibleRadiusExpression, placeDisplayName };",
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
  assert.ok(handlers.includes(`click:${LAYERS.possible}`), "the ring answers a click");
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

// 3. a place dot wins the press over a ring beneath it
{
  const withPlace = fakeMap({ [LAYERS.places]: [{ properties: { name: "St Mary" } }] });
  withPlace.addLayer({ id: LAYERS.places });
  const { api } = context(withPlace);
  assert.equal(api.placeDotAt({ x: 1, y: 1 }), true);
  const ringsOnly = context(fakeMap({ [LAYERS.possible]: [{ properties: {} }] }));
  ringsOnly.map.addLayer({ id: LAYERS.places });
  assert.equal(ringsOnly.api.placeDotAt({ x: 1, y: 1 }), false, "a ring alone is not a place");
  // the click handler checks it before opening a ring's popup
  assert.match(lift("function addPossibleLayers("), /map\.on\("click", LAYERS\.possible, \(e\) => \{\n\s*const feature = e\.features && e\.features\[0\];\n\s*if \(!feature \|\| placeDotAt\(e\.point\)\) return;/);
  checks += 3;
}

// 4. the popup: the name or the unnamed wording, the kind and one sentence,
// the osm record, and no action that assumes a counted place
{
  const { api, consts } = context(fakeMap());
  const html = api.possiblePlacePopupHtml(
    { id: "w42", osm_id: 42, osm_type: "way", name: "St <Jude>", religion: "unknown", denomination: "" },
    [174.75, -41.28],
    '<a class="popup-revise" href="x">Revise this place</a>'
  );
  assert.match(html, /<span class="popup-title">St &lt;Jude&gt;<\/span>/, "the name, escaped");
  assert.match(html, /<div class="place-note"><strong>Possible or former place of worship<\/strong><\/div>/);
  assert.match(html, /OpenStreetMap maps a church, mosque, temple, synagogue or chapel building here without tagging it as a place of worship, so it may be a former, converted or unconfirmed place, and it is not counted in the totals\./);
  assert.equal((consts.POSSIBLE_KIND_NOTE.match(/\. |\.$/g) || []).length, 1, "one sentence");
  assert.match(html, /href="https:\/\/www\.openstreetmap\.org\/way\/42"[^>]*>Open OSM</, "the osm record itself");
  assert.match(html, />Revise this place</, "the correction route stays");
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
  assert.match(placesBody, /hoverPopup\.remove\(\);\n\s*if \(pinnedLabel\) pinnedLabel\.remove\(\);\n\s*void handlePlaceFeatureClick/);
  checks += 8;
}

console.log(`possible places: ${checks} checks passed`);
