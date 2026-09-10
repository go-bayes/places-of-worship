// staged immersive pilot (2026-09-10): globe + terrain + buildings + a
// Canterbury Anglican tour, keyless. every source here is open and needs no
// key; nothing is cached or rehosted. not wired into navigation.
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6.9.0/dist/maplibre-gl.mjs";

const IS_MOBILE = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// whether the link that opened this page carried a saved camera; maplibre
// writes its own view= into the hash as soon as the map exists, so this must
// be read before the map is built
const OPENED_WITH_VIEW = /[#&]view=/.test(window.location.hash);

// the same colour vocabulary as the shared runtime (region-map.js)
const religionColors = [
  "match", ["get", "religion"],
  "christian", "#e11d48",
  "muslim", "#16a34a",
  "hindu", "#f97316",
  "buddhist", "#facc15",
  "jewish", "#2563eb",
  "sikh", "#7c3aed",
  "shinto", "#ec4899",
  "taoist", "#06b6d4",
  "#9ca3af"
];

// data products the NZ research page already ships; paths resolve from this
// staged directory
const DATED_PLACES_URL = "../../nz/data/dated_places.geojson";
const PLACES_TILES = "https://tiles.placemap.org/places/{z}/{x}/{y}";
const PLACES_SOURCE_LAYER = "places";

// tour stops are keyed to osm ids in the dated-places product, so every word
// on the title card comes from the data; only the camera is authored here.
// order runs from the alpine north through the plains into Ōtautahi
// Christchurch and out to Banks Peninsula.
const TOUR = [
  { osm_id: 412243229, zoom: 15.2, pitch: 62, bearing: 205 },   // Church of the Epiphany, Hanmer Springs
  { osm_id: 409627337, zoom: 16.0, pitch: 58, bearing: 30 },    // St John's, Rangiora
  { osm_id: 409414263, zoom: 16.2, pitch: 60, bearing: 300 },   // St Stephen's, Tuahiwi
  { osm_id: 441402587, zoom: 16.4, pitch: 60, bearing: 140 },   // St Paul's, Papanui
  { osm_id: 101333590, zoom: 16.6, pitch: 62, bearing: 20 },    // St Michael and All Angels
  { osm_id: 101123036, zoom: 16.4, pitch: 64, bearing: 320 },   // Transitional Cathedral
  { osm_id: 206893644, zoom: 16.4, pitch: 58, bearing: 70 },    // St Mary's, Addington
  { osm_id: 645144245, zoom: 15.4, pitch: 64, bearing: 160 }    // St Peter's, Akaroa
];
const TOUR_DWELL_MS = 7000;

const $ = (id) => document.getElementById(id);
const toast = (msg) => {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
};

// ---- style -----------------------------------------------------------------
const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    },
    // mapterhorn terrain tiles (terrarium-encoded webp, cc by 4.0), no key;
    // the source maplibre's own terrain examples use. a second copy of the
    // same tileset feeds the hillshade, as maplibre recommends separate
    // sources for terrain and hillshade. aws open data terrain tiles are the
    // documented alternative (see the options brief).
    terrain: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      // probed 2026-09-10: nz tiles served to z15; beyond that the server 404s
      maxzoom: 15,
      attribution: 'Terrain: <a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">© Mapterhorn</a> (CC BY 4.0)'
    },
    "terrain-shade": {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      // probed 2026-09-10: nz tiles served to z15; beyond that the server 404s
      maxzoom: 15
    },
    // openfreemap vector tiles, no key; used only for building extrusions
    openfreemap: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>'
    },
    places: {
      type: "vector",
      tiles: [PLACES_TILES],
      minzoom: 6,
      maxzoom: 18,
      attribution: '<a href="https://religionmap.org" target="_blank" rel="noopener">religionmap.org</a> (CC BY-NC-SA 4.0)'
    },
    dated: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    }
  },
  sky: {
    "sky-color": "#8fb7e6",
    "horizon-color": "#e8eef5",
    "fog-color": "#dfe6ee",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.55,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 1, 12, 0]
  },
  layers: [
    { id: "osm", type: "raster", source: "osm" },
    {
      id: "hillshade", type: "hillshade", source: "terrain-shade",
      paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#3b3f46", "hillshade-highlight-color": "#ffffff" }
    },
    {
      id: "buildings", type: "fill-extrusion", source: "openfreemap", "source-layer": "building", minzoom: 14,
      paint: {
        "fill-extrusion-color": "#d9d4c7",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85
      }
    },
    {
      id: "places", type: "circle", source: "places", "source-layer": PLACES_SOURCE_LAYER, minzoom: 6,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.1, 10, 3.85, 16, 6.5],
        "circle-color": religionColors,
        "circle-stroke-width": 0.8,
        "circle-stroke-color": "#0b0c10",
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 9, 0.85, 16, 0.8]
      }
    },
    {
      id: "dated", type: "circle", source: "dated",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 6, 16, 9],
        "circle-color": "#f59e0b",
        "circle-stroke-width": 1.2,
        "circle-stroke-color": "#0b0c10",
        "circle-opacity": 0.9
      }
    },
    {
      id: "dated-labels", type: "symbol", source: "dated", minzoom: 13,
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["concat", ["get", "name"], "\n", ["to-string", ["get", "start_year"]]],
        "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true
      },
      paint: { "text-halo-color": "#ffffff", "text-halo-width": 1.4 }
    }
  ]
};

