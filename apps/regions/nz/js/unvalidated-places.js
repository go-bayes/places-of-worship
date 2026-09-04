// the unreviewed places layer shared by the ra portal and the review portal
// (jb 2026-09-04: "any PoW that has not been reviewed should be in amber;
// all cases are open", and the review side takes "the same map as the
// revise portal"). every place of worship on the shop front's tiles is an
// open case until a reviewer confirms it, so each is drawn as an amber disc
// with a white halo on every basemap. two tilesets cover the zoom range:
// the public map's places-overview tier at country scale (native zoom 5,
// stretched to 7) and the full places tier from zoom 8 in. both carry
// osm_id, osm_type, name and country_code, so a click on either opens the
// same popup and revise card.
//
// leaflet.vectorgrid 1.3.0's own hit-testing predates leaflet 1.8 and never
// fires, so callers hit-test the map's click against the rendered symbols
// with nearestDot() instead: the nearest dot within a finger's width.
(function () {
    const COLOUR = "#f59e0b";
    const HALO = "#ffffff";
    const PLACES_TILE_URL = "https://tiles.placemap.org/places/{z}/{x}/{y}";
    const PLACES_TILE_LAYER = "places";
    const PLACES_TILE_MAX_NATIVE_ZOOM = 18;
    const OVERVIEW_TILE_URL = "https://tiles.placemap.org/places-overview/{z}/{x}/{y}";
    const OVERVIEW_TILE_LAYER = "places_overview";
    const OVERVIEW_TILE_MAX_NATIVE_ZOOM = 5;
    // the full tier takes over from here; below it the overview tier draws
    const PLACES_MIN_ZOOM = 8;
    const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    function dotStyle(zoomed) {
        return {
            // the overview tier is stretched up to two zoom levels past its
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
    // interactive path swallows the click before the map sees it)
    function createLayers(L) {
        if (!L || !L.vectorGrid || typeof L.vectorGrid.protobuf !== "function") return null;
        const common = {
            interactive: false,
            // the overlay pane sits above every basemap tile and below the
            // dom task markers and popups, where the canvas dots live
            pane: "overlayPane",
            attribution: ATTRIBUTION,
            getFeatureId: props => `${props.osm_type || "node"}/${props.osm_id}`,
        };
        const overview = L.vectorGrid.protobuf(OVERVIEW_TILE_URL, {
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
        return { overview, places };
    }

    function addTo(map, layers) {
        if (!map || !layers) return;
        [layers.overview, layers.places].forEach(layer => {
            if (layer && !map.hasLayer(layer)) layer.addTo(map);
        });
    }

    function removeFrom(map, layers) {
        if (!map || !layers) return;
        [layers.overview, layers.places].forEach(layer => {
            if (layer && map.hasLayer(layer)) map.removeLayer(layer);
        });
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
        PLACES_MIN_ZOOM,
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
