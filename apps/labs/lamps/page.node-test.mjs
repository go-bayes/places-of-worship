import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as geometry from "./geometry.mjs";
import * as palette from "../shared/palette.mjs";
import * as style from "./style.mjs";
import * as sun from "../shared/sun.mjs";
import * as maplibre from "../vendor/maplibre-gl@6.19.0/maplibre-gl.mjs";

async function lampsPage({ addProtocol = () => {}, fetch } = {}) {
  const elements = new Map();
  const document = {
    documentElement: { dataset: {} }, body: {}, addEventListener() {},
    createElement: () => ({
      children: [], dataset: {}, textContent: "", hidden: false, style: { setProperty() {} },
      setAttribute() {}, addEventListener() {}, replaceChildren() { this.children = []; },
      append(...children) { this.children.push(...children); },
      contains(child) { return this === child || this.children.some((item) => item.contains?.(child)); },
      focus() { document.activeElement = this; }
    })
  };
  document.getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, document.createElement());
    return elements.get(id);
  };
  document.getElementById("inview-panel").hidden = true;
  const card = document.getElementById("card");
  card.hidden = true;
  card.append(document.getElementById("card-main"));
  const map = {
    zoom: 12, features: [], hits: [], data: {}, handlers: {}, filters: new Map(), layers: new Set(),
    getZoom() { return this.zoom; },
    getCenter: () => ({ lng: 1, lat: 1 }),
    getBounds: () => ({ contains: () => true }),
    getSource(id) { return { setData: (data) => { this.data[id] = data; } }; },
    getLayer(id) { return this.layers.has(id); },
    getFilter(id) { return this.filters.get(id); },
    querySourceFeatures() { return this.features; },
    queryRenderedFeatures() { return this.hits; },
    setPaintProperty() {},
    setFilter(id, expression) { this.filters.set(id, expression); },
    isStyleLoaded: () => false,
    on(type, handler) { this.handlers[type] = handler; },
    addControl() {},
    getCanvas: () => document.createElement()
  };
  const source = await readFile(new URL("./lamps.mjs", import.meta.url), "utf8");
  const page = runInNewContext(
    source.slice(source.indexOf("const MAIN_MAP"), source.lastIndexOf("\nbuildChips();"))
      + "\n({ state, buildPillars, updateScale, startMap, applyFilter, refreshPlacesList, autoPitchTransform, setMap(m) { map = m; } })",
    {
      ...geometry, ...palette, ...style, ...sun, document, URLSearchParams, setInterval() {},
      window: { matchMedia: () => ({ matches: false }) }, location: { search: "", hash: "" },
      fetch,
      maplibregl: {
        Map: function (options) { map.options = options; return map; },
        NavigationControl: class {},
        addProtocol
      }
    }
  );
  page.setMap(map);
  return { ...page, map, document, get: document.getElementById };
}

function point(id, lng = 1, religion = "christian") {
  return {
    properties: { id, religion },
    tile: { z: 12, x: 2050, y: 2036 },
    _vectorTileFeature: { extent: 4096, loadGeometry: () => [[{ x: 10, y: 20 }]] },
    geometry: { type: "Point", coordinates: [lng, 1] }
  };
}

function openFirstPillar(map) {
  map.layers.add("pillars");
  map.hits = [{ layer: { id: "pillars" }, properties: map.data.pillars.features[0].properties }];
  map.handlers.click({ point: { x: 1, y: 1 } });
}

test("pillar refresh replaces a changed tail, updates coordinates and publishes empty data", async () => {
  const { map, state, buildPillars, get } = await lampsPage();
  const points = () => map.data.pillars.features.filter(({ geometry }) => geometry.type === "Point");
  map.features = [point("A"), point("B", 2)];
  buildPillars();
  assert.equal(points().length, 2);
  state.selected = points()[1].properties.id;
  const oldId = state.selected;
  map.features = [point("A"), point("C", 3)];
  buildPillars();
  assert.equal(points()[1].geometry.coordinates[0], 3);
  assert.equal(state.selected, null);
  assert.equal(get("card").hidden, true);
  assert.notEqual(points()[1].properties.id, oldId);
  map.features = [point("A"), point("C", 3.001)];
  buildPillars();
  assert.equal(points()[1].geometry.coordinates[0], 3.001);
  map.features = [];
  buildPillars();
  assert.equal(points().length, 0);
});