// ---- map -------------------------------------------------------------------
const map = new maplibregl.Map({
  container: "map",
  style,
  center: [172.9, -43.4],
  zoom: 7.2,
  pitch: 45,
  bearing: 0,
  hash: "view",
  maxPitch: 80,
  attributionControl: { compact: true }
});
// touch gestures cover pan, zoom, rotate and pitch on phones; the control
// only earns its space on desktop
if (!IS_MOBILE) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

let globeOn = true;
map.on("load", () => {
  try { map.setProjection({ type: "globe" }); } catch (e) { globeOn = false; console.warn("globe unavailable", e); }
  try { map.setTerrain({ source: "terrain", exaggeration: IS_MOBILE ? 1.0 : 1.35 }); } catch (e) { console.warn("terrain unavailable", e); }
  if (IS_MOBILE) map.setLayoutProperty("buildings", "visibility", "none");
  loadDated();
  wirePopups();
  applyHashStop();
});

$("globeBtn").addEventListener("click", () => {
  globeOn = !globeOn;
  map.setProjection({ type: globeOn ? "globe" : "mercator" });
  $("globeBtn").setAttribute("aria-pressed", String(globeOn));
});

// ---- dated places + year filter -------------------------------------------
let datedById = new Map();
async function loadDated() {
  try {
    const res = await fetch(DATED_PLACES_URL);
    const geo = await res.json();
    map.getSource("dated").setData(geo);
    for (const f of geo.features) {
      if (f.geometry && f.geometry.type === "Point") datedById.set(String(f.properties.osm_id), f);
    }
    applyYear(Number($("yearRange").value));
    if (pendingStop !== null) goToStop(pendingStop, true);
  } catch (e) {
    console.warn("dated places failed", e);
    toast("Dated places did not load");
  }
}

function applyYear(year) {
  $("yearOut").value = String(year);
  const alive = ["all",
    ["==", ["geometry-type"], "Point"],
    ["<=", ["coalesce", ["get", "start_year"], 0], year],
    ["any", ["!", ["has", "end_year"]], ["==", ["get", "end_year"], null], [">=", ["get", "end_year"], year]]
  ];
  map.setFilter("dated", alive);
  map.setFilter("dated-labels", alive);
}
$("yearRange").addEventListener("input", (e) => applyYear(Number(e.target.value)));
$("yearBtn").addEventListener("click", () => {
  const panel = $("yearPanel");
  panel.hidden = !panel.hidden;
  $("yearBtn").setAttribute("aria-pressed", String(!panel.hidden));
});

// ---- popups ("stand at the door") -----------------------------------------
function streetViewLink(lng, lat) {
  // a plain maps url, no api key; opens google street view at the point
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
function osmLink(type, id) { return `https://www.openstreetmap.org/${type}/${id}`; }

function wirePopups() {
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });
  const show = (e, props) => {
    const [lng, lat] = e.lngLat.toArray();
    const name = props["name:en"] || props.name_en || props.name || "Unnamed";
    const rel = props.religion || "religion not recorded";
    const den = props.denomination ? ` · ${props.denomination}` : "";
    const yrs = props.start_year ? `<p>Recorded from ${props.start_year}${props.end_year ? ` to ${props.end_year}` : ""}</p>` : "";
    const osm = props.osm_type && props.osm_id ? `<a href="${osmLink(props.osm_type, props.osm_id)}" target="_blank" rel="noopener">OSM</a> · ` : "";
    popup.setLngLat(e.lngLat).setHTML(
      `<h3>${escapeHtml(name)}</h3><p>${escapeHtml(rel)}${escapeHtml(den)}</p>${yrs}` +
      `<p>${osm}<a href="${streetViewLink(lng, lat)}" target="_blank" rel="noopener">Stand at the door (Street View)</a></p>`
    ).addTo(map);
  };
  for (const layer of ["dated", "places"]) {
    map.on("click", layer, (e) => { if (e.features && e.features[0]) show(e, e.features[0].properties || {}); });
    map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
  }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- tour ------------------------------------------------------------------
let stopIndex = -1;
let pendingStop = null;
let playing = false;
let playTimer = null;

