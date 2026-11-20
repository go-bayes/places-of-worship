import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as geometry from "./geometry.mjs";
import * as palette from "../shared/palette.mjs";
import * as style from "./style.mjs";
import * as sun from "../shared/sun.mjs";

async function lampsPage() {
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
      + "\n({ state, buildPillars, updateScale, startMap, applyFilter, refreshPlacesList, setMap(m) { map = m; } })",
    {
      ...geometry, ...palette, ...style, ...sun, document, URLSearchParams, setInterval() {},
      window: { matchMedia: () => ({ matches: false }) }, location: { search: "", hash: "" },
      maplibregl: { Map: function () { return map; }, NavigationControl: class {} }
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
  const { state, map, startMap, updateScale, get } = await lampsPage();
  const flights = [];
  map.flyTo = (camera) => flights.push(camera);
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
      properties: { id: "representative" }, geometry: { coordinates: [1, 1] }
    }];
    map.handlers.click({ point: { x: 1, y: 1 } });
    assert.equal(state.pendingSelect, null);
    assert.equal(state.selected, null);
  }
  assert.equal(flights.length, 3);
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
});
