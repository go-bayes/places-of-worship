// relief: the density and diversity of mapped places of worship across one
// city, as stacked columns over a flat day map. every number comes from the
// engine in a worker, which reads every tile that touches the study area;
// nothing is counted from the map view.

import * as maplibregl from "../vendor/maplibre-gl@6.19.0/maplibre-gl.mjs";
import { religionCategories } from "./engine/categories.js";
import { tilesCoveringBbox } from "./engine/extent.js";
import { CITIES } from "../shared/cities.mjs";
import { DAY, INK, mix } from "../shared/palette.mjs";
import {
  STUDY_SIZES,
  CELL_SIZES,
  studyArea,
  heightUnit,
  scaleRing,
  nestedRings,
  diversityColorExpression,
  categoryColorExpression,
  categoryLabel,
  describeCell,
  countLine,
  reconciliationLines,
  tileFailure,
  tableRows,
  sortRows,
  formatArea,
  formatDensity,
  formatBits,
  plural
} from "./view.mjs";

const TILE_URL = "https://tiles.placemap.org/places-v2-20260901-grid/{z}/{x}/{y}";
const KEY = window.MAPTILER_API_KEY || "";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const PHONE = window.matchMedia("(max-width: 640px)");
const PITCH = 55;
// columns stand a little inside their cells so neighbours read apart; the
// ground outline keeps each cell's true footprint
const COLUMN_SCALE = 0.86;

const $ = (id) => document.getElementById(id);
const EMPTY = { type: "FeatureCollection", features: [] };

// ---- state from the address --------------------------------------------

const params = new URLSearchParams(location.search);
const state = {
  city: CITIES.find((c) => c.label === params.get("city")) || CITIES.find((c) => c.label === "Wellington"),
  area: STUDY_SIZES.some((s) => s.key === params.get("area")) ? params.get("area") : "central",
  cell: CELL_SIZES.some((s) => String(s.metres) === params.get("cell")) ? Number(params.get("cell")) : 500,
  by: params.get("by") === "diversity" ? "diversity" : "traditions",
  flat: params.get("view") === "flat",
  result: null,
  cells: [],
  cellIndex: new Map(),
  unit: null,
  selected: null,
  sort: { key: "count", direction: "descending" },
  returnFocus: null
};

function writeAddress() {
  const p = new URLSearchParams();
  p.set("city", state.city.label);
  if (state.area !== "central") p.set("area", state.area);
  if (state.cell !== 500) p.set("cell", String(state.cell));
  if (state.by !== "traditions") p.set("by", state.by);
  if (state.flat) p.set("view", "flat");
  history.replaceState(null, "", `?${p.toString()}`);
}

// ---- the map -------------------------------------------------------------

let map = null;

