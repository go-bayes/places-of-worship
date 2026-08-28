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
// the whole country-specific surface: copy, camera, census levels, geocode
// bias, cross-links. everything below reads this and the data products.
const RC = window.REGION_CONFIG;
if (!RC) {
  throw new Error("REGION_CONFIG missing");
}
document.title = RC.title;

// depth-sensitive bases: country pages sit one level deeper than the
// global map, so every hub/handoff/manifest path rides regionsBase and
// the taxonomy rides schemaBase — no runtime path counting
const REGIONS_BASE = RC.regionsBase || "../";
const SCHEMA_BASE = RC.schemaBase || "../../../schemas/";

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
    .map((link) => `<a id="${link.id}" href="${link.href}" ${link.external ? 'target="_blank" rel="noopener" ' : ""}title="${link.title}">${link.label}</a>`)
    .join("\n    ");
  // key wrapper: the global map keeps its top-centre #counts-wrap (styled
  // by maplibre-flat.css, which every surface loads); country pages keep
  // #top-left-controls verbatim (styled by region-map.css)
  const keyWrapOpen = RC.keyPlacement === "top-centre"
    ? `<div id="counts-wrap" class="shell-top-centre">`
    : `<div id="top-left-controls">`;
  // census chrome renders only where a page declares census or overlay
  // data; tested on RC directly because the chrome renders before
  // CENSUS_LEVELS binds. a censusless page (the global map) gets no
  // census element at all, which is what keeps the census machinery inert
  const hasCensusConfig = Boolean(RC.censusLevels || RC.overlays);
  const censusChrome = hasCensusConfig ? `  <!-- census data control: options, colour key and time slider; front and
       centre (jb 2026-07-09) now the top strip has room. the pill is split:
       the census-data half toggles the panel, the points half is the place-
       dot mode select promoted out of the panel so it cannot be missed -->
  <div id="top-center-controls">
  <div id="census-wrap">
    <div id="data-pill" class="shell-pill">
      <button id="census-toggle" type="button" aria-controls="census-panel" aria-expanded="true">
        <span class="census-label-long">Show ${RC.dataNoun || "Census"} Data</span><span class="census-label-short">${RC.dataNoun || "Census"}</span><span class="census-caret" aria-hidden="true">▴</span>
      </button>
      <span id="census-partial-tag" hidden>Partial layer</span>
      <select id="censusPoints" class="shell-pill-select" aria-label="Place dots"></select>
    </div>
    <div id="census-panel">
      <!-- phone-only dismiss: the panel covers half a phone screen, and
           field-testing (jb 2026-07-16) showed the census button's caret
           is not discovered as the way to clear it; the X collapses via
           the same state as the button, which stays the reopen path -->
      <button id="census-close" type="button" aria-label="Hide the data panel"><span aria-hidden="true">×</span></button>
      <!-- dataset passport: the panel names its own contents — who measured,
           what construct, which geography and wave — with the evidence one
           tap away (design record: docs/development/sidebar-design-space-2026-07.md) -->
      <div id="census-passport" hidden></div>
      <div id="census-options">
        <!-- domain select: hidden until a page declares two or more
             overlay domains (multi-domain-overlay-design.md §3) -->
        <select id="censusDomain" aria-label="Data domain" hidden></select>
        <select id="censusSource" aria-label="Data source" hidden></select>
        <select id="censusMetric" aria-label="${RC.dataNoun || "Census"} metric"></select>
        <select id="censusLevel" aria-label="${RC.dataNoun || "Census"} geography"></select>
      </div>
      <div id="census-points-row">
        <label id="census-points-future" hidden>
          <input id="censusPointsFuture" type="checkbox">
          <span>show later foundations</span>
        </label>
      </div>
      <div id="census-partial-note" hidden></div>
      <div id="census-legend">
        <div id="census-legend-scale"></div>
        <div id="census-time" hidden></div>
      </div>
      <details id="census-evidence" hidden>
        <summary>About these data</summary>
        <div id="census-evidence-body"></div>
      </details>
    </div>
  </div>
  </div>` : "";
  root.innerHTML = `
  <div id="map"></div>
  <div id="tile-status">Loading tiles…</div>
  <div id="click-hint" class="shell-toast" role="status" aria-live="polite"></div>
  <div id="onboard" role="dialog" aria-label="${RC.onboarding.ariaLabel || "About this map"}">
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
    <a id="fixmap-link" href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener" title="Improve this map area on OpenStreetMap">fix OSM map</a>
    <select id="basemapSelect" class="shell-pill-select" aria-label="Theme"></select>
  </div>
  <button id="corner-reset" class="shell-pill shell-top-right" type="button" aria-label="Set North">
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
    <div id="datamaps-pill" class="shell-pill" aria-live="polite">
      <a id="datamaps-go" href="${REGIONS_BASE}" title="Country data maps"><span class="dm-label-long">Data Maps</span><span class="dm-label-short">Data</span></a>
      <button id="datamaps-caret" type="button" aria-label="Search all country data maps"><span class="dm-caret-word">Countries</span><span class="dm-caret-glyph" aria-hidden="true">▴</span></button>
    </div>
  </div>
  <!-- top-left: the denomination key for the place dots -->
  ${keyWrapOpen}
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
  </div>
${censusChrome}
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

// guard after the chrome injection, so a blocked or failed maplibre CDN
// load still leaves the wordmark, onboarding, and navigation on screen
// instead of a blank page (the map itself cannot boot either way)
if (!window.maplibregl) {
  throw new Error("MapLibre missing");
}

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
// keyless fallback basemap: openstreetmap standard tiles replaced the
// carto endpoint, which now watermarks every tile with "API KEY REQUIRED";
// the internal id stays "carto-light" so saved basemap preferences and the
// maptiler-failure fallback keep working
const cartoStyle = {
  id: "carto-light",
  label: "OpenStreetMap",
  style: {
    version: 8,
    name: "OpenStreetMap",
    sources: {
      "carto-light": {
        type: "raster",
        tiles: [
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
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
// default to maptiler's backdrop theme (jb 2026-07-09): terrain-shaded
// with buildings, streets, and the topographic features places sit in;
// dataviz stays selectable for a quieter canvas under the choropleth.
// fall back to the free carto style when no maptiler key is configured;
// the error handler below also drops to carto if maptiler credit runs out
const DEFAULT_BASEMAP_ID = "backdrop";
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
// tap-to-expand disc on phones, where the corner shares the pill line.
// the project-licence line rides every page; per-product source terms
// recorded in the manifests prevail where they differ (LICENSE.md)
map.addControl(new maplibregl.AttributionControl({
  customAttribution: '<strong>Project compilation <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></strong>'
}), "bottom-right");

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
  // the label popup instance is reused across shows: reset any dragged
  // offset and any drag-pinned anchor so every show opens at its anchor.
  // the drag call below is guard-safe — setHTML retains the content
  // element, so the module wires it once and only resets gesture state
  // on repeat calls
  pinnedLabel.setOffset([0, 0]);
  pinnedLabel.options.anchor = undefined;
  pinnedLabel
    .setLngLat(coords)
    .setHTML(`<div style="font-weight:600;color:inherit;">${name}</div>`)
    .addTo(map);
  makePopupDraggable(pinnedLabel);
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
  makePopupDraggable(popup);
  popup.on("close", () => {
    if (activePlacePopup === popup) activePlacePopup = null;
  });
}

// ── popup offset helpers ────────────────────────────────────────────
// the popup's current anchor: the configured one, or the auto-chosen
// one read from the wrapper element's anchor class
function popupAnchorOf(popup) {
  if (popup.options.anchor) return popup.options.anchor;
  const el = popup.getElement ? popup.getElement() : null;
  const m = el ? /maplibregl-popup-anchor-([a-z-]+)/.exec(el.className) : null;
  return m ? m[1] : "center";
}
// pin the auto-chosen anchor before applying an offset that must hold:
// a map pan re-chooses the auto anchor, and an anchor flip mirrors any
// held offset (an offset change alone never re-anchors in 3.6.1)
function pinPopupAnchor(popup) {
  if (popup.options.anchor) return;
  const el = popup.getElement ? popup.getElement() : null;
  const m = el ? /maplibregl-popup-anchor-([a-z-]+)/.exec(el.className) : null;
  if (m) popup.options.anchor = m[1];
}
// maplibre popup offsets take three forms — a number (radial, resolved
// per anchor), a PointLike, or a per-anchor object. resolve the
// effective x/y for the popup's current anchor so drags and clamps
// compose with a pre-set offset instead of discarding it
function resolvePopupOffset(popup) {
  const anchor = popupAnchorOf(popup);
  let o = popup.options.offset;
  if (o && typeof o === "object" && !Array.isArray(o) && o.x === undefined) {
    o = o[anchor] !== undefined ? o[anchor] : 0; // per-anchor object
  }
  if (typeof o === "number") {
    // maplibre's radial convention: the offset points away from the
    // anchored edge, with corners at sqrt(1/2) of the distance
    const c = Math.round(Math.sqrt(0.5 * o * o));
    const byAnchor = {
      center: [0, 0],
      top: [0, o], "top-left": [c, c], "top-right": [-c, c],
      bottom: [0, -o], "bottom-left": [c, -c], "bottom-right": [-c, -c],
      left: [o, 0], right: [-o, 0]
    };
    o = byAnchor[anchor] || [0, 0];
  }
  if (Array.isArray(o)) return { x: o[0] || 0, y: o[1] || 0 };
  if (o && typeof o === "object") return { x: o.x || 0, y: o.y || 0 };
  return { x: 0, y: 0 };
}

// popups drag like the pills (same start threshold, all pointer types,
// and trailing-click suppression), but by adjusting the maplibre offset,
// so the popup stays anchored to its feature: it pans and zooms with the
// map, displaced by the drag, and may leave the viewport — no clamping.
// touch works because the popup content carries touch-action: none, so
// the browser hands the gesture to us instead of claiming it for panning.
// nothing persists: every popup opens fresh at its anchor. the anchor
// is pinned when a real drag begins, leaving undragged popups on stock
// auto-anchor behaviour.
const POPUP_DRAG_WIRED = new WeakSet();
function makePopupDraggable(popup) {
  const el = popup.getElement ? popup.getElement() : null;
  const content = el ? el.querySelector(".maplibregl-popup-content") : null;
  if (!content) return;
  // maplibre's setHTML retains the content element and clears only its
  // children, so a reused popup (the pinned label) presents the same
  // element on every show: wire once, and only reset the gesture state
  // on repeat calls — rewiring would stack listeners and multiply drags
  if (POPUP_DRAG_WIRED.has(content)) {
    if (content._powDragReset) content._powDragReset();
    return;
  }
  POPUP_DRAG_WIRED.add(content);
  let startX = 0, startY = 0, baseX = 0, baseY = 0;
  let pointerId = null, captureEl = null;
  let dragging = false, moved = false, suppressClick = false;
  let dragThreshold = 4;
  // shared cleanup: end any gesture WITHOUT arming click suppression (a
  // cancelled pointer fires no trailing click, so arming would swallow
  // the next legitimate one) and always restore text selection
  const abortDrag = () => {
    if (captureEl) { try { captureEl.releasePointerCapture(pointerId); } catch (_) { /* already released */ } }
    captureEl = null;
    dragging = false; moved = false;
    document.body.style.userSelect = "";
  };
  content._powDragReset = () => { abortDrag(); suppressClick = false; };
  // the pinned label's timer can remove the popup mid-drag: end the
  // gesture and restore the page then too
  popup.on("close", abortDrag);
  content.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    // links, controls and the street view pane keep their own gestures
    if (t.closest("a, button, select, input, textarea, .streetview")) return;
    // finger jitter overshoots the mouse threshold, so touch gets more slack
    dragThreshold = e.pointerType === "touch" ? 10 : 4;
    startX = e.clientX; startY = e.clientY;
    dragging = true; moved = false; suppressClick = false;
    pointerId = e.pointerId;
    captureEl = t;
    try { t.setPointerCapture(e.pointerId); } catch (_) { /* capture unsupported */ }
    // the popup sits inside the map container: keep the press from
    // arming the map's own drag-pan
    e.stopPropagation();
  });
  content.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < dragThreshold) return; // under threshold: still a click
    if (!moved) {
      moved = true;
      // pin the anchor, then resolve whatever offset the popup already
      // carries (number, PointLike, or per-anchor object) as the base
      // the drag composes with — resolved against the pinned anchor
      pinPopupAnchor(popup);
      const base = resolvePopupOffset(popup);
      baseX = base.x; baseY = base.y;
      document.body.style.userSelect = "none";
    }
    popup.setOffset([baseX + dx, baseY + dy]);
  });
  content.addEventListener("pointerup", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    if (moved) {
      suppressClick = true; // a real drag: swallow the click it fires
      // a mouse drag fires its trailing click at once, but a touch or pen
      // drag fires none at all — disarm shortly after, or the stale flag
      // would swallow the next legitimate tap on the popup
      setTimeout(() => { suppressClick = false; }, 150);
    }
    abortDrag();
  });
  // a cancelled pointer produces no trailing click: end without arming
  content.addEventListener("pointercancel", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    abortDrag();
  });
  // capture loss (element leaving the DOM, OS-level grabs) ends the
  // drag too; after a normal release this is a no-op
  content.addEventListener("lostpointercapture", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    abortDrag();
  });
  // capture-phase so the click dies before any inner button/link handler runs
  content.addEventListener("click", (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
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
  // keep the popup on-screen by adjusting its offset, never its lngLat:
  // it stays anchored to its feature and pans with the map. pin the
  // anchor first so a later auto re-anchor cannot mirror the shift, and
  // compose with any offset already applied (a preset in any maplibre
  // form, or a drag's) instead of clobbering it
  pinPopupAnchor(popup);
  const base = resolvePopupOffset(popup);
  popup.setOffset([base.x + dx, base.y + dy]);
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
  // dragging comes from trackPlacePopup's universal offset drag; the old
  // per-popup setLngLat drag (which detached the popup from its feature)
  // is gone
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
  map.once("idle", async () => {
    if (HAS_CENSUS) await setCensusEnabled(true);
    // navigation prefetch starts only after the default boundary and summary
    // have completed, so speculative requests never contend with map data
    window.__DATAMAP_FIRST_IDLE__ = true;
    document.dispatchEvent(new CustomEvent("datamap:first-idle"));
  });
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
        "button, a, input, select, textarea, label, #dock, #counts-wrap, #key-wrap, #census-wrap, #wordmark, #corner-refresh, .maplibregl-ctrl"
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
// silence the card everywhere; the global map overrides via config to
// keep its pre-convergence dismissals (short-circuit leaves countryCode
// unread on a homeless config)
const ONBOARD_STORAGE_KEY = RC.onboardStorageKey || `pow-${RC.countryCode.toLowerCase()}-onboard-dismissed`;
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
  clearDragTransforms(); // reset also snaps any dragged pills back home
  // reset restores the whole initial state (jb 2026-07-16): any travel
  // offer drops at once (not at the flight's end) and the census layer
  // returns if it was toggled off. the toggle renders only where the
  // offer engine is armed — an unarmed pill stays the panel trigger
  handoffTapTarget = null;
  if (handoffRegions) setOffer(HANDOFF_HOME && HAS_CENSUS ? "toggle" : "resting", null);
  if (!censusState.enabled) void setCensusEnabled(true);
  // resurface the onboarding card (jb 2026-07-09): reset is how a visitor
  // recovers the how-to and the about-this-map link after dismissing it
  showOnboard();
  resetPageZoom();
  showClickHint("Map reset");
}
if (cornerRefresh) cornerRefresh.addEventListener("click", resetSite);

// page pinch-zoom is distinct from the map's own zoom: it scales the
// layout viewport, stranding the fixed chrome outside the visible area
// with no obvious way back (jb 2026-07-17). two recoveries: the reset
// button follows the visible corner while the page is zoomed, and reset
// itself re-clamps the page scale to 1 by briefly pinning the viewport
// meta — then restores it, so pinch zoom (an accessibility affordance)
// stays available.
function resetPageZoom() {
  const vv = window.visualViewport;
  if (!vv || vv.scale <= 1.02) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const original = meta.getAttribute("content");
  meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
  window.setTimeout(() => meta.setAttribute("content", original), 250);
  window.scrollTo(0, 0);
}
if (window.visualViewport && cornerRefresh) {
  const vv = window.visualViewport;
  let followRaf = 0;
  const followViewport = () => {
    followRaf = 0;
    if (vv.scale > 1.02) {
      cornerRefresh.style.left = (vv.offsetLeft + 10) + "px";
      cornerRefresh.style.top = (vv.offsetTop + vv.height - cornerRefresh.offsetHeight - 10) + "px";
      cornerRefresh.style.bottom = "auto";
    } else {
      cornerRefresh.style.left = "";
      cornerRefresh.style.top = "";
      cornerRefresh.style.bottom = "";
    }
  };
  const queueFollow = () => { if (!followRaf) followRaf = requestAnimationFrame(followViewport); };
  vv.addEventListener("resize", queueFollow);
  vv.addEventListener("scroll", queueFollow);
}

// draggable floating pills: mouse, pen and touch (the pill chrome carries
// touch-action: none, so a touch drag reaches us instead of being claimed by
// the browser; the flanks around the pills still pan the map). the wrap
// carries the inline transform so its drop-down panel travels with it. a
// start threshold (4px mouse/pen, 10px touch) keeps a tap a click; past it
// the gesture is a drag and its trailing click is swallowed so the pill
// never toggles on release. a touch drop glides to the nearest screen edge
// (free placement strands pills over the map centre on phones); mouse and
// pen keep free placement. double-tapping a displaced pill sends just that
// pill home without resetting the rest of the map.
// the search dock joins the drag roster (jb 2026-07-17): its input and
// selects never start drags, and the width-only resize guard keeps the
// phone keyboard from snapping a moved dock home
const DRAG_SELECTORS = ["#census-wrap", "#key-wrap", "#wordmark", "#dock"];
const DRAG_MARGIN = 8; // keep dragged boxes at least this far inside the viewport

// snap every pill home by dropping its inline transform (reset + resize)
function clearDragTransforms() {
  DRAG_SELECTORS.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) { el.style.transition = ""; el.style.transform = ""; }
  });
}

// one teaching toast per session, shown on the first press-and-hold of a
// pill; a completed drag also marks it seen — that user needs no teaching
const PILL_HINT_KEY = "pow-pill-drag-hint";
function pillHintPending() {
  try { return !sessionStorage.getItem(PILL_HINT_KEY); } catch (_) { return false; }
}
function markPillHintSeen() {
  try { sessionStorage.setItem(PILL_HINT_KEY, "1"); } catch (_) { /* private mode */ }
}

// ease an inline-transform change, then drop the transition so the next
// live drag stays 1:1 (pointermove writes transforms directly)
function glideTo(el, transform) {
  el.style.transition = "transform 220ms ease";
  el.style.transform = transform;
  setTimeout(() => { el.style.transition = ""; }, 260);
}

// wire one wrap for pointer dragging; closes over its own gesture state
function makeDraggable(el) {
  if (!el) return;
  let startX = 0, startY = 0, baseX = 0, baseY = 0;
  let layoutLeft = 0, layoutTop = 0, boxW = 0, boxH = 0;
  let pointerId = null, captureEl = null;
  let dragging = false, moved = false, suppressClick = false;
  let dragThreshold = 4;
  let touchDrag = false;
  let holdTimer = null;
  let lastTapAt = 0, lastTapX = 0, lastTapY = 0;

  // read the offset already applied so a second drag continues from there
  const readOffset = () => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || "");
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  };

  const clearHoldTimer = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  // after a touch drop, glide along one axis to the nearest screen edge;
  // the layout values captured at pointerdown make this transform-agnostic
  const snapToNearestEdge = () => {
    const off = readOffset();
    const left = layoutLeft + off.x, top = layoutTop + off.y;
    const dLeft = left - DRAG_MARGIN;
    const dRight = window.innerWidth - DRAG_MARGIN - boxW - left;
    const dTop = top - DRAG_MARGIN;
    const dBottom = window.innerHeight - DRAG_MARGIN - boxH - top;
    let nx = off.x, ny = off.y;
    const nearest = Math.min(dLeft, dRight, dTop, dBottom);
    if (nearest === dLeft) nx = DRAG_MARGIN - layoutLeft;
    else if (nearest === dRight) nx = window.innerWidth - DRAG_MARGIN - boxW - layoutLeft;
    else if (nearest === dTop) ny = DRAG_MARGIN - layoutTop;
    else ny = window.innerHeight - DRAG_MARGIN - boxH - layoutTop;
    glideTo(el, `translate(${nx}px, ${ny}px)`);
  };

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    // native selects/inputs open on mousedown, so never drag from them
    if (t.closest("select, input")) return;
    // the key list scrolls on phones: a touch there scrolls, never drags
    // (the key still moves by its pill; mouse drags keep working anywhere)
    if (e.pointerType === "touch" && t.closest("#counts")) return;
    // a drag must track the pointer 1:1, never ease after a snap
    el.style.transition = "";
    touchDrag = e.pointerType === "touch";
    // finger jitter overshoots the mouse threshold, so touch gets more slack
    dragThreshold = touchDrag ? 10 : 4;
    const off = readOffset();
    const rect = el.getBoundingClientRect();
    // layout position with zero transform, so clamping is transform-agnostic
    layoutLeft = rect.left - off.x;
    layoutTop = rect.top - off.y;
    boxW = rect.width; boxH = rect.height;
    baseX = off.x; baseY = off.y;
    startX = e.clientX; startY = e.clientY;
    dragging = true; moved = false; suppressClick = false;
    pointerId = e.pointerId;
    // capture on the hit element (it has pointer-events; the wrap may not)
    captureEl = t;
    try { t.setPointerCapture(e.pointerId); } catch (_) { /* capture unsupported */ }
    if (pillHintPending()) {
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!dragging || moved) return;
        markPillHintSeen();
        showClickHint("Drag to move — double-tap sends it home", { durationMs: 2600 });
      }, 450);
    }
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < dragThreshold) return; // under threshold: still a click
    if (!moved) {
      moved = true;
      clearHoldTimer();
      markPillHintSeen();
    }
    let nx = baseX + dx, ny = baseY + dy;
    nx = Math.min(Math.max(nx, DRAG_MARGIN - layoutLeft), window.innerWidth - DRAG_MARGIN - boxW - layoutLeft);
    ny = Math.min(Math.max(ny, DRAG_MARGIN - layoutTop), window.innerHeight - DRAG_MARGIN - boxH - layoutTop);
    el.style.transform = `translate(${nx}px, ${ny}px)`;
  });

  const endDrag = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    clearHoldTimer();
    if (captureEl) { try { captureEl.releasePointerCapture(pointerId); } catch (_) { /* already released */ } }
    captureEl = null;
    if (moved) {
      suppressClick = true; // a real drag: swallow the click it fires
      // a mouse drag fires its trailing click at once, but a touch or pen
      // drag fires none at all — disarm shortly after, or the stale flag
      // would swallow the next legitimate tap on the pill
      setTimeout(() => { suppressClick = false; }, 150);
      // a cancelled pointer keeps the pill where the gesture left it
      if (touchDrag && e.type === "pointerup") snapToNearestEdge();
      return;
    }
    if (e.type !== "pointerup") return;
    // double-tap on a displaced pill sends just that pill home; the taps
    // still toggle the pill's panel twice, which nets to no change
    const now = Date.now();
    if (el.style.transform && now - lastTapAt < 350 &&
        Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
      glideTo(el, "");
      lastTapAt = 0;
    } else {
      lastTapAt = now; lastTapX = e.clientX; lastTapY = e.clientY;
    }
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  // capture-phase so the click dies before any inner button/link handler runs
  el.addEventListener("click", (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

DRAG_SELECTORS.forEach((sel) => makeDraggable(document.querySelector(sel)));
// a resize can strand a dragged pill off-screen, so snap them all home —
// but only when the width changes (rotation, a real window resize): on
// phones the on-screen keyboard fires a height-only resize, and opening
// search must not discard the user's arrangement
let lastViewportWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastViewportWidth) return;
  lastViewportWidth = window.innerWidth;
  clearDragTransforms();
});

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
  // country-first where a page declares a geocode bias; the global map
  // declares none, so world search stays unbiased
  const nominatimCountry = RC.geocode && RC.geocode.country ? `&countrycodes=${RC.geocode.country}` : "";
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0${nominatimCountry}&q=${encodeURIComponent(query)}${emailParam}`;
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
  const maptilerCountry = RC.geocode && RC.geocode.country ? `&country=${RC.geocode.country}` : "";
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(MAPTILER_API_KEY)}&limit=1${maptilerCountry}`;
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
  // bias results toward the country; photon has no hard country filter,
  // and a page without a declared bias (the global map) sends none
  const photonBias = RC.geocode && RC.geocode.biasLngLat ? `&lat=${RC.geocode.biasLngLat[1]}&lon=${RC.geocode.biasLngLat[0]}` : "";
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1${photonBias}`;
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
const keyWrap = document.getElementById("key-wrap");
// set by syncKeyToDots when "Points: off" leaves the key describing
// nothing; updateCounts folds it into the toggle's disabled state
let keyDotsOff = false;
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
    // the schema base absorbs the page-depth difference: country pages
    // sit three up from schemas/, the global map two up (config)
    const res = await fetch(SCHEMA_BASE + "denomination-taxonomy.json");
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
      const disableToggle = (!eligibleZoom || keyDotsOff) && !IS_MOBILE;
      countsToggle.disabled = disableToggle;
      countsToggle.setAttribute("aria-disabled", disableToggle ? "true" : "false");
      countsToggle.title = keyDotsOff ? "Place dots are off" : "";
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
  hatch: "nz-census-hatch",
  line: "nz-census-line",
  hover: "nz-census-hover"
};
// ---- overlay domains -------------------------------------------------
// the overlay registry (design: docs/development/multi-domain-overlay-
// design.md; build record: overlay-registry-phase1-2026-07-17.md).
// RC.overlays maps domain id -> block; when absent, the PERMANENT legacy
// shim builds a single religion domain from the top-level keys, so all
// existing pages derive byte-identical values and never migrate.
function normaliseOverlayDomains(rc) {
  if (rc.overlays && typeof rc.overlays === "object" && Object.keys(rc.overlays).length) {
    const out = {};
    for (const [id, block] of Object.entries(rc.overlays)) {
      if (!block || typeof block !== "object" || !block.levels) continue;
      out[id] = block;
    }
    if (Object.keys(out).length) return out;
  }
  return {
    religion: {
      label: "Religion",
      levels: rc.censusLevels,
      defaultLevel: rc.defaultLevel,
      defaultMetric: rc.defaultMetric,
      defaultYear: rc.defaultYear,
      timeline: rc.timeline,
      metricLabels: rc.metricLabels,
      metricsAvailable: rc.metricsAvailable
    }
  };
}
const OVERLAY_DOMAINS = normaliseOverlayDomains(RC);
// religion leads when present (it carries the place dots); otherwise the
// config's first declared domain opens
let activeDomainId = OVERLAY_DOMAINS.religion ? "religion" : Object.keys(OVERLAY_DOMAINS)[0];
function activeDomain() {
  return OVERLAY_DOMAINS[activeDomainId];
}

