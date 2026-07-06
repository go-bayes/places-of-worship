// region-map.js — the shared runtime for the country research maps
// (apps/regions/<cc>/). one module, thin per-country pages: all map and
// census logic lives here; the whole country-specific surface arrives in
// window.REGION_CONFIG, and the page chrome is injected into #region-root
// so per-country html carries no structure that can drift. extracted from
// apps/regions/nz/index.html and apps/regions/vu/index.html as the union
// of both forks — behaviour keys on data and config, never on country
// (see docs/development/regional-map-consistency.md and ./DRIFT-REPORT.md).
// loads as a classic script from the page's own directory, so relative
// fetches (data/…, ../../../schemas/…) resolve against the page location.
if (!window.maplibregl) {
  throw new Error("MapLibre missing");
}

// the whole country-specific surface: copy, camera, census levels, geocode
// bias, cross-links. everything below reads this and the data products.
const RC = window.REGION_CONFIG;
if (!RC) {
  throw new Error("REGION_CONFIG missing");
}
document.title = RC.title;

// ── page chrome ─────────────────────────────────────────────────────
// injected rather than authored per country so the structure cannot
// drift between forks; only the copy (onboarding, wordmark links) comes
// from config. the markup is verbatim from the source pages.
(function renderChrome() {
  const root = document.getElementById("region-root");
  if (!root) {
    throw new Error("#region-root missing");
  }
  const onboardBullets = (RC.onboarding.bullets || [])
    .map((item) => `<li>${item}</li>`)
    .join("\n      ");
  // onboarding actions: config links first, then the shared dismiss button
  const onboardLinks = (RC.onboarding.links || [])
    .map((link) => link.external
      ? `<a href="${link.href}" target="_blank" rel="noopener">${link.label}</a>`
      : `<a href="${link.href}">${link.label}</a>`)
    .join("\n      ");
  // wordmark: config links lead; the fix-map link and theme select are shared
  const wordmarkLinks = (RC.wordmarkLinks || [])
    .map((link) => `<a id="${link.id}" href="${link.href}" title="${link.title}">${link.label}</a>`)
    .join("\n    ");
  root.innerHTML = `
  <div id="map"></div>
  <div id="tile-status">Loading tiles…</div>
  <div id="click-hint" class="shell-toast" role="status" aria-live="polite"></div>
  <div id="onboard" role="dialog" aria-label="About this map">
    <h3>${RC.onboarding.title}</h3>
    <p>${RC.onboarding.intro}</p>
    <ul>
      ${onboardBullets}
    </ul>
    <div class="onboard-actions">
      ${onboardLinks}
      <button type="button" id="onboard-dismiss">Got it</button>
    </div>
  </div>
  <div id="wordmark" class="shell-pill shell-top-right shell-divided">
    ${wordmarkLinks}
    <a id="fixmap-link" href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener" title="Improve this map area on OpenStreetMap">fix map</a>
    ${RC.raPortalHref ? `<a id="raportal-link" href="${RC.raPortalHref}" title="RA portal — sign in with your invited Google account">RA portal</a>` : ""}
    <select id="basemapSelect" class="shell-pill-select" aria-label="Theme"></select>
  </div>
  <button id="corner-reset" class="shell-pill shell-top-left" type="button" aria-label="Set North">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3L17 12L7 12L12 3Z" fill="#ef4444"/>
      <path d="M7 12L17 12L12 21L7 12Z" fill="currentColor" opacity="0.45"/>
      <text x="12" y="15" text-anchor="middle" font-size="8.5" font-weight="800" fill="#f8fafc" font-family="system-ui, sans-serif">N</text>
    </svg>
  </button>
  <button id="corner-refresh" class="shell-pill shell-bottom-left" type="button" aria-label="Reset map" title="Reset map">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
      <polyline points="21 3 21 9 15 9"/>
    </svg>
  </button>
  <div id="bottom-actions" class="shell-bottom-centre">
    <button id="dock-toggle" class="shell-pill" type="button">Search &amp; Filters</button>
    <button id="filters-clear" class="shell-pill" type="button" hidden aria-label="Clear filters"></button>
    <button id="near-me" class="shell-pill" type="button" aria-pressed="false"><span class="nm-dot"></span><span>Near Me</span></button>
  </div>
  <!-- top-left: the denomination key for the place dots -->
  <div id="key-wrap">
    <div id="counts-bar">
      <button id="counts-toggle" class="shell-pill" type="button" aria-controls="counts" aria-expanded="false">Show Denomination Key</button>
    </div>
    <div id="counts">
      <h3>Visible Places</h3>
      <div id="countsHint">Zoom in for key</div>
      <ul id="countsList"></ul>
      <div class="count-total" id="countsTotal">Total: 0</div>
    </div>
  </div>
  <!-- top-centre: the census data control, holding its options, colour key and time slider -->
  <div id="census-wrap" class="shell-top-centre">
    <button id="census-toggle" class="shell-pill" type="button" aria-controls="census-panel" aria-expanded="true">
      <span>Census</span><span class="census-caret" aria-hidden="true">▴</span>
    </button>
    <div id="census-panel">
      <div id="census-options">
        <select id="censusMetric" aria-label="Census metric"></select>
        <select id="censusLevel" aria-label="Census geography"></select>
      </div>
      <div id="census-legend">
        <div id="census-legend-scale"></div>
        <div id="census-time" hidden></div>
      </div>
    </div>
  </div>
  <div id="dock">
    <div class="dock-panel">
      <div class="dock-row">
        <input id="searchInput" type="text" placeholder="Search an address or place (prototype)">
        <button id="searchButton">Search</button>
        <button id="dock-close" type="button" aria-label="Close search and filters">×</button>
      </div>
      <div class="dock-row dock-cities-row">
        <div class="dock-cities" id="cityChips"></div>
      </div>
      <div class="dock-row dock-filters-row">
        <button id="filters-toggle" type="button" aria-expanded="false" aria-controls="dock-filters">Filters ▾</button>
      </div>
      <div class="dock-filters" id="dock-filters" hidden>
        <div class="filter-group" id="religion-filters" role="group" aria-label="Filter by religion"></div>
        <div class="filter-group" id="denom-filters" role="group" aria-label="Filter Christian denominations" hidden></div>
      </div>
    </div>
  </div>
`;
})();

const showStatus = () => {};

const CONFIG = {
  // camera opens on the country's own centre and zoom (config)
  center: RC.center,
  initialZoom: RC.initialZoom,
  streetViewMinZoom: 14,
  streetViewFailDelayMs: 1200,
  mobileMinZoom: 3.0,
  desktopMinZoom: 1.5,
  tiles: {
    overview: "https://tiles.placemap.org/places-overview/{z}/{x}/{y}",
    places: "https://tiles.placemap.org/places/{z}/{x}/{y}",
    polygons: "https://tiles.placemap.org/nz-polygons/{z}/{x}/{y}",
    buildings: "https://tiles.placemap.org/buildings/{z}/{x}/{y}"
  },
  layerDefaults: {
    overview: "places_overview",
    places: "places",
    polygons: "nz-polygons",
    buildings: "buildings"
  }
};

const urlParams = new URLSearchParams(window.location.search);
const OVERVIEW_LAYER = urlParams.get("overviewLayer") || CONFIG.layerDefaults.overview;
const OVERVIEW_ENABLED = urlParams.get("overview") !== "0";
const PLACES_LAYER = urlParams.get("placesLayer") || CONFIG.layerDefaults.places;
const POLYGONS_LAYER = urlParams.get("polygonsLayer") || CONFIG.layerDefaults.polygons;
const BUILDINGS_LAYER = urlParams.get("buildingsLayer") || CONFIG.layerDefaults.buildings;
const GOOGLE_MAPS_KEY = window.GOOGLE_MAPS_API_KEY || "";
const MAPTILER_API_KEY = window.MAPTILER_API_KEY || "";
const NOMINATIM_EMAIL = window.NOMINATIM_EMAIL || "";
const BACKDROP_BASEMAP_ID = "backdrop";
let terrainToggle = null;
let terrainOn = false;
let googleMapsReady = false;
const IS_MOBILE = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;

const religionColors = [
  "match",
  ["get", "religion"],
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

const basemapSelect = document.getElementById("basemapSelect");
const hasMaptilerKey = Boolean(MAPTILER_API_KEY && !MAPTILER_API_KEY.includes("REPLACE_WITH_MAPTILER_KEY"));
const isPlacesmapHost = ["placesmap.org", "www.placesmap.org"].includes(window.location.hostname);
const cartoStyle = {
  id: "carto-light",
  label: "CARTO",
  style: {
    version: 8,
    name: "CARTO",
    sources: {
      "carto-light": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors, © CARTO"
      }
    },
    layers: [{ id: "carto-light", type: "raster", source: "carto-light" }]
  }
};
const maptilerStyles = hasMaptilerKey
  ? [
      {
        id: "backdrop",
        label: "Backdrop",
        url: `https://api.maptiler.com/maps/backdrop/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
  id: "streets",
  label: "Streets",
  url: `https://api.maptiler.com/maps/streets/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
},
      {
        id: "aquarelle",
        label: "Aquarelle",
        url: `https://api.maptiler.com/maps/aquarelle/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
        id: "dataviz",
        label: "Dataviz",
        url: `https://api.maptiler.com/maps/dataviz/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
        id: "satellite",
        label: "Satellite",
        url: `https://api.maptiler.com/maps/satellite/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
        id: "toner",
        label: "Toner",
        url: `https://api.maptiler.com/maps/toner/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
        id: "topo",
        label: "Topo",
        url: `https://api.maptiler.com/maps/topo/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
      },
      {
  id: "winter",
  label: "Winter",
  url: `https://api.maptiler.com/maps/winter/style.json?key=${encodeURIComponent(MAPTILER_API_KEY)}`
}
  ]
: [];
const basemapOptions = [cartoStyle, ...maptilerStyles];
// default to maptiler's low-saturation dataviz theme: it is built to sit
// under data overlays, so the census choropleth reads clearly above it.
// fall back to dataviz-absent backdrop, then the free carto style; the
// error handler below also drops to carto if maptiler credit runs out
const DEFAULT_BASEMAP_ID = "dataviz";
const defaultBasemapId = hasMaptilerKey
  ? (basemapOptions.some((s) => s.id === DEFAULT_BASEMAP_ID) ? DEFAULT_BASEMAP_ID : BACKDROP_BASEMAP_ID)
  : cartoStyle.id;
let activeBasemapId = defaultBasemapId;

const initialBasemap = basemapOptions.find((s) => s.id === defaultBasemapId) || cartoStyle;
const initialStyle = initialBasemap.style || initialBasemap.url || cartoStyle.style;

function nudgeMap() {
  if (!map || !map.isStyleLoaded()) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  map.jumpTo({ center, zoom: zoom + 0.00001 });
  map.jumpTo({ center, zoom });
  map.triggerRepaint();
}

function syncTerrainToggleLabel() {
  if (!terrainToggle) return;
  terrainToggle.textContent = terrainOn ? "Carto" : "Backdrop";
}

function setTerrainStateFromBasemap(basemapId) {
  terrainOn = basemapId === BACKDROP_BASEMAP_ID;
  syncTerrainToggleLabel();
}

function updateTerrainToggleAvailability() {
  if (!terrainToggle) return;
  const hasBackdrop = basemapOptions.some((style) => style.id === BACKDROP_BASEMAP_ID);
  terrainToggle.disabled = !hasBackdrop;
  terrainToggle.setAttribute("aria-disabled", hasBackdrop ? "false" : "true");
  if (!hasBackdrop) {
    terrainOn = false;
    syncTerrainToggleLabel();
  }
}

function refreshMapLayers() {
  ensureCustomLayers();
  updateCounts();
  nudgeMap();
  map.triggerRepaint();
  setTimeout(() => {
    ensureCustomLayers();
    map.triggerRepaint();
  }, 280);
}

const map = new maplibregl.Map({
  container: "map",
  style: initialStyle,
  center: CONFIG.center,
  zoom: CONFIG.initialZoom,
  pitch: 0,
  bearing: 0,
  projection: "mercator",
  // named hash so the camera (#map=...) and filter state (#f=...) share
  // the fragment; legacy bare-position links fall back to the default view
  hash: "map",
  attributionControl: false,
  maxZoom: 18,
  minZoom: IS_MOBILE ? CONFIG.mobileMinZoom : CONFIG.desktopMinZoom
});

// responsive attribution: full text on wide maps, the standard
// tap-to-expand disc on phones, where the corner shares the pill line
map.addControl(new maplibregl.AttributionControl(), "bottom-right");

// fall back to the free carto basemap when the keyed maptiler style or
// tiles stop loading: 401/403 key blocked or credit exhausted, 429
// rate-limited. one-shot so a flaky tile cannot flip the style repeatedly.
let maptilerFallbackDone = false;
map.on("error", (e) => {
  if (maptilerFallbackDone || activeBasemapId === cartoStyle.id) return;
  const err = e && e.error;
  const status = err && err.status;
  const url = (err && err.url) || "";
  if (![401, 402, 403, 429].includes(status)) return;
  if (typeof url === "string" && url && !url.includes("api.maptiler.com")) return;
  maptilerFallbackDone = true;
  activeBasemapId = cartoStyle.id;
  if (basemapSelect) basemapSelect.value = cartoStyle.id;
  setTerrainStateFromBasemap(cartoStyle.id);
  map.setStyle(cartoStyle.style, { diff: false });
  map.once("style.load", () => refreshMapLayers());
});

if (!IS_MOBILE) {
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.FullscreenControl({ container: document.body }), "bottom-right");
}

// blue-dot location for all devices: permission-gated by the browser and
// computed client-side, so coordinates never leave the page. tracking
// keeps the dot following the user, the main mobile use case.
const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  fitBoundsOptions: { maxZoom: 16 },
  trackUserLocation: true,
  showAccuracyCircle: true
});
map.addControl(geolocate, "bottom-right");

// labelled primary control for locating; the stock geolocate icon is
// hidden in css. trigger() follows the control's state machine:
// off → locate, following → off (dot removed), background → recentre.
const nearMe = document.getElementById("near-me");
function locateWatching() {
  // _watchState is private maplibre api: if an upgrade removes it, the
  // pill degrades to never showing active rather than crashing
  return Boolean(geolocate._watchState && geolocate._watchState !== "OFF");
}
function syncNearMe() {
  if (!nearMe) return;
  const watching = locateWatching();
  nearMe.setAttribute("aria-pressed", watching ? "true" : "false");
  nearMe.classList.toggle("active", watching);
}
if (nearMe) {
  if (!(navigator && "geolocation" in navigator)) {
    nearMe.style.display = "none";
  } else {
    nearMe.addEventListener("click", () => {
      // strict toggle: when watching in any state, a tap turns location
      // fully off. stock trigger() would recentre from the background
      // state instead, which on phones reads as the pill being stuck —
      // it keeps zooming to the user and never switches off.
      if (locateWatching() && geolocate._watchState === "BACKGROUND") {
        geolocate._watchState = "ACTIVE_LOCK";
      }
      geolocate.trigger();
      // off/lock transitions settle synchronously but the first fix
      // arrives async; a short delay covers both
      setTimeout(syncNearMe, 60);
    });
    geolocate.on("trackuserlocationstart", syncNearMe);
    geolocate.on("trackuserlocationend", syncNearMe);
    geolocate.on("geolocate", syncNearMe);
    geolocate.on("error", syncNearMe);
  }
}

