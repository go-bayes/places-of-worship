// lamps: every mapped place of worship as a light under the real sun.
// the scene's light, palette and night shade follow the sun for the moment
// shown, which defaults to now.

import * as maplibregl from "../vendor/maplibre-gl@6.19.0/maplibre-gl.mjs";
import {
  sunPosition,
  subsolarPoint,
  nightCaps,
  shadeAlphas,
  clockMinutes,
  dayProfile,
  zoneOffsetMinutes,
  formatClock,
  describeAltitude
} from "../shared/sun.mjs";
import {
  TRADITIONS,
  KNOWN_TRADITIONS,
  DAY,
  NIGHT,
  INK,
  VELLUM,
  PANEL_ALPHA,
  mix,
  hexToRgb,
  daylight,
  twilight,
  panelTones,
  sceneTones
} from "../shared/palette.mjs";
import { buildStyle, PLACE_LAYERS, traditionFilter, pillarFilter, traditionColor, SCALE } from "./style.mjs";
import { metresPerPixel, pillarRadius, pillarHeight, hexagon, dedupeById } from "./geometry.mjs";

const MAIN_MAP = "../../global/";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const PHONE = window.matchMedia("(max-width: 640px)");
const KEY = window.MAPTILER_API_KEY || "";
const TZ_HOME = window.POW_TZ_HOME || { zones: {}, cameras: {} };

// the main map's city presets, with the five added for this page. each
// carries its zone so the clock can name the place
const CITIES = [
  { label: "Wellington", coords: [174.7762, -41.2865], zoom: 14.2, zone: "Pacific/Auckland" },
  { label: "Los Angeles", coords: [-118.2437, 34.0522], zoom: 14, zone: "America/Los_Angeles" },
  { label: "Nassau", coords: [-77.3554, 25.0343], zoom: 14.2, zone: "America/Nassau" },
  { label: "Atlanta", coords: [-84.388, 33.749], zoom: 14, zone: "America/New_York" },
  { label: "New York", coords: [-74.006, 40.7128], zoom: 14, zone: "America/New_York" },
  { label: "Buenos Aires", coords: [-58.3816, -34.6037], zoom: 14, zone: "America/Argentina/Buenos_Aires" },
  { label: "London", coords: [-0.1276, 51.5072], zoom: 14, zone: "Europe/London" },
  { label: "Jerusalem", coords: [35.2137, 31.7683], zoom: 14.6, zone: "Asia/Jerusalem" },
  { label: "Accra", coords: [-0.187, 5.6037], zoom: 14, zone: "Africa/Accra" },
  { label: "Mauritius", coords: [57.5522, -20.3484], zoom: 10.2, zone: "Indian/Mauritius" },
  { label: "Singapore", coords: [103.8198, 1.3521], zoom: 13.2, zone: "Asia/Singapore" },
  { label: "Tokyo", coords: [139.6917, 35.6895], zoom: 14, zone: "Asia/Tokyo" },
  { label: "Varanasi", coords: [83.0076, 25.3109], zoom: 14.6, zone: "Asia/Kolkata" },
  { label: "Kyoto", coords: [135.7681, 35.0116], zoom: 14, zone: "Asia/Tokyo" },
  { label: "Rome", coords: [12.4964, 41.9028], zoom: 14.4, zone: "Europe/Rome" },
  { label: "Lagos", coords: [3.3841, 6.455], zoom: 14, zone: "Africa/Lagos" },
  { label: "Istanbul", coords: [28.9784, 41.0082], zoom: 14.4, zone: "Europe/Istanbul" }
];

const $ = (id) => document.getElementById(id);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- state -------------------------------------------------------------

const params = new URLSearchParams(location.search);
const pinned = params.get("t") ? Date.parse(params.get("t")) : NaN;
const state = {
  moment: Number.isFinite(pinned) ? pinned : Date.now(),
  live: !Number.isFinite(pinned),
  clock: { lng: 0 },
  clockName: null,
  enabled: new Set(TRADITIONS.map((t) => t.key)),
  scale: null,
  selected: null,
  pendingSelect: null,
  profile: null,
  autoPitch: true,
  lastAutoPitch: null
};

// ---- webgl check -------------------------------------------------------

function showNoWebgl(reason) {
  document.body.classList.add("no-webgl");
  $("no-webgl").hidden = false;
  $("no-webgl-reason").textContent = reason;
}

function hasWebgl2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

