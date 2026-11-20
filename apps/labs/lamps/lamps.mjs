// lamps: every mapped place of worship as a light under the real sun.
// the scene's light, palette and night shade follow the sun for the moment
// shown, which defaults to now.

import * as maplibregl from "../vendor/maplibre-gl@6.19.0/maplibre-gl.mjs";
import {
  sunPosition,
  subsolarPoint,
  nightCaps,
  NIGHT_BANDS,
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
  DAY_GLOBE,
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
import { buildStyle, PLACE_LAYERS, traditionFilter, pillarFilter, traditionColor, presence, SCALE } from "./style.mjs";
import { metresPerPixel, pillarRadius, pillarHeight, hexagon, placesInTiles, PILLAR } from "./geometry.mjs";
import { CITIES } from "../shared/cities.mjs";
import { hasPlaceId } from "../shared/tile-ownership.mjs";

const MAIN_MAP = "../../global/";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const PHONE = window.matchMedia("(max-width: 640px)");
const KEY = window.MAPTILER_API_KEY || "";
const TZ_HOME = window.POW_TZ_HOME || { zones: {}, cameras: {} };

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

// the shade begins at the horizon
// and deepens over sixteen degrees, past nautical twilight, in half-degree
// steps fine enough that the edge reads as a gradient
const NIGHT_DEPTH = 0.9;
// keep the opacity of each band that remains after dropping the +0.5° cap
const ALPHAS = shadeAlphas(NIGHT_BANDS.length + 1, NIGHT_DEPTH).slice(1);

function nightData() {
  return nightCaps(state.moment, NIGHT_BANDS, ALPHAS);
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
  map.on("styledata", applyFilter);
  map.on("zoom", scheduleReshape);
  map.on("moveend", () => {
    refreshClock();
    refreshSun();
    schedulePillars();
    refreshPlacesList();
  });
  map.on("sourcedata", (e) => {
    if (e.tile || e.sourceDataType === "metadata") recoverSource(e.sourceId);
    if (e.sourceId === "places" && e.isSourceLoaded) schedulePillars();
    if (e.sourceId === "overview" && e.isSourceLoaded && !state.clockSettled) {
      refreshClock();
      refreshSun();
    }
  });
  map.on("error", onMapError);
  map.on("idle", () => {
    for (const [id, failure] of failed) {
      if (failure.hasTile) recoverSource(id);
    }
  });
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
      // the hit retains its source zoom, even while MapLibre draws a parent tile
      const individual = map.getZoom() >= 8 && light._z >= 8 && !(light.properties.n > 1);
      state.pendingSelect = individual && light.properties.id != null ? String(light.properties.id) : null;
      if (!individual) deselect();
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
  base.land = mix(base.land, DAY_GLOBE.land, world);
  base.water = mix(base.water, DAY_GLOBE.water, world);
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
  // by day a glow only tints the ground, so it is held back
  set("overview-glow", "circle-opacity", ["*", Number((0.22 * (0.35 + 0.65 * (1 - t))).toFixed(3)), presence]);
  if (lift !== state.lift) {
    state.lift = lift;
    set("overview-core", "circle-color", traditionColor(lift));
    set("places-core", "circle-color", traditionColor(lift));
  }
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
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.14, 5, 0.1, 8, 0]
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
// tones. at most every 150 ms, so each switch is drawn before the next.
// suspected maplibre gl js 6.19 bug: the render-to-texture fingerprint
// (src/webgl/rtt_fingerprint.ts) compares source revision, tile keys, zoom
// and the visible layer list but no paint state, so setPaintProperty on a
// draped layer leaves stale drape textures until something else changes
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
  region: "Regional scale. Each light stands for one or more places mapped nearby.",
  city: "City scale",
  pillars: "City scale. Each pillar is one place of worship; select one to see its details."
};

function updateScale() {
  const z = map.getZoom();
  const scale = z < SCALE.regionFrom ? "world" : z < SCALE.cityFrom + 1 ? "region" : "city";
  if (scale !== state.scale) {
    state.scale = scale;
    document.documentElement.dataset.scale = scale;
  }
  const hasPillars = scale === "city" && pillarPlaces.some(({ props }) => state.enabled.has(traditionKey(props)));
  const words = hasPillars ? SCALE_WORDS.pillars : SCALE_WORDS[scale];
  const status = $("scale-status");
  if (status.textContent !== words) status.textContent = words;
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
    return `${tone} ${((m / p.duration) * 100).toFixed(2)}%`;
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
  const { dayStart, duration } = state.profile;
  const wall = clockMinutes(dayStart + minutes * 60000, state.clock);
  mark.style.setProperty("--pos", String(minutes / duration));
  mark.querySelector(".mark-time").textContent = `${kind === "sunrise" ? "Sunrise" : "Sunset"} ${formatClock(wall)}`;
}