function baseStyle() {
  const q = `key=${encodeURIComponent(KEY)}`;
  return {
    version: 8,
    name: "Relief",
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?${q}`,
    light: { anchor: "viewport", position: [1.2, 215, 35], color: "#ffffff", intensity: 0.32 },
    transition: { duration: 300, delay: 0 },
    sources: {
      omt: { type: "vector", url: `https://api.maptiler.com/tiles/v3/tiles.json?${q}` },
      study: { type: "geojson", data: EMPTY },
      ground: { type: "geojson", data: EMPTY },
      columns: { type: "geojson", data: EMPTY },
      flat: { type: "geojson", data: EMPTY },
      selected: { type: "geojson", data: EMPTY }
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": DAY.land } },
      {
        id: "water", type: "fill", source: "omt", "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": DAY.water }
      },
      {
        id: "rivers", type: "line", source: "omt", "source-layer": "waterway", minzoom: 9,
        filter: ["match", ["get", "class"], ["river", "canal"], true, false],
        paint: { "line-color": DAY.water, "line-width": 1.2 }
      },
      {
        id: "roads", type: "line", source: "omt", "source-layer": "transportation", minzoom: 9,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f7f5ef", "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 9, 0.6, 13, 1.8, 16, 5] }
      },
      {
        // outside the study area the ground is washed back, so the eye
        // sees where counting stops
        id: "outside", type: "fill", source: "study",
        filter: ["==", ["get", "part"], "outside"],
        paint: { "fill-color": "#f6f4ee", "fill-opacity": 0.6 }
      },
      {
        id: "cell-ground", type: "line", source: "ground",
        paint: { "line-color": "rgba(29, 34, 51, 0.28)", "line-width": 0.8 }
      },
      {
        id: "bands", type: "fill", source: "flat",
        layout: { visibility: "none" },
        paint: { "fill-color": categoryColorExpression(), "fill-outline-color": "rgba(29, 34, 51, 0.35)" }
      },
      {
        id: "bands-diversity", type: "fill", source: "ground",
        layout: { visibility: "none" },
        paint: { "fill-color": diversityColorExpression(), "fill-outline-color": "rgba(29, 34, 51, 0.35)" }
      },
      {
        id: "study-line", type: "line", source: "study",
        filter: ["==", ["get", "part"], "edge"],
        paint: { "line-color": INK, "line-width": 1.4, "line-dasharray": [3, 2] }
      },
      {
        id: "selected-ground", type: "line", source: "selected",
        filter: ["==", ["get", "part"], "ground"],
        paint: { "line-color": INK, "line-width": 2.6 }
      },
      {
        id: "segments", type: "fill-extrusion", source: "columns",
        filter: ["==", ["get", "kind"], "segment"],
        paint: {
          "fill-extrusion-color": categoryColorExpression(),
          "fill-extrusion-base": 0,
          "fill-extrusion-height": 0,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false
        }
      },
      {
        id: "diversity", type: "fill-extrusion", source: "columns",
        filter: ["==", ["get", "kind"], "footprint"],
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": diversityColorExpression(),
          "fill-extrusion-height": 0,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false
        }
      },
      {
        // a dark cap on the selected column, so it reads at any angle
        id: "selected-cap", type: "fill-extrusion", source: "selected",
        filter: ["==", ["get", "part"], "cap"],
        paint: {
          "fill-extrusion-color": INK,
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false
        }
      },
      {
        id: "place-labels", type: "symbol", source: "omt", "source-layer": "place",
        filter: ["match", ["get", "class"], ["city", "town", "suburb"], true, false],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Source Sans Pro Regular"],
          "text-size": 13,
          "text-padding": 24,
          "text-max-width": 8
        },
        paint: { "text-color": mix(INK, DAY.land, 0.25), "text-halo-color": DAY.land, "text-halo-width": 1.4 }
      },
      {
        id: "water-names", type: "symbol", source: "omt", "source-layer": "water_name",
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Serif Italic"],
          "text-size": 13,
          "text-max-width": 7
        },
        paint: { "text-color": mix(DAY.water, INK, 0.6) }
      },
      {
        id: "flat-counts", type: "symbol", source: "flat",
        filter: ["==", ["get", "label"], true],
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "total"]],
          "text-font": ["Source Sans Pro Regular"],
          "text-size": 13,
          "text-allow-overlap": false
        },
        paint: { "text-color": INK, "text-halo-color": "#ffffff", "text-halo-width": 1.6 }
      }
    ]
  };
}

function hasWebgl2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function startMap() {
  map = new maplibregl.Map({
    container: "map",
    style: baseStyle(),
    center: state.city.coords,
    zoom: 12,
    pitch: state.flat ? 0 : PITCH,
    bearing: state.flat ? 0 : -18,
    attributionControl: false,
    maxPitch: 70
  });
  map.getCanvas().setAttribute("aria-label", "Map of the study area with a column for each occupied cell");
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.on("load", () => {
    drawStudyArea();
    applyMode();
    if (state.result) drawResult();
  });
  map.on("error", (event) => {
    if (event.sourceId === "omt" || /maptiler/.test(String(event.error?.url || ""))) {
      $("basemap-notice").hidden = false;
    }
  });
  map.on("sourcedata", (event) => {
    const notice = $("basemap-notice");
    if (notice.hidden || event.sourceId !== "omt" || (!event.tile && event.sourceDataType !== "metadata")) return;
    const tiles = map.style?.tileManagers?.omt;
    if (tiles?.getIds().some((key) => tiles.getTileByID(key)?.state === "errored")) return;
    notice.hidden = true;
  });
  map.on("idle", () => {
    const notice = $("basemap-notice");
    if (notice.hidden) return;
    // cached tiles can return to view without a new sourcedata event
    const tiles = map.style?.tileManagers?.omt;
    const ids = tiles?.getIds();
    if (ids?.length && ids.every((id) => tiles.getTileByID(id)?.state === "loaded")) notice.hidden = true;
  });
  map.on("click", onMapClick);
  for (const layer of ["segments", "diversity", "bands", "bands-diversity"]) {
    map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
  }
}