// ---- the night shade -----------------------------------------------------

// altitudes of the nested caps: the shade begins just above the horizon
// and deepens over sixteen degrees, past nautical twilight, in half-degree
// steps fine enough that the edge reads as a gradient
const BANDS = Array.from({ length: 34 }, (_, i) => 0.5 - i * 0.5);
const NIGHT_DEPTH = 0.9;
const ALPHAS = shadeAlphas(BANDS.length, NIGHT_DEPTH);

function nightData() {
  return nightCaps(state.moment, BANDS, ALPHAS);
}

// ---- the map -------------------------------------------------------------

let map = null;

function initialTones() {
  return sceneTones(1, 0);
}

function homeCamera() {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    zone = "";
  }
  const code = TZ_HOME.zones[zone];
  const cam = code && TZ_HOME.cameras[code];
  if (cam) return { center: [cam[0], cam[1]], code };
  // no home: face the evening terminator, so both day and night show
  const [sl] = subsolarPoint(state.moment);
  return { center: [sl - 75, 12], code: null };
}

function globeZoom() {
  return PHONE.matches ? 1.05 : 1.85;
}

function startMap() {
  const home = homeCamera();
  const hasHash = /(^|&|#)map=/.test(location.hash);
  const intro = !hasHash && !REDUCED_MOTION.matches;
  const startCenter = intro ? [home.center[0] - 95, home.center[1] * 0.4] : home.center;

  map = new maplibregl.Map({
    container: "map",
    style: buildStyle({ key: KEY, tones: initialTones(), nightData: nightData() }),
    center: startCenter,
    zoom: globeZoom(),
    hash: "map",
    attributionControl: false,
    maxPitch: 72,
    canvasContextAttributes: { antialias: true },
    transformCameraUpdate: autoPitchTransform
  });
  map.getCanvas().setAttribute("aria-label", "Globe of places of worship, lit by the sun for the time shown");

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");

  map.on("load", () => {
    // a shared link without a tilt takes the pitch its zoom calls for
    if (!/map=[^&]*\/[^&/]*\/[^&/]*\/[^&/]*\/[^&/]+/.test(location.hash)) {
      map.jumpTo({ pitch: pitchFor(map.getZoom()) });
      state.lastAutoPitch = map.getPitch();
    }
    applyFilter();
    refreshAll();
    if (intro) playIntro(home.center);
  });
  map.on("move", scheduleScene);
  map.on("moveend", () => {
    refreshClock();
    refreshSun();
    schedulePillars();
  });
  map.on("sourcedata", (e) => {
    if (e.sourceId === "places" && e.isSourceLoaded) schedulePillars();
    if (e.sourceId === "overview" && e.isSourceLoaded && !state.clockSettled) refreshClock();
  });
  map.on("error", onMapError);
  for (const layer of ["pillars", "crowns", "pools", "places-core"]) {
    map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
  }
  // one handler decides what a click meant: a pillar or its pool opens
  // the card, a light further out flies to its place, anything else
  // closes the card. a few pixels of slack make slender pillars easy to hit
  map.on("click", (e) => {
    const { x, y } = e.point;
    const box = [[x - 6, y - 6], [x + 6, y + 6]];
    const layers = ["crowns", "pillars", "pools", "places-core"].filter((id) => map.getLayer(id));
    const hits = map.queryRenderedFeatures(box, { layers });
    const pillar = hits.find((f) => f.layer.id !== "places-core");
    if (pillar) {
      select(String(pillar.properties.id), true);
      return;
    }
    const light = hits.find((f) => f.layer.id === "places-core");
    if (light && map.getZoom() < 13) {
      state.pendingSelect = String(light.properties.id || "");
      fly({ center: light.geometry.coordinates, zoom: 15.2 });
      return;
    }
    deselect();
  });
}

// ---- camera: pitch that follows zoom ------------------------------------

// flat over the globe, leaning in through the region scale, and a low
// city view once pillars stand
function pitchFor(zoom) {
  if (zoom <= 5) return 0;
  if (zoom <= 9) return 38 * smoothstep(5, 9, zoom);
  if (zoom <= 13) return 38 + 28 * smoothstep(9, 13, zoom);
  return 66;
}

function autoPitchTransform({ zoom, pitch }) {
  if (!state.autoPitch) {
    // over the globe the camera is always level, and leaving the city
    // hands pitch back to the zoom
    if (zoom < 4) state.autoPitch = true;
    return {};
  }
  if (state.lastAutoPitch !== null && Math.abs(pitch - state.lastAutoPitch) > 0.75) {
    // the visitor tilted the map: their pitch stands until they zoom out
    state.autoPitch = false;
    state.lastAutoPitch = null;
    return {};
  }
  const target = pitchFor(zoom);
  state.lastAutoPitch = target;
  return { pitch: target };
}

// ---- the one orchestrated moment -----------------------------------------

function playIntro(center) {
  const stop = () => {
    map.stop();
    for (const [type, fn] of listeners) window.removeEventListener(type, fn, true);
  };
  const listeners = ["pointerdown", "wheel", "touchstart", "keydown"].map((type) => [type, stop]);
  for (const [type, fn] of listeners) window.addEventListener(type, fn, { capture: true, passive: true });
  map.easeTo({
    center,
    zoom: globeZoom() + 0.25,
    duration: 9000,
    easing: (t) => 1 - (1 - t) ** 3
  });
  map.once("moveend", () => {
    for (const [type, fn] of listeners) window.removeEventListener(type, fn, true);
  });
}

function fly(camera) {
  state.autoPitch = true;
  state.lastAutoPitch = null;
  if (REDUCED_MOTION.matches) map.jumpTo(camera);
  else map.flyTo({ ...camera, speed: 1.1, curve: 1.5, essential: false });
}

// ---- scene tones by the sun -----------------------------------------------

let sceneQueued = false;
function scheduleScene() {
  if (sceneQueued) return;
  sceneQueued = true;
  requestAnimationFrame(() => {
    sceneQueued = false;
    applyScene();
    updateScale();
  });
}

let lastSceneKey = "";

function applyScene() {
  const c = map.getCenter();
  const zoom = map.getZoom();
  const sun = sunPosition(state.moment, c.lng, c.lat);
  const t = daylight(sun.altitude);
  const w = twilight(sun.altitude);
  // over the globe the base map keeps the day palette and the night shade
  // draws the dark side; zooming in hands the palette to the centre's sun
  const world = smoothstep(5.2, 3.2, zoom);
  const tEff = t + (1 - t) * world;
  const key = [t, w, tEff, Math.round(zoom * 4)].map((x) => x.toFixed(3)).join(",") + (zoom >= 8 ? sun.azimuth.toFixed(0) : "");
  if (key === lastSceneKey) return;
  lastSceneKey = key;

  const base = sceneTones(tEff, 0);
  const sky = sceneTones(t, w);
  const set = (layer, prop, value) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };

  set("land", "background-color", base.land);
  set("water", "fill-color", base.water);
  set("rivers", "line-color", base.water);
  set("roads", "line-color", base.road);
  set("borders", "line-color", base.boundary);
  set("relief", "hillshade-shadow-color", base.shadow);
  set("relief", "hillshade-highlight-color", base.highlight);
  set("relief", "hillshade-accent-color", base.shadow);
  set("buildings", "fill-extrusion-color", base.building);
  set("cities", "text-color", base.label);
  set("cities", "text-halo-color", base.labelHalo);
  set("water-names", "text-color", zoom < 5 ? "#7f8fa6" : mix(mix(NIGHT.water, VELLUM, 0.5), mix(DAY.water, INK, 0.55), tEff));

  // the shade fades as the base palette itself turns to night
  map.setGlobalStateProperty("shade", tEff);

  // lights glow more in the dark, and their cores pale a little toward
  // white so they read as light rather than paint
  const dark = 1 - tEff;
  const lift = Math.round(20 * (1 - t)) / 100;
  if (lift !== state.lift) {
    state.lift = lift;
    set("overview-core", "circle-color", traditionColor(lift));
    set("places-core", "circle-color", traditionColor(lift));
  }
  set("overview-glow", "circle-opacity", 0.32);
  set("places-glow", "circle-opacity", ["interpolate", ["linear"], ["zoom"], 12.6, 0.12 + 0.4 * dark, 13.6, 0]);
  set("pools", "circle-opacity", 0.22 + 0.5 * dark);
  set("places-core", "circle-stroke-color", `rgba(29, 34, 51, ${(0.4 * tEff).toFixed(3)})`);

  map.setSky({
    "sky-color": sky.sky,
    "horizon-color": sky.horizon,
    "fog-color": mix(sky.horizon, base.land, 0.35),
    "sky-horizon-blend": 0.65,
    "horizon-fog-blend": 0.55,
    "fog-ground-blend": 0.8,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.2, 5, 0.12, 8, 0]
  });
  map.setLight(lightFor(sun, zoom, t));

  // the page around the globe, and the panels
  document.documentElement.style.setProperty("--space", sky.space);
  applyPanels(t);
  refreshDrape();
}