// the wordmark's fix-map link deep-links the osm editor to whatever the
// user is looking at; href is computed at click time so it tracks the view
const fixmapLink = document.getElementById("fixmap-link");
if (fixmapLink) {
  fixmapLink.addEventListener("click", () => {
    const centre = map.getCenter();
    const zoom = Math.round(map.getZoom());
    fixmapLink.href = `https://www.openstreetmap.org/edit#map=${zoom}/${centre.lat.toFixed(5)}/${centre.lng.toFixed(5)}`;
  });
}

// ---- measuring point ---------------------------------------------------
// every distance answers from one reference: the planning pin when down
// (ported in a later step), otherwise the blue dot.
let userLocation = null;   // [lng, lat] from the last geolocate fix
let pinLocation = null;    // [lng, lat] of the planning pin, once ported
let focusedPlace = null;   // coords the guide line is held on
let focusedKey = null;     // its osm identity, for the click-again toggle
const NEAREST_LINE_SOURCE = "nearest-line";
const NEAREST_LINE_LAYER = "nearest-line";

function referencePoint() {
  return pinLocation || userLocation;
}

// great-circle distance in metres; ample precision for a popup readout
function haversineMetres(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

geolocate.on("geolocate", (event) => {
  userLocation = [event.coords.longitude, event.coords.latitude];
  // a held guide line tracks the moving dot
  ensureNearestLine();
});

geolocate.on("error", (err) => {
  // code 1 means the browser blocked the request: without a pointer to
  // settings the pill just looks dead
  if (err && err.code === 1) {
    showClickHint("Location is blocked for this site — allow it in your browser settings", { durationMs: 3500 });
  } else {
    showClickHint("Location unavailable", { durationMs: 2400 });
  }
});

geolocate.on("trackuserlocationend", () => {
  // fires when dropping to the background state too; only clear once the
  // watch is fully off (blue dot removed). _watchState is private, so an
  // api change degrades to keeping the line rather than crashing.
  if (geolocate._watchState && geolocate._watchState !== "OFF") return;
  userLocation = null;
  // the pin, if down, remains the measuring point; otherwise the line
  // loses its start and clears
  ensureNearestLine();
});

// a new measuring point releases any held guide line
function referenceChanged() {
  focusedPlace = null;
  focusedKey = null;
  ensureNearestLine();
}

// dashed guide line from the measuring point to a place the user has
// tapped — never drawn unbidden to the nearest place: this is a
// browsing map, and nobody is busting for church the way they are for
// a loo. re-added after every basemap switch because setStyle drops
// custom sources and layers.
function ensureNearestLine() {
  // places-source presence proxies "style initialised"; isStyleLoaded()
  // is false during any pending repaint and would skip updates silently
  if (!map.getSource(SOURCES.places)) return;
  if (!map.getSource(NEAREST_LINE_SOURCE)) {
    map.addSource(NEAREST_LINE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }
  if (!map.getLayer(NEAREST_LINE_LAYER)) {
    // insert beneath the place points so dots stay tappable
    map.addLayer({
      id: NEAREST_LINE_LAYER,
      type: "line",
      source: NEAREST_LINE_SOURCE,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 3,
        "line-dasharray": [1.5, 1.5],
        "line-opacity": 0.85
      }
    }, map.getLayer(LAYERS.places) ? LAYERS.places : undefined);
  }
  const ref = referencePoint();
  const target = focusedPlace;
  const features = (ref && target)
    ? [{
        type: "Feature",
        geometry: { type: "LineString", coordinates: [ref, target] },
        properties: {}
      }]
    : [];
  map.getSource(NEAREST_LINE_SOURCE).setData({ type: "FeatureCollection", features });
}

// holding focus keys on osm identity so the line survives popup close
// (useful for planning); clicking the same place again, or changing the
// measuring point, releases the line back to the nearest place
function placeKey(props, coords) {
  return props && props.osm_id ? `${props.osm_type || "node"}/${props.osm_id}` : coords.join(",");
}
function focusPlace(props, coords) {
  if (!referencePoint() || !coords) return;
  const key = placeKey(props, coords);
  if (focusedKey === key) {
    focusedPlace = null;
    focusedKey = null;
  } else {
    focusedPlace = coords;
    focusedKey = key;
  }
  ensureNearestLine();
}

// ---- nearest place of worship -------------------------------------------
// walking directions; when the planning pin is down it becomes the
// origin, otherwise google uses the device's current location
function directionsUrl(latFixed, lngFixed) {
  const origin = pinLocation
    ? `&origin=${pinLocation[1].toFixed(6)},${pinLocation[0].toFixed(6)}`
    : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${latFixed},${lngFixed}&travelmode=walking${origin}`;
}

function formatDistance(metres) {
  if (metres < 950) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// walk estimate: straight-line distance inflated by a typical
// street-network detour factor (1.3) at 4.8 km/h; omitted beyond a
// plausible walking trip. distances themselves stay as the crow flies,
// and the ui says so — hills and harbours ignore the haversine.
function walkSuffix(metres) {
  const minutes = (metres * 1.3) / 80;
  return minutes <= 90 ? ` · ~${Math.max(1, Math.round(minutes))} min walk` : "";
}

// distance rows for popups: from the blue dot and the planning pin;
// both rows show when both exist, which is the planning case that
// motivates the pin. each figure names itself as the crow flies, and
// the footnote points at Directions for a real route.
function distanceRowsHtml(coords) {
  if (!coords) return "";
  const rows = [];
  if (userLocation) {
    rows.push(["From you", distanceSummary(haversineMetres(userLocation, coords))]);
  }
  if (pinLocation) {
    rows.push(["From pin", distanceSummary(haversineMetres(pinLocation, coords))]);
  }
  if (!rows.length) return "";
  const items = rows
    .map(([k, v]) => `<div class="place-attr"><span class="place-attr-key">${k}</span><span class="place-attr-val">${v}</span></div>`)
    .join("");
  return `<div class="place-attrs">${items}</div>` +
    `<div class="place-note">Directions gives a real route.</div>`;
}

function distanceSummary(metres) {
  return `${formatDistance(metres)} as the crow flies${walkSuffix(metres)}`;
}

// ---- planning pin --------------------------------------------------------
// right-click (mouse) or press-and-hold (touch) drops a draggable amber
// pin; while present it replaces the blue dot as the measuring point, so
// the banner and directions answer "from the pin". the × on the banner
// or a tap on the pin removes it.
let pinMarker = null;
let pinDragging = false;

function setPin(lngLat) {
  const coords = [lngLat.lng, lngLat.lat];
  if (!pinMarker) {
    pinMarker = new maplibregl.Marker({ color: "#f59e0b", draggable: true })
      .setLngLat(coords)
      .addTo(map);
    pinMarker.on("dragstart", () => { pinDragging = true; });
    pinMarker.on("dragend", () => {
      const moved = pinMarker.getLngLat();
      pinLocation = [moved.lng, moved.lat];
      referenceChanged();
      // let the post-drag click slip past before re-arming tap-to-remove
      setTimeout(() => { pinDragging = false; }, 80);
    });
    // tap the pin itself to remove it: click on, click off
    pinMarker.getElement().addEventListener("click", (event) => {
      event.stopPropagation();
      if (pinDragging) return;
      clearPin();
    });
    showClickHint("Measuring from pin — tap it to remove", { durationMs: 2400 });
  } else {
    pinMarker.setLngLat(coords);
  }
  pinLocation = coords;
  referenceChanged();
}

function clearPin() {
  if (pinMarker) {
    pinMarker.remove();
    pinMarker = null;
  }
  pinLocation = null;
  referenceChanged();
}

map.on("contextmenu", (e) => {
  if (e.originalEvent && e.originalEvent.preventDefault) e.originalEvent.preventDefault();
  setPin(e.lngLat);
});

// long-press for touch, cancelled by panning or a second finger
let pressTimer = null;
let pressPoint = null;
function cancelLongPress() {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  pressPoint = null;
}
map.on("touchstart", (e) => {
  if (!e.lngLat || (e.points && e.points.length > 1)) {
    cancelLongPress();
    return;
  }
  pressPoint = e.point;
  const lngLat = e.lngLat;
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressTimer = null;
    setPin(lngLat);
  }, 600);
});
map.on("touchmove", (e) => {
  if (pressPoint && e.point &&
      Math.hypot(e.point.x - pressPoint.x, e.point.y - pressPoint.y) > 12) {
    cancelLongPress();
  }
});
map.on("touchend", cancelLongPress);
map.on("touchcancel", cancelLongPress);
map.on("move", cancelLongPress);

let pinnedLabel = null;
let pinnedTimer = null;
function showPinnedLabel(name, coords) {
  if (!pinnedLabel) {
    pinnedLabel = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "260px",
      className: "pinned-label"
    });
  }
  pinnedLabel
    .setLngLat(coords)
    .setHTML(`<div style="font-weight:600;color:inherit;">${name}</div>`)
    .addTo(map);
  if (pinnedTimer) clearTimeout(pinnedTimer);
  pinnedTimer = setTimeout(() => pinnedLabel.remove(), 2200);
}

function initBasemapSelect() {
  basemapSelect.innerHTML = "";
  basemapOptions.forEach((style) => {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    basemapSelect.appendChild(option);
  });
  basemapSelect.value = defaultBasemapId;
  setTerrainStateFromBasemap(defaultBasemapId);
  // No need to setStyle here; initial style is already chosen above.
  basemapSelect.addEventListener("change", (event) => {
    const selected = basemapOptions.find((style) => style.id === event.target.value);
    if (selected) {
      activeBasemapId = selected.id;
      setTerrainStateFromBasemap(selected.id);
      map.setStyle(selected.style || selected.url, { diff: false });
      map.once("style.load", () => {
        addCustomLayers();
        updateCounts();
        map.triggerRepaint();
        map.once("idle", () => {
          ensureCustomLayers();
          const center = map.getCenter();
          const zoom = map.getZoom();
          map.jumpTo({ center, zoom: zoom + 0.00001 });
          map.jumpTo({ center, zoom });
          refreshMapLayers();
        });
      });
      setTimeout(() => {
        ensureCustomLayers();
        map.triggerRepaint();
        nudgeMap();
        refreshMapLayers();
      }, 900);
    }
  });
  basemapSelect.disabled = basemapOptions.length <= 1;
  updateTerrainToggleAvailability();
}

// with loading=async the maps api is NOT ready at script.onload;
// readiness must come from the callback= param. the promise is cached
// so rapid clicks cannot inject the script twice.
let googleMapsPromise = null;
function loadGoogleMaps() {
  if (window.google && window.google.maps && window.google.maps.StreetViewService) {
    return Promise.resolve();
  }
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("Missing Google Maps key"));
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__powGoogleMapsReady";
    window[callbackName] = () => {
      googleMapsReady = true;
      delete window[callbackName];
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      googleMapsPromise = null;
      delete window[callbackName];
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

const SOURCES = {
  overview: "pow-overview",
  places: "pow-places",
  polygons: "pow-polygons",
  buildings: "pow-buildings"
};
const LAYERS = {
  overview: "pow-overview-points",
  places: "pow-places-points",
  polygonsFill: "pow-polygons-fill",
  polygonsLine: "pow-polygons-line",
  buildingsFill: "pow-buildings-fill",
  buildingsLine: "pow-buildings-line"
};
const OVERLAY_SOURCES = new Set(Object.values(SOURCES));

let mobileFeatureClickHandled = false;

function markMobileFeatureClickHandled() {
  if (!IS_MOBILE) return;
  mobileFeatureClickHandled = true;
  requestAnimationFrame(() => {
    mobileFeatureClickHandled = false;
  });
}

function coordsFromFeature(feature, fallbackLngLat) {
  const props = feature?.properties || {};
  const hasProps = props.lat !== undefined && props.lng !== undefined;
  const propCoords = hasProps ? [Number(props.lng), Number(props.lat)] : null;
  const geomCoords = feature?.geometry?.coordinates;
  const isValid = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return false;
    const x = Number(coords[0]);
    const y = Number(coords[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x) <= 180 && Math.abs(y) <= 90;
  };
  if (isValid(geomCoords)) return [Number(geomCoords[0]), Number(geomCoords[1])];
  if (isValid(propCoords)) return propCoords;
  if (fallbackLngLat) return [fallbackLngLat.lng, fallbackLngLat.lat];
  return null;
}

function showMobileStreetViewPopup(name, coords, featureId) {
  if (!coords) return;
  const latFixed = coords[1].toFixed(6);
  const lngFixed = coords[0].toFixed(6);
  const openStreetViewLink = `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFixed},${lngFixed}" target="_blank" rel="noopener">Streetview</a>`;
  const directionsLink = `<a href="${directionsUrl(latFixed, lngFixed)}" target="_blank" rel="noopener">Directions</a>`;
  const popup = new maplibregl.Popup({ maxWidth: "340px", closeOnClick: true })
    .setLngLat(coords)
    .setHTML(
      `<div class="popup-header"><span class="popup-title">${name || "Unnamed"}</span></div>` +
      distanceRowsHtml(coords) +
      `<div class="popup-actions" style="margin-top:6px;">${openStreetViewLink}${directionsLink}</div>`
    )
    .addTo(map);
  trackPlacePopup(popup);

  if (featureId === undefined || featureId === null) return;
  const fillPopupName = () => {
    const liveFeatures = map.queryRenderedFeatures({
      layers: [LAYERS.places, LAYERS.overview],
      filter: ["==", ["id"], featureId]
    });
    const f = liveFeatures && liveFeatures[0];
    const p = f?.properties || {};
    const betterName = p["name:en"] || p.name_en || p.name;
    if (betterName) {
      popup.setHTML(
        `<div class="popup-header"><span class="popup-title">${betterName}</span></div>` +
        `<div class="popup-actions" style="margin-top:6px;">${openStreetViewLink}</div>`
      );
    }
  };
  setTimeout(fillPopupName, 180);
  map.once("idle", fillPopupName);
}

