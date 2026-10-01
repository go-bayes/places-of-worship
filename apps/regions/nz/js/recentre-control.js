// the recentre button shared by the ra portal and the review portal (jb
// 2026-10-01: "needs a recentre map button, as if you scroll off it won't
// work"). a pan or a zoom away from the work had no way back short of
// reopening the task, so one map button returns the view: the page says
// where through a resolver, called at each press, and this module draws
// the button and moves the map. the resolver returns one of
//   { latlng, minZoom }            a point: setView at the current zoom or
//                                  minZoom, whichever is nearer
//   { latlng, radiusM, maxZoom }   an area: the circle fitted into the view
//   { bounds, maxZoom }            leaflet bounds fitted into the view
//   { centre, zoom }               the region's default view
// each with an optional label, read into the tooltip as the pointer or the
// focus arrives, so the button says where it goes. a null target leaves
// the map alone.
(function () {
    const LABEL = "Recentre the map";
    const DEFAULT_PADDING = [30, 30];
    // the zooms the portals already use when they open a point (a task
    // opens at 16, a pin at 17) and fit an area (14)
    const POINT_MIN_ZOOM = 16;
    const AREA_MAX_ZOOM = 14;
    // four corner brackets and a centre dot: the viewfinder, distinct from
    // the locate button's crosshair ring
    const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
        + `<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>`
        + `<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`;

    function finitePair(pair) {
        return Array.isArray(pair) && pair.length >= 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]));
    }

    // moves the map to the target; true when it moved
    function applyTarget(L, map, target) {
        if (!map || !target) return false;
        if (target.bounds) {
            map.fitBounds(target.bounds, { padding: target.padding || DEFAULT_PADDING, maxZoom: target.maxZoom });
            return true;
        }
        if (finitePair(target.latlng) && Number.isFinite(target.radiusM) && target.radiusM > 0) {
            const bounds = L.circle(target.latlng, { radius: target.radiusM }).getBounds();
            map.fitBounds(bounds, { padding: target.padding || DEFAULT_PADDING, maxZoom: target.maxZoom || AREA_MAX_ZOOM });
            return true;
        }
        if (finitePair(target.latlng)) {
            map.setView(target.latlng, Math.max(map.getZoom(), target.minZoom || POINT_MIN_ZOOM));
            return true;
        }
        if (finitePair(target.centre)) {
            map.setView(target.centre, Number.isFinite(target.zoom) ? target.zoom : map.getZoom());
            return true;
        }
        return false;
    }

    function create(L, map, options = {}) {
        if (!L || !map || typeof options.resolve !== "function") return null;
        const resolve = () => {
            try {
                return options.resolve() || null;
            } catch (error) {
                return null;
            }
        };
        const control = L.control({ position: options.position || "topleft" });
        control.onAdd = () => {
            const div = L.DomUtil.create("div", "leaflet-bar map-icon-control recentre-control");
            const button = L.DomUtil.create("button", "", div);
            button.type = "button";
            button.id = options.id || "recentreButton";
            button.setAttribute("aria-label", LABEL);
            button.title = LABEL;
            button.innerHTML = ICON;
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            // the tooltip names the destination as the pointer arrives
            const refreshTitle = () => {
                const target = resolve();
                button.title = target?.label || LABEL;
            };
            button.addEventListener("pointerenter", refreshTitle);
            button.addEventListener("focus", refreshTitle);
            button.addEventListener("click", () => {
                const target = resolve();
                const moved = applyTarget(L, map, target);
                options.onRecentre?.(target, moved);
            });
            return div;
        };
        control.addTo(map);
        return control;
    }

    window.PowRecentreControl = { create, applyTarget, LABEL, POINT_MIN_ZOOM, AREA_MAX_ZOOM };
})();
