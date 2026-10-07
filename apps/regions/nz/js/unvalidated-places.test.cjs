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
// the zoom floor: no request below the archive's first zoom (minNativeZoom
// alone clamps to z3 but still loads the layer at z1 and z2)
assert.equal(nz.overview.opts.minZoom, 3);
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
    assert.equal("minZoom" in fallback.overview.opts, false, code);
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

// the map's zoom floor while an ra-dots archive layer is shown (#177's final
// review). leaflet takes a map's lowest zoom from the lowest minZoom among
// its layers, so the archive layer's minZoom of 3 alone never stopped a map
// whose basemap reaches lower. the fake map keeps leaflet 1.9's arithmetic:
// getMinZoom() is the explicit option or the layers' lowest, and setView()
// clamps to it
{
    const fakeLeaflet = {
        vectorGrid: { protobuf(url, opts) { return { url, opts, addTo(map) { map.layers.add(this); return this; } }; } },
    };
    const makeMap = ({ zoom, layersMin, explicitMin }) => ({
        options: explicitMin === undefined ? {} : { minZoom: explicitMin },
        zoom, centre: [61.2, 104.9], layers: new Set(), fired: [],
        getMinZoom() { return this.options.minZoom === undefined ? layersMin : this.options.minZoom; },
        setMinZoom(value) { this.options.minZoom = value; if (this.zoom < value) this.setView(this.centre, value); return this; },
        setView(centre, value) { this.centre = centre; this.zoom = Math.max(this.getMinZoom(), value); return this; },
        hasLayer(layer) { return this.layers.has(layer); },
        removeLayer(layer) { this.layers.delete(layer); },
        fire(name) { this.fired.push(name); },
    });
    const russia = { centre: [61.2009, 104.8805], zoom: 2.5 };

    // russia opens at 2.5 with a basemap that reaches z2: before the fix the dots (z3 and up) were gone on arrival
    const ru = mod.createLayers(fakeLeaflet, { countryCode: "RU" });
    assert.equal(ru.zoomFloor, 3);
    const map = makeMap({ zoom: russia.zoom, layersMin: 2 });
    map.setView(russia.centre, russia.zoom);
    assert.equal(map.getMinZoom(), 2, "the layers alone leave the floor at the basemap's");
    mod.addTo(map, ru);
    assert.ok(mod.isShown(map, ru));
    assert.equal(map.options.minZoom, 3, "the floor is set explicitly");
    assert.equal(map.getMinZoom(), 3);
    assert.equal(map.zoom, 3, "a map opened below the floor is raised to it");
    assert.ok(map.fired.includes("zoomlevelschange"), "the zoom control is told");
    map.setView(map.centre, 1);
    assert.equal(map.zoom, 3, "zooming out stops at 3");
    // the recentre button asks for the country's own zoom, 2.5
    map.setView(russia.centre, russia.zoom);
    assert.equal(map.zoom, 3, "recentring lands on the floor, where the dots are");
    mod.addTo(map, ru);
    assert.equal(map.options.minZoom, 3, "adding again changes nothing");

    // hiding the dots gives the previous minimum back (none: the layers')
    mod.removeFrom(map, ru);
    assert.equal(mod.isShown(map, ru), false);
    assert.equal(map.options.minZoom, undefined);
    assert.equal(map.getMinZoom(), 2);
    map.setView(russia.centre, russia.zoom);
    assert.equal(map.zoom, 2.5, "without the dots the country view is as before");
    // and showing them again takes the floor again
    mod.addTo(map, ru);
    assert.equal(map.getMinZoom(), 3);
    assert.equal(map.zoom, 3);
    mod.removeFrom(map, ru);
    mod.removeFrom(map, ru);
    assert.equal(map.options.minZoom, undefined, "removing twice restores once");

    // a minimum the page set itself comes back, and one already above the floor is left alone
    const explicit = makeMap({ zoom: 6, layersMin: 2, explicitMin: 1 });
    const nzLayers = mod.createLayers(fakeLeaflet, { countryCode: "NZ" });
    mod.addTo(explicit, nzLayers);
    assert.equal(explicit.options.minZoom, 3);
    mod.removeFrom(explicit, nzLayers);
    assert.equal(explicit.options.minZoom, 1);
    const high = makeMap({ zoom: 6, layersMin: 2, explicitMin: 5 });
    const highLayers = mod.createLayers(fakeLeaflet, { countryCode: "NZ" });
    mod.addTo(high, highLayers);
    assert.equal(high.options.minZoom, 5);
    mod.removeFrom(high, highLayers);
    assert.equal(high.options.minZoom, 5);

    // a fallback country (no archive) keeps its usual zoom-out
    const fallbackLayers = mod.createLayers(fakeLeaflet, { countryCode: "AQ" });
    assert.equal(fallbackLayers.zoomFloor, null);
    const fallbackMap = makeMap({ zoom: 2, layersMin: 1 });
    mod.addTo(fallbackMap, fallbackLayers);
    assert.equal(fallbackMap.options.minZoom, undefined);
    assert.equal(fallbackMap.getMinZoom(), 1);
    assert.equal(fallbackMap.zoom, 2);
    mod.removeFrom(fallbackMap, fallbackLayers);
    assert.equal(fallbackMap.options.minZoom, undefined);
    assert.deepEqual(fallbackMap.fired, [], "nothing fired for a fallback country");

    // removing layers that were never added, and a missing map or layers, do nothing
    const idle = makeMap({ zoom: 4, layersMin: 2 });
    mod.removeFrom(idle, mod.createLayers(fakeLeaflet, { countryCode: "RU" }));
    assert.equal(idle.options.minZoom, undefined);
    mod.addTo(null, ru);
    mod.removeFrom(idle, null);
}

console.log("unvalidated-places: ok");