// each level is a governed area-summary product plus its boundary file;
// join key and display name are properties of that boundary set.
// domain-scoped: rebound by setOverlayDomain when a page declares more
// than one domain; under the legacy shim these never rebind
let CENSUS_LEVELS = activeDomain().levels;
// the census absence key: a page with no censusLevels and no overlays (the
// global map) forecloses every census entry point through this one
// predicate; every live country page declares non-empty levels, so the
// guards keyed on it are unreachable there
const HAS_CENSUS = Boolean(CENSUS_LEVELS && Object.keys(CENSUS_LEVELS).length);
// base metric definitions are shared across every country; a country whose
// construct differs (for example, adherents reported by religious bodies
// rather than a census self-identification question) overrides label/note
// text per metric via RC.metricLabels, and can hide metrics that make no
// sense for its construct via RC.metricsAvailable — the metric key, kind,
// and value formatting never change, so existing countries are unaffected
// when neither config field is present.
// counts-only products (a source that publishes member counts but no area
// denominator, for example Norway's SSB diocese series) opt in to the two
// count metrics by listing religious_affiliation_count and, when the series
// is annual, religious_affiliation_count_change in RC.metricsAvailable —
// both are optIn, so a page that does not list them is byte-identical to
// the pre-count runtime; the count change is a difference of counts and is
// never labelled in percentage points
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
  },
  // denomination shares (opt-in: shown only for a country that lists them in
  // metricsAvailable, so countries without a denomination breakdown are
  // unaffected). Vanuatu carries all five back to the 1967 first census
  customary_beliefs_percent: {
    label: "Customary beliefs %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share reporting customary (kastom) beliefs"
  },
  presbyterian_percent: {
    label: "Presbyterian %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Presbyterian Church"
  },
  anglican_percent: {
    label: "Anglican %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Anglican Church"
  },
  catholic_percent: {
    label: "Catholic %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Roman Catholic Church"
  },
  seventh_day_adventist_percent: {
    label: "Seventh-day Adventist %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Seventh-day Adventist Church"
  },
  // Saint Vincent's division tables print eleven Christian-denomination
  // share columns; the seven below join the opt-in family for them.
  // Presbyterian/Congregational is the table's own combined category and
  // stays distinct from the plain presbyterian_percent above
  baptist_spiritual_percent: {
    label: "Baptist (Spiritual) %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Baptist (Spiritual) denomination"
  },
  evangelical_percent: {
    label: "Evangelical %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with Evangelical churches"
  },
  jehovahs_witness_percent: {
    label: "Jehovah's Witness %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with Jehovah's Witnesses"
  },
  methodist_percent: {
    label: "Methodist %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Methodist Church"
  },
  pentecostal_percent: {
    label: "Pentecostal %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with Pentecostal churches"
  },
  presbyterian_congregational_percent: {
    label: "Presbyterian/Congregational %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with Presbyterian or Congregational churches"
  },
  salvation_army_percent: {
    label: "Salvation Army %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with the Salvation Army"
  },
  other_christian_percent: {
    label: "Other Christian %", kind: "seq", optIn: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "share affiliated with other Christian denominations"
  },
  // count metrics (opt-in): for products whose source publishes counts with
  // no area denominator, so no share metric would be honest. The count is
  // the row's religious_affiliation_count; the change is a difference of
  // counts between consecutive years in the series, never percentage points
  religious_affiliation_count: {
    label: "Membership (count)", kind: "seq", optIn: true,
    format: (v) => Math.round(v).toLocaleString("en"),
    note: "administrative membership count; the source publishes no area population denominator"
  },
  religious_affiliation_count_change: {
    label: "Membership change (count)", kind: "div", optIn: true,
    format: (v) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en")}`,
    note: "change in the membership count since the previous year in the series"
  },
  // building-register count (opt-in): for products whose only indicator is a
  // register of places (Bhutan's dzongkhag institutions), where mapping the
  // count onto a membership field would misstate the construct. The value is
  // the row's place_count as published; no denominator exists, so no share
  place_count: {
    label: "Places (count)", kind: "seq", optIn: true,
    format: (v) => Math.round(v).toLocaleString("en"),
    note: "register count of places; the source publishes no population denominator"
  }
};
// when a country sets metricsAvailable, its order also sets the dropdown
// order (so a country can lead with its most informative metric); otherwise
// the base order stands and opt-in metrics stay hidden
function buildCensusMetrics() {
  const domain = activeDomain();
  const allow = Array.isArray(domain.metricsAvailable) ? domain.metricsAvailable : null;
  const overrides = domain.metricLabels || {};
  const withOverride = (id) => {
    const def = CENSUS_METRICS_BASE[id];
    if (!def) return null;
    const override = overrides[id];
    return override ? { ...def, ...override } : def;
  };
  const out = {};
  if (allow) {
    for (const id of allow) {
      const def = withOverride(id);
      if (def) out[id] = def;
    }
  } else {
    for (const [id, def] of Object.entries(CENSUS_METRICS_BASE)) {
      if (def.optIn) continue;
      const override = overrides[id];
      out[id] = override ? { ...def, ...override } : def;
    }
  }
  return out;
}
let CENSUS_METRICS = buildCensusMetrics();
const censusState = {
  enabled: false,
  // the active overlay domain; single-domain pages never change it
  domain: activeDomainId,
  // the level, metric and year the overlay opens on (config): a country
  // opens on whichever metric carries data today
  level: activeDomain().defaultLevel,
  metric: activeDomain().defaultMetric,
  year: activeDomain().defaultYear,
  // per-level stores: { geojson, rows, byAreaYear, years, domains, hasFlags, loading }
  levels: {}
};