function sheetPadding() {
  if (PHONE.matches) return { top: 30, bottom: $("sheet").offsetHeight + 30, left: 16, right: 16 };
  return { top: 60, bottom: 60, left: 420, right: 80 };
}

function frameStudyArea(animate) {
  if (!map) return;
  const [w, s, e, n] = studyArea(state.city, state.area);
  const camera = map.cameraForBounds([[w, s], [e, n]], { padding: sheetPadding(), pitch: 0, bearing: 0 });
  if (!camera) return;
  const target = { center: camera.center, zoom: camera.zoom - (state.flat ? 0 : 0.15), pitch: state.flat ? 0 : PITCH, bearing: state.flat ? 0 : -18 };
  if (animate && !REDUCED_MOTION.matches) map.easeTo({ ...target, duration: 1400 });
  else map.jumpTo(target);
}

// the one moment of motion: a slow quarter turn round the study area,
// which any interaction cancels
function orbit() {
  if (REDUCED_MOTION.matches || state.flat || !map) return;
  const stop = () => {
    map.stop();
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) window.removeEventListener(type, stop, true);
  };
  for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) window.addEventListener(type, stop, { capture: true, passive: true });
  map.easeTo({ bearing: map.getBearing() + 90, duration: 16000, easing: (t) => t * t * (3 - 2 * t) });
  map.once("moveend", () => {
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) window.removeEventListener(type, stop, true);
  });
}

function drawStudyArea() {
  if (!map || !map.getSource("study")) return;
  const [w, s, e, n] = studyArea(state.city, state.area);
  const edge = [[w, s], [e, s], [e, n], [w, n], [w, s]];
  map.getSource("study").setData({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { part: "edge" }, geometry: { type: "LineString", coordinates: edge } },
      {
        type: "Feature", properties: { part: "outside" },
        geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], edge.slice().reverse()] }
      }
    ]
  });
}

// ---- computing in the worker ----------------------------------------------

let worker = null;
let requestId = 0;

function stopWorker() {
  worker?.terminate();
  worker = null;
}