function updateReadout() {
  const c = map.getCenter();
  const sun = sunPosition(state.moment, c.lng, c.lat);
  const { dayStart, duration } = state.profile;
  const elapsed = (state.moment - dayStart) / 60000;
  const time = formatClock(clockMinutes(state.moment, state.clock));
  const where = state.clockName ? `${state.clockName} time` : "Local solar time";
  const words = describeAltitude(sun.altitude);
  $("sun-readout").textContent = `${where} ${time}, ${words}`;
  handle.style.setProperty("--pos", String(elapsed / duration));
  track.style.setProperty("--pos", String(elapsed / duration));
  handle.setAttribute("aria-valuemax", String(duration - 1));
  handle.setAttribute("aria-valuenow", String(Math.min(duration - 1, Math.round(elapsed))));
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
    if (!p || ms < p.dayStart || ms >= p.dayEnd) refreshSun();
    else updateReadout();
  }
}

function minutesFromPointer(event) {
  const rect = track.getBoundingClientRect();
  const horizontal = PHONE.matches;
  const f = horizontal ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
  return clamp(f, 0, 1) * state.profile.duration;
}

function setElapsedMinutes(minutes) {
  const p = state.profile;
  if (!p) return;
  setMoment(p.dayStart + clamp(minutes, 0, p.duration - 1) * 60000, false);
}

let dragging = false;
track.addEventListener("pointerdown", (e) => {
  if (!state.profile) return;
  dragging = true;
  track.setPointerCapture(e.pointerId);
  handle.focus({ preventScroll: true });
  setElapsedMinutes(minutesFromPointer(e));
});
track.addEventListener("pointermove", (e) => {
  if (dragging) setElapsedMinutes(minutesFromPointer(e));
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
  if (!state.profile) return;
  const now = (state.moment - state.profile.dayStart) / 60000;
  const steps = { ArrowUp: -5, ArrowLeft: -5, ArrowDown: 5, ArrowRight: 5, PageUp: -60, PageDown: 60 };
  if (e.key in steps) {
    setElapsedMinutes(now + steps[e.key]);
  } else if (e.key === "Home") {
    setElapsedMinutes(0);
  } else if (e.key === "End") {
    setElapsedMinutes(state.profile.duration - 1);
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
let pillarPlaces = [];
let pillarRadiusInUse = 0;

// pillar width is geometry, not paint, so it cannot follow a zoom
// expression the way height does. instead the hexagons are redrawn as the
// zoom changes, whenever the width they call for moves by a step of about
// six per cent, which reads as a smooth easing rather than a jump
const WIDTH_STEP = Math.log(1.06);
function easedRadius(zoom, lat) {
  const r = pillarRadius(zoom, lat);
  const k = Math.round(Math.log(r / PILLAR.radius) / WIDTH_STEP);
  return PILLAR.radius * Math.exp(k * WIDTH_STEP);
}

function buildPillars() {
  if (!map || !map.getSource("pillars")) return;
  const zoom = map.getZoom();
  const src = map.getSource("pillars");
  let feats = [];
  if (zoom >= SCALE.cityFrom + 0.5) {
    feats = map.querySourceFeatures("places", { sourceLayer: "places" });
  }
  const places = placesInTiles(feats);
  const key = JSON.stringify(places.map(({ id, coords, props }) =>
    [id, coords, props.religion, props.denomination, props.start_date, placeName(props)]));
  if (key === pillarKey) {
    reshapePillars();
    return;
  }
  pillarKey = key;
  const previousPlaces = pillarPlaces;
  const previous = placesById.get(state.selected);
  pillarPlaces = places;
  placesById = new Map(places.map((p) => [p.id, p]));
  if (state.selected !== null) {
    const selected = placesById.get(state.selected) ?? followSourceId(previous, previousPlaces, places);
    if (selected && state.enabled.has(traditionKey(selected.props))) {
      state.selected = selected.id;
      updateCard(selected);
    } else {
      clearUnavailableSelection();
    }
  }
  pillarRadiusInUse = 0;
  if (places.length) {
    reshapePillars();
    sizePillars(map.getCenter().lat);
  } else {
    src.setData({ type: "FeatureCollection", features: [] });
  }
  if (state.pendingSelect !== null) {
    const matches = places.filter(({ props }) => props.id != null && String(props.id) === state.pendingSelect);
    if (matches.length === 1) select(matches[0].id, false);
    if (matches.length) state.pendingSelect = null;
  }
  updateScale();
  refreshPlacesList();
}

// redraw the hexagons at the width the current zoom calls for
function reshapePillars() {
  if (!pillarPlaces.length || map.getZoom() < SCALE.cityFrom + 0.5) return;
  const radius = easedRadius(map.getZoom(), map.getCenter().lat);
  if (radius === pillarRadiusInUse) return;
  pillarRadiusInUse = radius;
  const features = [];
  for (const p of pillarPlaces) {
    const tradition = KNOWN_TRADITIONS.includes(p.props.religion) ? p.props.religion : "other";
    const props = { id: p.id, tradition };
    features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [hexagon(p.coords, radius, Math.PI / 6)] } });
    features.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: p.coords } });
  }
  map.getSource("pillars").setData({ type: "FeatureCollection", features });
  if (state.selected && placesById.has(state.selected)) drawSelection(placesById.get(state.selected));
}