// ---- census view in the url ----------------------------------------
// the fragment carries the census view (#d=metric:year) beside the
// camera and the filters, so a border handoff — and any shared link —
// lands on the construct and wave the traveller was reading (roam v1,
// design record: docs/development/datamaps-pill-review-2026-07.md).
// an unknown metric falls back to this country's default; a year the
// arrival level lacks clamps to the nearest available wave on load.
// geography level never carries: levels do not correspond across
// countries, so the arrival keeps its own default.
(function applyCarriedCensusView() {
  const carried = readHashParam("d");
  if (!carried) return;
  const [metric, year] = carried.split(":");
  if (metric && CENSUS_METRICS[metric]) censusState.metric = metric;
  const y = Number(year);
  if (Number.isInteger(y) && y >= 1000 && y <= 9999) censusState.year = y;
})();
function writeCensusHash() {
  const carriable = censusState.enabled && !pulotuState.active;
  writeHashParam("d", carriable ? `${censusState.metric}:${censusState.year}` : null);
}

const censusToggle = document.getElementById("census-toggle");
const censusPanel = document.getElementById("census-panel");
const censusLevelSelect = document.getElementById("censusLevel");
const censusMetricSelect = document.getElementById("censusMetric");
const censusSourceSelect = document.getElementById("censusSource");
const censusYearSelect = document.getElementById("censusYear");
const censusLegend = document.getElementById("census-legend");

// census is on by default; the centre Census button opens and closes its
// data panel (options, colour key, slider) rather than toggling the layer.
// phones remember a dismissal for the session (tribunal 2026-07-17 item 4):
// the panel teaches on the first visit; once closed via the x or the census
// button, later country pages open with the choropleth on and the panel
// folded. an explicit reopen clears the memory — the state follows the last
// gesture. desktop keeps the always-open default.
const CENSUS_PANEL_DISMISSED_KEY = "pow-census-panel-dismissed";
function censusPanelDismissalRemembered() {
  if (!IS_MOBILE) return false;
  try {
    return window.sessionStorage.getItem(CENSUS_PANEL_DISMISSED_KEY) === "1";
  } catch (err) {
    return false;
  }
}
function rememberCensusPanelDismissal(dismissed) {
  if (!IS_MOBILE) return;
  try {
    if (dismissed) window.sessionStorage.setItem(CENSUS_PANEL_DISMISSED_KEY, "1");
    else window.sessionStorage.removeItem(CENSUS_PANEL_DISMISSED_KEY);
  } catch (err) {
    // private-mode storage failures cost only the memory
  }
}
let censusPanelOpen = !censusPanelDismissalRemembered();
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
let CENSUS_TIMELINE = Array.isArray(activeDomain().timeline)
  ? activeDomain().timeline.slice().sort((a, b) => a.year - b.year)
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
// rr3 makes percentages on small denominators volatile, suppressed cells
// carry no value at all, and an unprotected denominator under 100 (the
// ratified small-cell rule, docs/development/small-cell-rule.md) is too
// fragile to colour a unit; all wash out instead of implying precision
const WASH_FLAG_SUBSTRINGS = [
  "suppressed_denominator",
  "rr3_small_denominator",
  "small_denominator",
  "boundary_change_crosswalked",
  "voluntary_survey"
];
function rowWashTokens(row) {
  return flagTokens(row).filter((t) => WASH_FLAG_SUBSTRINGS.some((s) => t.includes(s)));
}
function rowFlagged(row) {
  return rowWashTokens(row).length > 0;
}
// the flat pale wash exists for SCATTERED unreliable rows; a wash flag
// carried by every row of a displayed year would erase that whole
// year's information, so year-universal wash flags surface as a legend
// caveat instead of washing (the same distinguishes-nothing principle
// the popup asterisk uses)
function rowWashes(row, universalForYear) {
  return rowWashTokens(row).some((t) => !(universalForYear && universalForYear.has(t)));
}
// caveats and value quality are different judgements: a distinguishing
// flag earns the popup asterisk and the page's flag note (universe
// breaks, boundary vintages, construct derivations), while only the
// value-quality flags above wash the choropleth — a comparability
// caveat does not make the value itself unreliable
function flagTokens(row) {
  return typeof row?.quality_flag === "string" && row.quality_flag.length > 0
    ? row.quality_flag.split(";")
    : [];
}
// a caveat carried by EVERY row is a product-level fact (the page's
// unconditional copy carries it), not a per-row distinction: asterisking
// every row of every popup would mark nothing. the universal set is
// computed from the data, so no flag vocabulary is hardcoded here.
function computeUniversalFlags(rows) {
  if (!rows.length) return new Set();
  let universal = null;
  for (const row of rows) {
    const tokens = new Set(flagTokens(row));
    if (universal === null) {
      universal = tokens;
    } else {
      for (const t of [...universal]) if (!tokens.has(t)) universal.delete(t);
    }
    if (!universal.size) break;
  }
  return universal || new Set();
}
function rowNoted(row, universalFlags) {
  return flagTokens(row).some((t) => !(universalFlags && universalFlags.has(t)));
}
// the ratified small-cell rule (docs/development/small-cell-rule.md §3-§4)
// carries two numerator/denominator tokens the build scripts emit from the
// published counts. small_denominator_under_100 washes the choropleth (it
// is in WASH_FLAG_SUBSTRINGS above) and marks the popup share as resting on
// a denominator under 100; small_cell_under_10 never washes — it only marks
// a derived share in the popup as resting on fewer than ten people. neither
// alters, redistributes, or hides a value: display emphasis only.
function rowSmallDenominator(row) {
  return flagTokens(row).some((t) => t.includes("small_denominator_under_100"));
}
function rowSmallCell(row) {
  return flagTokens(row).some((t) => t.includes("small_cell_under_10"));
}
function metricUsesDenominator(metric) {
  // the count metrics carry no denominator, so denominator-quality washes
  // do not apply to them (only reachable when a page opts into the counts)
  return metric !== "place_density_per_sq_km" &&
    metric !== "religious_affiliation_count" &&
    metric !== "religious_affiliation_count_change" &&
    metric !== "place_count";
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
    const prev = store.years[idx - 1];
    return rowWashes(store.byAreaYear.get(`${code}|${year}`), store.universalFlagsByYear?.get(year)) ||
      rowWashes(store.byAreaYear.get(`${code}|${prev}`), store.universalFlagsByYear?.get(prev));
  }
  return rowWashes(store.byAreaYear.get(`${code}|${year}`), store.universalFlagsByYear?.get(year));
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
      // skip only rows that actually wash: a year-universal wash flag
      // does not wash, so those rows must still shape the colour domain
      if (metricUsesDenominator(metric) &&
        rowWashes(row, store.universalFlagsByYear?.get(row.year))) continue;
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

// a change_withheld_* flag on either wave nulls the change metrics for
// that area: the product asserts the two waves are not comparable there
// (reclassification, instrument breaks), hence the map must not
// difference them — the area renders as no-data, never as zero change
function changeWithheld(now, prev) {
  return [now, prev].some((row) => row && flagTokens(row).some((t) => t.includes("change_withheld")));
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
    if (changeWithheld(now, prev)) return null;
    const a = now.religious_affiliation_percent;
    const b = prev.religious_affiliation_percent;
    // guard the operands: JS coerces null to 0, so null - null is 0, not
    // NaN — a suppressed denominator must not read as zero change, and a
    // fully-pending level would otherwise fake an all-zero domain
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a - b;
  }
  // count change mirrors religious_change but differences the raw counts;
  // the same operand and withhold guards apply — a missing count must not
  // read as zero and a withheld comparison must not paint
  if (metric === "religious_affiliation_count_change") {
    const idx = store.years.indexOf(year);
    if (idx <= 0) return null;
    const now = store.byAreaYear.get(`${code}|${year}`);
    const prev = store.byAreaYear.get(`${code}|${store.years[idx - 1]}`);
    if (!now || !prev) return null;
    if (changeWithheld(now, prev)) return null;
    const a = now.religious_affiliation_count;
    const b = prev.religious_affiliation_count;
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
  if (existing && existing.geojson) return existing.geojson;
  // callers arriving mid-load share the one in-flight promise instead of
  // reading null and treating "still loading" as failure (a rapid census
  // toggle used to lose its on-intent this way)
  if (existing && existing.loading && existing.promise) return existing.promise;
  const def = CENSUS_LEVELS[level];
  const store = { geojson: null, rows: [], byAreaYear: new Map(), years: [], domains: {}, hasFlags: false, loading: true };
  censusState.levels[level] = store;
  store.promise = loadCensusDataInto(store, def);
  return store.promise;
}

async function loadCensusDataInto(store, def) {
  showClickHint(`Loading ${(RC.dataNoun || "Census").toLowerCase()} boundaries…`);
  try {
    const [boundariesRes, summaryRes] = await Promise.all([
      fetch(def.boundaries),
      fetch(def.summary)
    ]);
    if (!boundariesRes.ok || !summaryRes.ok) throw new Error("census fetch failed");
    const summary = await summaryRes.json();
    // design §2: a product whose declared domain disagrees with the
    // config slot that loads it fails loudly rather than painting the
    // wrong construct; products without the field default to religion
    const productDomain = summary.domain || "religion";
    if (productDomain !== censusState.domain) {
      console.error(`area summary declares domain "${productDomain}" but the active overlay domain is "${censusState.domain}"`);
      throw new Error("overlay domain mismatch");
    }
    store.geojson = await boundariesRes.json();
    store.rows = summary.rows || [];
    // partial-layer declaration (ruled 2026-07-13): a level whose record is
    // partial — a unit or wave subset, a coarser or percentage-only grain, or
    // a single-denomination register — carries differentiated styling (hatch)
    // and a chrome tag. the level config wins over the summary file; either
    // may carry a plain reason string or an object with a reason field.
    store.partialLayer = normalisePartialLayer(def.partialLayer ?? summary.partial_layer);
    // passport metadata rides the product itself, so the panel can name its
    // contents without hand-written per-page prose (which drifts at 100 pages)
    store.meta = {
      sourceDatasets: Array.isArray(summary.source_datasets) ? summary.source_datasets
        : summary.source ? [summary.source] : [],
      construct: summary.construct || null,
      boundarySet: summary.boundary_set || null,
      // the boundary and place-snapshot datasets are excluded from the
      // passport identity line by their own declared ids
      boundaryId: summary.boundary_set?.source_dataset_id || null,
      snapshotId: summary.site_snapshot?.source_dataset_id || null
    };
    store.byAreaYear = new Map(store.rows.map((r) => [`${r.area_code}|${r.year}`, r]));
    store.years = [...new Set(store.rows.map((r) => r.year))].sort((a, b) => a - b);
    store.hasFlags = store.rows.some(rowFlagged);
    store.universalFlags = computeUniversalFlags(store.rows);
    store.universalFlagsByYear = new Map();
    for (const year of new Set(store.rows.map((r) => r.year))) {
      store.universalFlagsByYear.set(year,
        computeUniversalFlags(store.rows.filter((r) => r.year === year)));
    }
    computeCensusDomains(store);
  } catch (err) {
    store.geojson = null;
    showClickHint(`${RC.dataNoun || "Census"} data failed to load`);
  } finally {
    store.loading = false;
  }
  return store.geojson;
}

// reduce a partial-layer declaration to its display reason, or null when
// the layer is complete. accepts a bare string or {reason}/{note} objects.
function normalisePartialLayer(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.reason || value.note || "Partial data layer";
}

// the diagonal hatch that marks a partial layer's wash. drawn once onto a
// small canvas and registered as a tiling fill-pattern; the stub strokes at
// the corners keep the 45-degree lines seamless across tile edges.
function ensureHatchImage() {
  if (map.hasImage("partial-hatch")) return;
  const size = 10;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size * 2;
  const g = canvas.getContext("2d");
  g.strokeStyle = "rgba(15, 23, 42, 0.5)";
  g.lineWidth = 2.4;
  g.lineCap = "square";
  const s = size * 2;
  g.beginPath();
  g.moveTo(0, s); g.lineTo(s, 0);
  g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, -s / 2);
  g.moveTo(s / 2, s * 1.5); g.lineTo(s * 1.5, s / 2);
  g.stroke();
  map.addImage("partial-hatch", g.getImageData(0, 0, s, s), { pixelRatio: 2 });
}