// only one place popup at a time: repeated opens were stacking
// translucent copies on the same spot, each needing its own close
let activePlacePopup = null;
function trackPlacePopup(popup) {
  if (activePlacePopup && activePlacePopup !== popup) activePlacePopup.remove();
  activePlacePopup = popup;
  popup.on("close", () => {
    if (activePlacePopup === popup) activePlacePopup = null;
  });
}

function clampPopupToViewport(popup, padding = 12) {
  const popupEl = popup && popup.getElement ? popup.getElement() : null;
  const mapEl = map && map.getContainer ? map.getContainer() : null;
  if (!popupEl || !mapEl) return;
  const popupRect = popupEl.getBoundingClientRect();
  const mapRect = mapEl.getBoundingClientRect();
  if (!Number.isFinite(popupRect.width) || !Number.isFinite(popupRect.height)) return;
  const availableWidth = mapRect.width - padding * 2;
  const availableHeight = mapRect.height - padding * 2;
  let dx = 0;
  let dy = 0;
  if (popupRect.width <= availableWidth) {
    const minLeft = mapRect.left + padding;
    const maxRight = mapRect.right - padding;
    if (popupRect.left < minLeft) dx = minLeft - popupRect.left;
    if (popupRect.right > maxRight) dx = maxRight - popupRect.right;
  }
  if (popupRect.height <= availableHeight) {
    const minTop = mapRect.top + padding;
    const maxBottom = mapRect.bottom - padding;
    if (popupRect.top < minTop) dy = minTop - popupRect.top;
    if (popupRect.bottom > maxBottom) dy = maxBottom - popupRect.bottom;
  }
  if (!dx && !dy) return;
  const current = map.project(popup.getLngLat());
  const next = { x: current.x + dx, y: current.y + dy };
  popup.setLngLat(map.unproject(next));
}

async function handlePlaceFeatureClick(feature, fallbackLngLat) {
  if (!feature) return;
  const props = feature?.properties || {};
  const name = props["name:en"] || props.name_en || props.name || "Loading place…";
  const coords = coordsFromFeature(feature, fallbackLngLat);
  if (!coords) return;
  // hold or release the guide line on this place (no-op without a
  // measuring point); survives popup close by design
  focusPlace(props, coords);
  const panoId = `pano-${Date.now()}`;
  const latFixed = coords[1].toFixed(6);
  const lngFixed = coords[0].toFixed(6);
  const openStreetViewLink = `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFixed},${lngFixed}" target="_blank" rel="noopener">Open Street View</a>`;

  // Mobile: always allow Street View link at any zoom, with retry to fetch name
  if (IS_MOBILE) {
    if (mobileFeatureClickHandled) return;
    markMobileFeatureClickHandled();
    showMobileStreetViewPopup(name, coords, feature?.id);
    return;
  }
  if (IS_MOBILE) {
    new maplibregl.Popup({ maxWidth: "340px", closeOnClick: true })
      .setLngLat(coords)
      .setHTML(
        `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
        `<div class="popup-actions" style="margin-top:6px;">` +
        `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFixed},${lngFixed}" target="_blank" rel="noopener">Open Street View</a>` +
        `<a href="https://www.openstreetmap.org/?mlat=${latFixed}&mlon=${lngFixed}#map=18/${latFixed}/${lngFixed}" target="_blank" rel="noopener">Open OSM</a>` +
        `<button type="button" data-copy="${latFixed},${lngFixed}">Copy coords</button>` +
        `</div>`
      )
      .addTo(map);
    return;
  }
  const popup = new maplibregl.Popup({ maxWidth: "720px", closeOnClick: true })
    .setLngLat(coords)
    .setHTML(
      `<div class="popup-header" data-drag-handle="true">` +
      `<span class="popup-title">${name}</span>` +
      `</div>` +
      distanceRowsHtml(coords) +
      `<div class="streetview" id="${panoId}">Loading Street View…</div>` +
      `<div class="popup-actions">` +
      `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFixed},${lngFixed}" target="_blank" rel="noopener">Streetview</a>` +
      `<a href="${directionsUrl(latFixed, lngFixed)}" target="_blank" rel="noopener">Directions</a>` +
      `<a href="https://www.openstreetmap.org/?mlat=${latFixed}&mlon=${lngFixed}#map=18/${latFixed}/${lngFixed}" target="_blank" rel="noopener">Open OSM</a>` +
      `<button type="button" data-copy="${latFixed},${lngFixed}">Copy coords</button>` +
      `<button type="button" class="streetview-expand" data-mode="expand" data-pano="${panoId}">Expand</button>` +
      `</div>`
    )
    .addTo(map);
  trackPlacePopup(popup);
  requestAnimationFrame(() => clampPopupToViewport(popup));

  const panoContainer = () => document.getElementById(panoId);
  const popupContent = popup.getElement();
  const popupBody = popupContent ? popupContent.querySelector(".maplibregl-popup-content") : null;
  if (popupBody) {
    const mapCanvas = map.getCanvas();
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const canDragFromTarget = (event) => {
      if (event.button !== undefined && event.button !== 0) return false;
      const target = event.target;
      if (!(target instanceof Element)) return false;
      if (target.closest(".streetview")) return false;
      if (target.closest(".popup-actions")) return false;
      if (target.closest(".maplibregl-popup-close-button")) return false;
      if (target.closest("button, a, input, select, textarea, label")) return false;
      return true;
    };

    popupBody.addEventListener("mousedown", (event) => {
      if (!canDragFromTarget(event)) return;
      dragging = true;
      popupBody.classList.add("dragging");
      startX = event.clientX;
      startY = event.clientY;
      mapCanvas.style.cursor = "grabbing";
      if (map.dragPan) map.dragPan.disable();
      document.body.style.userSelect = "none";
      event.stopPropagation();
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      startX = event.clientX;
      startY = event.clientY;
      const current = map.project(popup.getLngLat());
      const next = { x: current.x + dx, y: current.y + dy };
      const nextLngLat = map.unproject(next);
      popup.setLngLat(nextLngLat);
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      popupBody.classList.remove("dragging");
      mapCanvas.style.cursor = "";
      if (map.dragPan) map.dragPan.enable();
      document.body.style.userSelect = "";
    });
  }
  // ui wiring that must work whether or not street view ever starts:
  // expand, the drag hint, and copy-coords live outside the lazy path
  const popupEl = popup.getElement();
  const expandButton = popupEl.querySelector(`[data-mode="expand"][data-pano="${panoId}"]`);
  let resizePano = null;
  if (expandButton) {
    expandButton.addEventListener("click", () => {
      const target = panoContainer();
      if (!target) return;
      const expanded = target.classList.toggle("expanded");
      expandButton.textContent = expanded ? "Collapse" : "Expand";
      if (resizePano) resizePano();
      requestAnimationFrame(() => clampPopupToViewport(popup));
    });
  }
  if (popupBody) {
    const DRAG_HINT_KEY = "pow-drag-hint-dismissed";
    const hint = document.createElement("div");
    hint.className = "popup-drag-toast";
    hint.textContent = "Drag to move";
    const shouldShowHint = () => {
      try {
        return !sessionStorage.getItem(DRAG_HINT_KEY);
      } catch (error) {
        return true;
      }
    };
    if (shouldShowHint()) {
      popupBody.appendChild(hint);
      setTimeout(() => {
        hint.classList.add("visible");
      }, 120);
      setTimeout(() => {
        hint.classList.remove("visible");
        hint.remove();
        try {
          sessionStorage.setItem(DRAG_HINT_KEY, "1");
        } catch (error) {
          // Ignore storage failures.
        }
      }, 2600);
    }
  }
  const copyButton = popupEl.querySelector(`[data-copy]`);
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const value = copyButton.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(value || "");
        copyButton.textContent = "Copied";
        setTimeout(() => {
          copyButton.textContent = "Copy coords";
        }, 1200);
      } catch (error) {
        copyButton.textContent = "Copy failed";
        setTimeout(() => {
          copyButton.textContent = "Copy coords";
        }, 1200);
      }
    });
  }

  if (!GOOGLE_MAPS_KEY) {
    const node = panoContainer();
    if (node) node.textContent = "Street View unavailable.";
    return;
  }
  // lazy street view: the maps api bills per dynamic load, and most
  // popup opens never look at it — load only on request
  const placeholder = panoContainer();
  if (placeholder) {
    placeholder.innerHTML = `<button type="button" class="sv-show">Show Street View</button>`;
    let svStarted = false;
    placeholder.querySelector(".sv-show").addEventListener("click", () => {
      if (svStarted) return;
      svStarted = true;
      void startStreetView();
    });
  }

  async function startStreetView() {
  try {
    const loadingNode = panoContainer();
    if (loadingNode) loadingNode.textContent = "Loading Street View…";
    await loadGoogleMaps();
    const node = panoContainer();
    if (!node) return;
    const sv = new google.maps.StreetViewService();
    let panoInstance = null;
    let currentSource = "OUTDOOR";
    let panoLoading = false;
    let lastPanoRequest = 0;
    let resizeObserver = null;
    let pendingFailTimer = null;

    function attachResizeHandle(target) {
      if (!target || target.querySelector(".sv-resize-handle")) return;
      const handle = document.createElement("div");
      handle.className = "sv-resize-handle";
      handle.textContent = "↘";
      target.appendChild(handle);
      const MIN_W = 260;
      const MIN_H = 160;
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.style.cursor = "nwse-resize";
        const startX = event.clientX;
        const startY = event.clientY;
        const rect = target.getBoundingClientRect();
        const startW = rect.width;
        const startH = rect.height;

        function onMove(e) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          const nextW = Math.min(window.innerWidth * 0.9, Math.max(MIN_W, startW + deltaX));
          const nextH = Math.min(window.innerHeight * 0.72, Math.max(MIN_H, startH + deltaY));
          target.style.width = `${nextW}px`;
          target.style.height = `${nextH}px`;
          resizePanorama();
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          handle.style.cursor = "nwse-resize";
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    }

    function resizePanorama() {
      if (panoInstance && window.google?.maps?.event) {
        window.google.maps.event.trigger(panoInstance, "resize");
      }
    }

    function watchResize() {
      const target = panoContainer();
      if (!target || typeof ResizeObserver === "undefined") return;
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = new ResizeObserver(() => resizePanorama());
      resizeObserver.observe(target);
    }

    function setMessage(message) {
      const target = panoContainer();
      if (target) target.textContent = message;
    }

    function loadPanorama(source, attempt = 0) {
      const target = panoContainer();
      if (!target) return;
      if (pendingFailTimer) {
        clearTimeout(pendingFailTimer);
        pendingFailTimer = null;
      }
      const now = Date.now();
      lastPanoRequest = now;
      target.textContent = "Loading Street View…";
      const radius = attempt === 0 ? 560 : 1120;
      const request = {
        location: { lat: coords[1], lng: coords[0] },
        radius,
        source: google.maps.StreetViewSource[source] || google.maps.StreetViewSource.DEFAULT
      };
      sv.getPanorama(request, (data, status) => {
        if (pendingFailTimer) {
          clearTimeout(pendingFailTimer);
          pendingFailTimer = null;
        }
        if (status === "OK") {
          currentSource = source;
          panoInstance = new google.maps.StreetViewPanorama(target, {
            position: { lat: coords[1], lng: coords[0] },
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
            fullscreenControl: false,
            motionTracking: false,
            showRoadLabels: false
          });
          resizePanorama();
        } else {
          if (attempt === 0) {
            // Fallback: broaden search and switch source if we started outdoors.
            const nextSource = source === "OUTDOOR" ? "DEFAULT" : "OUTDOOR";
            loadPanorama(nextSource, attempt + 1);
            return;
          }
          pendingFailTimer = setTimeout(() => {
            if (source === "OUTDOOR") {
              setMessage("No outdoor Street View available.");
            } else {
              setMessage("No Street View for this location.");
            }
          }, CONFIG.streetViewFailDelayMs);
        }
      });
    }

    // the hoisted expand handler resizes the pano once it exists
    resizePano = resizePanorama;

    loadPanorama("OUTDOOR");
    attachResizeHandle(panoContainer());
    watchResize();
    requestAnimationFrame(() => clampPopupToViewport(popup));
    popup.on("close", () => {
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = null;
      if (pendingFailTimer) clearTimeout(pendingFailTimer);
    });
  } catch (error) {
    const node = panoContainer();
    if (node) node.textContent = "Street View failed to load.";
  }
  }
}

let overviewMobileHandlerAttached = false;
function addOverviewLayer() {
  map.addSource(SOURCES.overview, {
    type: "vector",
    tiles: [CONFIG.tiles.overview],
    minzoom: 0,
    maxzoom: 6,
    // the places data is odbl: credit is required, not courtesy
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  });
  map.addLayer({
    id: LAYERS.overview,
    type: "circle",
    source: SOURCES.overview,
    "source-layer": OVERVIEW_LAYER,
    maxzoom: 6,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0, 1.4,
        6, 3.5,
        9, 4.2
      ],
      "circle-color": religionColors,
      "circle-stroke-width": 0.6,
      "circle-stroke-color": "rgba(10, 11, 14, 0.6)",
      // a country whose OSM dot density would bury the census choropleth
      // at national zoom can fade the overview tier via config; the
      // detailed places tier still ramps in on zoom as everywhere else
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0, RC.overviewDotOpacity ?? 0.75,
        5, RC.overviewDotOpacity ?? 0.75,
        6, 0.0
      ]
    }
  });

  if (IS_MOBILE && !overviewMobileHandlerAttached) {
    overviewMobileHandlerAttached = true;
    map.on("click", LAYERS.overview, (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      if (mobileFeatureClickHandled) return;
      const props = feature.properties || {};
      const name = props["name:en"] || props.name_en || props.name || "Unnamed";
      const coords = coordsFromFeature(feature, e.lngLat);
      if (!coords) return;
      markMobileFeatureClickHandled();
      focusPlace(props, coords);
      showMobileStreetViewPopup(name, coords, feature.id);
    });
  }
}

let placesHandlersAttached = false;
function addPlacesLayer() {
  map.addSource(SOURCES.places, {
    type: "vector",
    tiles: [CONFIG.tiles.places],
    minzoom: 6,
    maxzoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  });
  map.addLayer({
    id: LAYERS.places,
    type: "circle",
    source: SOURCES.places,
    "source-layer": PLACES_LAYER,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 2.1,
        10, 3.85,
        16, 5.95
      ],
      "circle-color": religionColors,
      "circle-stroke-width": 0.8,
      "circle-stroke-color": "#0b0c10",
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 0.2,
        9, 0.85,
        12, 0.75,
        18, 0.7
      ]
    }
  });

  const hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "260px"
  });

  if (placesHandlersAttached) {
    return;
  }
  placesHandlersAttached = true;

  map.on("mousemove", LAYERS.places, (e) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = e.features && e.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const name = props["name:en"] || props.name_en || props.name || "Unnamed";
    const coords = coordsFromFeature(feature, e.lngLat);
    if (!coords) return;
    hoverPopup
      .setLngLat(coords)
      .setHTML(`<div style="font-weight:600;color:inherit;">${name}</div>`)
      .addTo(map);
    showPinnedLabel(name, coords);
  });

  map.on("mouseleave", LAYERS.places, () => {
    map.getCanvas().style.cursor = "";
    hoverPopup.remove();
  });

  map.on("click", LAYERS.places, (e) => {
    const feature = e.features && e.features[0];
    if (!feature) return;
    void handlePlaceFeatureClick(feature, e.lngLat);
  });
}