let reshapeQueued = false;
function scheduleReshape() {
  if (reshapeQueued) return;
  reshapeQueued = true;
  setTimeout(() => {
    reshapeQueued = false;
    reshapePillars();
  }, 80);
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
  const r = pillarRadiusInUse || pillarRadius(z, lat);
  map.getSource("selection").setData({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [hexagon(place.coords, r * 1.35, Math.PI / 6)] } },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: place.coords } }
    ]
  });
}

function followSourceId(previous, previousPlaces, places) {
  const sourceId = previous?.props.id;
  if (!hasPlaceId(sourceId)) return;
  // decoded coordinates can move with tile precision. a shared source ID
  // is safe to follow only if it names a single occurrence in both sets.
  const id = String(sourceId);
  const sameSource = ({ props }) => props.id != null && String(props.id) === id;
  if (previousPlaces.filter(sameSource).length !== 1) return;
  const matches = places.filter(sameSource);
  return matches.length === 1 ? matches[0] : undefined;
}

function select(id, fromPointer) {
  const place = placesById.get(id);
  if (!place || !state.enabled.has(traditionKey(place.props))) return;
  state.selected = id;
  drawSelection(place);
  updateCard(place);
  $("card").hidden = false;
  document.documentElement.dataset.card = "open";
  if (!fromPointer || document.activeElement === document.body) $("card-name").focus({ preventScroll: true });
}

function updateCard(place) {
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
}

function deselect() {
  state.selected = null;
  if (!document.activeElement || !$("card").contains(document.activeElement)) state.returnFocus = null;
  if (map && map.getSource("selection")) map.getSource("selection").setData({ type: "FeatureCollection", features: [] });
  $("card").hidden = true;
  delete document.documentElement.dataset.card;
}

function clearUnavailableSelection() {
  if ($("card").contains(document.activeElement)) leaveCard();
  else deselect();
}

// focus goes back where the visitor came from: the list, or the map
function leaveCard() {
  const back = state.returnFocus;
  state.returnFocus = null;
  deselect();
  (back || map.getCanvas()).focus();
}

$("card-close").addEventListener("click", leaveCard);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("card").hidden) leaveCard();
  closeFlyMenu(true);
  closeInView(true);
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
      if (map) updateScale();
      refreshPlacesList();
    });
    li.append(b);
    list.append(li);
  }
}