// per-feature opacity for the hatch layer: hatch exactly the units the fill
// paints with a value, so no-data washes never read as hatched data.
function censusHatchOpacityExpression() {
  const { metric, year } = censusState;
  const store = censusActive();
  const def = censusLevelDef();
  const expr = ["match", ["get", def.codeProp]];
  for (const feature of store.geojson.features) {
    const code = feature.properties[def.codeProp];
    const v = censusValue(code, year, metric);
    expr.push(code, v === null || censusWashed(code, year, metric) ? 0 : 0.5);
  }
  expr.push(0);
  return expr;
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

// where to slot the census choropleth in the layer stack. two constraints:
// (1) it must stay beneath the project's own point/polygon layers so a place
// dot is never buried under the wash; (2) on a vector basemap it must also sit
// beneath streets, buildings, borders, and labels so infrastructure and place
// names draw on top of the fill. previously the fill anchored on the lowest
// point layer only, which on the MapTiler vector styles left it washing over
// the entire basemap (jb 2026-07-09: bahamas islands read as solid blobs).
const CENSUS_POINT_ANCHORS = [
  LAYERS.overview,
  LAYERS.polygonsFill,
  LAYERS.buildingsFill,
  LAYERS.places
];
// matches the first basemap layer that carries infrastructure or labels:
// roads, rail, aeroways, tunnels, bridges, buildings, transit, admin borders,
// waterway names, and place/poi symbols. land, water, landcover, and hillshade
// fills fall below this line and stay beneath the wash.
const CENSUS_INFRA_RE = /road|street|highway|motorway|bridge|tunnel|building|transit|rail|aeroway|label|place|poi|waterway[-_ ]?name|boundary|admin/i;
function censusBeforeId() {
  const style = map.getStyle();
  const layers = (style && style.layers) || [];
  // never anchor on our own layers when scanning the basemap
  const ours = new Set([
    ...Object.values(LAYERS),
    CENSUS.fill,
    CENSUS.hatch,
    CENSUS.line,
    CENSUS.hover
  ]);
  // vector anchor: first infrastructure/label layer. anchoring on the first
  // match keeps everything from that layer upward (and every label) above the
  // fill. the raster fallback (CARTO: one raster layer, no symbols) yields no
  // match, so this stays -1 and we degrade to the point-layer anchor below.
  let anchorIndex = -1;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (ours.has(layer.id)) continue;
    const src = layer["source-layer"] || "";
    if (layer.type === "symbol" || CENSUS_INFRA_RE.test(layer.id) || CENSUS_INFRA_RE.test(src)) {
      anchorIndex = i;
      break;
    }
  }
  // lowest project point/polygon layer already in the stack (if any)
  let pointIndex = -1;
  for (let i = 0; i < layers.length; i++) {
    if (CENSUS_POINT_ANCHORS.includes(layers[i].id)) {
      pointIndex = i;
      break;
    }
  }
  // insert before whichever valid anchor sits lower in the stack, so the fill
  // stays beneath both the basemap infrastructure and our own points
  const candidates = [anchorIndex, pointIndex].filter((i) => i >= 0);
  if (candidates.length === 0) return undefined;
  return layers[Math.min(...candidates)].id;
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
    // fill opacity is configurable per country: archipelagos and other
    // small-landmass geographies need a lighter wash so island features
    // stay visible beneath the choropleth (jb 2026-07-09, bahamas)
    paint: { "fill-color": censusFillExpression(), "fill-opacity": RC.censusFillOpacity ?? 0.55 }
  }, beforeId);
  // partial layers carry the ruled diagonal hatch over the same ramp; the
  // layer only exists when the active level declares partiality, so every
  // complete layer's stack is unchanged
  if (store.partialLayer) {
    ensureHatchImage();
    map.addLayer({
      id: CENSUS.hatch,
      type: "fill",
      source: CENSUS.source,
      paint: { "fill-pattern": "partial-hatch", "fill-opacity": censusHatchOpacityExpression() }
    }, beforeId);
  }
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
  // a level switch rebuilds these layers; the active source still rules
  // whether the fill shows
  setCensusFillForSource();
}

function removeCensusLayers() {
  [CENSUS.hover, CENSUS.line, CENSUS.hatch, CENSUS.fill].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(CENSUS.source)) map.removeSource(CENSUS.source);
}