function compute() {
  const id = ++requestId;
  stopWorker();
  setStatus({ loading: "Reading tiles" });
  clearResult();
  try {
    const bbox = studyArea(state.city, state.area);
    const tiles = [...tilesCoveringBbox(bbox, 12)].length;
    setStatus({ loading: `Reading ${plural(tiles, "tile", "tiles")} for ${state.city.label}` });
    worker = new Worker(new URL("./engine/relief-worker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", ({ data }) => {
      if (id !== requestId || !worker) return;
      stopWorker();
      try {
        if (data.error) showFailure(data.error);
        else showResult(data);
      } catch {
        showFailure("the counting worker returned an invalid result");
      }
    });
    function onWorkerError(event) {
      if (id !== requestId || !worker) return;
      stopWorker();
      showFailure(event.message || "the counting worker stopped");
    }
    worker.addEventListener("error", onWorkerError);
    worker.addEventListener("messageerror", onWorkerError);
    worker.postMessage({ bbox, zoom: 12, cellMetres: state.cell, tileUrlTemplate: TILE_URL });
  } catch (error) {
    stopWorker();
    showFailure(error.message);
  }
}

function setStatus({ loading = null, failure = null, line = null }) {
  const count = $("count-line");
  const fail = $("failure");
  document.documentElement.dataset.state = loading ? "loading" : failure ? "failed" : "ready";
  if (loading) {
    count.hidden = false;
    count.textContent = loading;
    fail.hidden = true;
  } else if (failure) {
    count.hidden = true;
    count.textContent = "";
    fail.hidden = false;
    $("failure-text").textContent = failure;
  } else {
    count.hidden = false;
    count.textContent = line;
    fail.hidden = true;
  }
}

function showFailure(message) {
  const { tile, reason } = tileFailure(message);
  const where = tile ? `Tile ${tile} could not be read (${reason}).` : `The tiles could not be read (${reason}).`;
  setStatus({ failure: `${where} No totals are shown until every tile in the study area is read.` });
  clearResult();
}

function clearResult() {
  state.result = null;
  state.unit = null;
  state.cells = [];
  state.cellIndex = new Map();
  state.returnFocus = null;
  deselect();
  $("how-lines").replaceChildren();
  renderLegendCounts(null);
  renderTable();
  renderHeightNote();
  if (!map || !map.getSource("columns")) return;
  for (const id of ["ground", "columns", "flat", "selected"]) map.getSource(id).setData(EMPTY);
}

function showResult(result) {
  const footprints = result.cells.features.filter((f) => f.properties.kind === "footprint");
  // name cells by rank, most places first, so the table and the card agree
  const ranked = footprints
    .map((f) => ({ ...f.properties, ring: f.geometry.coordinates[0] }))
    .sort((a, b) => b.count - a.count || (a.cell_id < b.cell_id ? -1 : 1));
  ranked.forEach((c, i) => { c.label = `Cell ${i + 1}`; });
  const segmentsByCell = new Map();
  for (const f of result.cells.features) {
    if (f.properties.kind !== "segment") continue;
    if (!segmentsByCell.has(f.properties.cell_id)) segmentsByCell.set(f.properties.cell_id, []);
    segmentsByCell.get(f.properties.cell_id).push(f.properties);
  }
  for (const c of ranked) c.segments = segmentsByCell.get(c.cell_id) || [];
  const sum = ranked.reduce((a, c) => a + c.count, 0);
  if (sum !== result.totals.count) {
    // the engine already checks this; the page refuses to show a total
    // that its own cells do not add up to
    showFailure("the cell counts do not match the total");
    return;
  }
  state.result = result;
  state.cells = ranked;
  state.cellIndex = new Map(ranked.map((c) => [c.cell_id, c]));
  const maxCount = ranked.reduce((a, c) => Math.max(a, c.count), 0);
  state.unit = heightUnit(state.cell, maxCount);
  setStatus({ line: countLine(result.totals) });
  const how = $("how-lines");
  how.replaceChildren(...reconciliationLines(result.reconciliation, result.totals, state.cell).map((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    return li;
  }));
  renderLegendCounts(result.totals);
  renderTable();
  drawResult();
}

function drawResult() {
  if (!map || !map.getSource("columns") || !state.result) return;
  const U = state.unit;
  const ground = [];
  const columns = [];
  const flat = [];
  for (const c of state.cells) {
    const summary = { cell_id: c.cell_id, count: c.count, entropy_bits: c.entropy_bits };
    ground.push({ type: "Feature", properties: summary, geometry: { type: "Polygon", coordinates: [c.ring] } });
    const inner = scaleRing(c.ring, COLUMN_SCALE);
    columns.push({ type: "Feature", properties: { ...summary, kind: "footprint", height: c.count * U }, geometry: { type: "Polygon", coordinates: [inner] } });
    for (const s of c.segments) {
      columns.push({
        type: "Feature",
        properties: { cell_id: c.cell_id, kind: "segment", category: s.category, base: s.base * U, top: s.top * U },
        geometry: { type: "Polygon", coordinates: [inner] }
      });
    }
    for (const band of nestedRings(c.ring, c.segments, c.count)) {
      flat.push({ type: "Feature", properties: { cell_id: c.cell_id, category: band.category }, geometry: { type: "Polygon", coordinates: [band.ring] } });
    }
    const pts = c.ring.slice(0, -1);
    const centre = [pts.reduce((a, p) => a + p[0], 0) / 6, pts.reduce((a, p) => a + p[1], 0) / 6];
    flat.push({ type: "Feature", properties: { cell_id: c.cell_id, label: true, total: c.count }, geometry: { type: "Point", coordinates: centre } });
  }
  map.getSource("ground").setData({ type: "FeatureCollection", features: ground });
  map.getSource("columns").setData({ type: "FeatureCollection", features: columns });
  map.getSource("flat").setData({ type: "FeatureCollection", features: flat });
  map.setPaintProperty("segments", "fill-extrusion-base", ["get", "base"]);
  map.setPaintProperty("segments", "fill-extrusion-height", ["get", "top"]);
  map.setPaintProperty("diversity", "fill-extrusion-height", ["get", "height"]);
  renderHeightNote();
}

// ---- modes ---------------------------------------------------------------

function applyMode() {
  document.documentElement.dataset.by = state.by;
  document.documentElement.dataset.view = state.flat ? "flat" : "columns";
  $("legend-traditions").hidden = state.by !== "traditions";
  $("legend-diversity").hidden = state.by !== "diversity";
  $("flat").setAttribute("aria-pressed", state.flat ? "true" : "false");
  if (!map || !map.getLayer("segments")) return;
  const show = (id, on) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  show("segments", !state.flat && state.by === "traditions");
  show("diversity", !state.flat && state.by === "diversity");
  show("bands", state.flat && state.by === "traditions");
  show("bands-diversity", state.flat && state.by === "diversity");
  show("flat-counts", state.flat);
}

function setFlat(flat) {
  state.flat = flat;
  if (state.selected) select(state.selected, { focus: false });
  writeAddress();
  applyMode();
  renderHeightNote();
  if (!map) return;
  const camera = { pitch: flat ? 0 : PITCH, bearing: flat ? 0 : map.getBearing() || -18 };
  if (REDUCED_MOTION.matches) map.jumpTo(camera);
  else map.easeTo({ ...camera, duration: 800 });
}

// ---- legend ----------------------------------------------------------------

function buildLegend() {
  const list = $("legend-traditions");
  for (const c of religionCategories) {
    const li = document.createElement("li");
    li.dataset.key = c.key;
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.setProperty("--swatch", c.color);
    sw.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = c.label;
    const n = document.createElement("span");
    n.className = "legend-count";
    li.append(sw, name, n);
    list.append(li);
  }
}

function renderLegendCounts(totals) {
  for (const li of $("legend-traditions").children) {
    const n = totals ? totals.counts[li.dataset.key] : null;
    li.querySelector(".legend-count").textContent = n === null ? "" : String(n);
    li.classList.toggle("is-zero", n === 0);
  }
}

function renderHeightNote() {
  const unit = state.unit;
  $("height-note").textContent = state.flat
    ? "Flat view: each cell's bands share its area in proportion to the places of each tradition; the number is the cell's count."
    : unit === null
      ? "Height: each column rises with the number of places in its cell."
      : `Height: each place adds ${unit % 1 ? unit.toFixed(1) : unit} m to its column.`;
}

// ---- selecting a cell ----------------------------------------------------------

function onMapClick(e) {
  const layers = ["segments", "diversity", "bands", "bands-diversity"].filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
  const { x, y } = e.point;
  const hits = map.queryRenderedFeatures([[x - 3, y - 3], [x + 3, y + 3]], { layers });
  const hit = hits.find((f) => f.properties && f.properties.cell_id);
  if (hit) select(hit.properties.cell_id, { focus: false });
  else deselect();
}

function select(cellId, { focus = true, move = false } = {}) {
  const c = state.cellIndex.get(cellId);
  if (!c) return;
  state.selected = cellId;
  if (map && map.getSource("selected")) {
    const top = c.count * state.unit;
    const cap = state.flat ? [] : [{
      type: "Feature",
      properties: { part: "cap", base: top, top: top + Math.max(15, state.unit * 0.3) },
      geometry: { type: "Polygon", coordinates: [scaleRing(c.ring, COLUMN_SCALE)] }
    }];
    map.getSource("selected").setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { part: "ground" }, geometry: { type: "Polygon", coordinates: [c.ring] } }, ...cap]
    });
  }
  $("card-title").textContent = c.label;
  const text = $("card-text");
  text.replaceChildren(...describeCell(c).map((t) => {
    const p = document.createElement("p");
    p.textContent = t;
    return p;
  }));
  $("card").hidden = false;
  document.documentElement.dataset.card = "open";
  if (focus) $("card-title").focus({ preventScroll: true });
  if (move && map) {
    const pts = c.ring.slice(0, -1);
    const centre = [pts.reduce((a, p) => a + p[0], 0) / 6, pts.reduce((a, p) => a + p[1], 0) / 6];
    if (REDUCED_MOTION.matches) map.jumpTo({ center: centre });
    else map.easeTo({ center: centre, duration: 700 });
  }
  for (const row of $("table-body").children) row.classList.toggle("is-selected", row.dataset.cell === cellId);
}