function addPolygonsLayer() {
  map.addSource(SOURCES.polygons, { type: "vector", tiles: [CONFIG.tiles.polygons], minzoom: 2, maxzoom: 14 });
  map.addLayer({
    id: LAYERS.polygonsFill,
    type: "fill",
    source: SOURCES.polygons,
    "source-layer": POLYGONS_LAYER,
    paint: { "fill-color": "rgba(125, 211, 252, 0.10)", "fill-outline-color": "rgba(255,255,255,0.05)" }
  });
  map.addLayer({
    id: LAYERS.polygonsLine,
    type: "line",
    source: SOURCES.polygons,
    "source-layer": POLYGONS_LAYER,
    paint: { "line-color": "rgba(255,255,255,0.25)", "line-width": 0.6 }
  });
}

function addBuildingsLayer() {
  map.addSource(SOURCES.buildings, { type: "vector", tiles: [CONFIG.tiles.buildings], minzoom: 10, maxzoom: 18 });
  map.addLayer({
    id: LAYERS.buildingsFill,
    type: "fill",
    source: SOURCES.buildings,
    "source-layer": BUILDINGS_LAYER,
    minzoom: 10,
    paint: {
      "fill-color": "rgba(15, 23, 42, 0.12)",
      "fill-outline-color": "rgba(15, 23, 42, 0.25)"
    }
  });
  map.addLayer({
    id: LAYERS.buildingsLine,
    type: "line",
    source: SOURCES.buildings,
    "source-layer": BUILDINGS_LAYER,
    minzoom: 10,
    paint: {
      "line-color": "rgba(15, 23, 42, 0.35)",
      "line-width": 0.6
    }
  });
}

function addCustomLayers() {
  Object.values(LAYERS).forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  Object.values(SOURCES).forEach((id) => {
    if (map.getSource(id)) {
      map.removeSource(id);
    }
  });
  [CENSUS.hover, CENSUS.line, CENSUS.fill].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(CENSUS.source)) map.removeSource(CENSUS.source);
  // census fill first so the choropleth sits beneath every point layer
  addCensusLayers();
  if (OVERVIEW_ENABLED) {
    addOverviewLayer();
  }
  addPolygonsLayer();
  addBuildingsLayer();
  addPlacesLayer();
}

function ensureCustomLayers() {
  if (!map.isStyleLoaded()) return;
  if (!map.getLayer(LAYERS.places) && !map.getLayer(LAYERS.overview)) {
    addCustomLayers();
    applyFilters();
    updateCounts();
  }
}

map.on("style.load", () => {
  addCustomLayers();
  applyFilters();
  ensureNearestLine();
  updateCounts();
  setTimeout(ensureCustomLayers, 350);
  setTimeout(nudgeMap, 400);
  setTimeout(refreshMapLayers, 650);
});

map.on("sourcedata", (event) => {
  if (!event || !event.isSourceLoaded || !event.sourceId) return;
  if (!OVERLAY_SOURCES.has(event.sourceId)) return;
  map.triggerRepaint();
});

map.on("load", () => {
  initBasemapSelect();
  updateCounts();
  map.once("idle", ensureCustomLayers);
  map.once("idle", nudgeMap);
  map.once("idle", refreshMapLayers);
  // census is on by default so the map opens already oriented in NZ; this
  // idle fires after the point layers exist, so the choropleth inserts
  // beneath them rather than over the dots
  map.once("idle", () => { void setCensusEnabled(true); });
});

map.on("error", (e) => {
  const message = e && e.error && e.error.message ? e.error.message : "";
  if (activeBasemapId !== "carto-light" && message.includes("api.maptiler.com")) {
    activeBasemapId = "carto-light";
    basemapSelect.value = "carto-light";
    map.setStyle(cartoStyle.style);
  }
});

if (IS_MOBILE) {
  map.on("click", (e) => {
    // gate on layer presence, not isStyleLoaded(): the latter is false during
    // any pending repaint and silently swallows taps (see CRITIQUE/porting doc)
    if (mobileFeatureClickHandled || !map.getLayer(LAYERS.places) || !map.getLayer(LAYERS.overview)) return;
    const tapPadding = 12;
    const bbox = [
      [e.point.x - tapPadding, e.point.y - tapPadding],
      [e.point.x + tapPadding, e.point.y + tapPadding]
    ];
    const features = map.queryRenderedFeatures(bbox, { layers: [LAYERS.places, LAYERS.overview] });
    if (!features.length) return;
    const feature = features.find((item) => item.layer && item.layer.id === LAYERS.places) || features[0];
    const props = feature.properties || {};
    const name = props["name:en"] || props.name_en || props.name || "Unnamed";
    const coords = coordsFromFeature(feature, e.lngLat);
    if (!coords) return;
    markMobileFeatureClickHandled();
    focusPlace(props, coords);
    showMobileStreetViewPopup(name, coords, feature.id);
  });
}

if (!IS_MOBILE) {
  map.on("click", (e) => {
    // layer-presence guard; isStyleLoaded() would drop clicks during repaints
    if (!map.getLayer(LAYERS.places) || !map.getLayer(LAYERS.overview)) return;
    const target = e.originalEvent && e.originalEvent.target;
    if (target instanceof Element) {
      const isUiClick = target.closest(
        "button, a, input, select, textarea, label, #dock, #key-wrap, #census-wrap, #wordmark, #corner-refresh, .maplibregl-ctrl"
      );
      if (isUiClick) return;
    }
    const directHit = map.queryRenderedFeatures(e.point, { layers: [LAYERS.places, LAYERS.overview] });
    if (directHit && directHit.length) return;
    const tapPadding = 12;
    const bbox = [
      [e.point.x - tapPadding, e.point.y - tapPadding],
      [e.point.x + tapPadding, e.point.y + tapPadding]
    ];
    const nearby = map.queryRenderedFeatures(bbox, { layers: [LAYERS.places, LAYERS.overview] });
    if (nearby && nearby.length) {
      const feature = nearby.find((item) => item.layer && item.layer.id === LAYERS.places) || nearby[0];
      void handlePlaceFeatureClick(feature, e.lngLat);
      return;
    }
    // an area click answers with the census popup; no street-view hint
    if (censusState.enabled && map.getLayer(CENSUS.fill) &&
        map.queryRenderedFeatures(e.point, { layers: [CENSUS.fill] }).length) {
      return;
    }
    if (map.getZoom() >= CONFIG.streetViewMinZoom) {
      showClickHint("Move Closer and Center on a Place");
    }
  });
}

const cityChips = document.getElementById("cityChips");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resetButton = document.getElementById("corner-reset");
terrainToggle = document.getElementById("terrain-toggle");
const dock = document.getElementById("dock");
const dockToggle = document.getElementById("dock-toggle");
const tileStatus = document.getElementById("tile-status");
const clickHint = document.getElementById("click-hint");
const cornerInfo = document.getElementById("corner-info");
const infoToggle = document.getElementById("corner-info-toggle");
const infoMenu = document.getElementById("corner-info-menu");
const onboard = document.getElementById("onboard");
const onboardDismiss = document.getElementById("onboard-dismiss");
const onboardToggle = document.getElementById("onboard-toggle");
// per-country dismissal key, so one country's "got it" does not
// silence the card everywhere
const ONBOARD_STORAGE_KEY = `pow-${RC.countryCode.toLowerCase()}-onboard-dismissed`;
// quick-jump chips in the search dock (config)
const cityPresets = RC.cityPresets;

function flyTo(coords, zoom) {
  map.flyTo({ center: coords, zoom: zoom || 10, speed: 1.2, curve: 1.4 });
}

function normalizePresetTerm(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findCityPresetMatch(query) {
  const normalizedQuery = normalizePresetTerm(query);
  if (!normalizedQuery) return null;
  for (const city of cityPresets) {
    const terms = [city.label, city.shortLabel, ...(city.aliases || [])].filter(Boolean);
    for (const term of terms) {
      const normalizedTerm = normalizePresetTerm(term);
      if (normalizedQuery === normalizedTerm || normalizedQuery.startsWith(normalizedTerm)) {
        return city;
      }
    }
  }
  return null;
}

cityPresets.forEach((city) => {
  const chip = document.createElement("button");
  chip.className = "dock-chip";
  chip.textContent = city.shortLabel || city.label;
  chip.addEventListener("click", () => flyTo(city.coords, city.zoom));
  cityChips.appendChild(chip);
});

if (cityChips) {
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragMoved = false;
  let pointerId = null;
  let hasPointerCapture = false;
  const dragThreshold = 6;

  const stopDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    cityChips.classList.remove("dragging");
    if (hasPointerCapture && cityChips.releasePointerCapture && pointerId !== null) {
      cityChips.releasePointerCapture(pointerId);
    }
    hasPointerCapture = false;
    pointerId = null;
    if (dragMoved) {
      setTimeout(() => {
        dragMoved = false;
      }, 0);
    }
  };

  cityChips.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    isDragging = true;
    dragMoved = false;
    pointerId = event.pointerId !== undefined ? event.pointerId : null;
    dragStartX = event.clientX;
    dragStartScroll = cityChips.scrollLeft;
    cityChips.classList.add("dragging");
    hasPointerCapture = false;
  });

  cityChips.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - dragStartX;
    if (Math.abs(deltaX) > dragThreshold) {
      if (!dragMoved) {
        dragMoved = true;
        if (!hasPointerCapture && cityChips.setPointerCapture && pointerId !== null) {
          cityChips.setPointerCapture(pointerId);
          hasPointerCapture = true;
        }
      }
    }
    cityChips.scrollLeft = dragStartScroll - deltaX;
  });

  cityChips.addEventListener("pointerup", stopDrag);
  cityChips.addEventListener("pointercancel", stopDrag);
  cityChips.addEventListener("pointerleave", stopDrag);

  cityChips.addEventListener("click", (event) => {
    if (!dragMoved) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

if (terrainToggle) {
  updateTerrainToggleAvailability();
  syncTerrainToggleLabel();
  terrainToggle.addEventListener("click", () => {
    if (terrainToggle.disabled) {
      showClickHint("Backdrop Unavailable");
      return;
    }
    const targetId = terrainOn ? cartoStyle.id : BACKDROP_BASEMAP_ID;
    if (basemapSelect) {
      basemapSelect.value = targetId;
      basemapSelect.dispatchEvent(new Event("change"));
    }
  });
}

resetButton.addEventListener("click", () => {
  map.resetNorth();
});

// compass on demand: the set-north badge appears only when the map is
// rotated off north, on phone and desktop alike (the url hash can
// restore a bearing, so sync on load too)
function syncCompassVisibility() {
  if (!resetButton) return;
  resetButton.classList.toggle("rotated", Math.abs(map.getBearing()) > 0.5);
}
map.on("rotate", syncCompassVisibility);
map.on("rotateend", syncCompassVisibility);
map.on("load", syncCompassVisibility);
syncCompassVisibility();

// one tap back to a clean slate: pin, guide line, popup, search text,
// dock, default view — without dumping the tile cache the way a reload
// would. the blue dot survives; location is the user's own toggle.
const cornerRefresh = document.getElementById("corner-refresh");
function resetSite() {
  clearPin();
  if (activePlacePopup) activePlacePopup.remove();
  if (searchInput) searchInput.value = "";
  setDockOpen(false);
  clearFiltersIfAny();
  map.flyTo({ center: CONFIG.center, zoom: CONFIG.initialZoom, bearing: 0, pitch: 0, speed: 1.6 });
  showClickHint("Map reset");
}
if (cornerRefresh) cornerRefresh.addEventListener("click", resetSite);

let clickHintTimer = null;
function showClickHint(message, options = {}) {
  if (!clickHint) return;
  clickHint.textContent = message;
  clickHint.classList.add("visible");
  if (clickHintTimer) clearTimeout(clickHintTimer);
  if (options.sticky) return;
  const durationMs = options.durationMs || 1600;
  clickHintTimer = setTimeout(() => {
    clickHint.classList.remove("visible");
  }, durationMs);
}

function hideClickHint() {
  if (!clickHint) return;
  if (clickHintTimer) clearTimeout(clickHintTimer);
  clickHint.classList.remove("visible");
}

function scheduleSearchHintClear(targetCoords) {
  if (!clickHint || !targetCoords) {
    hideClickHint();
    return;
  }
  const start = Date.now();
  const maxWaitMs = 2500;
  const thresholdPx = 2;
  const target = { lng: targetCoords[0], lat: targetCoords[1] };

  const check = () => {
    if (!map || !map.isStyleLoaded()) {
      if (Date.now() - start < maxWaitMs) {
        requestAnimationFrame(check);
      } else {
        hideClickHint();
      }
      return;
    }
    const center = map.getCenter();
    const targetPx = map.project(target);
    const centerPx = map.project(center);
    const distance = Math.hypot(targetPx.x - centerPx.x, targetPx.y - centerPx.y);
    if (distance <= thresholdPx) {
      hideClickHint();
      return;
    }
    if (Date.now() - start < maxWaitMs) {
      requestAnimationFrame(check);
    } else {
      hideClickHint();
    }
  };

  map.once("moveend", check);
  requestAnimationFrame(check);
}

function showOnboard() {
  if (!onboard) return;
  onboard.classList.add("visible");
}

function hideOnboard(persist) {
  if (!onboard) return;
  onboard.classList.remove("visible");
  if (!persist) return;
  try {
    sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
  } catch (error) {
    // Ignore storage failures (private mode, etc).
  }
}

function shouldShowOnboard() {
  try {
    return !sessionStorage.getItem(ONBOARD_STORAGE_KEY);
  } catch (error) {
    return true;
  }
}

function syncInfoPosition() {
  if (!cornerInfo) return;
  cornerInfo.style.top = "";
  cornerInfo.style.bottom = "";
}

// escape still dismisses the onboarding card (this lived in the old
// info-menu wiring; the menu is gone, the behaviour stays)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideOnboard(false);
});

if (onboard) {
  if (shouldShowOnboard()) {
    setTimeout(showOnboard, 650);
  }
  if (onboardDismiss) {
    onboardDismiss.addEventListener("click", () => {
      hideOnboard(true);
    });
  }
}