function placeUnderCursor(point) {
  // pulotu culture points win the cursor over the census fill, exactly
  // as place dots do — without this the area popup swallows the click
  const placeLayers = [LAYERS.places, LAYERS.overview, PULOTU.layer].filter((id) => map.getLayer(id));
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
  // boundaries-only scaffold: no row for this area carries a population
  // total or a religious-affiliation/no-religion metric (survey products,
  // for example Italy, carry the latter with population_total null by
  // design), so show the area and its pending status rather than a table
  // of dashes
  const hasCountMetric = "religious_affiliation_count" in CENSUS_METRICS;
  // an area has data when any metric THIS PAGE carries holds a value on one
  // of its rows (population_total counts too). generalises the earlier
  // counts-only and place-register special cases to every opt-in product,
  // including share-only pages (VC's denomination percentages). the two
  // OSM-derived density metrics never count: pending-religion rows carry
  // them by design, and they must keep reaching the pending popup below
  const OSM_DERIVED_METRICS = new Set(["places_per_10000_residents", "place_density_per_sq_km"]);
  const productMetrics = Object.keys(CENSUS_METRICS).filter((m) => !OSM_DERIVED_METRICS.has(m));
  const areaHasData = store.years.some((year) => {
    const row = store.byAreaYear.get(`${code}|${year}`);
    return row && (
      Number.isFinite(row.population_total) ||
      productMetrics.some((metric) => Number.isFinite(row[metric]))
    );
  });
  if (!areaHasData) {
    // religion is pending, but place-of-worship density is computed
    const row = store.byAreaYear.get(`${code}|${censusState.year}`);
    const placeInfo = row && Number.isFinite(row.place_count)
      ? `<div class="place-attrs">` +
          `<div class="place-attr"><span class="place-attr-key">Places of worship</span><span class="place-attr-val">${row.place_count}</span></div>` +
          // guard the derived lines: a register product carries the count
          // with no land area, and null.toFixed would throw mid-popup
          (Number.isFinite(row.land_area_sq_km)
            ? `<div class="place-attr"><span class="place-attr-key">Land area</span><span class="place-attr-val">${row.land_area_sq_km.toFixed(0)} km²</span></div>`
            : "") +
          (Number.isFinite(row.place_density_per_sq_km)
            ? `<div class="place-attr"><span class="place-attr-key">Density</span><span class="place-attr-val">${row.place_density_per_sq_km.toFixed(3)} / km²</span></div>`
            : "") +
        `</div>`
      : "";
    // a page whose product carries no OSM place layer overrides the pending
    // wording (a register product's empty area is absent-in-source, not
    // pending) and drops the OSM credit, which only backs placeInfo lines
    const pendingNote = RC.pendingAreaNote ||
      `Place density from OpenStreetMap. ${RC.dataNoun || "Census"} religious-affiliation data are pending for this area.`;
    const html =
      `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
      placeInfo +
      `<div class="place-note">${pendingNote}</div>` +
      `<div class="place-note">${levelDef.credit}${placeInfo ? " · places © OpenStreetMap (ODbL)" : ""}</div>`;
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
  // the affiliation share column follows the same rule: a counts-only
  // product omits religious_affiliation_percent from metricsAvailable and
  // drops the column rather than showing a column of dashes (every
  // existing page lists the metric, so the column is unchanged for them)
  const hasAffiliationPercent = "religious_affiliation_percent" in CENSUS_METRICS;
  // popup headers keep the original short words unless a country
  // explicitly overrides the metric labels (byte-identical NZ/VU popups)
  const affiliationLabel = RC.metricLabels?.religious_affiliation_percent?.label || "Religious";
  const noReligionLabel = RC.metricLabels?.no_religion_percent?.label || "No religion";
  const countLabel = RC.metricLabels?.religious_affiliation_count?.label || "Membership (count)";
  const countDef = CENSUS_METRICS.religious_affiliation_count;
  // the place columns come from the area summary's OSM-derived counts; a
  // country that hides the place metrics (no extraction pass yet) drops
  // the columns and the OSM credit instead of showing dashes
  const hasPlaces = "places_per_10000_residents" in CENSUS_METRICS ||
    "place_density_per_sq_km" in CENSUS_METRICS;
  // when the map is showing a metric the fixed columns do not carry (a
  // denomination share, for example), lead the table with that metric so the
  // popup answers the same question the choropleth does — and a 1967 row,
  // whose affiliation column is blank by construction, still reads
  const fixedColumnMetrics = ["religious_affiliation_percent", "no_religion_percent",
    "places_per_10000_residents", "place_density_per_sq_km", "religious_affiliation_count"];
  const activeDef = CENSUS_METRICS[censusState.metric];
  const showActive = activeDef && activeDef.kind !== "div" &&
    !fixedColumnMetrics.includes(censusState.metric);
  const activeMetric = censusState.metric;
  const fmtActive = (v) => (Number.isFinite(v) ? activeDef.format(v) : "–");
  // the active-metric column is a derived share only when the metric is a
  // *_percent field; the count metrics render as published and carry no
  // small-cell marker (docs/development/small-cell-rule.md: the count itself
  // renders as published; only derived shares are marked)
  const activeIsShare = typeof activeMetric === "string" && activeMetric.endsWith("_percent");
  let anyFlagged = false;
  let anySmallCell = false;
  let anySmallDenom = false;
  // the small-cell rule marks a derived share where the row's numerator falls
  // under ten people (†) or its denominator under 100 (‡); the markers are
  // byte-absent unless the row carries the token, so no existing product's
  // popup changes and only the numerator/denominator-token rows gain a mark
  const shareMark = (row) => {
    let mark = "";
    if (rowSmallCell(row)) { mark += "†"; anySmallCell = true; }
    if (rowSmallDenominator(row)) { mark += "‡"; anySmallDenom = true; }
    return mark;
  };
  const rowsHtml = store.years.map((year) => {
    const row = store.byAreaYear.get(`${code}|${year}`);
    if (!row) return "";
    const flagged = rowNoted(row, store.universalFlags);
    if (flagged) anyFlagged = true;
    const selected = year === censusState.year ? ' class="census-year-selected"' : "";
    return `<tr${selected}>
      <td>${year}${flagged ? "*" : ""}</td>
      ${showActive ? `<td>${fmtActive(row[activeMetric])}${activeIsShare ? shareMark(row) : ""}</td>` : ""}
      ${hasCountMetric ? `<td>${Number.isFinite(row.religious_affiliation_count) ? countDef.format(row.religious_affiliation_count) : "–"}</td>` : ""}
      ${hasAffiliationPercent ? `<td>${fmtPercent(row.religious_affiliation_percent)}${shareMark(row)}</td>` : ""}
      ${hasNoReligion ? `<td>${fmtPercent(row.no_religion_percent)}${shareMark(row)}</td>` : ""}
      ${hasPlaces ? `<td>${fmtCount(row.place_count)}</td><td>${fmtRate(row.places_per_10000_residents)}</td>` : ""}
    </tr>`;
  }).join("");
  const flagNote = anyFlagged && RC.censusFlagNote
    ? `<div class="place-note">${RC.censusFlagNote}</div>`
    : "";
  // small-cell footnotes: rendered only when a marked row is present, so the
  // popup is byte-identical for every product that carries neither token
  const smallCellNote = anySmallCell
    ? `<div class="place-note">† share rests on fewer than ten people</div>`
    : "";
  const smallDenomNote = anySmallDenom
    ? `<div class="place-note">‡ share rests on a denominator under 100</div>`
    : "";
  // the selected year's structured composition (area-summary.v2): source-
  // verbatim category labels with the percent and/or count exactly as
  // carried — never one derived from the other. absent on every product but
  // vanuatu, so the block is byte-absent elsewhere and the popup is unchanged
  const selectedRow = store.byAreaYear.get(`${code}|${censusState.year}`);
  const composition = Array.isArray(selectedRow?.composition) ? selectedRow.composition : [];
  const compositionHtml = composition.length
    ? `<div class="place-note">Composition (${censusState.year})</div>` +
      `<div class="place-attrs">` +
      composition.map((entry) => {
        const parts = [];
        // render the percent exactly as carried (vu ships two decimals);
        // re-rounding with toFixed would alter a published value
        if (Number.isFinite(entry.percent)) parts.push(`${entry.percent}%`);
        if (Number.isFinite(entry.count)) parts.push(String(entry.count));
        return `<div class="place-attr">` +
          `<span class="place-attr-key">${pulotuEscape(entry.label_verbatim)}</span>` +
          `<span class="place-attr-val">${parts.join(" · ")}</span>` +
          `</div>`;
      }).join("") +
      `</div>`
    : "";
  const html =
    `<div class="popup-header"><span class="popup-title">${name}</span></div>` +
    `<table class="census-table">` +
    `<thead><tr><th>${RC.dataNoun || "Census"}</th>${showActive ? `<th>${activeDef.label}</th>` : ""}${hasCountMetric ? `<th>${countLabel}</th>` : ""}${hasAffiliationPercent ? `<th>${affiliationLabel}</th>` : ""}${hasNoReligion ? `<th>${noReligionLabel}</th>` : ""}${hasPlaces ? "<th>Places</th><th>Per 10k</th>" : ""}</tr></thead>` +
    `<tbody>${rowsHtml}</tbody></table>` +
    compositionHtml +
    flagNote +
    smallCellNote +
    smallDenomNote +
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
// place-dot visibility modes (docs/development/temporal-place-layer.md):
// period = only dated dots alive at the selected year, undated snapshot
// hidden; all = snapshot plus dated layer (the pre-modes behaviour);
// off = choropleth alone. mode null means the user has not chosen, so
// the year decides: historical years open in period (where dated data
// exists), recent years in all. a user choice persists across year and
// level changes until they change it again.
const placesDotState = { mode: null, future: false };
function effectivePointsMode() {
  if (placesDotState.mode) return placesDotState.mode;
  return placeSnapshotStale() && RC.datedPlaces ? "period" : "all";
}
const DATED = { source: "pow-dated", layer: "pow-dated-points", futureLayer: "pow-dated-future-points" };
let datedHandlersAttached = false;
let datedStartYears = null;
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
  // prospective tier: dated places founded after the selected year render
  // as hollow rings when "show later foundations" is on — with perfect
  // information one would see where future places were to be built. the
  // stroke is dark slate: the lighter grey vanished on the pale basemap
  map.addLayer({
    id: DATED.futureLayer,
    type: "circle",
    source: DATED.source,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.6, 9, 5.6, 16, 7.4],
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#334155"
    }
  });
  // the future count feeds the legend: an honest "2 places founded after
  // 2018" stops an almost-empty layer reading as a broken control
  if (!datedStartYears) {
    datedStartYears = [];
    fetch(RC.datedPlaces).then((r) => r.json()).then((geo) => {
      datedStartYears = (geo.features || [])
        .map((f) => f.properties && f.properties.start_year)
        .filter((y) => Number.isFinite(y));
      updateCensusLegend();
    }).catch(() => { /* count stays empty; the legend simply omits it */ });
  }
  if (!datedHandlersAttached) {
    datedHandlersAttached = true;
    const openDatedPopup = (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const pr = f.properties || {};
      const name = pr.name || "Unnamed place";
      const span = `${pr.start_year || "?"}–${pr.end_year || "present"}`;
      const prospective = censusState.enabled &&
        Number.isFinite(pr.start_year) && pr.start_year > censusState.year;
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
          (prospective ? `<div class="place-note">Founded after ${censusState.year} — shown because "show later foundations" is on.</div>` : "") +
          `<div class="place-note">Dates from OpenStreetMap tags — provisional until reviewed evidence replaces them.</div>` +
          `<div class="popup-actions">` +
          `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}" target="_blank" rel="noopener">Streetview</a>` +
          `<a href="https://www.openstreetmap.org/${pr.osm_type}/${pr.osm_id}" target="_blank" rel="noopener">Open OSM</a>` +
          `</div>`
        )
        .addTo(map);
      trackPlacePopup(popup);
    };
    for (const layerId of [DATED.layer, DATED.futureLayer]) {
      map.on("click", layerId, openDatedPopup);
      map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    }
  }
}
function syncDatedPlaces(showAlive, showFuture) {
  if (!RC.datedPlaces) return;
  addDatedPlacesLayer();
  if (!map.getLayer(DATED.layer)) return;
  if (showAlive) {
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
  if (!map.getLayer(DATED.futureLayer)) return;
  if (showFuture) {
    map.setFilter(DATED.futureLayer, ["all",
      ["has", "start_year"],
      [">", ["get", "start_year"], censusState.year]
    ]);
    map.setLayoutProperty(DATED.futureLayer, "visibility", "visible");
  } else {
    map.setLayoutProperty(DATED.futureLayer, "visibility", "none");
  }
}

// ── pulotu cultures layer ──────────────────────────────────────────
// the ratified cultures layer (docs/development/pulotu-cultures-layer.md,
// amended by pi directive 2026-07-12): documented cultural reconstructions
// from the pulotu database, selected as a DATA SOURCE beside the census,
// never blended with place dots or census metrics (the never-merge rule).
// the product is one global geojson; each page filters to its own country
// tag. the census year slider never touches the cultures: selecting the
// pulotu source swaps the whole temporal frame to the dataset's own three
// time points (traditional / post-contact / current), and each culture's
// own calendar anchors stay declared in its popup.
const PULOTU = { source: "pow-pulotu", layer: "pow-pulotu-points" };
let pulotuHandlersAttached = false;
// which source drives the panel: the census (default) or pulotu. time and
// metric are pulotu's own; they survive source flips within a session
const pulotuState = { active: false, time: "traditional", metric: "belief_in_gods" };
// the dataset's temporal model is three time layers carried on the
// variables (68 traditional, 16 post-contact, 4 current); the timeline
// renders exactly those three points — nothing between them exists
const PULOTU_TIME_POINTS = [
  { id: "traditional", label: "Traditional", metrics: ["belief_in_gods", "belief_in_ancestral_spirits", "supernatural_punishment_for_impiety"],
    note: "reconstructed to each culture's own traditional anchor year (range 1521–1983) — the popup declares it" },
  { id: "postcontact", label: "Post-contact", metrics: ["adoption_world_religion"],
    note: "processes spanning the interval between each culture's traditional and contemporary anchors" },
  { id: "current", label: "Current", metrics: ["dominant_world_religion"],
    note: "each culture at its own contemporary anchor year (mostly 2014–2020) — the popup declares it" }
];
// the curated set with the record's own code frame: [code, legend label,
// colour]. ordinal scales ride a violet ramp and the nominal dominant-
// world-religion variable carries distinct hues, all outside the census
// blue/orange palettes (the measurement-diversity separation guard).
// legend labels shorten the record's code descriptions; the popup keeps
// the full text
const PULOTU_METRICS = {
  belief_in_gods: { label: "Belief in god(s)", codes: [
    [0, "Absent", "#ede9fe"], [1, "Present, minor focus", "#c4b5fd"],
    [2, "Present, major focus", "#8b5cf6"], [3, "Present, principal focus", "#4c1d95"]] },
  belief_in_ancestral_spirits: { label: "Belief in ancestral spirits", codes: [
    [0, "Absent", "#ede9fe"], [1, "Present, minor focus", "#c4b5fd"],
    [2, "Present, major focus", "#8b5cf6"], [3, "Present, principal focus", "#4c1d95"]] },
  supernatural_punishment_for_impiety: { label: "Supernatural punishment for impiety", codes: [
    [0, "Absent", "#ede9fe"], [1, "Present", "#4c1d95"]] },
  adoption_world_religion: { label: "Adoption of a world religion", codes: [
    [0, "Absent or minimal", "#ede9fe"], [1, "Present but minor", "#c4b5fd"],
    [2, "Present and major", "#8b5cf6"], [3, "Present and predominant", "#4c1d95"]] },
  dominant_world_religion: { label: "Dominant world religion", codes: [
    [1, "Christianity", "#6d28d9"], [2, "Islam", "#0f766e"], [3, "Hinduism / Buddhism", "#b45309"]] }
};
const PULOTU_MISSING_COLOUR = "rgba(148, 163, 184, 0.55)";
// heading order and membership follow the dataset's own organisation;
// each key carries the record's variable name so a missing value still
// names its variable (a null entry has no name of its own to read)
const PULOTU_GROUPS = [
  ["Traditional Culture", [
    ["belief_in_gods", "Belief in god(s)"],
    ["belief_in_ancestral_spirits", "Belief in ancestral spirits"],
    ["supernatural_punishment_for_impiety", "Belief in supernatural punishment for impiety"]
  ]],
  ["Post-Contact History", [["adoption_world_religion", "Adoption of a world religion"]]],
  ["Current Culture", [["dominant_world_religion", "Dominant world religion"]]]
];
function pulotuEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// the geojson loads once per session; each feature's curated codes are
// flattened onto top-level properties (code_<metric>, -1 = not documented)
// so paint expressions can match on them — maplibre expressions cannot
// reach into the nested values object
let pulotuStore = null;
let pulotuLoading = null;
async function loadPulotuData() {
  if (pulotuStore) return pulotuStore;
  if (pulotuLoading) return pulotuLoading;
  pulotuLoading = (async () => {
    const res = await fetch(RC.pulotuCultures.data);
    const gj = await res.json();
    for (const f of gj.features) {
      const values = f.properties.values || {};
      for (const key of Object.keys(PULOTU_METRICS)) {
        const v = values[key];
        f.properties[`code_${key}`] = v && v.code !== null && v.code !== undefined ? v.code : -1;
      }
    }
    pulotuStore = {
      data: gj,
      countryFeatures: gj.features.filter((f) => f.properties.country_iso2 === RC.countryCode)
    };
    return pulotuStore;
  })();
  return pulotuLoading;
}
async function addPulotuLayer() {
  if (!RC.pulotuCultures || map.getLayer(PULOTU.layer)) return;
  const store = await loadPulotuData();
  // a source flip can arrive before the style finishes its first load
  // (or right after a basemap switch); adding layers then throws, so
  // wait until the style reports loaded — styledata fires repeatedly
  // through a style load, so this resolves at the earliest safe moment
  // rather than waiting for a full tile idle.
  //
  // the earlier `while (!isStyleLoaded) await once("styledata")` form lost
  // the wakeup when the style finished in the gap between the check and the
  // once-listener registering: an early flip during the INITIAL load then
  // parked here forever, and setDataSource never reached its metric/level
  // select swap, leaving the census selects stale until a second flip cycle
  // (the tonga early-flip defect). registering the listener before the
  // re-check, and polling as a backstop wake, closes the gap. the clean path
  // is unchanged: an already-loaded style skips the wait entirely, exactly
  // as before, so the post-initial-load flip on vu/sb is unaffected.
  if (!map.isStyleLoaded()) {
    await new Promise((resolve) => {
      const settle = () => {
        if (!map.isStyleLoaded()) return;
        map.off("styledata", settle);
        clearInterval(poll);
        resolve();
      };
      const poll = setInterval(settle, 50);
      map.on("styledata", settle);
      settle();
    });
  }
  if (map.getLayer(PULOTU.layer)) return;
  // a basemap switch drops the layer but can leave the source; reuse it
  if (!map.getSource(PULOTU.source)) {
    map.addSource(PULOTU.source, { type: "geojson", data: store.data });
  }
  // points colour by the selected variable's own codes; the heavier white
  // halo keeps the reconstruction points visually apart from enumeration
  // dots (the measurement-diversity separation guard)
  map.addLayer({
    id: PULOTU.layer,
    type: "circle",
    source: PULOTU.source,
    layout: { visibility: "none" },
    filter: ["==", ["get", "country_iso2"], RC.countryCode],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5.0, 9, 8.0, 16, 11.0],
      "circle-color": pulotuColourExpression(),
      "circle-opacity": 0.92,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff"
    }
  });
  if (!pulotuHandlersAttached) {
    pulotuHandlersAttached = true;
    map.on("click", PULOTU.layer, (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const pr = f.properties || {};
      // maplibre stringifies nested feature properties
      let values = {}, timeFocus = {};
      try { values = typeof pr.values === "string" ? JSON.parse(pr.values) : (pr.values || {}); } catch (err) { /* row renders as not documented */ }
      try { timeFocus = typeof pr.time_focus === "string" ? JSON.parse(pr.time_focus) : (pr.time_focus || {}); } catch (err) { /* anchors omitted */ }
      const anchorRow = (key, node) => node && Number.isFinite(node.year)
        ? `<div class="place-attr"><span class="place-attr-key">${key}</span><span class="place-attr-val">${node.year}</span></div>`
        : "";
      // each value renders its label head; the full code definition rides
      // the title attribute, and every documented value cites its sources
      const valueRow = (v) => {
        if (!v || v.code === null || v.code === undefined) {
          return `<span class="pulotu-val pulotu-val-missing">not documented</span>`;
        }
        const full = pulotuEscape(v.label || "");
        const head = pulotuEscape(String(v.label || "").split(" (")[0]);
        const src = (v.sources || []).length
          ? ` <span class="pulotu-src">${pulotuEscape(v.sources.join(", "))}</span>`
          : "";
        return `<span class="pulotu-val" title="${full}">${head}</span>${src}`;
      };
      const groups = PULOTU_GROUPS.map(([heading, keys]) => {
        const rows = keys.map(([k, fallbackName]) => {
          const v = values[k];
          const name = pulotuEscape(v && v.variable ? v.variable : fallbackName);
          return `<div class="place-attr"><span class="place-attr-key">${name}</span><span class="place-attr-val">${valueRow(v)}</span></div>`;
        }).join("");
        return `<div class="pulotu-group-title">${heading}</div><div class="place-attrs">${rows}</div>`;
      }).join("");
      const popup = new maplibregl.Popup({ maxWidth: "360px" })
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<div class="popup-header"><span class="popup-title">${pulotuEscape(pr.name || pr.culture_id)}</span></div>` +
          `<div class="place-attrs">` +
          anchorRow("Traditional state time focus", timeFocus.traditional_state) +
          anchorRow("Contemporary time focus", timeFocus.contemporary) +
          `</div>` +
          groups +
          `<div class="place-note">A documented cultural reconstruction from the Pulotu database — values cite the database's sources; the full record carries all 88 variables.</div>` +
          (pr.record_url ? `<div class="popup-actions"><a href="${pulotuEscape(pr.record_url)}" target="_blank" rel="noopener">Full Pulotu record</a></div>` : "")
        )
        .addTo(map);
      trackPlacePopup(popup);
    });
    map.on("mouseenter", PULOTU.layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", PULOTU.layer, () => { map.getCanvas().style.cursor = ""; });
  }
}
function pulotuTimePoint() {
  return PULOTU_TIME_POINTS.find((t) => t.id === pulotuState.time) || PULOTU_TIME_POINTS[0];
}
// points match on the flattened code properties; an undocumented value
// (code -1 falls through to the default) greys out rather than implying
// an observation the record does not carry
function pulotuColourExpression() {
  const def = PULOTU_METRICS[pulotuState.metric];
  const expr = ["match", ["get", `code_${pulotuState.metric}`]];
  for (const [code, , colour] of def.codes) expr.push(code, colour);
  expr.push(PULOTU_MISSING_COLOUR);
  return expr;
}
function applyPulotuPaint() {
  if (!map.getLayer(PULOTU.layer)) return;
  map.setPaintProperty(PULOTU.layer, "circle-color", pulotuColourExpression());
}
// the pulotu legend is categorical: one swatch per code the country's
// cultures actually carry, with counts, plus the regime declaration the
// measurement-diversity principle requires
function renderPulotuLegend() {
  if (!censusLegend) return;
  const scale = document.getElementById("census-legend-scale");
  if (!scale) return;
  censusLegend.hidden = false;
  const tp = pulotuTimePoint();
  const def = PULOTU_METRICS[pulotuState.metric];
  const feats = (pulotuStore && pulotuStore.countryFeatures) || [];
  const counts = new Map();
  let missing = 0;
  for (const f of feats) {
    const code = f.properties[`code_${pulotuState.metric}`];
    if (code === -1) missing += 1;
    else counts.set(code, (counts.get(code) || 0) + 1);
  }
  const legendRow = (colour, label, n) =>
    `<div class="pulotu-legend-row"><span class="pulotu-swatch" style="background:${colour}"></span><span class="pulotu-legend-label">${pulotuEscape(label)}</span><span class="pulotu-legend-count">${n}</span></div>`;
  const rows = def.codes
    .filter(([code]) => counts.has(code))
    .map(([code, label, colour]) => legendRow(colour, label, counts.get(code)))
    .join("");
  const missingRow = missing ? legendRow(PULOTU_MISSING_COLOUR, "not documented", missing) : "";
  scale.innerHTML =
    `<div class="census-legend-title">Pulotu cultures: ${pulotuEscape(def.label)} (${tp.label})</div>` +
    rows + missingRow +
    `<div class="census-legend-note">${tp.note}</div>` +
    `<div class="census-legend-note">Pulotu cultures are documented cultural reconstructions, not counts — the timeline steps through Pulotu's own three time points, never ${(RC.dataNoun || "census").toLowerCase()} years. © Pulotu (D-PLACE CLDF v1.3.1, CC BY 4.0)</div>`;
}
// the pulotu timeline replaces the census year slider wholesale: three
// stops, worded not numbered, because the dataset's temporal model has
// exactly three points and nothing between them
function syncPulotuTimeStrip() {
  const timeEl = document.getElementById("census-time");
  if (!timeEl) return;
  const idx = Math.max(0, PULOTU_TIME_POINTS.findIndex((t) => t.id === pulotuState.time));
  const panel = document.getElementById("census-panel");
  if (panel) panel.classList.remove("census-long");
  timeEl.hidden = false;
  timeEl.innerHTML =
    `<div class="census-time-row">` +
      `<input id="census-slider" class="census-slider" type="range" min="0" max="${PULOTU_TIME_POINTS.length - 1}" step="1" value="${idx}" aria-label="Pulotu time point">` +
    `</div>` +
    `<div class="census-ticks pulotu-ticks">${PULOTU_TIME_POINTS.map((t) => `<span data-time="${t.id}">${t.label}</span>`).join("")}</div>`;
  const slider = document.getElementById("census-slider");
  if (slider) {
    slider.addEventListener("input", () => {
      const tp = PULOTU_TIME_POINTS[Number(slider.value)];
      if (tp) setPulotuTime(tp.id);
    });
  }
  markPulotuTick();
}
function markPulotuTick() {
  document.querySelectorAll("#census-time .census-ticks span[data-time]").forEach((span) => {
    span.classList.toggle("census-tick-active", span.dataset.time === pulotuState.time);
  });
}
function setPulotuTime(id) {
  const tp = PULOTU_TIME_POINTS.find((t) => t.id === id);
  if (!tp || pulotuState.time === id) return;
  pulotuState.time = id;
  // a metric belongs to exactly one time layer; crossing layers swaps to
  // the new layer's lead metric
  if (!tp.metrics.includes(pulotuState.metric)) pulotuState.metric = tp.metrics[0];
  populateMetricOptions();
  applyPulotuPaint();
  updateCensusLegend();
  markPulotuTick();
}
// one metric select serves both sources; its options swap with the source
// (and, under pulotu, with the active time point)
function populateMetricOptions() {
  if (!censusMetricSelect) return;
  censusMetricSelect.innerHTML = "";
  if (pulotuState.active) {
    for (const id of pulotuTimePoint().metrics) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = PULOTU_METRICS[id].label;
      censusMetricSelect.appendChild(option);
    }
    censusMetricSelect.value = pulotuState.metric;
  } else {
    for (const [id, def] of Object.entries(CENSUS_METRICS)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = def.label;
      censusMetricSelect.appendChild(option);
    }
    censusMetricSelect.value = censusState.metric;
  }
}
// under the pulotu source the census fill and hover hide (never-merge,
// enforced at source level); the boundary line stays for orientation
function setCensusFillForSource() {
  const vis = pulotuState.active ? "none" : "visible";
  for (const id of [CENSUS.fill, CENSUS.hover]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
  }
}
// the source switch: the panel's metric select, timeline, legend, and
// layers all follow. pow place dots stay under the points control's own
// modes in either source (the pi's "retain the pows optionally")
async function setDataSource(src) {
  const wantPulotu = src === "pulotu" && !!RC.pulotuCultures;
  if (pulotuState.active === wantPulotu) return;
  pulotuState.active = wantPulotu;
  if (censusSourceSelect) censusSourceSelect.value = wantPulotu ? "pulotu" : "census";
  if (wantPulotu) {
    try {
      await addPulotuLayer();
    } catch (e) {
      // a failed load must not strand a half-switched panel: revert to
      // the census source and let the user retry
      pulotuState.active = false;
      if (censusSourceSelect) censusSourceSelect.value = "census";
      return;
    }
  }
  // geography has no meaning for a point layer; the select returns with
  // the census source
  if (censusLevelSelect) censusLevelSelect.hidden = wantPulotu;
  const panel = document.getElementById("census-panel");
  if (panel) panel.classList.toggle("pulotu-mode", wantPulotu);
  populateMetricOptions();
  setCensusFillForSource();
  syncPulotuCultures();
  if (wantPulotu) {
    applyPulotuPaint();
    syncPulotuTimeStrip();
    updateCensusLegend();
    // pulotu metrics name another dataset's constructs; the carried
    // census view would mislead a handoff, so the fragment drops it
    writeCensusHash();
  } else {
    syncCensusTimeSlider();
    if (censusState.enabled && censusActive()) applyCensusPaint();
    else updateCensusLegend();
  }
  syncPlaceDotEra();
}
function syncPulotuCultures() {
  if (!RC.pulotuCultures) return;
  // a basemap switch drops the layer; rebuild it when the pulotu source
  // is active, then let the rebuilt layer take the current paint and
  // visibility
  if (!map.getLayer(PULOTU.layer)) {
    if (pulotuState.active) {
      void addPulotuLayer().then(() => {
        if (!map.getLayer(PULOTU.layer)) return;
        applyPulotuPaint();
        map.setLayoutProperty(PULOTU.layer, "visibility",
          censusState.enabled && pulotuState.active ? "visible" : "none");
      }).catch(() => { /* the next sync retries */ });
    }
    return;
  }
  const show = censusState.enabled && pulotuState.active;
  map.setLayoutProperty(PULOTU.layer, "visibility", show ? "visible" : "none");
}