function deselect() {
  state.selected = null;
  if (map && map.getSource("selected")) map.getSource("selected").setData(EMPTY);
  $("card").hidden = true;
  delete document.documentElement.dataset.card;
}

$("card-close").addEventListener("click", () => {
  const back = state.returnFocus;
  state.returnFocus = null;
  deselect();
  (back || (map && map.getCanvas()) || document.body).focus?.();
});

// ---- the table ---------------------------------------------------------------

const COLUMNS = [
  { key: "label", title: "Cell", sortable: false },
  { key: "count", title: "Places" },
  { key: "area", title: "Area (km²)" },
  { key: "density", title: "Per km²" },
  ...religionCategories.map((c) => ({ key: c.key, title: c.label })),
  { key: "diversity", title: "Diversity (bits)" }
];

function cellText(key, value) {
  if (value === null || value === undefined) return "not defined";
  if (key === "area") return formatArea(value);
  if (key === "density") return formatDensity(value);
  if (key === "diversity") return formatBits(value);
  return String(value);
}

function buildTableHead() {
  const row = $("table-headrow");
  for (const col of COLUMNS) {
    const th = document.createElement("th");
    th.scope = "col";
    th.dataset.key = col.key;
    if (col.sortable === false) {
      th.textContent = col.title;
    } else {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = col.title;
      b.addEventListener("click", () => {
        const same = state.sort.key === col.key;
        state.sort = { key: col.key, direction: same && state.sort.direction === "descending" ? "ascending" : "descending" };
        renderTable();
      });
      th.append(b);
    }
    row.append(th);
  }
}