// the terrain caches the layers it drapes over the ground and redraws a
// cached tile when the set of visible layers changes, not when a paint
// value does. switching an empty layer makes the ground redraw in the new
// tones. at most every 150 ms, so each switch is drawn before the next
let drapeTimer = 0;
let drapeLast = 0;
let drapeFlip = false;
function refreshDrape() {
  const run = () => {
    drapeTimer = 0;
    drapeLast = performance.now();
    drapeFlip = !drapeFlip;
    if (map.getLayer("drape-refresh")) map.setLayoutProperty("drape-refresh", "visibility", drapeFlip ? "none" : "visible");
  };
  if (drapeTimer) return;
  const wait = Math.max(0, 150 - (performance.now() - drapeLast));
  drapeTimer = setTimeout(run, wait);
}

// over the globe the light is fixed to the earth at the subsolar point, so
// the atmosphere glows on the day side; nearer the ground it is the local
// sun, so buildings and pillars are lit from where the sun stands
function lightFor(sun, zoom, t) {
  if (zoom < 8) {
    const [sl, sp] = subsolarPoint(state.moment);
    const R = Math.PI / 180;
    // the direction of the sun in the frame maplibre turns with the globe
    const s = [Math.cos(sp * R) * Math.sin(sl * R), Math.sin(sp * R), Math.cos(sp * R) * Math.cos(sl * R)];
    const polar = Math.acos(clamp(-s[2], -1, 1)) / R;
    const azimuth = ((Math.atan2(s[0], -s[1]) / R) + 360) % 360;
    return { anchor: "map", position: [1.5, azimuth, polar], color: "#ffffff", intensity: 0.45 };
  }
  // below the horizon the scene is lit softly from overhead, so pillars
  // read as lamps: low intensity flattens the shading toward their colour
  const polar = sun.altitude > 4 ? 90 - sun.altitude : 35;
  const color = mix("#c9d2ff", "#fff6e6", t);
  return {
    anchor: "map",
    position: [1.15, sun.altitude > 4 ? sun.azimuth : 200, clamp(polar, 10, 86)],
    color,
    intensity: 0.12 + 0.33 * t
  };
}