function syncPlaceDotEra() {
  const stale = placeSnapshotStale();
  // dots are religion-domain furniture (design §4): under any other
  // overlay domain the place layers hide and the points row drops; the
  // user's chosen mode survives in placesDotState for religion's return
  const dotsBelong = activeDomainId === "religion";
  const mode = !dotsBelong ? "off" : censusState.enabled ? effectivePointsMode() : "all";
  // period mode shows only the dated tier; all mode keeps the pre-modes
  // behaviour where the dated tier joins the faded snapshot on
  // historical years; off shows no dots at all
  const showAlive = censusState.enabled &&
    (mode === "period" || (mode === "all" && stale));
  const showFuture = censusState.enabled && mode === "period" && placesDotState.future;
  try { syncDatedPlaces(showAlive, showFuture); } catch (e) { /* dated layer is optional */ }
  try { syncPulotuCultures(); } catch (e) { /* cultures layer is optional */ }
  // the undated snapshot tiers hide entirely (not fade) in period and
  // off modes; hidden layers also drop out of click hit-testing
  const hideSnapshot = censusState.enabled && mode !== "all";
  if (map.getLayer(LAYERS.overview)) {
    map.setLayoutProperty(LAYERS.overview, "visibility", hideSnapshot ? "none" : "visible");
  }
  if (map.getLayer(LAYERS.places)) {
    map.setLayoutProperty(LAYERS.places, "visibility", hideSnapshot ? "none" : "visible");
  }
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
  syncPointsControl(mode);
  syncKeyToDots(mode);
}

// the key describes the place dots; "Points: off" leaves it describing
// nothing, so phones drop the pill entirely (phone chrome earns its
// place) while desktop keeps the affordance visible but disabled with
// the reason — hidden affordances are not rediscovered (tribunal
// consensus, docs/development/datamaps-tribunal-2026-07-17.md). any
// mode with dots restores the key at once through the same paint path.
function syncKeyToDots(mode) {
  if (!keyWrap || !countsToggle) return;
  const dotsOff = mode === "off";
  if (dotsOff === keyDotsOff) return;
  keyDotsOff = dotsOff;
  if (dotsOff && countsUserEnabled) {
    countsUserEnabled = false;
    syncCountsToggleLabel();
  }
  keyWrap.hidden = IS_MOBILE && dotsOff;
  updateCounts();
}

// keep the points control in step with the effective mode: the select
// shows what the map is doing even before the user has chosen, and the
// later-foundations checkbox only makes sense inside period mode
function syncPointsControl(mode) {
  const select = document.getElementById("censusPoints");
  const futureRow = document.getElementById("census-points-future");
  if (!select) return;
  // the points control speaks only for religion's place dots; other
  // overlay domains drop the row entirely (design §4)
  select.hidden = activeDomainId !== "religion";
  if (select.value !== mode) select.value = mode;
  if (futureRow) futureRow.hidden = mode !== "period" || !RC.datedPlaces;
}

function applyCensusPaint() {
  if (map.getLayer(CENSUS.fill)) {
    map.setPaintProperty(CENSUS.fill, "fill-color", censusFillExpression());
  }
  if (map.getLayer(CENSUS.hatch)) {
    map.setPaintProperty(CENSUS.hatch, "fill-opacity", censusHatchOpacityExpression());
  }
  syncPlaceDotEra();
  updateCensusLegend();
  // every metric or wave change funnels through here, so the url's
  // census view stays current for handoffs and shared links
  writeCensusHash();
}

// the partial-layer chrome: the tag rides the data pill (it travels with a
// dragged pill) and the panel note carries the declared reason. both bind to
// the ACTIVE level's declaration, so switching to a complete level clears them.
function updatePartialIndicator() {
  const tag = document.getElementById("census-partial-tag");
  const note = document.getElementById("census-partial-note");
  const store = censusActive();
  const reason = censusState.enabled && !pulotuState.active && store ? store.partialLayer : null;
  if (tag) tag.hidden = !reason;
  if (note) {
    note.hidden = !reason;
    note.textContent = reason || "";
  }
}