function renderTable() {
  const body = $("table-body");
  const foot = $("table-foot");
  body.replaceChildren();
  foot.replaceChildren();
  for (const th of $("table-headrow").children) {
    if (th.dataset.key === state.sort.key) th.setAttribute("aria-sort", state.sort.direction);
    else th.removeAttribute("aria-sort");
  }
  const result = state.result;
  if (!result) {
    $("table-caption").textContent = document.documentElement.dataset.state === "failed"
      ? "The table is empty because a tile could not be read; no partial counts are shown."
      : "Reading the tiles for this study area.";
    return;
  }
  $("table-caption").textContent = `${countLine(result.totals)} ${plural(state.cells.length, "occupied cell", "occupied cells")} of ${formatArea(state.cells[0] ? state.cells[0].area_km2 : 0)} km² each, in ${state.city.label}. A cell on the study boundary reports density over its whole hexagon. Select a cell to show it on the map and read its details.`;
  const labels = new Map(state.cells.map((c) => [c.cell_id, c.label]));
  const rows = sortRows(tableRows(state.cells), state.sort.key, state.sort.direction);
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.dataset.cell = r.id;
    if (r.id === state.selected) tr.classList.add("is-selected");
    for (const col of COLUMNS) {
      if (col.key === "label") {
        const th = document.createElement("th");
        th.scope = "row";
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = labels.get(r.id);
        b.addEventListener("click", () => {
          state.returnFocus = b;
          select(r.id, { focus: true, move: true });
        });
        th.append(b);
        tr.append(th);
      } else {
        const td = document.createElement("td");
        td.textContent = cellText(col.key, r[col.key]);
        if (r[col.key] === 0) td.classList.add("is-zero");
        tr.append(td);
      }
    }
    body.append(tr);
  }
  const t = result.totals;
  const totalCells = {
    label: "All cells",
    count: t.count,
    area: state.cells.reduce((a, c) => a + c.area_km2, 0),
    density: null,
    ...Object.fromEntries(religionCategories.map((c) => [c.key, t.counts[c.key]])),
    diversity: t.entropy_bits
  };
  for (const col of COLUMNS) {
    const cell = document.createElement(col.key === "label" ? "th" : "td");
    if (col.key === "label") {
      cell.scope = "row";
      cell.textContent = "All cells";
    } else if (col.key === "density") {
      cell.textContent = "";
    } else {
      cell.textContent = cellText(col.key, totalCells[col.key]);
    }
    foot.append(cell);
  }
}