function syncDockToggleLabel(isOpen) {
  if (!dockToggle) return;
  // the long label overflows the phone pill row once the filter chip joins
  dockToggle.textContent = isOpen ? "Close" : (IS_MOBILE ? "Search" : "Search & Filters");
}

function dockIsOpen() {
  return Boolean(dock) && dock.style.display !== "none";
}
// single open/close path shared by the toggle, the panel ×, escape, and
// reset. filters survive close: filtering is the analytical act here,
// and closing the panel is how you look at the result. the indicator
// chip beside the toggle keeps closed-panel filters visible (and one
// tap clears them), so persistence carries no invisible state.
function setDockOpen(open) {
  if (!dock) return;
  dock.style.display = open ? "flex" : "none";
  const filtersWrap = document.getElementById("dock-filters");
  if (!open) {
    if (searchInput) searchInput.blur();
    if (filtersWrap) filtersWrap.hidden = true;
  } else if (filtersWrap && filtersOffCount() > 0) {
    // reopen with active filters in view, spare otherwise
    filtersWrap.hidden = false;
  }
  syncFiltersToggleLabel();
  syncDockToggleLabel(open);
  requestAnimationFrame(syncInfoPosition);
}
if (dockToggle) {
  if (dock) {
    dock.style.display = "none";
    syncDockToggleLabel(false);
  }
  dockToggle.addEventListener("click", () => setDockOpen(!dockIsOpen()));
}
const dockClose = document.getElementById("dock-close");
if (dockClose) dockClose.addEventListener("click", () => setDockOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dockIsOpen()) setDockOpen(false);
});

window.addEventListener("resize", () => {
  requestAnimationFrame(() => {
    syncInfoPosition();
    map.resize();
    updateCounts();
  });
});

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeNominatim(query) {
  const emailParam = NOMINATIM_EMAIL ? `&email=${encodeURIComponent(NOMINATIM_EMAIL)}` : "";
  // country-first: this is the country's research surface
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&countrycodes=${RC.geocode.country}&q=${encodeURIComponent(query)}${emailParam}`;
  let response;
  try {
    response = await fetchWithTimeout(url, { headers: { "Accept": "application/json" } });
  } catch (error) {
    return null;
  }
  if (!response.ok) return null;
  const results = await response.json();
  const result = results && results.length ? results[0] : null;
  if (!result) return null;
  return {
    lon: parseFloat(result.lon),
    lat: parseFloat(result.lat),
    name: result.display_name || "",
    // address-precise results get a measuring pin; areas only get a fly
    precise: result.class === "building" ||
      ["house", "building"].includes(result.type) ||
      result.addresstype === "house"
  };
}

async function geocodeMaptiler(query) {
  if (!hasMaptilerKey || !window.USE_MAPTILER_GEOCODE) return null;
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(MAPTILER_API_KEY)}&limit=1&country=${RC.geocode.country}`;
  let response;
  try {
    response = await fetchWithTimeout(url, { headers: { "Accept": "application/json" } });
  } catch (error) {
    return null;
  }
  if (!response.ok) return null;
  const payload = await response.json();
  const feature = payload && payload.features && payload.features[0];
  const center = feature && (feature.center || feature.geometry?.coordinates);
  if (!center) return null;
  return {
    lon: center[0],
    lat: center[1],
    name: feature.place_name || feature.text || "",
    precise: Array.isArray(feature.place_type) && feature.place_type.includes("address")
  };
}

