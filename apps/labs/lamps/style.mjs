// the lamps basemap: a minimal style over openmaptiles vector tiles so the
// page controls every colour, plus the places sources, the night shade and
// the pillars. paints that follow the sun are set again by applyTones().

import { TRADITIONS, KNOWN_TRADITIONS, LAMP_GOLD, mix } from "../shared/palette.mjs";

export const PLACES_TILE_PROTOCOL = "places-tile";
export const TILES = {
  overview: `${PLACES_TILE_PROTOCOL}://tiles.placemap.org/places-overview-v2-20260722-grid/{z}/{x}/{y}`,
  places: `${PLACES_TILE_PROTOCOL}://tiles.placemap.org/places-v2-20260722-grid/{z}/{x}/{y}`
};

const OSM_CREDIT = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// lift > 0 moves every colour toward white, to read as light in the dark
export function traditionColor(lift = 0) {
  const c = (hex) => (lift > 0 ? mix(hex, "#ffffff", lift) : hex);
  return [
    "match",
    ["coalesce", ["get", "religion"], "unknown"],
    ...TRADITIONS.filter((t) => t.key !== "other").flatMap((t) => [t.key, c(t.color)]),
    c(TRADITIONS.find((t) => t.key === "other").color)
  ];
}

// pillars carry their tradition key already
const pillarColor = [
  "match",
  ["get", "tradition"],
  ...TRADITIONS.filter((t) => t.key !== "other").flatMap((t) => [t.key, t.color]),
  TRADITIONS.find((t) => t.key === "other").color
];

// the lit crown of a pillar: its colour lifted toward lamp light
const crownColor = [
  "match",
  ["get", "tradition"],
  ...TRADITIONS.filter((t) => t.key !== "other").flatMap((t) => [t.key, mix(t.color, "#fff4dc", 0.55)]),
  mix(TRADITIONS.find((t) => t.key === "other").color, "#fff4dc", 0.55)
];

// how many places an overview light stands for. a light for one place is
// small and faint; lights for more grow and brighten, so a dense region
// builds up brightness where its lights overlap instead of saturating
const places = ["coalesce", ["get", "n"], 1];
const weight = ["interpolate", ["linear"], places, 1, 0.7, 10, 1.2, 100, 1.9, 1000, 2.7, 4000, 3.2];
export const presence = ["interpolate", ["linear"], places, 1, 0.38, 5, 0.55, 30, 0.78, 300, 0.95];

export const SCALE = { regionFrom: 5.6, cityFrom: 11 };