function openTable(open) {
  $("table-panel").hidden = !open;
  $("table-open").setAttribute("aria-expanded", open ? "true" : "false");
  document.documentElement.dataset.table = open ? "open" : "closed";
  if (open) $("table-title").focus();
  else $("table-open").focus();
}

$("table-open").addEventListener("click", () => openTable($("table-panel").hidden));
$("table-close").addEventListener("click", () => openTable(false));

// ---- controls ------------------------------------------------------------------

function buildControls() {
  const city = $("city");
  for (const c of CITIES) {
    const o = document.createElement("option");
    o.value = c.label;
    o.textContent = c.label;
    city.append(o);
  }
  city.value = state.city.label;
  city.addEventListener("change", () => {
    state.city = CITIES.find((c) => c.label === city.value);
    changedArea();
  });
  const area = $("area");
  for (const s of STUDY_SIZES) {
    const o = document.createElement("option");
    o.value = s.key;
    o.textContent = s.label;
    area.append(o);
  }
  area.value = state.area;
  area.addEventListener("change", () => {
    state.area = area.value;
    changedArea();
  });
  const sizes = $("cell-sizes");
  for (const s of CELL_SIZES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "cell";
    input.value = String(s.metres);
    input.checked = s.metres === state.cell;
    input.addEventListener("change", () => {
      state.cell = s.metres;
      writeAddress();
      compute();
    });
    const span = document.createElement("span");
    span.textContent = s.label;
    label.append(input, span);
    sizes.append(label);
  }
  for (const input of document.querySelectorAll('input[name="by"]')) {
    input.checked = input.value === state.by;
    input.addEventListener("change", () => {
      state.by = input.value;
      writeAddress();
      applyMode();
    });
  }
  $("flat").addEventListener("click", () => setFlat(!state.flat));
  $("retry").addEventListener("click", compute);
  $("fold").addEventListener("click", () => setFolded($("sheet").dataset.folded !== "true"));
  // a phone opens with the sheet folded, so the columns have the screen
  if (PHONE.matches) setFolded(true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("table-panel").hidden) openTable(false);
    else if (!$("card").hidden) $("card-close").click();
  });
}

function setFolded(folded) {
  $("sheet").dataset.folded = folded ? "true" : "false";
  $("fold").setAttribute("aria-expanded", folded ? "false" : "true");
  $("fold").textContent = folded ? "Show controls" : "Hide controls";
}

function changedArea() {
  writeAddress();
  drawStudyArea();
  frameStudyArea(true);
  compute();
}

// ---- start -------------------------------------------------------------------

buildControls();
buildLegend();
buildTableHead();
applyMode();
renderHeightNote();
compute();
if (!hasWebgl2()) {
  document.body.classList.add("no-webgl");
  $("no-webgl").hidden = false;
  $("no-webgl-reason").textContent = "The columns need WebGL 2, which this browser does not offer or has turned off.";
} else {
  try {
    startMap();
    map.once("load", () => {
      frameStudyArea(false);
      // let the first columns arrive before the turn begins
      setTimeout(orbit, 600);
    });
  } catch (err) {
    console.error(err);
    $("no-webgl").hidden = false;
    $("no-webgl-reason").textContent = "The 3D map could not start in this browser.";
  }
}

window.relief = { get map() { return map; }, state };