async function geocodePhoton(query) {
  // bias results toward the country; photon has no hard country filter
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lat=${RC.geocode.biasLngLat[1]}&lon=${RC.geocode.biasLngLat[0]}`;
  let response;
  try {
    response = await fetchWithTimeout(url, { headers: { "Accept": "application/json" } });
  } catch (error) {
    return null;
  }
  if (!response.ok) return null;
  const payload = await response.json();
  const feature = payload && payload.features && payload.features[0];
  const coords = feature && feature.geometry && feature.geometry.coordinates;
  if (!coords) return null;
  const props = feature.properties || {};
  return {
    lon: coords[0],
    lat: coords[1],
    name: props.name || props.label || "",
    precise: Boolean(props.housenumber) || props.osm_key === "building" || props.type === "house"
  };
}

async function geocode(query) {
  const photonResult = await geocodePhoton(query);
  if (photonResult) return photonResult;
  const nominatimResult = await geocodeNominatim(query);
  if (nominatimResult) return nominatimResult;
  return await geocodeMaptiler(query);
}

// typing a category into the search box ("mosque", "anglican") expresses
// a filter, not an address; the geocoder would serve it poorly. exact
// single-term matches apply the filter instead; anything longer geocodes.
function searchFilterTarget(query) {
  const q = query.toLowerCase().trim();
  const venueTerms = {
    mosque: "muslim", mosques: "muslim", masjid: "muslim",
    church: "christian", churches: "christian",
    cathedral: "christian", chapel: "christian",
    synagogue: "jewish", synagogues: "jewish",
    gurdwara: "sikh", gurdwaras: "sikh"
  };
  const religionTerms = { ...venueTerms };
  countLabels.forEach((c) => {
    religionTerms[c.key] = c.key;
    religionTerms[c.label.toLowerCase()] = c.key;
  });
  if (religionTerms[q]) {
    const entry = countLabels.find((c) => c.key === religionTerms[q]);
    return { kind: "religion", key: entry.key, label: entry.label };
  }
  if (christianBuckets) {
    const bucket = christianBuckets.find((b) =>
      b.label.toLowerCase() === q || b.code.split(".")[1] === q || b.aliases.includes(q));
    if (bucket) return { kind: "bucket", code: bucket.code, label: bucket.label };
  }
  return null;
}

function applySearchFilter(target) {
  countLabels.forEach((c) => { religionFilterState[c.key] = false; });
  if (christianBuckets) {
    christianBuckets.forEach((b) => { denomFilterState[b.code] = false; });
    denomFilterState.__other = false;
  }
  if (target.kind === "religion") {
    religionFilterState[target.key] = true;
    if (target.key === "christian" && christianBuckets) {
      christianBuckets.forEach((b) => { denomFilterState[b.code] = true; });
      denomFilterState.__other = true;
    }
  } else {
    denomFilterState[target.code] = true;
    religionFilterState.christian = true;
  }
  buildFilterUi();
  applyFilters();
}

async function runSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  const filterTarget = searchFilterTarget(query);
  if (filterTarget) {
    applySearchFilter(filterTarget);
    searchInput.value = "";
    setDockOpen(false);
    showClickHint(`Showing ${filterTarget.label} places only — tap ✕ to clear`, { durationMs: 3200 });
    return;
  }
  showClickHint("SEARCHING", { sticky: true });
  const presetMatch = findCityPresetMatch(query);
  if (presetMatch) {
    if (IS_MOBILE) {
      map.jumpTo({ center: presetMatch.coords, zoom: presetMatch.zoom || 10 });
    } else {
      flyTo(presetMatch.coords, presetMatch.zoom || 10);
    }
    scheduleSearchHintClear(presetMatch.coords);
    return;
  }
  try {
    const result = await geocode(query);
    if (!result) {
      showClickHint("No Results");
      return;
    }
    const lon = parseFloat(result.lon);
    const lat = parseFloat(result.lat);
    const zoom = result.precise ? 16 : 13;
    if (IS_MOBILE) {
      map.jumpTo({ center: [lon, lat], zoom });
    } else {
      flyTo([lon, lat], zoom);
    }
    if (result.precise) {
      // an address is a point: measure from it without asking. the hint
      // also replaces the sticky searching message, which setPin alone
      // leaves behind when it merely moves an existing pin.
      setPin({ lng: lon, lat: lat });
      showClickHint("Measuring pin dropped at the address — tap it to remove", { durationMs: 2600 });
    } else if (!maybeShowPinTip()) {
      scheduleSearchHintClear([lon, lat]);
    }
  } catch (error) {
    showClickHint("Search Unavailable, Use Scroll");
  }
}

// one nudge per session: area searches often precede distance questions.
// shown in place of the searching hint and self-expiring, so it neither
// races the arrival hint-clear nor nags.
function maybeShowPinTip() {
  if (pinLocation) return false;
  try {
    if (sessionStorage.getItem("pow-pin-tip")) return false;
    sessionStorage.setItem("pow-pin-tip", "1");
  } catch (error) {
    // private mode: once per page load is fine
  }
  const gesture = IS_MOBILE ? "press and hold the map" : "right-click the map";
  showClickHint(`Tip: ${gesture} to drop a measuring pin`, { durationMs: 3600 });
  return true;
}

searchButton.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});

const countsPanel = document.getElementById("counts");
const countsHint = document.getElementById("countsHint");
const countsList = document.getElementById("countsList");
const countsTotal = document.getElementById("countsTotal");
const countsToggle = document.getElementById("counts-toggle");
const countsHintDefault = countsHint ? countsHint.textContent : "";
const countLabels = [
  { key: "christian", label: "Christian", color: "#e11d48" },
  { key: "muslim", label: "Muslim", color: "#16a34a" },
  { key: "hindu", label: "Hindu", color: "#f97316" },
  { key: "buddhist", label: "Buddhist", color: "#facc15" },
  { key: "jewish", label: "Jewish", color: "#2563eb" },
  { key: "sikh", label: "Sikh", color: "#7c3aed" },
  { key: "shinto", label: "Shinto", color: "#ec4899" },
  { key: "taoist", label: "Taoist", color: "#06b6d4" },
  { key: "unknown", label: "Unknown", color: "#9ca3af" }
];
const EMPTY_COUNTS = {
  christian: 0,
  muslim: 0,
  hindu: 0,
  buddhist: 0,
  jewish: 0,
  sikh: 0,
  shinto: 0,
  taoist: 0,
  unknown: 0
};

// ---- search-panel filters ----------------------------------------------
// one clause builder feeds the layer filters, the counts key (which reads
// rendered features, so it follows the layer filter), and the nearest
// search. religion chips cover the palette; christian denominations group
// raw osm values through the taxonomy's alias table. the christian chip
// is the tri-state master of its denomination row, so the subtype
// relation is structural: picking anglican alone shows christian as
// partially on, and there is no way to select anglican without christian.
const KNOWN_RELIGIONS = countLabels.filter((c) => c.key !== "unknown").map((c) => c.key);
const CHRISTIAN_BUCKET_CODES = [
  "christian.anglican", "christian.catholic", "christian.presbyterian",
  "christian.methodist", "christian.baptist", "christian.pentecostal",
  "christian.orthodox", "christian.latter_day_saints"
];
const religionFilterState = {};
countLabels.forEach((c) => { religionFilterState[c.key] = true; });
const denomFilterState = { __other: true };
let christianBuckets = null; // [{ code, label, aliases }] from the taxonomy

async function loadDenominationBuckets() {
  try {
    // this page sits one level deeper than the global map
    // (apps/regions/nz/ vs apps/global/), so the taxonomy is three up
    const res = await fetch("../../../schemas/denomination-taxonomy.json");
    if (!res.ok) throw new Error(`taxonomy fetch ${res.status}`);
    const tax = await res.json();
    christianBuckets = CHRISTIAN_BUCKET_CODES.map((code) => {
      const entry = (tax.denominations || []).find((d) => d.code === code);
      if (!entry) return null;
      const en = (entry.labels || []).find((l) => l.lang === "en");
      return {
        code,
        label: en ? en.label.replace(/\s*\(.*\)$/, "") : code.split(".")[1],
        aliases: (entry.osm_aliases || []).map((a) => a.toLowerCase())
      };
    }).filter(Boolean);
    christianBuckets.forEach((b) => { denomFilterState[b.code] = true; });
  } catch (error) {
    // religion filters still work without the taxonomy
    christianBuckets = null;
  }
  // a shared link's filters apply once the bucket vocabulary is known
  const fromHash = readHashParam("f");
  if (fromHash) applyTokensToFilterState(fromHash.split(","));
  filtersBootstrapped = true;
  buildFilterUi();
  if (fromHash) applyFilters();
}

// christian participation derives from the denomination boxes
function christianTotals() {
  if (!christianBuckets) return null;
  const total = christianBuckets.length + 1; // + other christian
  const on = christianBuckets.filter((b) => denomFilterState[b.code]).length +
    (denomFilterState.__other ? 1 : 0);
  return { on, total };
}

function allFiltersOn() {
  const others = countLabels.every((c) => c.key === "christian" || religionFilterState[c.key]);
  const totals = christianTotals();
  const christianOn = totals ? totals.on === totals.total : Boolean(religionFilterState.christian);
  return others && christianOn;
}

function currentFilterClauses() {
  if (allFiltersOn()) return null;
  const rel = ["coalesce", ["get", "religion"], "unknown"];
  const totals = christianTotals();
  const christianFull = totals ? totals.on === totals.total : Boolean(religionFilterState.christian);
  const christianNone = totals ? totals.on === 0 : !religionFilterState.christian;
  const fullReligions = KNOWN_RELIGIONS.filter((k) =>
    k === "christian" ? christianFull : religionFilterState[k]);
  const otherChecked = Boolean(religionFilterState.unknown);
  const parts = [
    fullReligions.length ? ["match", rel, fullReligions, true, false] : false,
    otherChecked ? ["!", ["match", rel, KNOWN_RELIGIONS, true, false]] : false
  ];
  if (totals && !christianFull && !christianNone) {
    // partially-selected christianity: only the chosen buckets pass
    const aliases = christianBuckets.filter((b) => denomFilterState[b.code]).flatMap((b) => b.aliases);
    const denom = ["downcase", ["to-string", ["coalesce", ["get", "denomination"], ""]]];
    const denomMatch = aliases.length
      ? ["match", denom, aliases, true, Boolean(denomFilterState.__other)]
      : Boolean(denomFilterState.__other);
    parts.push(["all", ["==", rel, "christian"], denomMatch]);
  }
  return ["any", ...parts];
}

function applyFilters() {
  const clauses = currentFilterClauses();
  if (map.getLayer(LAYERS.places)) map.setFilter(LAYERS.places, clauses);
  if (map.getLayer(LAYERS.overview)) map.setFilter(LAYERS.overview, clauses);
  updateCounts();
  // no hash writes until the boot parse has run, or an early style.load
  // would erase a shared link's filter param before it is read
  if (filtersBootstrapped) writeHashParam("f", filterStateToTokens().join(","));
}
let filtersBootstrapped = false;

// ---- filters in the url ------------------------------------------------
// the fragment carries the off-list (#f=muslim,catholic,other) beside the
// camera, so a filtered view is shareable and citable. helpers handle the
// fragment as raw segments because the camera value contains slashes that
// urlsearchparams would re-encode.
function readHashParam(key) {
  const seg = location.hash.slice(1).split("&").find((s) => s.startsWith(key + "="));
  return seg ? decodeURIComponent(seg.slice(key.length + 1)) : null;
}
function writeHashParam(key, value) {
  const segs = location.hash.slice(1).split("&").filter((s) => s && !s.startsWith(key + "="));
  if (value) segs.push(key + "=" + value);
  const next = segs.length ? "#" + segs.join("&") : "#";
  if (next !== location.hash) history.replaceState(null, "", next);
}
function filterStateToTokens() {
  const off = countLabels.filter((c) => c.key !== "christian" && !religionFilterState[c.key]).map((c) => c.key);
  if (christianBuckets) {
    christianBuckets.forEach((b) => { if (!denomFilterState[b.code]) off.push(b.code.split(".")[1]); });
    if (!denomFilterState.__other) off.push("other");
  } else if (!religionFilterState.christian) {
    off.push("christian");
  }
  return off;
}
function applyTokensToFilterState(tokens) {
  const set = new Set(tokens.filter(Boolean));
  countLabels.forEach((c) => { if (c.key !== "christian") religionFilterState[c.key] = !set.has(c.key); });
  if (christianBuckets) {
    const wholeChristianOff = set.has("christian");
    christianBuckets.forEach((b) => {
      denomFilterState[b.code] = !(wholeChristianOff || set.has(b.code.split(".")[1]));
    });
    denomFilterState.__other = !(wholeChristianOff || set.has("other"));
    religionFilterState.christian = christianTotals().on > 0;
  } else {
    religionFilterState.christian = !set.has("christian");
  }
}

function clearFiltersIfAny() {
  if (allFiltersOn()) return;
  countLabels.forEach((c) => { religionFilterState[c.key] = true; });
  denomFilterState.__other = true;
  if (christianBuckets) christianBuckets.forEach((b) => { denomFilterState[b.code] = true; });
  buildFilterUi();
  applyFilters();
}

function filterChip(group, key, label, colour, state, onChange) {
  const chip = document.createElement("label");
  chip.className = "filter-chip" + (state[key] ? "" : " unchecked");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = Boolean(state[key]);
  box.addEventListener("change", () => {
    state[key] = box.checked;
    chip.classList.toggle("unchecked", !box.checked);
    onChange();
  });
  chip.appendChild(box);
  if (colour) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = colour;
    chip.appendChild(dot);
  }
  chip.appendChild(document.createTextNode(label));
  group.appendChild(chip);
}

// the row-leading box selects or clears everything, denominations
// included; the indeterminate dash shows a mixed state at a glance
function religionMasterChip(group) {
  const chip = document.createElement("label");
  chip.className = "filter-chip filter-chip-all";
  const box = document.createElement("input");
  box.type = "checkbox";
  const totals = christianTotals();
  let on = countLabels.filter((c) => c.key !== "christian" && religionFilterState[c.key]).length;
  let total = countLabels.length;
  if (totals) {
    on += totals.on > 0 ? (totals.on === totals.total ? 1 : 0.5) : 0;
  } else if (religionFilterState.christian) {
    on += 1;
  }
  box.checked = on === total;
  box.indeterminate = on > 0 && on < total;
  chip.classList.toggle("unchecked", on === 0);
  box.addEventListener("change", () => {
    const target = box.checked;
    countLabels.forEach((c) => { religionFilterState[c.key] = target; });
    if (christianBuckets) {
      christianBuckets.forEach((b) => { denomFilterState[b.code] = target; });
      denomFilterState.__other = target;
    }
    buildFilterUi();
    applyFilters();
  });
  chip.appendChild(box);
  chip.appendChild(document.createTextNode("All"));
  group.appendChild(chip);
}

// the christian chip doubles as the master of the denomination row
function christianMasterChip(group) {
  const c = countLabels.find((x) => x.key === "christian");
  const chip = document.createElement("label");
  chip.className = "filter-chip";
  const box = document.createElement("input");
  box.type = "checkbox";
  const totals = christianTotals();
  box.checked = totals.on === totals.total;
  box.indeterminate = totals.on > 0 && totals.on < totals.total;
  chip.classList.toggle("unchecked", totals.on === 0);
  box.addEventListener("change", () => {
    const target = box.checked;
    christianBuckets.forEach((b) => { denomFilterState[b.code] = target; });
    denomFilterState.__other = target;
    religionFilterState.christian = target;
    buildFilterUi();
    applyFilters();
  });
  chip.appendChild(box);
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = c.color;
  chip.appendChild(dot);
  chip.appendChild(document.createTextNode(c.label));
  group.appendChild(chip);
}

function onDenomChange() {
  // mirror any-on into the stored flag, then refresh so the christian
  // chip and the all box show the new mix
  religionFilterState.christian = christianTotals().on > 0;
  buildFilterUi();
  applyFilters();
}

function buildFilterUi() {
  const religionGroup = document.getElementById("religion-filters");
  const denomGroup = document.getElementById("denom-filters");
  if (!religionGroup || !denomGroup) return;
  religionGroup.innerHTML = "";
  denomGroup.innerHTML = "";
  religionMasterChip(religionGroup);
  countLabels.forEach((c) => {
    if (c.key === "christian" && christianBuckets) {
      christianMasterChip(religionGroup);
      return;
    }
    filterChip(religionGroup, c.key, c.label, c.color, religionFilterState, () => {
      buildFilterUi();
      applyFilters();
    });
  });
  if (christianBuckets) {
    christianBuckets.forEach((b) => {
      filterChip(denomGroup, b.code, b.label, null, denomFilterState, onDenomChange);
    });
    filterChip(denomGroup, "__other", "Other Christian", null, denomFilterState, onDenomChange);
  }
  syncDenomVisibility();
  syncFiltersToggleLabel();
}

function syncDenomVisibility() {
  const denomGroup = document.getElementById("denom-filters");
  if (!denomGroup) return;
  const totals = christianTotals();
  denomGroup.hidden = !(totals && totals.on > 0);
}

// collapsed by default so the panel stays spare; the label carries a
// count whenever anything is filtered, so collapsed filters are never
// invisible state
const filtersToggle = document.getElementById("filters-toggle");
function filtersOffCount() {
  let off = countLabels.filter((c) => c.key !== "christian" && !religionFilterState[c.key]).length;
  if (christianBuckets) {
    off += christianBuckets.filter((b) => !denomFilterState[b.code]).length +
      (denomFilterState.__other ? 0 : 1);
  } else if (!religionFilterState.christian) {
    off += 1;
  }
  return off;
}
function syncFiltersToggleLabel() {
  if (!filtersToggle) return;
  const wrap = document.getElementById("dock-filters");
  const open = wrap && !wrap.hidden;
  const off = filtersOffCount();
  filtersToggle.textContent = `Filters${off ? ` (${off} off)` : ""} ${open ? "▴" : "▾"}`;
  filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
  // the indicator chip carries closed-panel filter state
  const clearChip = document.getElementById("filters-clear");
  if (clearChip) {
    const show = off > 0 && !dockIsOpen();
    clearChip.hidden = !show;
    if (show) clearChip.textContent = `${off} off ✕`;
  }
}
const filtersClearChip = document.getElementById("filters-clear");
if (filtersClearChip) {
  filtersClearChip.addEventListener("click", () => {
    clearFiltersIfAny();
    showClickHint("Filters cleared");
  });
}
if (filtersToggle) {
  filtersToggle.addEventListener("click", () => {
    const wrap = document.getElementById("dock-filters");
    if (!wrap) return;
    wrap.hidden = !wrap.hidden;
    syncFiltersToggleLabel();
  });
}

// religion chips render immediately; the denomination row joins when
// the taxonomy fetch lands, so a quick first tap never finds an empty
// panel on a slow connection
buildFilterUi();
loadDenominationBuckets();

const COUNTS_MIN_INTERVAL_MS = 160;
let countsUserEnabled = false;
let countsLastUpdate = 0;
let countsScheduled = false;

// compact pull-down: three colour dots hint at the palette, the panel
// holds the full key. dots follow the top categories in view.
let countsTopThree = null;
function syncCountsToggleLabel() {
  if (!countsToggle) return;
  const top = countsTopThree && countsTopThree.length ? countsTopThree : countLabels.slice(0, 3);
  countsToggle.innerHTML =
    top.map((c) => `<span class="key-dot" style="background:${c.color}"></span>`).join("") +
    `<span class="key-label">Key</span>` +
    `<span class="key-caret" aria-hidden="true">${countsUserEnabled ? "▴" : "▾"}</span>`;
  countsToggle.setAttribute("aria-expanded", countsUserEnabled ? "true" : "false");
  countsToggle.setAttribute("aria-label", countsUserEnabled ? "Hide denomination key" : "Show denomination key");
}

if (countsToggle) {
  syncCountsToggleLabel();
  countsToggle.addEventListener("click", () => {
    if (countsToggle.disabled) return;
    countsUserEnabled = !countsUserEnabled;
    syncCountsToggleLabel();
    updateCounts();
  });
}

function renderCounts(counts) {
  countsList.innerHTML = "";
  let total = 0;
  countLabels.forEach(({ key, label, color }) => {
    const value = counts[key] || 0;
    total += value;
    const item = document.createElement("li");
    item.innerHTML =
      `<span class="legend"><span class="dot" style="background:${color}"></span>${label}</span>` +
      `<span>${value.toLocaleString()}</span>`;
    countsList.appendChild(item);
  });
  countsTotal.textContent = `Total: ${total.toLocaleString()}`;
  // feed the toggle's hint dots with the categories that lead this view
  const ranked = countLabels
    .filter((c) => (counts[c.key] || 0) > 0)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
    .slice(0, 3);
  countsTopThree = ranked.length ? ranked : null;
  syncCountsToggleLabel();
}

function updateCounts() {
  // no isStyleLoaded() gate: it skips UI sync during repaints; the
  // rendered-feature query below already guards on layer presence
  if (countsScheduled) return;
  const now = performance.now();
  const elapsed = now - countsLastUpdate;
  if (elapsed < COUNTS_MIN_INTERVAL_MS) {
    countsScheduled = true;
    setTimeout(() => {
      countsScheduled = false;
      updateCounts();
    }, COUNTS_MIN_INTERVAL_MS - elapsed);
    return;
  }
  countsScheduled = true;
  requestAnimationFrame(() => {
    countsScheduled = false;
    countsLastUpdate = performance.now();
    const zoom = map.getZoom();
    const eligibleZoom = zoom >= 4;
    if (countsToggle) {
      countsToggle.style.display = "inline-flex";
      const disableToggle = !eligibleZoom && !IS_MOBILE;
      countsToggle.disabled = disableToggle;
      countsToggle.setAttribute("aria-disabled", disableToggle ? "true" : "false");
      if (!eligibleZoom && disableToggle) {
        syncCountsToggleLabel();
        countsToggle.setAttribute("aria-expanded", "false");
      } else {
        syncCountsToggleLabel();
      }
    }
    if (!eligibleZoom) {
      if (!countsUserEnabled) {
        countsPanel.style.display = "none";
        if (countsHint) countsHint.style.display = "none";
        return;
      }
      countsPanel.style.display = "block";
      if (countsHint) {
        countsHint.style.display = "block";
        if (IS_MOBILE) {
          countsHint.textContent = "Zoom in for live counts";
        } else {
          countsHint.textContent = countsHintDefault;
        }
      }
      if (IS_MOBILE) {
        countsList.style.display = "grid";
        countsTotal.style.display = "block";
        renderCounts(EMPTY_COUNTS);
      } else {
        countsList.style.display = "none";
        countsTotal.style.display = "none";
      }
      return;
    }
    if (!countsUserEnabled) {
      countsPanel.style.display = "none";
      return;
    }
    countsPanel.style.display = "block";
    if (countsHint) {
      countsHint.style.display = "none";
      countsHint.textContent = countsHintDefault;
    }
    countsList.style.display = "grid";
    countsTotal.style.display = "block";
    const preferredLayer = zoom < 6 ? LAYERS.overview : LAYERS.places;
    if (!map.getLayer(preferredLayer)) return;
    const features = map.queryRenderedFeatures({ layers: [preferredLayer] });
    const counts = { ...EMPTY_COUNTS };
    features.forEach((feature) => {
      const key = feature.properties?.religion || "unknown";
      if (counts[key] === undefined) {
        counts.unknown += 1;
      } else {
        counts[key] += 1;
      }
    });
    renderCounts(counts);
  });
}

let tileTimer = null;
function showTileStatus() {
  tileStatus.classList.add("visible");
  if (tileTimer) clearTimeout(tileTimer);
  tileTimer = setTimeout(() => tileStatus.classList.remove("visible"), 2200);
}

// ── census overlay: area choropleths ────────────────────────────────
// consumes the governed area-summary products declared in
// REGION_CONFIG.censusLevels: each level joins a summary (rows keyed on
// area_code x year) to its boundary file on the level's codeProp. a
// level whose summary carries no metric values yet renders the
// boundaries-only scaffold instead of a choropleth.
const CENSUS = {
  source: "nz-census",
  fill: "nz-census-fill",
  line: "nz-census-line",
  hover: "nz-census-hover"
};
// each level is a governed area-summary product plus its boundary file;
// join key and display name are properties of that boundary set
const CENSUS_LEVELS = RC.censusLevels;
// base metric definitions are shared across every country; a country whose
// construct differs (for example, adherents reported by religious bodies
// rather than a census self-identification question) overrides label/note
// text per metric via RC.metricLabels, and can hide metrics that make no
// sense for its construct via RC.metricsAvailable — the metric key, kind,
// and value formatting never change, so existing countries are unaffected
// when neither config field is present
const CENSUS_METRICS_BASE = {
  religious_affiliation_percent: {
    label: "Religious affiliation %",
    kind: "seq",
    format: (v) => `${v.toFixed(1)}%`,
    note: "share of the stated religion-response denominator"
  },
  no_religion_percent: {
    label: "No religion %",
    kind: "seq",
    format: (v) => `${v.toFixed(1)}%`,
    note: "share of the stated religion-response denominator"
  },
  places_per_10000_residents: {
    label: "Places per 10,000",
    kind: "seq",
    format: (v) => v.toFixed(1),
    note: "current place counts repeated across census years"
  },
  place_density_per_sq_km: {
    label: "Places per km²",
    kind: "seq",
    format: (v) => v.toFixed(2),
    note: "current place counts repeated across census years"
  },
  religious_change: {
    label: "Religious affiliation change",
    kind: "div",
    format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} pt`,
    note: "percentage-point change since the previous census"
  }
};
function buildCensusMetrics() {
  const allow = Array.isArray(RC.metricsAvailable) ? RC.metricsAvailable : null;
  const overrides = RC.metricLabels || {};
  const out = {};
  for (const [id, def] of Object.entries(CENSUS_METRICS_BASE)) {
    if (allow && !allow.includes(id)) continue;
    const override = overrides[id];
    out[id] = override ? { ...def, ...override } : def;
  }
  return out;
}
const CENSUS_METRICS = buildCensusMetrics();
const censusState = {
  enabled: false,
  // the level, metric and year the overlay opens on (config): a country
  // opens on whichever metric carries data today
  level: RC.defaultLevel,
  metric: RC.defaultMetric,
  year: RC.defaultYear,
  // per-level stores: { geojson, rows, byAreaYear, years, domains, hasFlags, loading }
  levels: {}
};