function applyFilter() {
  if (!map) return;
  const dots = traditionFilter(state.enabled);
  const polygons = pillarFilter(state.enabled, "Polygon");
  const points = pillarFilter(state.enabled, "Point");
  for (const [id, filter] of [
    ...PLACE_LAYERS.map((id) => [id, dots]),
    ["pillars", polygons], ["crowns", polygons], ["pools", points]
  ]) {
    if (map.getLayer(id) && JSON.stringify(map.getFilter(id)) !== JSON.stringify(filter)) {
      map.setFilter(id, filter);
    }
  }
  const selected = placesById.get(state.selected);
  if (selected && !state.enabled.has(traditionKey(selected.props))) clearUnavailableSelection();
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
    closeInView();
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

// ---- places in view: the keyboard and screen-reader route to the pillars ----

// a plain list of the places drawn as pillars in the view, nearest the
// centre first. long lists are cut, and the note says so without a count
const INVIEW_CAP = 40;

function traditionKey(props) {
  return KNOWN_TRADITIONS.includes(props.religion) ? props.religion : "other";
}

function refreshPlacesList() {
  const panel = $("inview-panel");
  if (!map || panel.hidden) return;
  const list = $("inview-list");
  const note = $("inview-note");
  const active = document.activeElement;
  const focusedId = list.contains(active) ? active.dataset.placeId : undefined;
  let nextFocus;
  list.replaceChildren();
  if (state.scale !== "city" || !pillarPlaces.length) {
    note.textContent = state.scale === "city"
      ? "No places are drawn in this view."
      : "Zoom in to a city, where each place stands as a pillar, to list them here.";
    if (focusedId !== undefined) $("inview-toggle").focus();
    return;
  }
  const bounds = map.getBounds();
  const c = map.getCenter();
  const centre = [c.lng, c.lat];
  const shown = pillarPlaces
    .filter((p) => bounds.contains(p.coords) && state.enabled.has(traditionKey(p.props)))
    .map((p) => ({ p, d: distanceKm(centre, p.coords) }))
    .sort((a, b) => a.d - b.d);
  if (!shown.length) {
    note.textContent = "No places are drawn in this view.";
    if (focusedId !== undefined) $("inview-toggle").focus();
    return;
  }
  note.textContent = shown.length > INVIEW_CAP
    ? "The places nearest the centre of the view. More are drawn than listed here; zoom in or move the map to list the others."
    : "Every place drawn in this view, nearest the centre first.";
  for (const { p } of shown.slice(0, INVIEW_CAP)) {
    const key = traditionKey(p.props);
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.placeId = p.id;
    if (p.id === focusedId) nextFocus = b;
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.setProperty("--swatch", COLORS[key]);
    sw.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "inview-name";
    name.dir = "auto";
    name.textContent = placeName(p.props);
    const trad = document.createElement("span");
    trad.className = "inview-tradition";
    trad.textContent = LABELS[key];
    b.append(sw, name, trad);
    b.addEventListener("click", () => {
      closeInView();
      state.returnFocus = $("inview-toggle");
      select(p.id, false);
    });
    li.append(b);
    list.append(li);
  }
  if (focusedId !== undefined) (nextFocus || $("inview-toggle")).focus({ preventScroll: true });
}

function closeInView(returnFocus = false) {
  if ($("inview-toggle").getAttribute("aria-expanded") !== "true") return;
  const inside = $("inview-panel").contains(document.activeElement);
  $("inview-toggle").setAttribute("aria-expanded", "false");
  $("inview-panel").hidden = true;
  if (returnFocus && inside) $("inview-toggle").focus();
}

$("inview-toggle").addEventListener("click", () => {
  const open = $("inview-toggle").getAttribute("aria-expanded") !== "true";
  closeFlyMenu();
  $("inview-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  $("inview-panel").hidden = !open;
  if (open) {
    refreshPlacesList();
    const first = $("inview-list").querySelector("button");
    (first || $("inview-note")).focus?.();
  }
});
document.addEventListener("click", (e) => {
  if (!$("inview").contains(e.target)) closeInView();
});

// ---- about (the caption on a phone) ----------------------------------------

$("about-toggle").addEventListener("click", () => {
  const open = $("about-toggle").getAttribute("aria-expanded") !== "true";
  $("about-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  document.documentElement.dataset.about = open ? "open" : "closed";
});

// ---- failures ---------------------------------------------------------------

const warningKinds = new Map([
  ["places", "places"], ["overview", "places"],
  ["omt", "basemap"], ["dem", "basemap"], ["relief", "basemap"]
]);
const failed = new Map();

function onMapError(e) {
  const providerError = /maptiler/.test(String(e.error?.url || ""));
  const kind = warningKinds.get(e.sourceId) || (providerError ? "basemap" : null);
  if (!kind) return;
  failed.set(e.sourceId || "omt", { kind, hasTile: Boolean(e.tile) });
  renderWarnings();
}

function recoverSource(id) {
  if (!failed.has(id)) return;
  // MapLibre considers errored tiles settled. A success in the same source
  // only clears its warning once the affected viewport has no errored tiles.
  const tiles = map.style?.tileManagers?.[id];
  if (tiles?.getIds().some((key) => tiles.getTileByID(key)?.state === "errored")) return;
  failed.delete(id);
  renderWarnings();
}

function renderWarnings() {
  const kinds = new Set([...failed.values()].map(({ kind }) => kind));
  const messages = {
    places: "The lights could not be loaded just now, so places of worship are missing from this view. The main map may still show them.",
    basemap: "The base map could not be loaded just now, so land, water and terrain are drawn plainly."
  };
  const notice = $("notice");
  notice.hidden = kinds.size === 0;
  notice.querySelector(".notice-text").textContent = kinds.size > 1
    ? "Map tiles could not be loaded just now. The lights and the base map may be incomplete."
    : messages[[...kinds][0]] || "";
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