function applyPanels(t) {
  const p = panelTones(t);
  const [r, g, b] = hexToRgb(p.wash).map((x) => Math.round(x * 255));
  const root = document.documentElement.style;
  root.setProperty("--wash", `rgba(${r}, ${g}, ${b}, ${PANEL_ALPHA})`);
  root.setProperty("--wash-solid", p.wash);
  root.setProperty("--text", p.text);
  root.setProperty("--muted", p.muted);
  root.setProperty("--hairline", p.hairline);
  document.documentElement.dataset.sky = p.dark ? "night" : "day";
}

// ---- scale, in words -------------------------------------------------------

const SCALE_WORDS = {
  world: "World scale. Each light stands for the places of worship mapped nearby; larger lights stand for more of them.",
  region: "Region scale. Each light is one place of worship.",
  city: "City scale. Each pillar is one place of worship; select one to see its details."
};

function updateScale() {
  const z = map.getZoom();
  const scale = z < SCALE.regionFrom ? "world" : z < SCALE.cityFrom + 1 ? "region" : "city";
  if (scale === state.scale) return;
  state.scale = scale;
  $("scale-status").textContent = SCALE_WORDS[scale];
  document.documentElement.dataset.scale = scale;
}

// ---- the clock: which place, which zone ---------------------------------

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function distanceKm([lng1, lat1], [lng2, lat2]) {
  const R = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * R) / 2) ** 2 +
    Math.cos(lat1 * R) * Math.cos(lat2 * R) * Math.sin(((lng2 - lng1) * R) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// the country of the nearest mapped place, from the tiles already loaded
function countryAtCentre(centre) {
  let best = null;
  let bestD = Infinity;
  for (const [source, layer] of [["places", "places"], ["overview", "places_overview"]]) {
    if (!map.getSource(source)) continue;
    let feats = [];
    try {
      feats = map.querySourceFeatures(source, { sourceLayer: layer });
    } catch {
      feats = [];
    }
    for (const f of feats) {
      const cc = f.properties && f.properties.country_code;
      if (!cc || !f.geometry || f.geometry.type !== "Point") continue;
      const d = distanceKm(centre, f.geometry.coordinates);
      if (d < bestD) {
        bestD = d;
        best = cc;
      }
    }
    if (best && bestD < 60) break;
  }
  return best && bestD < 250 ? String(best) : null;
}

// a country's clock when its zones agree to within an hour now: the zone
// most of them share. otherwise the country has no single clock to name
function countryClock(cc) {
  const code = cc.toLowerCase() === "gb" ? "uk" : cc.toLowerCase();
  const zones = Object.entries(TZ_HOME.zones).filter(([, c]) => c === code).map(([z]) => z);
  if (!zones.length) return null;
  const offsets = new Map();
  let lo = Infinity;
  let hi = -Infinity;
  for (const z of zones) {
    let off;
    try {
      off = zoneOffsetMinutes(state.moment, z);
    } catch {
      continue;
    }
    lo = Math.min(lo, off);
    hi = Math.max(hi, off);
    if (!offsets.has(off)) offsets.set(off, []);
    offsets.get(off).push(z);
  }
  if (!offsets.size || hi - lo > 60) return null;
  const [, members] = [...offsets.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const name = regionNames ? regionNames.of(cc.toUpperCase() === "UK" ? "GB" : cc.toUpperCase()) : null;
  return name ? { zone: members[0], name } : null;
}

function refreshClock() {
  if (!map) return;
  const c = map.getCenter();
  const centre = [c.lng, c.lat];
  const zoom = map.getZoom();
  let clock = { lng: c.lng };
  let name = null;
  const city = CITIES.find((p) => distanceKm(centre, p.coords) < 45);
  if (city && zoom >= 8) {
    clock = { zone: city.zone };
    name = city.label;
  } else if (zoom >= 3) {
    const cc = countryAtCentre(centre);
    const cl = cc && countryClock(cc);
    if (cl) {
      clock = { zone: cl.zone };
      name = cl.name;
      state.clockSettled = true;
    }
  }
  state.clock = clock;
  state.clockName = name;
}

// ---- the sun control -------------------------------------------------------

const track = $("sun-track");
const handle = $("sun-handle");

function refreshSun() {
  if (!map) return;
  const c = map.getCenter();
  state.profile = dayProfile(state.moment, state.clock, c.lng, c.lat, 15);
  const p = state.profile;
  // the track's colour is the sky through the day at this place
  const stops = p.samples.map(([m, alt]) => {
    const t = daylight(alt);
    const tone = mix(mix(NIGHT.sky, "#9fb7c6", t), "#e3a67d", twilight(alt) * 0.7);
    return `${tone} ${((m / 1440) * 100).toFixed(2)}%`;
  });
  track.style.setProperty("--day", `linear-gradient(var(--track-dir), ${stops.join(", ")})`);
  placeMark("sunrise", p.sunrise);
  placeMark("sunset", p.sunset);
  $("sun-polar").hidden = !(p.allDay || p.allNight);
  $("sun-polar").textContent = p.allDay ? "The sun stays up all day here" : p.allNight ? "The sun stays down all day here" : "";
  updateReadout();
}

function placeMark(kind, minutes) {
  const mark = $(`${kind}-mark`);
  if (minutes === null) {
    mark.hidden = true;
    return;
  }
  mark.hidden = false;
  mark.style.setProperty("--pos", String(minutes / 1440));
  mark.querySelector(".mark-time").textContent = `${kind === "sunrise" ? "Sunrise" : "Sunset"} ${formatClock(minutes)}`;
}

function updateReadout() {
  const c = map.getCenter();
  const sun = sunPosition(state.moment, c.lng, c.lat);
  const minutes = clockMinutes(state.moment, state.clock);
  const time = formatClock(minutes);
  const where = state.clockName ? `${state.clockName} time` : "Local solar time";
  const words = describeAltitude(sun.altitude);
  $("sun-readout").textContent = `${where} ${time}, ${words}`;
  handle.style.setProperty("--pos", String(minutes / 1440));
  track.style.setProperty("--pos", String(minutes / 1440));
  handle.setAttribute("aria-valuenow", String(Math.round(minutes)));
  handle.setAttribute("aria-valuetext", `${where} ${time}, ${words}`);
  // while the scene follows the clock there is nothing for "Now" to do
  $("sun-now").disabled = state.live;
}

function setMoment(ms, live = false) {
  state.moment = ms;
  state.live = live;
  const src = map && map.getSource("night");
  if (src) src.setData(nightData());
  lastSceneKey = "";
  if (map) {
    applyScene();
    // a new day at the place redraws the track; otherwise only the handle
    const p = state.profile;
    if (!p || ms < p.dayStart || ms >= p.dayStart + 86400000) refreshSun();
    else updateReadout();
  }
}

function minutesFromPointer(event) {
  const rect = track.getBoundingClientRect();
  const horizontal = PHONE.matches;
  const f = horizontal ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
  return clamp(f, 0, 0.9993) * 1440;
}

function setClockMinutes(minutes) {
  const p = state.profile;
  if (!p) return;
  setMoment(p.dayStart + clamp(minutes, 0, 1439) * 60000, false);
}

let dragging = false;
track.addEventListener("pointerdown", (e) => {
  dragging = true;
  track.setPointerCapture(e.pointerId);
  handle.focus({ preventScroll: true });
  setClockMinutes(minutesFromPointer(e));
});
track.addEventListener("pointermove", (e) => {
  if (dragging) setClockMinutes(minutesFromPointer(e));
});
const endDrag = (e) => {
  if (!dragging) return;
  dragging = false;
  try {
    track.releasePointerCapture(e.pointerId);
  } catch {
    // capture already released
  }
};
track.addEventListener("pointerup", endDrag);
track.addEventListener("pointercancel", endDrag);

handle.addEventListener("keydown", (e) => {
  const now = clockMinutes(state.moment, state.clock);
  const steps = { ArrowUp: -5, ArrowLeft: -5, ArrowDown: 5, ArrowRight: 5, PageUp: -60, PageDown: 60 };
  if (e.key in steps) {
    setClockMinutes(now + steps[e.key]);
  } else if (e.key === "Home") {
    setClockMinutes(0);
  } else if (e.key === "End") {
    setClockMinutes(1439);
  } else {
    return;
  }
  e.preventDefault();
});

$("sun-now").addEventListener("click", () => setMoment(Date.now(), true));

setInterval(() => {
  if (state.live && map) setMoment(Date.now(), true);
}, 30000);

// ---- pillars ---------------------------------------------------------------

let pillarTimer = 0;
function schedulePillars() {
  clearTimeout(pillarTimer);
  pillarTimer = setTimeout(buildPillars, 120);
}

let pillarKey = "";
function buildPillars() {
  if (!map || !map.getSource("pillars")) return;
  const zoom = map.getZoom();
  const src = map.getSource("pillars");
  if (zoom < SCALE.cityFrom + 0.5) {
    if (pillarKey !== "empty") {
      src.setData({ type: "FeatureCollection", features: [] });
      pillarKey = "empty";
    }
    return;
  }
  const lat = map.getCenter().lat;
  const z = Math.floor(zoom);
  const radius = pillarRadius(z, lat);
  let feats = [];
  try {
    feats = map.querySourceFeatures("places", { sourceLayer: "places" });
  } catch {
    feats = [];
  }
  const places = dedupeById(feats);
  const key = `${z}:${places.length}:${places.length ? places[0].id : ""}`;
  if (key === pillarKey) return;
  pillarKey = key;
  const features = [];
  for (const p of places) {
    const tradition = KNOWN_TRADITIONS.includes(p.props.religion) ? p.props.religion : "other";
    const props = { id: p.id, tradition };
    features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [hexagon(p.coords, radius, Math.PI / 6)] } });
    features.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: p.coords } });
  }
  placesById = new Map(places.map((p) => [p.id, p]));
  src.setData({ type: "FeatureCollection", features });
  sizePillars(lat);
  if (state.pendingSelect && placesById.has(state.pendingSelect)) {
    select(state.pendingSelect, false);
    state.pendingSelect = null;
  } else if (state.selected && placesById.has(state.selected)) {
    drawSelection(placesById.get(state.selected));
  }
}

