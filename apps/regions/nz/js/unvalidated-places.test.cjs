// the shared unreviewed-places module (jb 2026-09-04): amber for every
// place no reviewer has confirmed, both tile tiers, and the pure nearest-
// symbol hit test the ra and review portals run against the rendered dots
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const window = {};
const context = vm.createContext({ window, Math, Object, Array, Number, String, Boolean });
vm.runInContext(fs.readFileSync(path.join(__dirname, "unvalidated-places.js"), "utf8"), context, { filename: "unvalidated-places.js" });
const mod = window.PowUnvalidatedPlaces;

// colours: amber disc, white halo, one value for both portals
assert.equal(mod.COLOUR, "#f59e0b");
assert.equal(mod.HALO, "#ffffff");
assert.equal(mod.dotStyle(true).fillColor, "#f59e0b");
assert.equal(mod.dotStyle(false).color, "#ffffff");

// the two tiers meet at zoom 8: the country's dots (or the overview sample)
// below, the full places tier from 8 in
assert.equal(mod.PLACES_MIN_ZOOM, 8);
assert.equal(mod.OVERVIEW_TILE_MAX_NATIVE_ZOOM, 5);
assert.equal(mod.OVERVIEW_TILE_URL, "https://tiles.placemap.org/places-overview-v2-20260722/{z}/{x}/{y}");
assert.match(mod.PLACES_TILE_URL, /\/places\//);
assert.equal(mod.RA_DOTS_MIN_NATIVE_ZOOM, 3);
assert.equal(mod.RA_DOTS_MAX_NATIVE_ZOOM, 7);

// the archive list: 210 two-letter codes from the tiles-v2-20260722 manifest
assert.equal(mod.RA_DOTS_COUNTRY_CODES.size, 210);
[...mod.RA_DOTS_COUNTRY_CODES].forEach(code => assert.match(code, /^[a-z]{2}$/));
["nz", "us", "de", "se", "fj", "gb", "id", "br"].forEach(code => assert.ok(mod.RA_DOTS_COUNTRY_CODES.has(code), code));
["zz", "uk", "aq", "xk"].forEach(code => assert.equal(mod.RA_DOTS_COUNTRY_CODES.has(code), false, code));
assert.equal(mod.raDotsTileUrl("NZ"), "https://tiles.placemap.org/ra-dots-nz-20260722/{z}/{x}/{y}");
assert.equal(mod.raDotsTileUrl(" us "), "https://tiles.placemap.org/ra-dots-us-20260722/{z}/{x}/{y}");
assert.equal(mod.raDotsTileUrl("ZZ"), null);
assert.equal(mod.raDotsTileUrl(""), null);
assert.equal(mod.raDotsTileUrl(undefined), null);

// createLayers: null without vectorgrid, otherwise both tiers with the
// zoom hand-off and non-interactive paths
assert.equal(mod.createLayers({}), null);
const made = [];
const fakeL = {
    vectorGrid: {
        protobuf(url, opts) {
            made.push({ url, opts });
            return { url, opts };
        },
    },
};
// no country (the world view): the overview sample, native zoom 5
const layers = mod.createLayers(fakeL);
assert.equal(made.length, 2);
assert.equal(layers.overview.url, mod.OVERVIEW_TILE_URL);
assert.equal(layers.overview.opts.maxZoom, 7);
assert.equal(layers.overview.opts.maxNativeZoom, 5);
assert.equal("minNativeZoom" in layers.overview.opts, false);
assert.equal(layers.places.opts.minZoom, 8);
assert.equal(layers.places.url, mod.PLACES_TILE_URL);
assert.equal(layers.overview.opts.interactive, false);
assert.equal(layers.places.opts.interactive, false);
assert.equal(layers.overview.opts.pane, "overlayPane");
assert.equal(Object.keys(layers.overview.opts.vectorTileLayerStyles).join(), "places_overview");
assert.equal(Object.keys(layers.places.opts.vectorTileLayerStyles).join(), "places");
// without a canvas tile renderer the module's default (svg) stands
assert.equal("rendererFactory" in layers.overview.opts, false);

// a country with an archive: its own ra-dots tiles, native zooms 3 to 7,
// the overview sample not requested at all
made.length = 0;
const nz = mod.createLayers(fakeL, { countryCode: "NZ" });
assert.equal(nz.overview.url, "https://tiles.placemap.org/ra-dots-nz-20260722/{z}/{x}/{y}");
assert.equal(nz.overview.opts.minNativeZoom, 3);
assert.equal(nz.overview.opts.maxNativeZoom, 7);
assert.equal(nz.overview.opts.maxZoom, 7);
assert.equal(Object.keys(nz.overview.opts.vectorTileLayerStyles).join(), "places_overview");
assert.equal(nz.overview.opts.vectorTileLayerStyles.places_overview.fillColor, "#f59e0b");
assert.equal(nz.places.url, mod.PLACES_TILE_URL);
assert.equal(nz.places.opts.minZoom, 8);
assert.ok(made.every(entry => !/places-overview/.test(entry.url)));

// a country with no archive (and ZZ) falls back to the overview sample
["ZZ", "aq", "xx"].forEach(code => {
    const fallback = mod.createLayers(fakeL, { countryCode: code });
    assert.equal(fallback.overview.url, mod.OVERVIEW_TILE_URL, code);
    assert.equal(fallback.overview.opts.maxNativeZoom, 5, code);
});

// the dots paint on canvas tiles where the bundled build offers them (jb
// 2026-09-22: the svg renderer's dom paths crashed ios safari on sweden);
// no client-side filter stands between a tile's places and the draw
const tile = () => "canvas-tile";
const withCanvas = { ...fakeL, canvas: { tile } };
const se = mod.createLayers(withCanvas, { countryCode: "se" });
assert.equal(se.overview.opts.rendererFactory, tile);
assert.equal(se.places.opts.rendererFactory, tile);
assert.equal(typeof se.overview.opts.vectorTileLayerStyles.places_overview, "object");
assert.equal(se.overview.opts.vectorTileLayerStyles.places_overview.fillColor, "#f59e0b");
assert.equal(se.places.opts.vectorTileLayerStyles.places.fillColor, "#f59e0b");
// the retired overviewKeep option is ignored
const ignored = mod.createLayers(withCanvas, { overviewKeep: () => false });
assert.equal(ignored.overview.opts.vectorTileLayerStyles.places_overview.fillColor, "#f59e0b");

// nearestSymbol: the nearest rendered symbol within the radius, across
// layers, with the feature's own position handed back by the projector
const layerA = {
    _vectorTiles: {
        t1: { _tileCoord: { x: 1, y: 1, z: 8 }, _layers: {
            a: { _point: { x: 10, y: 10 }, properties: { name: "A", osm_id: 1, osm_type: "node" } },
            b: { _point: { x: 40, y: 40 }, properties: { name: "B", osm_id: 2, osm_type: "way" } },
        } },
    },
};
const layerB = {
    _vectorTiles: {
        t2: { _tileCoord: { x: 2, y: 1, z: 8 }, _layers: {
            c: { _point: { x: 5, y: 5 }, properties: { name: "C", osm_id: 3, osm_type: "node" } },
        } },
    },
};
// projector: tile x offsets by 100px per tile column, identity otherwise
const project = (coord, point) => ({ x: (coord.x - 1) * 100 + point.x, y: point.y, latlng: { lat: -point.y, lng: point.x } });
const hitA = mod.nearestSymbol([layerA, layerB], { x: 12, y: 9 }, 14, project);
assert.equal(hitA.properties.name, "A");
assert.equal(`${hitA.latlng.lat},${hitA.latlng.lng}`, "-10,10");
const hitC = mod.nearestSymbol([layerA, layerB], { x: 103, y: 6 }, 14, project);
assert.equal(hitC.properties.name, "C");
assert.equal(mod.nearestSymbol([layerA, layerB], { x: 70, y: 70 }, 14, project), null);
assert.equal(mod.nearestSymbol([null, { _vectorTiles: null }], { x: 0, y: 0 }, 14, project), null);

// featureFrom: geojson shape with the tile's identity fields
const feature = mod.featureFrom({ name: "A", osm_id: 1, osm_type: "node", country_code: "NZ" }, { lat: -41, lng: 174 });
assert.equal(feature.type, "Feature");
assert.equal(feature.geometry.coordinates.join(","), "174,-41");
assert.equal(feature.properties.osm_id, 1);
assert.equal(feature.properties.country_code, "NZ");

console.log("unvalidated-places: ok");