test("regional lights and retained low-zoom tiles fly without opening a place card", async () => {
  const { state, map, startMap, updateScale, get, autoPitchTransform } = await lampsPage();
  const flights = [];
  map.flyTo = (camera) => flights.push(camera);
  const landed = [];
  map.once = (type, fn) => { if (type === "moveend") landed.push(fn); };
  map.getPitch = () => 66;
  map.stop = () => {};
  startMap();
  map.layers.add("places-core");
  for (const [zoom, tileZoom] of [[6, 6], [7, 7], [8.2, 7]]) {
    map.zoom = zoom;
    updateScale();
    assert.equal(get("scale-status").textContent, "Regional scale. Each light stands for one or more places mapped nearby.");
    state.pendingSelect = "previous";
    map.hits = [{
      layer: { id: "places-core" }, _z: tileZoom,
      properties: { id: "w643607728", n: 3 }, geometry: { coordinates: [1, 1] }
    }];
    map.handlers.click({ point: { x: 1, y: 1 } });
    assert.equal(state.pendingSelect, null);
    assert.equal(state.selected, null);
  }
  assert.equal(flights.length, 3);
  // a flight carries the tilt its destination zoom calls for, and the
  // per-frame transform leaves the pitch alone until the flight lands
  for (const flight of flights) assert.equal(flight.pitch, 66);
  assert.equal(state.flying, true);
  assert.equal(Object.keys(autoPitchTransform({ zoom: 9, pitch: 0 })).length, 0);
  for (const fn of landed) fn();
  assert.equal(state.flying, false);
  assert.equal(state.lastAutoPitch, 66);
  assert.equal(autoPitchTransform({ zoom: 15.2, pitch: 66 }).pitch, 66);
});

test("tradition filters apply while tiles load and close a hidden selection", async () => {
  const { map, state, startMap, buildPillars, applyFilter, get } = await lampsPage();
  startMap();
  state.enabled.delete("christian");
  applyFilter();
  assert.equal(map.filters.size, 0);
  for (const id of [...style.PLACE_LAYERS, "pillars", "crowns", "pools"]) map.layers.add(id);
  map.handlers.styledata?.();
  assert.equal(map.filters.size, 7);
  assert.deepEqual(map.filters.get("places-core"), style.traditionFilter(state.enabled));

  map.features = [point("A")];
  buildPillars();
  state.selected = map.data.pillars.features[0].properties.id;
  applyFilter();
  assert.equal(state.selected, null);
  assert.equal(get("card").hidden, true);
});

test("refreshing the places list preserves the focused place", async () => {
  const { map, buildPillars, refreshPlacesList, document, get } = await lampsPage();
  get("inview-panel").hidden = false;
  map.features = [point("A"), point("B", 2)];
  buildPillars();
  const list = get("inview-list");
  const previous = list.children[1].children[0];
  previous.focus();
  refreshPlacesList();
  const focused = list.children[1].children[0];
  assert.notEqual(focused, previous);
  assert.equal(document.activeElement, focused);
});

test("Lamps clears a recovered source warning while another source still fails", async () => {
  const { map, startMap, get } = await lampsPage();
  const notice = get("notice");
  notice.querySelector = () => get("notice-text");
  const failedTile = { state: "errored" };
  map.style = { tileManagers: { places: { getIds: () => ["a"], getTileByID: () => failedTile } } };
  startMap();
  map.handlers.error({ sourceId: "places", tile: failedTile, error: { status: 503 } });
  map.handlers.error({ sourceId: "dem", error: { status: 403 } });
  assert.match(get("notice-text").textContent, /lights and the base map/);
  map.handlers.sourcedata({ sourceId: "places", tile: {}, isSourceLoaded: false });
  assert.match(get("notice-text").textContent, /lights and the base map/);
  failedTile.state = "loaded";
  map.handlers.sourcedata({ sourceId: "places", tile: {}, isSourceLoaded: false });
  assert.match(get("notice-text").textContent, /The base map/);
  assert.equal(notice.hidden, false);
  map.handlers.sourcedata({ sourceId: "dem", sourceDataType: "metadata" });
  assert.equal(notice.hidden, true);
});

test("a different occurrence with the same source ID cannot inherit the selection", async () => {
  const { map, state, buildPillars } = await lampsPage();
  map.features = [point("shared"), point("shared", 2)];
  buildPillars();
  state.selected = map.data.pillars.features[0].properties.id;
  map.features = [point("shared", 2)];
  buildPillars();
  assert.equal(state.selected, null);

  state.selected = map.data.pillars.features[0].properties.id;
  map.features = [point("shared", 2.001), point("shared", 3)];
  buildPillars();
  assert.equal(state.selected, null);
});

test("an open card closes when a distant sole match replaces the selected occurrence", async () => {
  const { map, state, startMap, buildPillars, get } = await lampsPage();
  startMap();
  const original = point("shared");
  original.properties.name = "Chapel A";
  map.features = [original];
  buildPillars();
  openFirstPillar(map);
  assert.equal(get("card").hidden, false);

  const replacement = point("shared", 2);
  replacement.properties.name = "Chapel B";
  map.features = [replacement];
  buildPillars();
  assert.equal(state.selected, null);
  assert.equal(get("card").hidden, true);
});