let placesById = new Map();
// the crown takes the top tenth of a pillar
const CROWN_FROM = 0.9;

// heights and pool sizes are zoom functions, so they ease with the camera
function sizePillars(lat) {
  const heights = [];
  const crownBase = [];
  const tops = [];
  const selTops = [];
  const pools = [];
  const crown = [];
  for (let z = 11; z <= 19; z += 1) {
    const h = pillarHeight(z, lat);
    heights.push(z, h * CROWN_FROM);
    crownBase.push(z, h * CROWN_FROM);
    tops.push(z, h);
    selTops.push(z, h * 1.1);
    // the pool spreads some six pillar widths, in pixels at that zoom
    pools.push(z, (pillarRadius(z, lat) * 6) / metresPerPixel(z, lat));
    crown.push(z, (pillarRadius(z, lat) * 7) / metresPerPixel(z, lat));
  }
  map.setPaintProperty("pillars", "fill-extrusion-height", ["interpolate", ["exponential", 2], ["zoom"], ...heights]);
  map.setPaintProperty("crowns", "fill-extrusion-base", ["interpolate", ["exponential", 2], ["zoom"], ...crownBase]);
  map.setPaintProperty("crowns", "fill-extrusion-height", ["interpolate", ["exponential", 2], ["zoom"], ...tops]);
  map.setPaintProperty("selection-crown", "fill-extrusion-base", ["interpolate", ["exponential", 2], ["zoom"], ...tops]);
  map.setPaintProperty("selection-crown", "fill-extrusion-height", ["interpolate", ["exponential", 2], ["zoom"], ...selTops]);
  map.setPaintProperty("pools", "circle-radius", ["interpolate", ["exponential", 2], ["zoom"], ...pools]);
  map.setPaintProperty("selection-pool", "circle-radius", ["interpolate", ["exponential", 2], ["zoom"], ...crown]);
}

