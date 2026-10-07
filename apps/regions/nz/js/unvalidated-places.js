// the unreviewed places layer shared by the ra portal and the review portal
// (jb 2026-09-04: "any PoW that has not been reviewed should be in amber;
// all cases are open", and the review side takes "the same map as the
// revise portal"). every place of worship on the shop front's tiles is an
// open case until a reviewer confirms it, so each is drawn as an amber disc
// with a white halo on every basemap. two tilesets cover the zoom range:
// below zoom 8 the page country's own ra-dots archive (every place of that
// country, native zooms 3 to 7; a country with no archive falls back to the
// public map's slim places-overview-v2 sample, native zoom 5, stretched to
// 7) and the full places tier from zoom 8 in. all carry osm_id, osm_type,
// name and country_code where the place has them, so a click on any opens
// the same popup and revise card.
//
// leaflet.vectorgrid 1.3.0's own hit-testing predates leaflet 1.8 and never
// fires, so callers hit-test the map's click against the rendered symbols
// with nearestDot() instead: the nearest dot within a finger's width. the
// canvas tile renderer keeps the same per-tile symbol table the svg one
// does, so the hit test reads either.
(function () {
    const COLOUR = "#f59e0b";
    const HALO = "#ffffff";
    const PLACES_TILE_URL = "https://tiles.placemap.org/places/{z}/{x}/{y}";
    const PLACES_TILE_LAYER = "places";
    const PLACES_TILE_MAX_NATIVE_ZOOM = 18;
    // tiles v2 (build 20260722). the overview is a fraction-preserving
    // sample, z0 to 5; the ra-dots archives hold every place of one country,
    // z3 to 7, in the same layer name. both are immutable versioned names
    // served by the tiles worker
    const TILES_VERSION = "20260722";
    const OVERVIEW_TILE_URL = `https://tiles.placemap.org/places-overview-v2-${TILES_VERSION}/{z}/{x}/{y}`;
    const OVERVIEW_TILE_LAYER = "places_overview";
    const OVERVIEW_TILE_MAX_NATIVE_ZOOM = 5;
    const RA_DOTS_TILE_LAYER = "places_overview";
    const RA_DOTS_MIN_NATIVE_ZOOM = 3;
    const RA_DOTS_MAX_NATIVE_ZOOM = 7;
    // the two-letter codes that have an ra-dots archive: the 210 archives in
    // manifest tiles-v2-20260722:0ce3c532af1e986d (tools/tiles-r2/manifests/
    // tiles-v2-20260722-0ce3c532af1e.manifest.json, on main at commit 8dae8c76). update this list with
    // TILES_VERSION whenever the archives are rebuilt. a country not listed
    // (and the world view, ZZ) falls back to the overview sample
    const RA_DOTS_COUNTRY_CODES = new Set((
        "ad ae af ag ai al am ao ar at au az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bw by " +
        "bz ca cd cf cg ch ci ck cl cm cn co cr cu cv cy cz de dj dk dm do dz ec ee eg eh er es " +
        "et fi fj fk fm fo fr ga gb gd ge gg gh gi gm gn gq gr gt gw gy hn hr ht hu id ie il im " +
        "in iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu " +
        "lv ly ma mc md me mg mh mk ml mm mn mr ms mt mu mv mw mx my mz na ne ng ni nl no np nr " +
        "nu nz om pa pe pg ph pk pl pt pw py qa ro rs ru rw sa sb sc sd se sg si sk sl sm sn so " +
        "sr ss st sv sy sz tc td tg th tj tl tm tn to tr tt tv tw tz ua ug us uy uz va vc ve vg " +
        "vn vu ws ye za zm zw"
    ).split(" "));
    // the full tier takes over from here; below it the country's ra-dots
    // archive (or the overview sample) draws
    const PLACES_MIN_ZOOM = 8;
    const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    // the ra-dots archive url for a two-letter country code, or null when the
    // build has none for it
    function raDotsTileUrl(countryCode) {
        const code = String(countryCode || "").trim().toLowerCase();
        if (!RA_DOTS_COUNTRY_CODES.has(code)) return null;
        return `https://tiles.placemap.org/ra-dots-${code}-${TILES_VERSION}/{z}/{x}/{y}`;
    }

    function dotStyle(zoomed) {
        return {
            // the overview sample is stretched up to two zoom levels past its
            // native 5, so its dots start small
            radius: zoomed ? 5 : 2.4,
            color: HALO,
            weight: zoomed ? 2 : 1,
            fill: true,
            fillColor: COLOUR,
            fillOpacity: 0.95,
            opacity: 1,
        };
    }

    // both tile layers for a leaflet map; neither is interactive (an
    // interactive path swallows the click before the map sees it). the
    // dots paint on canvas tiles: vectorgrid's default svg renderer makes
    // one dom path per dot, and the tiles a phone requests at country scale
    // carried some 300,000 places across europe, which ios safari could not
    // hold through a zoom (jb 2026-09-22, sweden). `options.countryCode` is
    // the page country's two-letter iso code: below zoom 8 only that
    // country's archive loads, so no neighbour's dots are fetched or drawn
    // and no client-side filter is needed. the layer called `overview` in the
    // result is the below-zoom-8 tier, whichever tileset backs it
    function createLayers(L, options = {}) {
        if (!L || !L.vectorGrid || typeof L.vectorGrid.protobuf !== "function") return null;
        const raUrl = raDotsTileUrl(options.countryCode);
        const common = {
            interactive: false,
            // the overlay pane sits above every basemap tile and below the
            // dom task markers and popups, where the canvas dots live
            pane: "overlayPane",
            attribution: ATTRIBUTION,
            getFeatureId: props => `${props.osm_type || "node"}/${props.osm_id}`,
            // the bundled build ships the canvas tile renderer; the module's
            // own default (svg) stands only where it is missing
            ...(L.canvas && typeof L.canvas.tile === "function" ? { rendererFactory: L.canvas.tile } : {}),
        };
        const overview = raUrl
            ? L.vectorGrid.protobuf(raUrl, {
                ...common,
                vectorTileLayerStyles: { [RA_DOTS_TILE_LAYER]: dotStyle(false) },
                maxZoom: PLACES_MIN_ZOOM - 1,
                // the zoom floor: leaflet's minNativeZoom alone only clamps
                // requests to z3, so a zoom-out to z1 still fetched the
                // country's z3 tiles for every wrapped world copy (168
                // fetches, and 3 MB tiles for the us). with minZoom set the
                // layer loads nothing below z3. the map's own minimum is set
                // by addTo() below, not left to the layers: leaflet takes the
                // lowest of them, and the basemap's is lower
                minZoom: RA_DOTS_MIN_NATIVE_ZOOM,
                minNativeZoom: RA_DOTS_MIN_NATIVE_ZOOM,
                maxNativeZoom: RA_DOTS_MAX_NATIVE_ZOOM,
            })
            : L.vectorGrid.protobuf(OVERVIEW_TILE_URL, {
                ...common,
                vectorTileLayerStyles: { [OVERVIEW_TILE_LAYER]: dotStyle(false) },
                maxZoom: PLACES_MIN_ZOOM - 1,
                maxNativeZoom: OVERVIEW_TILE_MAX_NATIVE_ZOOM,
            });
        const places = L.vectorGrid.protobuf(PLACES_TILE_URL, {
            ...common,
            vectorTileLayerStyles: { [PLACES_TILE_LAYER]: dotStyle(true) },
            minZoom: PLACES_MIN_ZOOM,
            maxNativeZoom: PLACES_TILE_MAX_NATIVE_ZOOM,
        });
        // zoomFloor: the lowest zoom the map may reach while these layers are
        // shown; null where the overview sample draws (a fallback country
        // keeps its usual zoom-out)
        return { overview, places, zoomFloor: raUrl ? RA_DOTS_MIN_NATIVE_ZOOM : null };
    }

    // leaflet takes a map's lowest zoom from the lowest minZoom among its
    // layers, so the archive layer's own minZoom of 3 never stops a map
    // whose basemap reaches lower (russia opens at 2.5 and its basemap goes
    // to 1 or 2: the dots vanished below 3). while an archive layer is
    // shown the map's minimum is set to the floor explicitly, and the
    // previous minimum (an explicit one, or none) comes back when the dots
    // are hidden. a minimum already at or above the floor stays as it is
    function applyZoomFloor(map, layers) {
        if (!map || !layers || typeof layers.zoomFloor !== "number" || layers.floorState) return;
        const previous = map.options ? map.options.minZoom : undefined;
        layers.floorState = { map, previous };
        if (typeof previous === "number" && previous >= layers.zoomFloor) return;
        if (typeof map.setMinZoom === "function") map.setMinZoom(layers.zoomFloor);
        if (typeof map.fire === "function") map.fire("zoomlevelschange");
    }

    function releaseZoomFloor(map, layers) {
        const state = layers && layers.floorState;
        if (!state || state.map !== map) return;
        layers.floorState = null;
        if (typeof state.previous === "number" && state.previous >= layers.zoomFloor) return;
        if (state.previous === undefined) {
            if (map.options) map.options.minZoom = undefined;
        } else if (typeof map.setMinZoom === "function") {
            map.setMinZoom(state.previous);
        }
        if (typeof map.fire === "function") map.fire("zoomlevelschange");
    }

    function addTo(map, layers) {
        if (!map || !layers) return;
        [layers.overview, layers.places].forEach(layer => {
            if (layer && !map.hasLayer(layer)) layer.addTo(map);
        });
        applyZoomFloor(map, layers);
    }

    function removeFrom(map, layers) {
        if (!map || !layers) return;
        [layers.overview, layers.places].forEach(layer => {
            if (layer && map.hasLayer(layer)) map.removeLayer(layer);
        });
        releaseZoomFloor(map, layers);
    }

    function isShown(map, layers) {
        return Boolean(map && layers && (map.hasLayer(layers.places) || map.hasLayer(layers.overview)));
    }

    // pure: the nearest rendered symbol to a container point across the
    // given vectorgrid layers, or null when none sits within radiusPx.
    // `project(coord, point)` turns a tile coordinate plus in-tile pixel
    // offset into a container point; the feature's exact position comes
    // back from the tile rather than the click
    function nearestSymbol(layers, containerPoint, radiusPx, project) {
        let best = null;
        let bestDistance = radiusPx;
        (layers || []).forEach(layer => {
            if (!layer || !layer._vectorTiles) return;
            Object.values(layer._vectorTiles).forEach(renderer => {
                const coord = renderer && renderer._tileCoord;
                const symbols = renderer && renderer._layers ? Object.values(renderer._layers) : [];
                symbols.forEach(symbol => {
                    if (!symbol || !symbol._point || !coord) return;
                    const projected = project(coord, symbol._point, layer);
                    if (!projected) return;
                    const dx = projected.x - containerPoint.x;
                    const dy = projected.y - containerPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = { latlng: projected.latlng, properties: symbol.properties || {} };
                    }
                });
            });
        });
        return best;
    }

    // the rendered dot nearest a container point on a live map, rebuilt as
    // a geojson-shaped feature; null when none sits within radiusPx
    function nearestDot(L, map, layers, containerPoint, radiusPx = 14) {
        if (!map || !layers) return null;
        const live = [layers.places, layers.overview].filter(layer => layer && map.hasLayer(layer));
        const best = nearestSymbol(live, containerPoint, radiusPx, (coord, point, layer) => {
            const tileSize = layer.getTileSize();
            const projected = L.point(coord.x, coord.y).scaleBy(tileSize).add(point);
            const latlng = map.unproject(projected, coord.z);
            const onScreen = map.latLngToContainerPoint(latlng);
            return { x: onScreen.x, y: onScreen.y, latlng };
        });
        if (!best) return null;
        return { latlng: best.latlng, feature: featureFrom(best.properties, best.latlng) };
    }

    function featureFrom(props, latlng) {
        return {
            type: "Feature",
            properties: {
                name: props.name || "",
                osm_id: props.osm_id,
                osm_type: props.osm_type,
                religion: props.religion,
                denomination: props.denomination,
                country_code: props.country_code,
            },
            geometry: { type: "Point", coordinates: [latlng.lng, latlng.lat] },
        };
    }

    window.PowUnvalidatedPlaces = {
        COLOUR,
        HALO,
        PLACES_TILE_URL,
        PLACES_TILE_LAYER,
        PLACES_TILE_MAX_NATIVE_ZOOM,
        OVERVIEW_TILE_URL,
        OVERVIEW_TILE_LAYER,
        OVERVIEW_TILE_MAX_NATIVE_ZOOM,
        RA_DOTS_TILE_LAYER,
        RA_DOTS_MIN_NATIVE_ZOOM,
        RA_DOTS_MAX_NATIVE_ZOOM,
        RA_DOTS_COUNTRY_CODES,
        PLACES_MIN_ZOOM,
        applyZoomFloor,
        releaseZoomFloor,
        raDotsTileUrl,
        dotStyle,
        createLayers,
        addTo,
        removeFrom,
        isShown,
        nearestSymbol,
        nearestDot,
        featureFrom,
    };
})();