test("an open card follows a prefixed OSM key across tile precision changes", async () => {
  const { map, state, startMap, buildPillars, get } = await lampsPage();
  startMap();
  map.features = [point("w643607728")];
  buildPillars();
  openFirstPillar(map);
  assert.equal(get("card").hidden, false);
  const finer = point("w643607728", 1.00001);
  finer.tile = { z: 14, x: 8200, y: 8144 };
  map.zoom = 14;
  map.features = [finer];
  buildPillars();
  assert.equal(get("card").hidden, false);
  assert.equal(state.selected, map.data.pillars.features[0].properties.id);
  assert.deepEqual(map.data.selection.features[1].geometry.coordinates, finer.geometry.coordinates);
  assert.equal(get("card-main").href, "../../global/#map=17.00/1.00000/1.00001");
});

test("a detailed light selects the place by its prefixed OSM key after flying", async () => {
  const { map, state, startMap, buildPillars, get } = await lampsPage();
  map.flyTo = () => {};
  map.once = () => {};
  map.getPitch = () => 66;
  map.stop = () => {};
  startMap();
  map.zoom = 9;
  map.layers.add("places-core");
  const way = point("w123");
  way.properties.osm_id = 123;
  map.hits = [{ ...way, layer: { id: "places-core" }, _z: 9 }];
  map.handlers.click({ point: { x: 1, y: 1 } });
  assert.equal(state.pendingSelect, "w123");
  const node = point("n123", 2);
  node.properties.osm_id = 123;
  map.zoom = 15.2;
  map.features = [way, node];
  buildPillars();
  assert.equal(state.pendingSelect, null);
  assert.equal(get("card").hidden, false);
  assert.deepEqual(map.data.selection.features[1].geometry.coordinates, way.geometry.coordinates);
});

test("cards display September names and missing tags without inventing tile names", async () => {
  const { map, startMap, buildPillars, get } = await lampsPage();
  startMap();
  const place = point("w525849060", 1, "unknown");
  for (const [name, name_en, displayed] of [
    ["", undefined, "Unnamed place of worship"],
    ["Place of Worship 123", undefined, "Place of Worship 123"],
    ["Te ingoa", "English name", "English name"]
  ]) {
    map.features = [{ ...place, properties: { ...place.properties, name, name_en, osm_id: 525849060 } }];
    buildPillars();
    openFirstPillar(map);
    assert.equal(get("card-name").textContent, displayed);
    assert.equal(get("card-tradition").textContent, "Other or unknown");
    assert.equal(get("card-start-row").hidden, true);
  }
});

test("the Lamps places protocol reports 404 and preserves empty and populated tiles", async (t) => {
  const controller = new AbortController();
  const bytes = new Uint8Array([26, 0]);
  let status = 404;
  const { map, startMap } = await lampsPage({
    addProtocol: (scheme, handler) => {
      maplibre.addProtocol(scheme, handler);
      t.after(() => maplibre.removeProtocol(scheme));
    },
    fetch: async (url, options) => {
      assert.match(url, /^https:\/\/tiles\.placemap\.org\/places-(overview-)?v2-20260901-grid\/0\/0\/0$/);
      assert.equal(options.signal, controller.signal);
      return new Response(status === 200 ? bytes : null, { status, headers: { "Cache-Control": "max-age=60" } });
    }
  });
  startMap();
  const { sources } = map.options.style;
  const customSources = Object.entries(sources)
    .filter(([, source]) => source.tiles?.some((url) => url.startsWith("places-tile://")))
    .map(([id]) => id);
  assert.deepEqual(customSources, ["overview", "places"]);
  // use the vendored handler that dispatches protocol requests from workers
  const request = maplibre.getGlobalDispatcher().messageHandlers.GR;
  for (const id of customSources) {
    const url = sources[id].tiles[0].replace("{z}/{x}/{y}", "0/0/0");
    const loadTile = () => request(null, { url, type: "arrayBuffer" }, controller);
    status = 404;
    await assert.rejects(loadTile, (error) => {
      assert.match(error.message, /Places archive not found \(HTTP 404\)/);
      assert.notEqual(error.status, 404);
      return true;
    });
    status = 204;
    assert.equal((await loadTile()).data.byteLength, 0);
    status = 200;
    const result = await loadTile();
    assert.deepEqual(new Uint8Array(result.data), bytes);
    assert.equal(result.cacheControl, "max-age=60");
  }
});

test("an open card refreshes a revised start date without moving focus", async () => {
  const { map, document, startMap, buildPillars, get } = await lampsPage();
  startMap();
  const original = point("A");
  original.properties.start_date = "1920";
  map.features = [original];
  buildPillars();
  openFirstPillar(map);
  assert.equal(get("card-start").textContent, "1920");
  get("card-main").focus();

  for (const startDate of ["1952", undefined]) {
    map.features = [{ ...original, properties: { ...original.properties, start_date: startDate } }];
    buildPillars();
    assert.equal(get("card-start").textContent, startDate ?? "");
    assert.equal(get("card-start-row").hidden, startDate === undefined);
    assert.equal(get("card").hidden, false);
    assert.equal(document.activeElement, get("card-main"));
  }
});