// ---- selection and the card -----------------------------------------------

const LABELS = Object.fromEntries(TRADITIONS.map((t) => [t.key, t.label]));
const COLORS = Object.fromEntries(TRADITIONS.map((t) => [t.key, t.color]));

function prettify(value) {
  const s = String(value || "").replace(/_/g, " ").replace(/;/g, ", ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

function placeName(props) {
  const name = String(props["name:en"] || props.name_en || props.name || "").trim();
  // the tiles give unnamed places a placeholder built from the osm id
  if (!name || /^(Place of Worship \d+|unnamed)$/i.test(name)) return "Unnamed place of worship";
  return name;
}

function drawSelection(place) {
  const lat = place.coords[1];
  const z = Math.floor(map.getZoom());
  const r = pillarRadius(z, lat);
  map.getSource("selection").setData({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [hexagon(place.coords, r * 1.35, Math.PI / 6)] } },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: place.coords } }
    ]
  });
}

function select(id, fromPointer) {
  const place = placesById.get(id);
  if (!place) return;
  state.selected = id;
  drawSelection(place);
  const props = place.props;
  const key = KNOWN_TRADITIONS.includes(props.religion) ? props.religion : "other";
  const [lng, lat] = place.coords;
  $("card-name").textContent = placeName(props);
  $("card-tradition").textContent = key === "other" && props.religion && props.religion !== "unknown"
    ? prettify(props.religion)
    : LABELS[key];
  $("card-swatch").style.setProperty("--swatch", COLORS[key]);
  const denom = prettify(props.denomination);
  $("card-denomination-row").hidden = !denom;
  $("card-denomination").textContent = denom;
  const start = String(props.start_date || "").trim();
  $("card-start-row").hidden = !start;
  $("card-start").textContent = start;
  $("card-main").href = `${MAIN_MAP}#map=17.00/${lat.toFixed(5)}/${lng.toFixed(5)}`;
  $("card-streetview").href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;
  const card = $("card");
  card.hidden = false;
  document.documentElement.dataset.card = "open";
  if (!fromPointer || document.activeElement === document.body) $("card-name").focus({ preventScroll: true });
}