// ---- dataset passport ---------------------------------------------------
// escape product-json strings before they enter panel markup; RC config
// strings stay author-controlled html as elsewhere in this file
function escText(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// distinct statistics providers behind the active product; boundary and
// place-snapshot datasets stay in the drawer, off the identity line. two
// providers fit on a line; more would push the frame line off a phone
function passportProviders(meta) {
  const all = (meta.sourceDatasets || []).filter(Boolean);
  const roleTagged = all.some((s) => s.role);
  let candidates = roleTagged
    ? all.filter((s) => s.role === "map_source")
    : all.filter((s) => !meta.snapshotId || s.source_dataset_id !== meta.snapshotId);
  if (!roleTagged && meta.boundaryId) {
    // a boundary that rides the statistics dataset itself (one id for both)
    // must not empty the line; exclude only when other sources remain
    const nonBoundary = candidates.filter((s) => s.source_dataset_id !== meta.boundaryId);
    if (nonBoundary.length) candidates = nonBoundary;
  }
  if (!candidates.length) candidates = all;
  const names = [...new Set(candidates.map((s) => s.provider).filter(Boolean))];
  if (!names.length) return null;
  return names.length <= 2 ? names.join(" · ") : `${names[0]} + ${names.length - 1} more`;
}

// the passport answers "what exactly am I looking at?" with zero
// interaction: source · construct on one line, geography · wave on the
// next. it renders only what the product metadata states — a page whose
// product carries no construct shows none rather than a guessed one.
function updateDataPassport() {
  const passport = document.getElementById("census-passport");
  const evidence = document.getElementById("census-evidence");
  const hideAll = () => {
    if (passport) passport.hidden = true;
    if (evidence) evidence.hidden = true;
  };
  if (!passport) return;
  if (!censusState.enabled) { hideAll(); return; }
  if (pulotuState.active) {
    passport.hidden = false;
    passport.innerHTML =
      `<div class="passport-line passport-source">Pulotu database of Pacific cultures</div>` +
      `<div class="passport-line passport-frame">curated culture records · Traditional / Post-contact / Current</div>`;
    if (evidence) evidence.hidden = true;
    return;
  }
  const store = censusActive();
  const meta = store && store.meta;
  if (!store || !store.geojson || !meta) { hideAll(); return; }
  const providers = passportProviders(meta) || RC.dataNoun || "Census";
  const level = censusLevelDef();
  const years = store.years || [];
  const waveText = years.length > 1
    ? `${years[0]}–${years[years.length - 1]} · showing ${censusState.year}`
    : `${censusState.year}`;
  passport.hidden = false;
  passport.innerHTML =
    `<div class="passport-line passport-source">${escText(providers)}${meta.construct ? ` · ${escText(meta.construct)}` : ""}</div>` +
    `<div class="passport-line passport-frame">${escText(level.label)} · ${escText(waveText)}</div>`;
  renderEvidenceDrawer(meta);
}

// the collapsed evidence drawer: sources with licences, the boundary
// lineage, provider-mandated reuse text, and the page's full dossier
function renderEvidenceDrawer(meta) {
  const evidence = document.getElementById("census-evidence");
  const body = document.getElementById("census-evidence-body");
  if (!evidence || !body) return;
  const rows = [];
  for (const s of (meta.sourceDatasets || []).slice(0, 6)) {
    if (!s) continue;
    const name = s.name || s.provider || s.source_dataset_id;
    if (!name) continue;
    const link = s.url
      ? `<a href="${escText(s.url)}" target="_blank" rel="noopener">${escText(name)}</a>`
      : escText(name);
    const licence = s.licence && (s.licence.name || (typeof s.licence === "string" ? s.licence : null));
    const licenceHtml = licence
      ? (s.licence.url
        ? ` — <a href="${escText(s.licence.url)}" target="_blank" rel="noopener">${escText(licence)}</a>`
        : ` — ${escText(licence)}`)
      : "";
    rows.push(`<li>${link}${licenceHtml}</li>`);
    if (s.reuse_note) rows.push(`<li class="evidence-reuse">${escText(s.reuse_note)}</li>`);
  }
  const b = meta.boundarySet;
  const boundaryNote = b && (b.source_dataset_id || b.boundary_set_id)
    ? `<p class="evidence-note">Boundaries: ${escText(b.source_dataset_id || b.boundary_set_id)}${b.vintage ? ` (${escText(b.vintage)} vintage)` : ""}</p>`
    : "";
  const flagNote = RC.censusFlagNote ? `<p class="evidence-note">${escText(RC.censusFlagNote)}</p>` : "";
  // attribution is author-controlled html, same trust as the map credit line
  const attribution = RC.censusSourceAttribution
    ? `<p class="evidence-note">${RC.censusSourceAttribution}</p>`
    : "";
  evidence.hidden = false;
  body.innerHTML =
    (rows.length ? `<ul class="evidence-sources">${rows.join("")}</ul>` : "") +
    boundaryNote + flagNote + attribution +
    `<p class="evidence-note"><a href="overview.html">Full data record →</a></p>`;
}

function updateCensusLegend() {
  updatePartialIndicator();
  updateDataPassport();
  if (!censusLegend) return;
  // the pulotu source carries its own categorical legend; the census
  // legend machinery below never speaks for it
  if (pulotuState.active) {
    if (!censusState.enabled) {
      censusLegend.hidden = true;
      return;
    }
    renderPulotuLegend();
    return;
  }
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
  // (the years themselves render as inert ticks in the time strip below)
  if (!domain && !hasAnyData) {
    censusLegend.hidden = false;
    scale.innerHTML =
      `<div class="census-legend-title">${censusLevelDef().label} boundaries</div>` +
      `<div class="census-legend-note">${RC.dataNoun || "Census"} religious-affiliation data are pending. ` +
      `The areas are ready to receive it.</div>`;
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
  // the wash legend states why areas are pale from the flags that
  // actually wash (year-universal wash flags do not wash — they get the
  // year-caveat line below instead); naming the wrong reason misleads
  const washTokenClause = (tokens) => {
    const clauses = [];
    if (tokens.some((t) => t.includes("suppressed_denominator") || t.includes("rr3_small_denominator") || t.includes("small_denominator"))) {
      clauses.push("small or suppressed denominators");
    }
    if (tokens.some((t) => t.includes("boundary_change_crosswalked"))) {
      clauses.push("values converted across boundary vintages");
    }
    if (tokens.some((t) => t.includes("voluntary_survey"))) {
      clauses.push("voluntary-survey estimates, not census counts");
    }
    return clauses;
  };
  const washingTokens = [];
  for (const row of store.rows) {
    const uni = store.universalFlagsByYear?.get(row.year);
    for (const t of rowWashTokens(row)) if (!(uni && uni.has(t))) washingTokens.push(t);
  }
  const washReasons = washTokenClause(washingTokens);
  const washNote = washReasons.length && metricUsesDenominator(censusState.metric)
    ? `<div class="census-legend-note">pale areas: ${washReasons.join("; ")}</div>`
    : "";
  // a wash flag on every row of the selected year is a property of the
  // whole wave: say so once, without erasing the wave's colours
  const activeUniversal = [...(store.universalFlagsByYear?.get(censusState.year) || [])]
    .filter((t) => WASH_FLAG_SUBSTRINGS.some((s) => t.includes(s)));
  const yearCaveats = washTokenClause(activeUniversal);
  const yearCaveatNote = yearCaveats.length
    ? `<div class="census-legend-note">${censusState.year}: ${yearCaveats.join("; ")} — details in area popups</div>`
    : "";
  // the dot note tracks the points mode: period explains the dated-only
  // view, all keeps the interim honesty note on historical years, off
  // needs no note because the control itself says so
  const pointsMode = effectivePointsMode();
  const futureCount = placesDotState.future && Array.isArray(datedStartYears)
    ? datedStartYears.filter((y) => y > censusState.year).length
    : null;
  const dotEraNote = pointsMode === "period"
    ? `<div class="census-legend-note">showing only places whose OpenStreetMap date tags say they existed in ${censusState.year} — today's undated snapshot is hidden${placesDotState.future ? `; hollow rings mark places founded after ${censusState.year}${futureCount !== null ? ` (${futureCount} in this dataset)` : ""}` : ""}</div>`
    : pointsMode === "all" && placeSnapshotStale()
      ? `<div class="census-legend-note">place dots show today's OpenStreetMap places, not ${censusState.year} places${RC.datedPlaces ? ` — amber-ringed dots carry OpenStreetMap date tags saying they existed in ${censusState.year}` : " — historical place layers are being assembled from evidence"}</div>`
      : "";
  // the ramp clamps at the 2nd-98th percentile; mark the ends when
  // values continue beyond them
  const isClamped = store.clamped && store.clamped[censusState.metric];
  const loLabel = (isClamped ? "≤ " : "") + def.format(domain[0]);
  const hiLabel = (isClamped ? "≥ " : "") + def.format(domain[1]);
  censusLegend.hidden = false;
  // only the scale child is rewritten; the time slider below it persists
  // the colour sentence states direction and scale behaviour plainly; the
  // ramp alone tells a first-time reader neither
  const colourNote = def.kind === "div"
    ? `<div class="census-legend-note census-colour-note">orange marks decline, blue marks growth${isClamped ? "; ≤ and ≥ mark the clamped 2nd–98th percentile ends" : ""}</div>`
    : `<div class="census-legend-note census-colour-note">darker blue means a higher value; one colour scale spans every wave${isClamped ? ", clamped at the 2nd–98th percentiles" : ""}</div>`;
  scale.innerHTML =
    `<div class="census-legend-title">${censusLevelDef().label}: ${def.label} (${censusState.year})</div>` +
    `<div class="census-legend-bar" style="background:${rampGradient(stops)}"></div>` +
    `<div class="census-legend-range"><span>${loLabel}</span><span>${hiLabel}</span></div>` +
    colourNote +
    `<div class="census-legend-note census-construct-note">${def.note}</div>` +
    washNote +
    yearCaveatNote +
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

// tick labels for the year strip: every year keeps its span so the flex
// row spreads ticks across the slider's stops, but only a strip-width
// budget of them carries text. an empty span shrinks to nothing while a
// visibility-hidden one keeps its min-content width — which is what let
// sweden's 54 register years push the tick row ~790px past the panel
// edge. first and last years always label; the legend title carries the
// active year, so a skipped label loses nothing.
function censusTicksMarkup(tickYears, timeEl) {
  // panel is open by default so the strip is usually measurable; the
  // fallback approximates the census-long desktop strip
  const stripWidth = (timeEl && timeEl.clientWidth) || 520;
  // ~44px per label fits four digits with breathing room at 11px
  const maxLabels = Math.max(4, Math.floor(stripWidth / 44));
  const stride = Math.ceil(tickYears.length / maxLabels);
  const last = tickYears.length - 1;
  const spans = tickYears.map((y, i) => {
    // the half-stride guard keeps a strided label from crowding the
    // always-labelled final year
    const labelled = stride === 1 || i === last ||
      (i % stride === 0 && last - i >= stride / 2);
    return `<span data-year="${y}">${labelled ? y : ""}</span>`;
  });
  return `<div class="census-ticks">${spans.join("")}</div>`;
}

// rebuild the slider structure for the timeline (or the active level's
// year set when no timeline is configured)
function syncCensusTimeSlider() {
  // under the pulotu source the time strip is pulotu's three points
  if (pulotuState.active) {
    syncPulotuTimeStrip();
    return;
  }
  const timeEl = document.getElementById("census-time");
  const store = censusActive();
  if (!timeEl || !store) return;
  const years = censusSliderYears();
  // a slider needs at least two stops, and at least one metric with data
  // to animate — but vanishing without a word made a pending level look
  // broken (the scotland scaffold); the suppressed states now say why:
  // a pending level keeps its year ticks inert under a data-pending note,
  // and a single-wave level shows its one year
  const hasAnyData = Object.keys(store.domains || {}).length > 0;
  if (years.length < 2 || !hasAnyData) {
    const tickYears = hasAnyData ? years : (store.years || []);
    const note = hasAnyData
      ? `single ${(RC.dataNoun || "census").toLowerCase()} year mapped so far`
      : `${RC.dataNoun || "Census"} data for this level is pending — the year control activates when it arrives`;
    timeEl.hidden = false;
    timeEl.innerHTML =
      (tickYears.length ? censusTicksMarkup(tickYears, timeEl) : "") +
      `<div class="census-legend-note">${note}</div>`;
    markActiveTick();
    return;
  }
  const idx = Math.max(0, years.indexOf(censusState.year));
  const panel = document.getElementById("census-panel");
  if (panel) panel.classList.toggle("census-long", years.length >= 6);
  timeEl.hidden = false;
  timeEl.innerHTML =
    `<div class="census-time-row">` +
      `<input id="census-slider" class="census-slider" type="range" min="0" max="${years.length - 1}" step="1" value="${idx}" aria-label="${RC.dataNoun || "Census"} year">` +
    `</div>` +
    censusTicksMarkup(years, timeEl);
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
  // a censusless page has nothing to enable; returning before the state
  // write means the flag can never be left true with no store
  if (!HAS_CENSUS) return;
  censusState.enabled = on;
  if (on) {
    const data = await loadCensusData(censusState.level);
    // a second toggle can land while the load is in flight; the later
    // intent wins, so a stale load must not add layers over it
    if (censusState.enabled !== on) return;
    if (!data) {
      censusState.enabled = false;
      updateCensusLegend();
      return;
    }
    // a carried census view (#d=metric:year) can name a wave this
    // country never surveyed; the same nearest-year clamp that guards a
    // level switch guards the first load (earlier wins a tie)
    const store = censusActive();
    if (store && store.years.length && !store.years.includes(censusState.year)) {
      const current = censusState.year;
      censusState.year = store.years.reduce((best, y) => {
        const dy = Math.abs(y - current);
        const db = Math.abs(best - current);
        return dy < db || (dy === db && y < best) ? y : best;
      });
    }
    syncCensusYearSelect();
    syncCensusTimeSlider();
    addCensusLayers();
    applyCensusPaint();
  } else {
    removeCensusLayers();
    syncPlaceDotEra();
    updateCensusLegend();
    writeCensusHash();
  }
  // the data maps pill's home state is the census toggle; its dot
  // follows the layer wherever the enable/disable came from
  if (offerMode === "toggle") renderOfferToggle();
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
  // the year slider keeps its index across a level switch, but the new
  // level's store.years rarely matches the old one's; clamp to the nearest
  // available year in either direction (earlier wins a tie) rather than
  // leaving censusState.year pointing at a year this level has no data for
  // (which paints the choropleth grey). the old not-after rule skipped
  // nearer forward years: 2021 against [2001, 2011, 2022] landed on 2011
  const newStore = censusActive();
  if (newStore && newStore.years.length && !newStore.years.includes(censusState.year)) {
    const current = censusState.year;
    censusState.year = newStore.years.reduce((best, y) => {
      const dy = Math.abs(y - current);
      const db = Math.abs(best - current);
      return dy < db || (dy === db && y < best) ? y : best;
    });
  }
  syncCensusYearSelect();
  syncCensusTimeSlider();
  addCensusLayers();
  applyCensusPaint();
}

// ---- overlay domain switching (design §3, §5) -------------------------
// single-domain pages — every page under the legacy shim — never call
// this; the select that drives it renders only when RC.overlays declares
// two or more domains. switching rebinds the domain-scoped constants,
// clears the level cache (level ids may repeat across domains), snaps to
// the target domain's defaults with the year carrying over when the
// target has it, and repaints.
async function setOverlayDomain(domainId) {
  if (!OVERLAY_DOMAINS[domainId] || domainId === activeDomainId) return;
  activeDomainId = domainId;
  censusState.domain = domainId;
  const domain = activeDomain();
  CENSUS_LEVELS = domain.levels;
  CENSUS_METRICS = buildCensusMetrics();
  CENSUS_TIMELINE = Array.isArray(domain.timeline)
    ? domain.timeline.slice().sort((a, b) => a.year - b.year)
    : null;
  removeCensusLayers();
  censusState.levels = {};
  censusState.level = domain.defaultLevel;
  censusState.metric = domain.defaultMetric;
  const carriedYear = censusState.year;
  censusState.year = domain.defaultYear;
  if (censusLevelSelect) {
    censusLevelSelect.innerHTML = "";
    for (const [id, def] of Object.entries(CENSUS_LEVELS)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = def.label;
      censusLevelSelect.appendChild(option);
    }
    censusLevelSelect.value = censusState.level;
  }
  populateMetricOptions();
  // dots are religion furniture: leaving religion hides them, returning
  // restores the remembered points mode through the same paint path
  syncPlaceDotEra();
  if (!censusState.enabled) return;
  const data = await loadCensusData(censusState.level);
  if (!data) {
    updateCensusLegend();
    return;
  }
  // the year carries over when the loaded store has it (design §5);
  // otherwise the nearest available year wins, earlier on a tie
  const store = censusActive();
  if (store && store.years.length) {
    const wanted = store.years.includes(carriedYear) ? carriedYear : censusState.year;
    censusState.year = store.years.includes(wanted) ? wanted : store.years.reduce((best, y) => {
      const dy = Math.abs(y - wanted);
      const db = Math.abs(best - wanted);
      return dy < db || (dy === db && y < best) ? y : best;
    });
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
    rememberCensusPanelDismissal(!censusPanelOpen);
    syncCensusPanel();
  });
}
// the phone X closes through the same state, so the census button's
// aria-expanded and caret stay truthful and remain the reopen path
const censusClose = document.getElementById("census-close");
if (censusClose) {
  censusClose.addEventListener("click", () => {
    censusPanelOpen = false;
    rememberCensusPanelDismissal(true);
    syncCensusPanel();
  });
}
if (censusLevelSelect && HAS_CENSUS) {
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
  populateMetricOptions();
  censusMetricSelect.addEventListener("change", () => {
    if (pulotuState.active) {
      pulotuState.metric = censusMetricSelect.value;
      applyPulotuPaint();
      updateCensusLegend();
      return;
    }
    censusState.metric = censusMetricSelect.value;
    applyCensusPaint();
  });
}
// the domain select renders only when the page declares two or more
// overlay domains (design §3); every single-domain page — all pages
// under the legacy shim — keeps no control and no change
const censusDomainSelect = document.getElementById("censusDomain");
if (censusDomainSelect && Object.keys(OVERLAY_DOMAINS).length > 1) {
  for (const [id, block] of Object.entries(OVERLAY_DOMAINS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = block.label || id;
    censusDomainSelect.appendChild(option);
  }
  censusDomainSelect.value = activeDomainId;
  censusDomainSelect.hidden = false;
  censusDomainSelect.addEventListener("change", () => {
    void setOverlayDomain(censusDomainSelect.value);
  });
}
// the data-source select exists only where a page opts into the pulotu
// layer; everywhere else the census is the sole source and the select
// stays hidden
if (censusSourceSelect && RC.pulotuCultures) {
  for (const [value, label] of [["census", RC.dataNoun || "Census"], ["pulotu", "Pulotu cultures"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    censusSourceSelect.appendChild(option);
  }
  censusSourceSelect.value = "census";
  censusSourceSelect.hidden = false;
  censusSourceSelect.addEventListener("change", () => {
    void setDataSource(censusSourceSelect.value);
  });
}
{
  // points control: period only exists where the country ships a dated
  // layer; choosing any mode pins it until the user chooses again
  const censusPointsSelect = document.getElementById("censusPoints");
  if (censusPointsSelect) {
    const modes = RC.datedPlaces
      ? [["period", "Points: period"], ["all", "Points: all"], ["off", "Points: off"]]
      : [["all", "Points: all"], ["off", "Points: off"]];
    // pulotu is a data source, not a points mode (pi directive
    // 2026-07-12): the points control speaks only for the pow dots,
    // which stay optionally on the map under either source
    for (const [value, label] of modes) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      censusPointsSelect.appendChild(option);
    }
    censusPointsSelect.value = "all";
    censusPointsSelect.addEventListener("change", () => {
      placesDotState.mode = censusPointsSelect.value;
      applyCensusPaint();
    });
    const futureBox = document.getElementById("censusPointsFuture");
    if (futureBox) {
      futureBox.addEventListener("change", () => {
        placesDotState.future = futureBox.checked;
        applyCensusPaint();
      });
    }
  }
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

// ---- border handoff ------------------------------------------------------
// moving from one country's data map to a neighbour's should not need the
// hub (JW request, 2026-07-14). when the map centre leaves this country's
// data extent, a pill offers the country now under the centre — or the way
// home when the centre is over open water — and a handoff carries the
// camera hash so the next page opens on the same view. country extents
// come from a committed manifest generated off the shipped boundary files
// (scripts/build_region_bboxes.py; rerun it when a country launches);
// boxes are [west, south, east, north], west > east wrapping the
// antimeridian. no manifest, no feature: the page behaves as before.
const offerGo = document.getElementById("datamaps-go");
const offerShell = document.getElementById("datamaps-pill");
let offerMode = "resting"; // resting | toggle | hint | offer
let offerRegion = null;    // the manifest entry the mode points at
let offerSavedLabel = null;
// the handoff home key: a country page's own code, or null on the global
// map, which has no home — null switches the engine to global semantics
// (hint state, zoom-driven refresh, deferred manifest fetch)
const HANDOFF_HOME = RC.countryCode ? RC.countryCode.toLowerCase() : null;
// legacy arrival marker from older handoff links; consumed and ignored
const HANDOFF_ORIGIN_PARAM = "handoff-from";
// offers need a country-scale view; below this zoom the centre names
// nothing in particular
const HANDOFF_MIN_ZOOM = 3;
let handoffRegions = null;
let handoffTapTarget = null; // a tap-made offer outlives programmatic moveends
const handoffPrefetched = new Set();

// geometry lives in the shared resolver (apps/shared/region-resolve.js),
// one implementation for every surface after tribunal review caught the
// global map's duplicate diverging (design record:
// docs/development/country-broadcast-review-2026-07.md)
const normaliseLng = window.RegionResolve.normaliseLng;

// the foreign country under a point, land-verified with the rectangle-only
// fallback for entries without outlines; null over home, over open water,
// and over water inside the home rectangle. shared by the centre-crossing
// detection and the tap-on-a-neighbour offer, so both name the same country
function handoffNeighbourAt(lng, lat) {
  if (!handoffRegions) return null;
  // no homeCode on the global map: every data country resolves, none is home
  return window.RegionResolve.resolveAt(handoffRegions, lng, lat, HANDOFF_HOME ? { homeCode: HANDOFF_HOME } : undefined);
}

// the census view a departure carries (roam v1): metric and year are
// valid even before the layer's first load completes (they hold the
// defaults); only the pulotu source withholds them
function handoffCarrySegment() {
  return HAS_CENSUS && !pulotuState.active ? `&d=${censusState.metric}:${censusState.year}` : "";
}

function handoffHref(target) {
  const centre = map.getCenter();
  const zoom = map.getZoom().toFixed(2);
  return `${REGIONS_BASE}${target.code}/#map=${zoom}/${centre.lat.toFixed(5)}/${normaliseLng(centre.lng).toFixed(5)}` +
    handoffCarrySegment();
}

// ---- the data maps pill's offer states --------------------------------
// the split pill's main zone follows the map with exactly two working
// states (jb 2026-07-16): the census toggle — "NZ Data" with an on/off
// dot, one tap hides or restores the choropleth — and the travel offer —
// "<Country> Data →" in emerald whenever the centre rests over another
// data country, one tap goes there with the census view carried. each
// offer replaces the last as the user moves; there are no sticky "back"
// states (tracking covers the return, and the reset button restores the
// initial state). resting (before the manifest arrives, or when the
// handoff is disabled) it stays the plain "Data Maps" trigger for the
// switcher panel, whose listener it defers to; the caret zone opens
// that panel in every state.
function renderOfferToggle() {
  const on = censusState.enabled;
  // re-rendering an unchanged toggle would spam the pill's polite live
  // region on every moveend; only a real state change speaks
  const want = on ? "true" : "false";
  if (offerGo.getAttribute("aria-pressed") === want && offerGo.querySelector(".dm-dot")) return;
  const noun = (RC.dataNoun || "census").toLowerCase();
  offerGo.innerHTML = `<span class="dm-dot${on ? " on" : ""}" aria-hidden="true"></span><span>${RC.countryCode.toUpperCase()} Data</span>`;
  offerGo.setAttribute("aria-pressed", want);
  offerGo.setAttribute("aria-label", `${on ? "Hide" : "Show"} the ${RC.countryCode.toUpperCase()} ${noun} data layer`);
}

function setOffer(mode, region) {
  if (!offerGo) return;
  if (mode === offerMode) {
    if (mode === "toggle") renderOfferToggle();
    if (region && offerRegion && region.code === offerRegion.code) {
      // same offer, new camera: keep modified clicks and copied links
      // honest about where they lead
      if (mode === "offer") offerGo.setAttribute("href", handoffHref(region));
      return;
    }
    if (!region && !offerRegion) return;
  }
  offerMode = mode;
  offerRegion = region || null;
  offerShell.classList.toggle("offering", mode === "offer");
  offerShell.classList.toggle("hinting", mode === "hint");
  if (mode === "resting") {
    if (offerSavedLabel !== null) {
      offerGo.innerHTML = offerSavedLabel;
      offerSavedLabel = null;
    }
    offerGo.setAttribute("href", REGIONS_BASE);
    offerGo.removeAttribute("role");
    offerGo.removeAttribute("tabindex");
    offerGo.removeAttribute("aria-label");
    offerGo.removeAttribute("aria-pressed");
    return;
  }
  if (offerSavedLabel === null) offerSavedLabel = offerGo.innerHTML;
  offerGo.removeAttribute("aria-pressed");
  if (mode !== "toggle") offerGo.removeAttribute("tabindex");
  if (mode === "toggle") {
    // the toggle acts in place, so it carries no destination; an anchor
    // without href leaves the tab order, so tabindex keeps it reachable
    // (enter and space handled below)
    offerGo.removeAttribute("href");
    offerGo.setAttribute("role", "button");
    offerGo.setAttribute("tabindex", "0");
    renderOfferToggle();
  } else if (mode === "offer") {
    // the arrow sits outside the ellipsised name, so a long country
    // never truncates the navigation affordance itself
    offerGo.innerHTML = `<span class="dm-offer-name"></span><span class="dm-offer-arrow" aria-hidden="true">→</span>`;
    offerGo.querySelector(".dm-offer-name").textContent = `${region.name} Data`;
    offerGo.setAttribute("href", handoffHref(region));
    offerGo.removeAttribute("role");
    offerGo.setAttribute("aria-label", `Open the ${region.name} data map`);
    prefetchHandoffPage(region.code);
  } else if (mode === "hint") {
    // global-only state: a data country sits under the centre but the
    // view is too far out for a direct offer; the hint promises data on
    // zoom and the click handler delivers the zoom
    offerGo.textContent = `Zoom for ${region.name} data`;
    offerGo.setAttribute("href", REGIONS_BASE);
    offerGo.removeAttribute("role");
    offerGo.setAttribute("aria-label", `Zoom in for ${region.name} data`);
  }
}

function prefetchHandoffPage(code) {
  // warm the neighbour's page while the user reads the offer
  if (handoffPrefetched.has(code)) return;
  handoffPrefetched.add(code);
  if (typeof window.datamapsPrefetchCountry === "function") {
    window.datamapsPrefetchCountry(code);
    return;
  }
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = `${REGIONS_BASE}${code}/`;
  document.head.appendChild(link);
}

function updateBorderHandoff() {
  if (!handoffRegions) return;
  // a tap-made offer survives programmatic camera nudges (whose moveends
  // would otherwise re-derive from a centre still over home); only a real
  // user gesture — which clears the tap target on movestart — dismisses it
  if (handoffTapTarget) {
    setOffer("offer", handoffTapTarget);
    return;
  }
  if (HANDOFF_HOME && HAS_CENSUS) {
    // country semantics: below the offer zoom the pill is the census
    // toggle, before any resolve; a neighbour under the centre offers.
    // toggle mode needs census data behind it — a dots-only home page
    // (countryCode set, census pending) falls through to the global
    // semantics below so the pill never renders a dead toggle
    if (map.getZoom() < HANDOFF_MIN_ZOOM) { setOffer("toggle"); return; }
    const centre = map.getCenter();
    const lng = normaliseLng(centre.lng);
    const lat = centre.lat;
    const pick = handoffNeighbourAt(lng, lat);
    if (pick) setOffer("offer", pick);
    else setOffer("toggle");
    return;
  }
  // global semantics: no census toggle to fall back to — a data country
  // under the centre offers at offer zoom, hints below it, and open
  // water rests the pill
  const centre = map.getCenter();
  const lng = normaliseLng(centre.lng);
  const lat = centre.lat;
  const pick = handoffNeighbourAt(lng, lat);
  if (pick && map.getZoom() >= HANDOFF_MIN_ZOOM) setOffer("offer", pick);
  else if (pick) setOffer("hint", pick);
  else setOffer("resting", null);
}

// near me can land the camera outside this country entirely (the phone
// is in another country); the choropleth has nothing to paint there, so
// the data layer reads off while its panels keep talking about a census
// the viewport no longer shows. make the state honest: turn the census
// off and fold its panel. only the crossing itself acts — a user who
// re-enables the layer while abroad (to browse this map's data from
// afar) is not fought on every subsequent watch fix.
let lastFixWasAbroad = false;
geolocate.on("geolocate", (event) => {
  if (!handoffRegions || !event || !event.coords) return;
  const lng = normaliseLng(event.coords.longitude);
  const lat = event.coords.latitude;
  const home = handoffRegions.find((r) => r.code === HANDOFF_HOME);
  // home means on home land or over water inside the home rectangle —
  // the same nulls the handoff resolver treats as "not a neighbour"
  const abroad = Boolean(home) &&
    !window.RegionResolve.regionHasPoint(home, lng, lat) &&
    !home.boxes.some((b) => window.RegionResolve.boxContains(b, lng, lat, 0));
  if (abroad && !lastFixWasAbroad && censusState.enabled) {
    void setCensusEnabled(false);
    censusPanelOpen = false;
    syncCensusPanel();
  }
  lastFixWasAbroad = abroad;
});

if (offerGo && !RC.disableBorderHandoff) {
  // country pages revalidate the manifest against the host's etag
  // (no-cache), so a new country launch reaches every page without a
  // cache-pin ceremony; the global map keeps default caching — the etag
  // still revalidates — and defers the fetch past window load so the
  // manifest stays off the critical path
  const armOffers = () => {
    fetch(`${REGIONS_BASE}_shared/data/region-bboxes.json`, HANDOFF_HOME ? { cache: "no-cache" } : undefined)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (!doc || !Array.isArray(doc.regions)) return;
        handoffRegions = doc.regions;
        // consume the legacy arrival marker so older links stay clean
        writeHashParam(HANDOFF_ORIGIN_PARAM, null);
        if (HANDOFF_HOME) {
          // the pill is persistent chrome, so it keeps its state during a
          // gesture and moveend re-derives it. only a USER gesture drops a
          // tap-made offer: the runtime's own camera nudges (nudgeMap's
          // paired jumpTo calls after layer refreshes) are programmatic
          // movestarts with no originalEvent, and they must not eat it
          map.on("movestart", (e) => {
            if (e && e.originalEvent) handoffTapTarget = null;
          });
        }
        map.on("moveend", updateBorderHandoff);
        if (HANDOFF_HOME) {
          // touching a neighbouring country's territory is a stronger signal
          // than drifting the centre across a border: the tap surfaces the
          // offer on the pill — navigation still takes a tap on the pill, so
          // a stray touch never yanks the user off their map. runs only when
          // the tap hit none of the page's interactive layers, so place
          // dots, census areas, and pulotu points keep every popup
          map.on("click", (e) => {
            if (map.getZoom() < HANDOFF_MIN_ZOOM) return;
            const target = e.originalEvent && e.originalEvent.target;
            if (target instanceof Element && target.closest(
              "button, a, input, select, textarea, label, #dock, #counts-wrap, #key-wrap, #census-wrap, #wordmark, #corner-refresh, .maplibregl-ctrl"
            )) return;
            const interactive = [LAYERS.places, LAYERS.overview, CENSUS.fill, PULOTU.layer]
              .filter((id) => id && map.getLayer(id));
            if (interactive.length && map.queryRenderedFeatures(e.point, { layers: interactive }).length) return;
            const pick = handoffNeighbourAt(normaliseLng(e.lngLat.lng), e.lngLat.lat);
            if (!pick) {
              // tapping home or water dismisses what tapping a neighbour offered
              if (handoffTapTarget) {
                handoffTapTarget = null;
                updateBorderHandoff();
              }
              return;
            }
            handoffTapTarget = pick;
            setOffer("offer", pick);
          });
        } else {
          // the global hint↔offer transition is purely zoom-driven, so
          // moveend alone would freeze a hint until the next pan; on
          // country pages this would double-call per zoom, so global-only
          map.on("zoomend", updateBorderHandoff);
        }
        updateBorderHandoff();
      })
      .catch(() => {});
  };
  if (HANDOFF_HOME) armOffers();
  else if (document.readyState === "complete") armOffers();
  else window.addEventListener("load", armOffers, { once: true });
  // the offer engine claims the main zone's clicks in every non-resting
  // state; this listener registers before the switcher's (script order),
  // so resting clicks fall through to the panel as usual
  // the toggle is an anchor without href, so enter and space activate it
  // by hand (role=button promises both keys)
  offerGo.addEventListener("keydown", (e) => {
    if (offerMode !== "toggle") return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    offerGo.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
  offerGo.addEventListener("click", (e) => {
    if (offerMode === "resting") return;
    // modified activations keep their native new-tab/window behaviour on
    // the href set with the offer
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (offerMode === "toggle") {
      // one tap hides or restores the census choropleth in place; the
      // dot follows the state even if a stalled style delays the paint
      Promise.resolve(setCensusEnabled(!censusState.enabled))
        .catch(() => {})
        .finally(() => {
          if (offerMode === "toggle") renderOfferToggle();
        });
      return;
    }
    if (offerMode === "hint") {
      // the hint promises data on zoom; deliver the zoom. jumpTo by
      // choice, not necessity: the old page's claim that flyTo/zoomTo
      // no-op on the global surface was disproved by hand (reset's
      // flyTo moves the camera; jb 2026-08-14) — the instant jump is
      // simply the promise kept without an animation to wait through
      map.jumpTo({ zoom: HANDOFF_MIN_ZOOM + 0.4 });
      return;
    }
    if (offerMode === "offer") {
      if (HANDOFF_HOME) {
        // remember the country being left, so the switcher panel can pin a
        // one-tap return row (the pill itself keeps no sticky back state);
        // the global map has no home to name, so it writes nothing
        try {
          const homeEntry = handoffRegions && handoffRegions.find((r) => r.code === HANDOFF_HOME);
          window.sessionStorage.setItem("dm-previous", JSON.stringify({
            code: HANDOFF_HOME,
            name: homeEntry ? homeEntry.name : RC.countryCode.toUpperCase()
          }));
        } catch (err) {
          // private-mode storage failures cost only the return row
        }
      }
      // one tap goes there, census view riding along (roam v1); the
      // href rebuilds at click time so the camera is exact
      window.location.href = handoffHref(offerRegion);
    }
  });
}