const censusToggle = document.getElementById("census-toggle");
const censusPanel = document.getElementById("census-panel");
const censusLevelSelect = document.getElementById("censusLevel");
const censusMetricSelect = document.getElementById("censusMetric");
const censusYearSelect = document.getElementById("censusYear");
const censusLegend = document.getElementById("census-legend");

// census is on by default; the centre Census button opens and closes its
// data panel (options, colour key, slider) rather than toggling the layer
let censusPanelOpen = true;
function syncCensusPanel() {
  if (censusPanel) censusPanel.hidden = !censusPanelOpen;
  if (censusToggle) {
    censusToggle.setAttribute("aria-expanded", censusPanelOpen ? "true" : "false");
    const caret = censusToggle.querySelector(".census-caret");
    if (caret) caret.textContent = censusPanelOpen ? "▴" : "▾";
  }
}

function censusActive() {
  return censusState.levels[censusState.level] || null;
}
function censusLevelDef() {
  return CENSUS_LEVELS[censusState.level];
}
// unified timeline: a country whose eras live on different boundary
// levels (the us runs 1850-2020 across six county vintages) declares
// RC.timeline = [{year, level}, ...]. the slider then spans every era
// and switches geography level automatically as the year crosses an
// era boundary. without the config the slider spans the active level's
// years, as before.
const CENSUS_TIMELINE = Array.isArray(RC.timeline)
  ? RC.timeline.slice().sort((a, b) => a.year - b.year)
  : null;
function censusSliderYears() {
  if (CENSUS_TIMELINE) return CENSUS_TIMELINE.map((t) => t.year);
  const store = censusActive();
  return store ? store.years : [];
}
// dragging across an era boundary triggers an async level load; the
// token keeps a stale load from clobbering the latest requested year
let censusYearRequestToken = 0;
function requestCensusYear(year) {
  if (!Number.isFinite(year)) return;
  const token = ++censusYearRequestToken;
  const entry = CENSUS_TIMELINE && CENSUS_TIMELINE.find((t) => t.year === year);
  if (entry && entry.level !== censusState.level) {
    void setCensusLevel(entry.level).then(() => {
      if (token === censusYearRequestToken) setCensusYear(year);
    });
    return;
  }
  setCensusYear(year);
}
// rr3 makes percentages on small denominators volatile, and suppressed
// cells carry no value at all; both wash out instead of implying precision
function rowFlagged(row) {
  return typeof row?.quality_flag === "string" &&
    (row.quality_flag.includes("suppressed_denominator") ||
      row.quality_flag.includes("rr3_small_denominator") ||
      row.quality_flag.includes("boundary_change_crosswalked"));
}
function metricUsesDenominator(metric) {
  return metric !== "place_density_per_sq_km";
}

// three-stop ramps: sequential blues for levels, orange-to-blue
// diverging for change. interpolation in srgb is fine at this scale.
const SEQ_STOPS = [[224, 242, 254], [59, 130, 246], [30, 58, 138]];
const DIV_STOPS = [[194, 65, 12], [241, 245, 249], [29, 78, 216]];
function rampColour(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const mix = stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}
function rampGradient(stops) {
  return `linear-gradient(to right, ${stops.map((s) => `rgb(${s[0]}, ${s[1]}, ${s[2]})`).join(", ")})`;
}

// change is computed against the previous census; the first year has none
function censusValue(code, year, metric) {
  const store = censusActive();
  if (!store) return null;
  return storeValue(store, code, year, metric);
}

function censusWashed(code, year, metric) {
  if (!metricUsesDenominator(metric)) return false;
  const store = censusActive();
  if (!store) return false;
  if (metric === "religious_change") {
    const idx = store.years.indexOf(year);
    if (idx <= 0) return true;
    return rowFlagged(store.byAreaYear.get(`${code}|${year}`)) ||
      rowFlagged(store.byAreaYear.get(`${code}|${store.years[idx - 1]}`));
  }
  return rowFlagged(store.byAreaYear.get(`${code}|${year}`));
}

// domains span all years so colours stay comparable across the year
// selector, exclude washed rows, and clamp to the 2nd-98th percentile so
// a handful of extreme small-area values cannot compress the national
// palette; the diverging domain is symmetric about zero
function quantileOf(sorted, p) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function computeCensusDomains(store) {
  const domains = {};
  const clamped = {};
  for (const metric of Object.keys(CENSUS_METRICS)) {
    const values = [];
    for (const row of store.rows) {
      if (metricUsesDenominator(metric) && rowFlagged(row)) continue;
      const v = storeValue(store, row.area_code, row.year, metric);
      if (v !== null) values.push(v);
    }
    if (!values.length) continue;
    values.sort((a, b) => a - b);
    if (CENSUS_METRICS[metric].kind === "div") {
      const magnitudes = values.map(Math.abs).sort((a, b) => a - b);
      const m = quantileOf(magnitudes, 0.98);
      domains[metric] = [-m, m];
      clamped[metric] = magnitudes[magnitudes.length - 1] > m;
    } else {
      const lo = quantileOf(values, 0.02);
      const hi = quantileOf(values, 0.98);
      domains[metric] = [lo, hi];
      clamped[metric] = values[0] < lo || values[values.length - 1] > hi;
    }
  }
  store.domains = domains;
  store.clamped = clamped;
}

// value lookup against an explicit store, usable before the store is
// installed as the active level
function storeValue(store, code, year, metric) {
  if (metric === "religious_change") {
    const idx = store.years.indexOf(year);
    if (idx <= 0) return null;
    const now = store.byAreaYear.get(`${code}|${year}`);
    const prev = store.byAreaYear.get(`${code}|${store.years[idx - 1]}`);
    if (!now || !prev) return null;
    const a = now.religious_affiliation_percent;
    const b = prev.religious_affiliation_percent;
    // guard the operands: JS coerces null to 0, so null - null is 0, not
    // NaN — a suppressed denominator must not read as zero change, and a
    // fully-pending level would otherwise fake an all-zero domain
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a - b;
  }
  const row = store.byAreaYear.get(`${code}|${year}`);
  const v = row ? row[metric] : null;
  return Number.isFinite(v) ? v : null;
}

function syncCensusYearSelect() {
  const store = censusActive();
  if (!censusYearSelect || !store) return;
  const previous = String(censusState.year);
  censusYearSelect.innerHTML = "";
  [...store.years].sort((a, b) => b - a).forEach((y) => {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = String(y);
    censusYearSelect.appendChild(option);
  });
  censusYearSelect.value = previous;
  if (censusYearSelect.value !== previous) {
    censusYearSelect.selectedIndex = 0;
    censusState.year = Number(censusYearSelect.value);
  }
}

async function loadCensusData(level) {
  const existing = censusState.levels[level];
  if (existing && (existing.geojson || existing.loading)) return existing.geojson;
  const def = CENSUS_LEVELS[level];
  const store = { geojson: null, rows: [], byAreaYear: new Map(), years: [], domains: {}, hasFlags: false, loading: true };
  censusState.levels[level] = store;
  showClickHint("Loading census boundaries…");
  try {
    const [boundariesRes, summaryRes] = await Promise.all([
      fetch(def.boundaries),
      fetch(def.summary)
    ]);
    if (!boundariesRes.ok || !summaryRes.ok) throw new Error("census fetch failed");
    const summary = await summaryRes.json();
    store.geojson = await boundariesRes.json();
    store.rows = summary.rows || [];
    store.byAreaYear = new Map(store.rows.map((r) => [`${r.area_code}|${r.year}`, r]));
    store.years = [...new Set(store.rows.map((r) => r.year))].sort((a, b) => a - b);
    store.hasFlags = store.rows.some(rowFlagged);
    computeCensusDomains(store);
  } catch (err) {
    store.geojson = null;
    showClickHint("Census data failed to load");
  } finally {
    store.loading = false;
  }
  return store.geojson;
}

function censusFillExpression() {
  const { metric, year } = censusState;
  const store = censusActive();
  const def = censusLevelDef();
  const [min, max] = store.domains[metric] || [0, 1];
  const stops = CENSUS_METRICS[metric].kind === "div" ? DIV_STOPS : SEQ_STOPS;
  const expr = ["match", ["get", def.codeProp]];
  for (const feature of store.geojson.features) {
    const code = feature.properties[def.codeProp];
    const v = censusValue(code, year, metric);
    // no value (change at the first census, suppressed cells) or a
    // flagged denominator washes out instead of implying precision
    expr.push(code, v === null || censusWashed(code, year, metric)
      ? "rgba(148, 163, 184, 0.25)"
      : rampColour(stops, max === min ? 0.5 : Math.min(1, Math.max(0, (v - min) / (max - min)))));
  }
  expr.push("rgba(0, 0, 0, 0)");
  return expr;
}

// points keep priority: census layers slide beneath the lowest point layer
function censusBeforeId() {
  return [LAYERS.overview, LAYERS.polygonsFill, LAYERS.buildingsFill, LAYERS.places]
    .find((id) => map.getLayer(id));
}

let censusHandlersAttached = false;
function addCensusLayers() {
  const store = censusActive();
  if (!censusState.enabled || !store || !store.geojson) return;
  if (map.getLayer(CENSUS.fill)) return;
  if (!map.getSource(CENSUS.source)) {
    map.addSource(CENSUS.source, {
      type: "geojson",
      data: store.geojson,
      attribution: RC.censusSourceAttribution
    });
  }
  const codeProp = censusLevelDef().codeProp;
  const beforeId = censusBeforeId();
  map.addLayer({
    id: CENSUS.fill,
    type: "fill",
    source: CENSUS.source,
    paint: { "fill-color": censusFillExpression(), "fill-opacity": 0.55 }
  }, beforeId);
  map.addLayer({
    id: CENSUS.line,
    type: "line",
    source: CENSUS.source,
    paint: { "line-color": "rgba(15, 23, 42, 0.4)", "line-width": 0.8 }
  }, beforeId);
  map.addLayer({
    id: CENSUS.hover,
    type: "line",
    source: CENSUS.source,
    filter: ["==", ["get", codeProp], ""],
    paint: { "line-color": "#0f172a", "line-width": 2.2 }
  }, beforeId);
  attachCensusHandlers();
}

function removeCensusLayers() {
  [CENSUS.hover, CENSUS.line, CENSUS.fill].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(CENSUS.source)) map.removeSource(CENSUS.source);
}

function placeUnderCursor(point) {
  const placeLayers = [LAYERS.places, LAYERS.overview].filter((id) => map.getLayer(id));
  return placeLayers.length > 0 &&
    map.queryRenderedFeatures(point, { layers: placeLayers }).length > 0;
}

function attachCensusHandlers() {
  if (censusHandlersAttached) return;
  censusHandlersAttached = true;
  const censusHoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "280px",
    offset: 10
  });
  map.on("mousemove", CENSUS.fill, (e) => {
    if (!censusState.enabled) return;
    const feature = e.features && e.features[0];
    if (!feature) return;
    const codeProp = censusLevelDef().codeProp;
    // places win the cursor: clear area affordances under a point
    if (placeUnderCursor(e.point)) {
      map.setFilter(CENSUS.hover, ["==", ["get", codeProp], ""]);
      censusHoverPopup.remove();
      return;
    }
    const code = feature.properties[codeProp];
    map.setFilter(CENSUS.hover, ["==", ["get", codeProp], code]);
    const def = CENSUS_METRICS[censusState.metric];
    const v = censusValue(code, censusState.year, censusState.metric);
    const washed = censusWashed(code, censusState.year, censusState.metric);
    const valueText = v === null
      ? "no data"
      : def.format(v) + (washed ? " · small denominator" : "");
    censusHoverPopup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-weight:600;">${feature.properties[censusLevelDef().nameProp]}</div>` +
        `<div>${def.label} (${censusState.year}): ${valueText}</div>`
      )
      .addTo(map);
  });
  map.on("mouseleave", CENSUS.fill, () => {
    if (map.getLayer(CENSUS.hover)) {
      map.setFilter(CENSUS.hover, ["==", ["get", censusLevelDef().codeProp], ""]);
    }
    censusHoverPopup.remove();
  });
  map.on("click", CENSUS.fill, (e) => {
    if (!censusState.enabled) return;
    const feature = e.features && e.features[0];
    if (!feature) return;
    if (placeUnderCursor(e.point)) return;
    openCensusPopup(feature, e.lngLat);
  });
}