function deselect() {
  state.selected = null;
  if (map && map.getSource("selection")) map.getSource("selection").setData({ type: "FeatureCollection", features: [] });
  $("card").hidden = true;
  delete document.documentElement.dataset.card;
}

$("card-close").addEventListener("click", () => {
  deselect();
  map.getCanvas().focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("card").hidden) {
    deselect();
    map.getCanvas().focus();
  }
  closeFlyMenu(true);
});

// ---- tradition chips --------------------------------------------------------

function buildChips() {
  const list = $("key-list");
  for (const t of TRADITIONS) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.key = t.key;
    b.setAttribute("aria-pressed", "true");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.setProperty("--swatch", t.color);
    sw.setAttribute("aria-hidden", "true");
    b.append(sw, document.createTextNode(t.label));
    b.addEventListener("click", () => {
      const on = !state.enabled.has(t.key);
      if (on) state.enabled.add(t.key); else state.enabled.delete(t.key);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      applyFilter();
    });
    li.append(b);
    list.append(li);
  }
}

function applyFilter() {
  if (!map || !map.isStyleLoaded()) return;
  const f = traditionFilter(state.enabled);
  for (const layer of PLACE_LAYERS) map.setFilter(layer, f);
  map.setFilter("pillars", pillarFilter(state.enabled, "Polygon"));
  map.setFilter("crowns", pillarFilter(state.enabled, "Polygon"));
  map.setFilter("pools", pillarFilter(state.enabled, "Point"));
}