function readHashParam(key) {
  const m = window.location.hash.match(new RegExp(`[#&]${key}=([^&]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeHashParam(key, value) {
  let h = window.location.hash.replace(new RegExp(`[&]${key}=[^&]*`), "").replace(new RegExp(`#${key}=[^&]*&?`), "#");
  if (h === "#") h = "";
  if (value !== null && value !== undefined) h += (h ? "&" : "#") + `${key}=${encodeURIComponent(value)}`;
  history.replaceState(null, "", window.location.pathname + window.location.search + h);
}
function applyHashStop() {
  const s = readHashParam("stop");
  if (s === null) return;
  const n = Number(s) - 1;
  if (Number.isInteger(n) && n >= 0 && n < TOUR.length) {
    pendingStop = n;
    if (datedById.size) goToStop(n, true);
  }
}

function goToStop(n, fromHash = false) {
  const stop = TOUR[n];
  const f = datedById.get(String(stop.osm_id));
  if (!f) { toast("Stop not in the data"); return; }
  stopIndex = n;
  pendingStop = null;
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const card = $("tourCard");
  card.hidden = false;
  $("tourBtn").setAttribute("aria-pressed", "true");
  $("tourStep").textContent = `Stop ${n + 1} of ${TOUR.length} · Canterbury Anglican`;
  $("tourName").textContent = p.name || "Unnamed";
  const rel = [p.religion, p.denomination].filter(Boolean).join(" · ");
  const when = p.start_year ? `Recorded from ${p.start_year}${p.end_year ? ` to ${p.end_year}` : ""} (OpenStreetMap start_date tag)` : "No start date recorded";
  $("tourMeta").textContent = `${rel} — ${when}`;
  $("tourLinks").innerHTML =
    `<a href="${osmLink(p.osm_type, p.osm_id)}" target="_blank" rel="noopener">OSM ${p.osm_type} ${p.osm_id}</a> · ` +
    `<a href="${streetViewLink(lng, lat)}" target="_blank" rel="noopener">Stand at the door</a>`;
  $("tourPrev").disabled = n === 0;
  $("tourNext").disabled = n === TOUR.length - 1;
  writeHashParam("stop", n + 1);

  const camera = { center: [lng, lat], zoom: IS_MOBILE ? stop.zoom - 0.6 : stop.zoom, pitch: stop.pitch, bearing: stop.bearing };
  // a shared link opens exactly the saved camera: keep the hash view when it
  // arrived with the stop, otherwise fly there
  if (fromHash && OPENED_WITH_VIEW) return;
  if (REDUCED_MOTION || fromHash) map.jumpTo(camera);
  else map.flyTo({ ...camera, speed: 0.9, curve: 1.5, essential: true });
}

function startTour() {
  if (stopIndex < 0) goToStop(0); else $("tourCard").hidden = false;
}
function endTour() {
  playing = false;
  clearTimeout(playTimer);
  $("tourPlay").setAttribute("aria-pressed", "false");
  $("tourPlay").textContent = "Play";
  $("tourCard").hidden = true;
  $("tourBtn").setAttribute("aria-pressed", "false");
  writeHashParam("stop", null);
}
function scheduleNext() {
  clearTimeout(playTimer);
  if (!playing) return;
  playTimer = setTimeout(() => {
    if (!playing) return;
    if (stopIndex < TOUR.length - 1) { goToStop(stopIndex + 1); scheduleNext(); }
    else { playing = false; $("tourPlay").setAttribute("aria-pressed", "false"); $("tourPlay").textContent = "Play"; }
  }, TOUR_DWELL_MS);
}

$("tourBtn").addEventListener("click", () => { if ($("tourCard").hidden) startTour(); else endTour(); });
$("tourClose").addEventListener("click", endTour);
$("tourPrev").addEventListener("click", () => { if (stopIndex > 0) goToStop(stopIndex - 1); scheduleNext(); });
$("tourNext").addEventListener("click", () => { if (stopIndex < TOUR.length - 1) goToStop(stopIndex + 1); scheduleNext(); });
$("tourPlay").addEventListener("click", () => {
  playing = !playing;
  $("tourPlay").setAttribute("aria-pressed", String(playing));
  $("tourPlay").textContent = playing ? "Pause" : "Play";
  if (playing && stopIndex < 0) goToStop(0);
  scheduleNext();
});
document.addEventListener("keydown", (e) => {
  if ($("tourCard").hidden) return;
  if (e.key === "ArrowRight" && stopIndex < TOUR.length - 1) goToStop(stopIndex + 1);
  if (e.key === "ArrowLeft" && stopIndex > 0) goToStop(stopIndex - 1);
  if (e.key === "Escape") endTour();
});

// ---- share -----------------------------------------------------------------
$("shareBtn").addEventListener("click", async () => {
  const url = window.location.href;
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { toast(url); }
});