function openCensusPopup(feature, lngLat) {
  const store = censusActive();
  const levelDef = censusLevelDef();
  const code = feature.properties[levelDef.codeProp];
  const name = feature.properties[levelDef.nameProp];
  // boundaries-only scaffold: no row for this area carries a denominator,
  // so show the area and its pending status rather than a table of dashes
  const areaHasData = store.years.some((year) => {
    const row = store.byAreaYear.get(`${code}|${year}`);
    return row && Number.isFinite(row.population_total);
  });
  if (!areaHasData) {
    // religion is pending, but place-of-worship density is computed
    const row = store.byAreaYear.get(`${code}|${censusState.year}`);
    const placeInfo = row && Number.isFinite(row.place_count)
      ? `<div class="place-attrs">` +
          `<div class="place-attr"><span class="place-attr-key">Places of worship</span><span class="place-attr-val">${row.place_count}</span></div>` +
          `<div class="place-attr"><span class="place-attr-key">Land area</span><span class="place-attr-val">${row.land_area_sq_km.toFixed(0)} km²</span></div>` +
          `<div class="place-attr"><span class="place-attr-key">Density</span><span class="place-attr-val">${row.place_density_per_sq_km.toFixed(3)} / km²</span></div>` +
        `</div>`
      : "";
    const html =
      `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
      placeInfo +
      `<div class="place-note">Place density from OpenStreetMap. Census religious-affiliation data is pending for this area.</div>` +
      `<div class="place-note">${levelDef.credit} · places © OpenStreetMap (ODbL)</div>`;
    trackPlacePopup(new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(lngLat).setHTML(html).addTo(map));
    return;
  }
  const fmtPercent = (v) => (Number.isFinite(v) ? `${v.toFixed(1)}%` : "–");
  const fmtRate = (v) => (Number.isFinite(v) ? v.toFixed(1) : "–");
  const fmtCount = (v) => (Number.isFinite(v) ? v : "–");
  // no-religion is a NZ/VU-style census-question construct; a country whose
  // metricsAvailable omits it (for example, the US adherents/congregations
  // construct, where absence of reported adherence is not "no religion")
  // drops the column entirely rather than showing dashes
  const hasNoReligion = "no_religion_percent" in CENSUS_METRICS;
  // popup headers keep the original short words unless a country
  // explicitly overrides the metric labels (byte-identical NZ/VU popups)
  const affiliationLabel = RC.metricLabels?.religious_affiliation_percent?.label || "Religious";
  const noReligionLabel = RC.metricLabels?.no_religion_percent?.label || "No religion";
  // the place columns come from the area summary's OSM-derived counts; a
  // country that hides the place metrics (no extraction pass yet) drops
  // the columns and the OSM credit instead of showing dashes
  const hasPlaces = "places_per_10000_residents" in CENSUS_METRICS ||
    "place_density_per_sq_km" in CENSUS_METRICS;
  let anyFlagged = false;
  const rowsHtml = store.years.map((year) => {
    const row = store.byAreaYear.get(`${code}|${year}`);
    if (!row) return "";
    const flagged = rowFlagged(row);
    if (flagged) anyFlagged = true;
    const selected = year === censusState.year ? ' class="census-year-selected"' : "";
    return `<tr${selected}>
      <td>${year}${flagged ? "*" : ""}</td>
      <td>${fmtPercent(row.religious_affiliation_percent)}</td>
      ${hasNoReligion ? `<td>${fmtPercent(row.no_religion_percent)}</td>` : ""}
      ${hasPlaces ? `<td>${fmtCount(row.place_count)}</td><td>${fmtRate(row.places_per_10000_residents)}</td>` : ""}
    </tr>`;
  }).join("");
  const flagNote = anyFlagged
    ? `<div class="place-note">${RC.censusFlagNote}</div>`
    : "";
  const html =
    `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
    `<table class="census-table">` +
    `<thead><tr><th>Census</th><th>${affiliationLabel}</th>${hasNoReligion ? `<th>${noReligionLabel}</th>` : ""}${hasPlaces ? "<th>Places</th><th>Per 10k</th>" : ""}</tr></thead>` +
    `<tbody>${rowsHtml}</tbody></table>` +
    flagNote +
    `<div class="place-note">${RC.popupDenominatorNote || "Percentages use the stated religion-response denominator."}` +
    `${hasPlaces ? " Place counts are the current snapshot repeated across census years." : ""}</div>` +
    `<div class="place-note">${levelDef.credit}${hasPlaces ? " · places © OpenStreetMap (ODbL)" : ""}</div>`;
  const popup = new maplibregl.Popup({ maxWidth: "380px" })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);
  trackPlacePopup(popup);
}

// today's OSM snapshot is honest only near the present: when the census
// year sits more than PLACE_SNAPSHOT_HORIZON years back, the dot layers
// fade hard and the legend says why — historical place layers must come
// from accepted events (docs/development/temporal-place-layer.md), not
// from pretending the present is the past
const PLACE_SNAPSHOT_HORIZON = 15;
function placeSnapshotStale() {
  return censusState.enabled &&
    (new Date().getFullYear() - censusState.year) > PLACE_SNAPSHOT_HORIZON;
}
const DATED = { source: "pow-dated", layer: "pow-dated-points" };
let datedHandlersAttached = false;
function addDatedPlacesLayer() {
  if (!RC.datedPlaces || map.getSource(DATED.source)) return;
  map.addSource(DATED.source, { type: "geojson", data: RC.datedPlaces });
  map.addLayer({
    id: DATED.layer,
    type: "circle",
    source: DATED.source,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.2, 9, 5.2, 16, 7.0],
      "circle-color": religionColors,
      "circle-opacity": 0.9,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#d68910"
    }
  });
  if (!datedHandlersAttached) {
    datedHandlersAttached = true;
    map.on("click", DATED.layer, (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const pr = f.properties || {};
      const name = pr.name || "Unnamed place";
      const span = `${pr.start_year || "?"}–${pr.end_year || "present"}`;
      const [lng, lat] = f.geometry.coordinates;
      const popup = new maplibregl.Popup({ maxWidth: "320px" })
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
          `<div class="place-attrs">` +
          (pr.religion ? `<div class="place-attr"><span class="place-attr-key">Religion</span><span class="place-attr-val">${pr.religion}</span></div>` : "") +
          (pr.denomination ? `<div class="place-attr"><span class="place-attr-key">Denomination</span><span class="place-attr-val">${pr.denomination}</span></div>` : "") +
          `<div class="place-attr"><span class="place-attr-key">Dated</span><span class="place-attr-val">${span}</span></div>` +
          `</div>` +
          `<div class="place-note">Dates from OpenStreetMap tags — provisional until reviewed evidence replaces them.</div>` +
          `<div class="popup-actions">` +
          `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}" target="_blank" rel="noopener">Streetview</a>` +
          `<a href="https://www.openstreetmap.org/${pr.osm_type}/${pr.osm_id}" target="_blank" rel="noopener">Open OSM</a>` +
          `</div>`
        )
        .addTo(map);
      trackPlacePopup(popup);
    });
    map.on("mouseenter", DATED.layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", DATED.layer, () => { map.getCanvas().style.cursor = ""; });
  }
}
function syncDatedPlaces(stale) {
  if (!RC.datedPlaces) return;
  addDatedPlacesLayer();
  if (!map.getLayer(DATED.layer)) return;
  if (stale) {
    // open-ended places carry end_year as an explicit null (the key is
    // present), so ["has","end_year"] is true for them; test the value for
    // null as well, or every still-open place would be filtered out.
    map.setFilter(DATED.layer, ["all",
      ["has", "start_year"],
      ["<=", ["get", "start_year"], censusState.year],
      ["any",
        ["!", ["has", "end_year"]],
        ["==", ["get", "end_year"], null],
        [">=", ["get", "end_year"], censusState.year]]
    ]);
    map.setLayoutProperty(DATED.layer, "visibility", "visible");
  } else {
    map.setLayoutProperty(DATED.layer, "visibility", "none");
  }
}

function syncPlaceDotEra() {
  const stale = placeSnapshotStale();
  try { syncDatedPlaces(stale); } catch (e) { /* dated layer is optional */ }
  const overviewBase = RC.overviewDotOpacity ?? 0.75;
  const ov = stale ? overviewBase * 0.15 : overviewBase;
  if (map.getLayer(LAYERS.overview)) {
    map.setPaintProperty(LAYERS.overview, "circle-opacity",
      ["interpolate", ["linear"], ["zoom"], 0, ov, 5, ov, 6, 0.0]);
  }
  if (map.getLayer(LAYERS.places)) {
    const censusFirst = censusState.enabled && !stale;
    map.setPaintProperty(LAYERS.places, "circle-opacity", stale
      ? ["interpolate", ["linear"], ["zoom"], 6, 0.05, 9, 0.2, 12, 0.18, 18, 0.18]
      : censusFirst
        ? ["interpolate", ["linear"], ["zoom"], 6, 0.08, 8, 0.45, 9, 0.85, 12, 0.75, 18, 0.7]
        : ["interpolate", ["linear"], ["zoom"], 6, 0.2, 9, 0.85, 12, 0.75, 18, 0.7]);
  }
}

function applyCensusPaint() {
  if (map.getLayer(CENSUS.fill)) {
    map.setPaintProperty(CENSUS.fill, "fill-color", censusFillExpression());
  }
  syncPlaceDotEra();
  updateCensusLegend();
}

function updateCensusLegend() {
  if (!censusLegend) return;
  const scale = document.getElementById("census-legend-scale");
  const store = censusActive();
  const domain = store && store.domains[censusState.metric];
  if (!censusState.enabled || !store || !store.geojson) {
    censusLegend.hidden = true;
    return;
  }
  // boundaries-only state: areas are mapped but no metric has values yet.
  // show the areas and say so, rather than hiding the panel.
  const hasAnyData = Object.keys(store.domains || {}).length > 0;
  if (!domain && !hasAnyData) {
    const years = (store.years || []).join(" · ");
    censusLegend.hidden = false;
    scale.innerHTML =
      `<div class="census-legend-title">${censusLevelDef().label} boundaries</div>` +
      `<div class="census-legend-note">Census religious-affiliation data is pending. ` +
      `The areas are ready to receive it.</div>` +
      (years ? `<div class="census-legend-note">Census years: ${years}</div>` : "");
    return;
  }
  // this metric has no values, but others do (religion metrics can be
  // pending while place density is live): say so for this metric
  if (!domain) {
    const def = CENSUS_METRICS[censusState.metric];
    censusLegend.hidden = false;
    scale.innerHTML =
      `<div class="census-legend-title">${censusLevelDef().label}: ${def.label}</div>` +
      `<div class="census-legend-note">No data for this metric yet — religious-affiliation counts are pending.</div>`;
    return;
  }
  const def = CENSUS_METRICS[censusState.metric];
  const stops = def.kind === "div" ? DIV_STOPS : SEQ_STOPS;
  const washNote = store.hasFlags && metricUsesDenominator(censusState.metric)
    ? `<div class="census-legend-note">pale areas: small or suppressed denominators</div>`
    : "";
  const dotEraNote = placeSnapshotStale()
    ? `<div class="census-legend-note">place dots show today's OpenStreetMap places, not ${censusState.year} places${RC.datedPlaces ? ` — amber-ringed dots carry OpenStreetMap date tags saying they existed in ${censusState.year}` : " — historical place layers are being assembled from evidence"}</div>`
    : "";
  // the ramp clamps at the 2nd-98th percentile; mark the ends when
  // values continue beyond them
  const isClamped = store.clamped && store.clamped[censusState.metric];
  const loLabel = (isClamped ? "≤ " : "") + def.format(domain[0]);
  const hiLabel = (isClamped ? "≥ " : "") + def.format(domain[1]);
  censusLegend.hidden = false;
  // only the scale child is rewritten; the time slider below it persists
  scale.innerHTML =
    `<div class="census-legend-title">${censusLevelDef().label}: ${def.label} (${censusState.year})</div>` +
    `<div class="census-legend-bar" style="background:${rampGradient(stops)}"></div>` +
    `<div class="census-legend-range"><span>${loLabel}</span><span>${hiLabel}</span></div>` +
    `<div class="census-legend-note">${def.note}</div>` +
    washNote +
    dotEraNote;
  markActiveTick();
}

// ── census time slider ─────────────────────────────────────────────
// the slider drives censusState.year through setCensusYear, the single
// entry point that keeps the slider thumb and the paint in step
function setCensusYear(year) {
  if (!Number.isFinite(year)) return;
  const changed = year !== censusState.year;
  censusState.year = year;
  if (censusYearSelect) censusYearSelect.value = String(year);
  syncCensusTimeValue();
  if (changed) applyCensusPaint();
}

// rebuild the slider structure for the timeline (or the active level's
// year set when no timeline is configured)
function syncCensusTimeSlider() {
  const timeEl = document.getElementById("census-time");
  const store = censusActive();
  if (!timeEl || !store) return;
  const years = censusSliderYears();
  // a slider needs at least two stops, and at least one metric with data
  // to animate; the boundaries-only scaffold has neither use for it
  const hasAnyData = Object.keys(store.domains || {}).length > 0;
  if (years.length < 2 || !hasAnyData) {
    timeEl.hidden = true;
    timeEl.innerHTML = "";
    return;
  }
  const idx = Math.max(0, years.indexOf(censusState.year));
  const panel = document.getElementById("census-panel");
  if (panel) panel.classList.toggle("census-long", years.length >= 6);
  timeEl.hidden = false;
  timeEl.innerHTML =
    `<div class="census-time-row">` +
      `<input id="census-slider" class="census-slider" type="range" min="0" max="${years.length - 1}" step="1" value="${idx}" aria-label="Census year">` +
    `</div>` +
    `<div class="census-ticks">${years.map((y) => `<span data-year="${y}">${y}</span>`).join("")}</div>`;
  attachCensusTimeListeners();
  markActiveTick();
}

// keep the slider thumb on the active year without rebuilding the markup
function syncCensusTimeValue() {
  const store = censusActive();
  const slider = document.getElementById("census-slider");
  if (!store || !slider) return;
  const idx = censusSliderYears().indexOf(censusState.year);
  if (idx >= 0 && String(idx) !== slider.value) slider.value = String(idx);
  markActiveTick();
}

function markActiveTick() {
  const ticks = document.querySelectorAll("#census-time .census-ticks span");
  ticks.forEach((span) => {
    span.classList.toggle("census-tick-active", Number(span.dataset.year) === censusState.year);
  });
}

function attachCensusTimeListeners() {
  const slider = document.getElementById("census-slider");
  if (slider) {
    slider.addEventListener("input", () => {
      requestCensusYear(censusSliderYears()[Number(slider.value)]);
    });
  }
}

async function setCensusEnabled(on) {
  censusState.enabled = on;
  if (on) {
    const data = await loadCensusData(censusState.level);
    if (!data) {
      censusState.enabled = false;
      updateCensusLegend();
      return;
    }
    syncCensusYearSelect();
    syncCensusTimeSlider();
    addCensusLayers();
    applyCensusPaint();
  } else {
    removeCensusLayers();
    syncPlaceDotEra();
    updateCensusLegend();
  }
}

// switching geography swaps the source and rejoins; each level's data
// loads once and is cached for the session
async function setCensusLevel(level) {
  if (!CENSUS_LEVELS[level] || level === censusState.level) return;
  censusState.level = level;
  if (censusLevelSelect) censusLevelSelect.value = level;
  if (!censusState.enabled) return;
  removeCensusLayers();
  const data = await loadCensusData(level);
  if (!data) {
    updateCensusLegend();
    return;
  }
  syncCensusYearSelect();
  syncCensusTimeSlider();
  addCensusLayers();
  applyCensusPaint();
}

if (censusToggle) {
  syncCensusPanel();
  censusToggle.addEventListener("click", () => {
    censusPanelOpen = !censusPanelOpen;
    syncCensusPanel();
  });
}
if (censusLevelSelect) {
  for (const [id, def] of Object.entries(CENSUS_LEVELS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = def.label;
    censusLevelSelect.appendChild(option);
  }
  censusLevelSelect.value = censusState.level;
  censusLevelSelect.addEventListener("change", () => {
    void setCensusLevel(censusLevelSelect.value);
  });
}
if (censusMetricSelect) {
  for (const [id, def] of Object.entries(CENSUS_METRICS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = def.label;
    censusMetricSelect.appendChild(option);
  }
  censusMetricSelect.value = censusState.metric;
  censusMetricSelect.addEventListener("change", () => {
    censusState.metric = censusMetricSelect.value;
    applyCensusPaint();
  });
}

map.on("movestart", showTileStatus);
map.on("moveend", () => {
  updateCounts();
  ensureCustomLayers();
});
map.on("zoomstart", showTileStatus);
map.on("zoomend", () => {
  updateCounts();
  ensureCustomLayers();
});
map.on("styledata", showTileStatus);