// ---- fly to -----------------------------------------------------------------

function buildFlyMenu() {
  const list = $("fly-list");
  for (const c of CITIES) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.label;
    b.addEventListener("click", () => {
      closeFlyMenu();
      deselect();
      fly({ center: c.coords, zoom: c.zoom, bearing: 0 });
    });
    li.append(b);
    list.append(li);
  }
  $("fly-toggle").addEventListener("click", () => {
    const open = $("fly-toggle").getAttribute("aria-expanded") !== "true";
    $("fly-toggle").setAttribute("aria-expanded", open ? "true" : "false");
    list.hidden = !open;
    if (open) list.querySelector("button").focus();
  });
  document.addEventListener("click", (e) => {
    if (!$("fly").contains(e.target)) closeFlyMenu();
  });
}

function closeFlyMenu(returnFocus = false) {
  if ($("fly-toggle").getAttribute("aria-expanded") !== "true") return;
  const inside = $("fly-list").contains(document.activeElement);
  $("fly-toggle").setAttribute("aria-expanded", "false");
  $("fly-list").hidden = true;
  if (returnFocus && inside) $("fly-toggle").focus();
}

// ---- about (the caption on a phone) ----------------------------------------

$("about-toggle").addEventListener("click", () => {
  const open = $("about-toggle").getAttribute("aria-expanded") !== "true";
  $("about-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  document.documentElement.dataset.about = open ? "open" : "closed";
});

// ---- failures ---------------------------------------------------------------

const failed = new Set();
function onMapError(e) {
  const id = e && e.sourceId;
  const status = e && e.error && e.error.status;
  let what = null;
  if (id === "places" || id === "overview") what = "places";
  else if (id === "omt" || id === "dem" || id === "relief" || (e.error && /maptiler/.test(String(e.error.url || "")))) what = "basemap";
  if (!what || failed.has(what)) return;
  failed.add(what);
  const text = {
    places: "The lights could not be loaded just now, so places of worship are missing from this view. The main map may still show them.",
    basemap: "The base map could not be loaded just now, so land, water and terrain are drawn plainly."
  }[what];
  const notice = $("notice");
  notice.hidden = false;
  notice.querySelector(".notice-text").textContent = [...failed].length > 1
    ? "Map tiles could not be loaded just now. The lights and the base map may be incomplete."
    : text;
  if (status) notice.dataset.status = String(status);
}

// ---- layout on a phone ---------------------------------------------------------

// the phone stacks the key above the sun strip; both heights vary with
// the text, so the stack reads them
function watchLayout() {
  const root = document.documentElement.style;
  const ro = new ResizeObserver(() => {
    root.setProperty("--sun-h", `${$("sun").offsetHeight}px`);
    root.setProperty("--key-h", `${document.querySelector(".key").offsetHeight}px`);
  });
  ro.observe($("sun"));
  ro.observe(document.querySelector(".key"));
  const orient = () => handle.setAttribute("aria-orientation", PHONE.matches ? "horizontal" : "vertical");
  orient();
  PHONE.addEventListener("change", orient);
}

// ---- start ------------------------------------------------------------------

function refreshAll() {
  refreshClock();
  applyScene();
  updateScale();
  refreshSun();
}

buildChips();
buildFlyMenu();
watchLayout();
applyPanels(1);
if (!hasWebgl2()) {
  showNoWebgl("This experiment needs WebGL 2, which this browser does not offer or has turned off.");
} else {
  try {
    startMap();
  } catch (err) {
    showNoWebgl("This experiment could not start the 3D map in this browser.");
    console.error(err);
  }
}

// expose a little for testing in the console
window.lamps = { get map() { return map; }, state, setMoment };