export function buildStyle({ key, tones, nightData }) {
  const q = `key=${encodeURIComponent(key)}`;
  const label = ["Source Sans Pro Regular"];
  const sky = ["Noto Serif Italic"];
  return {
    version: 8,
    name: "Lamps",
    state: { shade: { default: 1 } },
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?${q}`,
    projection: { type: "globe" },
    // paint changes land at once: the terrain drape is drawn from the value
    // of the frame it is drawn in, so an easing value would be frozen
    // part-way (the page eases the tones itself, with the sun)
    transition: { duration: 0, delay: 0 },
    light: { anchor: "map", position: [1.15, 210, 40], color: "#ffffff", intensity: 0.4 },
    sky: {
      "sky-color": tones.sky,
      "horizon-color": tones.horizon,
      "fog-color": tones.horizon,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.75,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 5, 0.4, 8, 0]
    },
    terrain: { source: "dem", exaggeration: 1.15 },
    sources: {
      omt: { type: "vector", url: `https://api.maptiler.com/tiles/v3/tiles.json?${q}` },
      dem: { type: "raster-dem", url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?${q}` },
      relief: { type: "raster-dem", url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?${q}` },
      overview: { type: "vector", tiles: [TILES.overview], minzoom: 0, maxzoom: 5, attribution: OSM_CREDIT },
      // every place is in the tiles from zoom 8; zoom 14 tiles carry full
      // precision for a point, so deeper zooms reuse them
      places: { type: "vector", tiles: [TILES.places], minzoom: 6, maxzoom: 14, attribution: OSM_CREDIT },
      night: { type: "geojson", data: nightData, maxzoom: 6, tolerance: 0.6 },
      pillars: { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" },
      selection: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": tones.land } },
      {
        id: "relief",
        type: "hillshade",
        source: "relief",
        // from zoom 3: the relief tiles stop short of the poles, and over
        // the whole globe the bare polar cap showed as a pale disc
        minzoom: 3,
        maxzoom: 15,
        paint: {
          "hillshade-exaggeration": 0.32,
          "hillshade-shadow-color": tones.shadow,
          "hillshade-highlight-color": tones.highlight,
          "hillshade-accent-color": tones.shadow,
          "hillshade-illumination-anchor": "map"
        }
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": tones.water, "fill-antialias": true }
      },
      {
        id: "rivers",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        minzoom: 8,
        filter: ["match", ["get", "class"], ["river", "canal"], true, false],
        paint: { "line-color": tones.water, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 2.2] }
      },
      {
        id: "roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 10,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": tones.road,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 11, 0.85],
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 0.6, 14, 2.4, 17, 9]
        }
      },
      {
        id: "borders",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: {
          "line-color": tones.boundary,
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 0.9, 12, 1.4]
        }
      },
      {
        // the night side: nested caps, each a little darker, so the shade
        // deepens through twilight into night
        id: "night",
        type: "fill",
        source: "night",
        paint: { "fill-color": "#060a24", "fill-opacity": ["*", ["get", "alpha"], ["global-state", "shade"]], "fill-antialias": false }
      },
      {
        // draws nothing. the terrain caches the layers it drapes over the
        // ground and redraws a cached tile when the set of visible layers
        // changes, not when a paint value does; switching this layer on and
        // off makes the drape take up new tones (refreshDrape in lamps.mjs)
        id: "drape-refresh",
        type: "fill",
        source: "night",
        filter: false,
        paint: { "fill-opacity": 0 }
      },
      {
        id: "buildings",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": tones.building,
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.82]
        }
      },
      {
        id: "overview-glow",
        type: "circle",
        source: "overview",
        "source-layer": "places_overview",
        maxzoom: 6.2,
        paint: {
          "circle-color": traditionColor(),
          "circle-blur": 1,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, ["*", 1.8, weight], 3, ["*", 2.6, weight], 6, ["*", 5, weight]],
          "circle-opacity": ["*", 0.22, presence],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "overview-core",
        type: "circle",
        source: "overview",
        "source-layer": "places_overview",
        maxzoom: 6.2,
        paint: {
          "circle-color": traditionColor(),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, ["*", 0.75, weight], 3, ["*", 1.05, weight], 6, ["*", 1.9, weight]],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5.6, presence, 6.2, 0],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "places-glow",
        type: "circle",
        source: "places",
        "source-layer": "places",
        minzoom: 5.6,
        paint: {
          "circle-color": traditionColor(),
          "circle-blur": 1,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 10, 10, 13, 16],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12.6, 0.3, 13.6, 0],
          "circle-pitch-alignment": "map"
        }
      },
      {
        id: "places-core",
        type: "circle",
        source: "places",
        "source-layer": "places",
        minzoom: 5.6,
        // stays on past the city fade, so the places tiles stay loaded for
        // the pillars that are built from them
        paint: {
          "circle-color": traditionColor(),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.5, 10, 2.6, 13, 3.6],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5.6, 0, 6.2, 0.95, 12.6, 0.95, 13.6, 0],
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(29, 34, 51, 0.35)",
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 5.6, 0, 6.2, 1, 12.6, 1, 13.6, 0],
          "circle-pitch-alignment": "map"
        }
      },
      {
        // a soft pool of light at the foot of each pillar
        id: "pools",
        type: "circle",
        source: "pillars",
        minzoom: 11.5,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": pillarColor,
          "circle-blur": 1,
          "circle-radius": 20,
          "circle-opacity": 0.4,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map"
        }
      },
      {
        id: "pillars",
        type: "fill-extrusion",
        source: "pillars",
        minzoom: 11.5,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-extrusion-color": pillarColor,
          "fill-extrusion-height": 60,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1],
          "fill-extrusion-vertical-gradient": true
        }
      },
      {
        // the top of each pillar burns paler, like the flame of a lamp
        id: "crowns",
        type: "fill-extrusion",
        source: "pillars",
        minzoom: 11.5,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-extrusion-color": crownColor,
          "fill-extrusion-height": 60,
          "fill-extrusion-base": 54,
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1],
          "fill-extrusion-vertical-gradient": false
        }
      },
      {
        id: "selection-pool",
        type: "circle",
        source: "selection",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": LAMP_GOLD,
          "circle-radius": 30,
          "circle-blur": 0.6,
          "circle-opacity": 0.75,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map"
        }
      },
      {
        id: "selection-crown",
        type: "fill-extrusion",
        source: "selection",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-extrusion-color": LAMP_GOLD,
          "fill-extrusion-height": 66,
          "fill-extrusion-base": 60,
          "fill-extrusion-opacity": 1
        }
      },
      {
        id: "water-names",
        type: "symbol",
        source: "omt",
        "source-layer": "water_name",
        // oceans over the globe; seas, lakes and bays once a region fills the view
        filter: ["any",
          ["==", ["get", "class"], "ocean"],
          ["all", [">=", ["zoom"], 3.5], ["match", ["get", "class"], ["sea", "lake", "bay"], true, false]]
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": sky,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 13, 6, 14, 12, 15],
          "text-letter-spacing": 0.04,
          "text-max-width": 7
        },
        paint: { "text-color": tones.water, "text-halo-width": 0 }
      },
      {
        id: "cities",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 5,
        filter: ["any",
          ["all", ["==", ["get", "class"], "city"], ["<=", ["coalesce", ["get", "rank"], 99], 6]],
          ["all", ["==", ["get", "class"], "town"], [">=", ["zoom"], 10]],
          ["all", ["match", ["get", "class"], ["suburb", "neighbourhood"], true, false], [">=", ["zoom"], 13]]
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": label,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 13, 10, 15, 14, 14],
          "text-max-width": 8,
          "text-padding": 12,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 99]
        },
        paint: { "text-color": tones.label, "text-halo-color": tones.labelHalo, "text-halo-width": 1.4, "text-halo-blur": 0.4 }
      }
    ]
  };
}

// the layers that draw places, for filtering by tradition
export const PLACE_LAYERS = ["overview-glow", "overview-core", "places-glow", "places-core"];
export const PILLAR_LAYERS = ["pools", "pillars", "crowns"];

export function traditionFilter(enabled) {
  const known = KNOWN_TRADITIONS.filter((k) => enabled.has(k));
  const religion = ["coalesce", ["get", "religion"], "unknown"];
  const parts = [];
  if (known.length) parts.push(["match", religion, known, true, false]);
  if (enabled.has("other")) parts.push(["match", religion, KNOWN_TRADITIONS, false, true]);
  return parts.length ? ["any", ...parts] : false;
}

export function pillarFilter(enabled, geometry) {
  return ["all", ["==", ["geometry-type"], geometry], ["in", ["get", "tradition"], ["literal", [...enabled]]]];
}
