// the review portal's two drag bars (jb 2026-09-21: "we need the sliders on
// the review panel"; the weekly update promised the bar on every screen and
// the review page had a fixed 440 px map beside a fixed queue). side by
// side, the bar between the queue and the detail drags the queue width, as
// the ra portal's bar drags its sidebar; the bar under the map drags the
// map's height on every screen, phone included. the device remembers both.
// keyboard: left / right and up / down step, home resets; a double click
// resets too. same idiom as verification-map.js setupPaneDivider.
(function () {
    const SIDEBAR_KEY = "pow-review-sidebar-w";
    const MAP_KEY = "pow-review-map-h";
    const SIDEBAR_DEFAULT = 390;
    const SIDEBAR_MIN = 320;
    const SIDEBAR_MAX_SHARE = 0.6;
    const SIDEBAR_STEP = 40;
    const MAP_MIN = 200;
    // the map may take most of the window, never all of it: the cards
    // beneath must stay reachable
    const MAP_MAX_SHARE = 0.9;
    const MAP_STEP = 40;
    const STACKED_QUERY = "(max-width: 900px), (orientation: portrait)";

    function clamp(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return Math.round(Math.min(max, Math.max(min, number)));
    }

    function stacked() {
        return Boolean(window.matchMedia?.(STACKED_QUERY)?.matches);
    }

    function read(key) {
        try {
            const value = Number(window.localStorage?.getItem(key));
            return Number.isFinite(value) && value > 0 ? value : null;
        } catch (error) {
            return null;
        }
    }

    function write(key, value) {
        try {
            if (value === null) window.localStorage?.removeItem(key);
            else window.localStorage?.setItem(key, String(value));
        } catch (error) {
            // storage unavailable: the size lives for this page only
        }
    }

    // a drag by pointer on one bar along one axis; the bar refuses the
    // touchmove while a drag is live so ios cannot scroll the page under
    // the finger (the ra portal's lesson, jb 2026-09-20)
    function wireDrag(bar, { axis, onMove, onEnd, onReset }) {
        let drag = null;
        bar.addEventListener("pointerdown", (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            drag = { startX: event.clientX, startY: event.clientY, moved: false };
            bar.setPointerCapture?.(event.pointerId);
            bar.classList?.add("pane-dragging");
            event.preventDefault?.();
        });
        bar.addEventListener("pointermove", (event) => {
            if (!drag) return;
            const travel = axis === "x" ? Math.abs(event.clientX - drag.startX) : Math.abs(event.clientY - drag.startY);
            if (travel > 4) drag.moved = true;
            if (drag.moved) onMove(event);
        });
        const end = (event) => {
            if (!drag) return;
            const { moved } = drag;
            drag = null;
            bar.releasePointerCapture?.(event.pointerId);
            bar.classList?.remove("pane-dragging");
            if (moved) onEnd(event);
        };
        bar.addEventListener("pointerup", end);
        bar.addEventListener("pointercancel", end);
        bar.addEventListener("touchmove", (event) => {
            if (drag && event.cancelable) event.preventDefault();
        }, { passive: false });
        bar.addEventListener("dblclick", () => onReset());
    }

    function setup(options = {}) {
        const layout = options.layout || document.querySelector?.(".layout");
        const detail = options.detail || document.querySelector?.(".detail");
        const sidebarBar = options.sidebarBar || document.getElementById?.("paneDivider");
        const mapBar = options.mapBar || document.getElementById?.("mapDivider");
        const mapEl = options.mapEl || document.getElementById?.("reviewMap");
        const onResize = typeof options.onResize === "function" ? options.onResize : () => {};
        const api = {
            sidebarWidth: null,
            mapHeight: null,

            // the widest the queue may be: six tenths of the layout, never under the floor
            sidebarMax(width = layout?.getBoundingClientRect?.()?.width) {
                return Number.isFinite(width) && width > 0 ? Math.max(SIDEBAR_MIN, Math.floor(width * SIDEBAR_MAX_SHARE)) : Infinity;
            },
            clampSidebar(value, layoutWidth) {
                return clamp(value, SIDEBAR_MIN, api.sidebarMax(layoutWidth)) ?? SIDEBAR_DEFAULT;
            },
            sidebarFromPointer(clientX, rect = layout?.getBoundingClientRect?.()) {
                if (!rect || !(rect.width > 0)) return SIDEBAR_DEFAULT;
                return api.clampSidebar(clientX - rect.left, rect.width);
            },
            // chosen: a drag or key by hand; null: back to the default and forgotten
            setSidebarWidth(value, { chosen = false } = {}) {
                if (!layout) return null;
                if (value === null) {
                    api.sidebarWidth = null;
                    layout.style?.removeProperty?.("--sidebar-w");
                    if (chosen) write(SIDEBAR_KEY, null);
                    api.describeSidebar(SIDEBAR_DEFAULT);
                    onResize();
                    return null;
                }
                const width = api.clampSidebar(value, layout.getBoundingClientRect?.()?.width);
                api.sidebarWidth = width;
                layout.style?.setProperty?.("--sidebar-w", `${width}px`);
                if (chosen) write(SIDEBAR_KEY, width);
                api.describeSidebar(width);
                onResize();
                return width;
            },
            describeSidebar(width) {
                if (!sidebarBar) return;
                sidebarBar.setAttribute?.("aria-valuemin", String(SIDEBAR_MIN));
                const max = api.sidebarMax();
                sidebarBar.setAttribute?.("aria-valuemax", String(Number.isFinite(max) ? max : SIDEBAR_DEFAULT));
                sidebarBar.setAttribute?.("aria-valuenow", String(width));
            },

            // the tallest the map may be: nine tenths of the window, never under the floor
            mapMax(viewportHeight = window.innerHeight) {
                return Number.isFinite(viewportHeight) && viewportHeight > 0 ? Math.max(MAP_MIN, Math.floor(viewportHeight * MAP_MAX_SHARE)) : Infinity;
            },
            clampMap(value, viewportHeight) {
                return clamp(value, MAP_MIN, api.mapMax(viewportHeight));
            },
            mapFromPointer(clientY, rect = mapEl?.getBoundingClientRect?.()) {
                if (!rect) return null;
                return api.clampMap(clientY - rect.top);
            },
            currentMapHeight() {
                if (api.mapHeight !== null) return api.mapHeight;
                const measured = mapEl?.getBoundingClientRect?.()?.height;
                return Number.isFinite(measured) && measured > 0 ? Math.round(measured) : MAP_MIN;
            },
            setMapHeight(value, { chosen = false } = {}) {
                if (!detail) return null;
                if (value === null) {
                    api.mapHeight = null;
                    detail.style?.removeProperty?.("--map-h");
                    if (chosen) write(MAP_KEY, null);
                    api.describeMap(api.currentMapHeight());
                    onResize();
                    return null;
                }
                const height = api.clampMap(value);
                if (height === null) return null;
                api.mapHeight = height;
                detail.style?.setProperty?.("--map-h", `${height}px`);
                if (chosen) write(MAP_KEY, height);
                api.describeMap(height);
                onResize();
                return height;
            },
            describeMap(height) {
                if (!mapBar) return;
                mapBar.setAttribute?.("aria-valuemin", String(MAP_MIN));
                const max = api.mapMax();
                mapBar.setAttribute?.("aria-valuemax", String(Number.isFinite(max) ? max : MAP_MIN));
                mapBar.setAttribute?.("aria-valuenow", String(height));
            },
            stacked,
        };

        // what the device remembers, applied before the first paint settles
        const savedSidebar = read(SIDEBAR_KEY);
        if (savedSidebar !== null) api.setSidebarWidth(savedSidebar);
        else api.describeSidebar(SIDEBAR_DEFAULT);
        const savedMap = read(MAP_KEY);
        if (savedMap !== null) api.setMapHeight(savedMap);
        else api.describeMap(api.currentMapHeight());

        if (sidebarBar) {
            wireDrag(sidebarBar, {
                axis: "x",
                onMove: (event) => api.setSidebarWidth(api.sidebarFromPointer(event.clientX)),
                onEnd: (event) => api.setSidebarWidth(api.sidebarFromPointer(event.clientX), { chosen: true }),
                onReset: () => api.setSidebarWidth(null, { chosen: true }),
            });
            sidebarBar.addEventListener("keydown", (event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    const step = event.key === "ArrowLeft" ? -SIDEBAR_STEP : SIDEBAR_STEP;
                    api.setSidebarWidth((api.sidebarWidth ?? SIDEBAR_DEFAULT) + step, { chosen: true });
                } else if (event.key === "Home") {
                    event.preventDefault();
                    api.setSidebarWidth(null, { chosen: true });
                }
            });
        }
        if (mapBar) {
            wireDrag(mapBar, {
                axis: "y",
                onMove: (event) => api.setMapHeight(api.mapFromPointer(event.clientY)),
                onEnd: (event) => api.setMapHeight(api.mapFromPointer(event.clientY), { chosen: true }),
                onReset: () => api.setMapHeight(null, { chosen: true }),
            });
            mapBar.addEventListener("keydown", (event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    const step = event.key === "ArrowUp" ? -MAP_STEP : MAP_STEP;
                    api.setMapHeight(api.currentMapHeight() + step, { chosen: true });
                } else if (event.key === "Home") {
                    event.preventDefault();
                    api.setMapHeight(null, { chosen: true });
                }
            });
        }
        // a window resize can leave a remembered width wider than the new
        // ceiling; leaflet re-measures either way
        window.addEventListener?.("resize", () => {
            if (api.sidebarWidth !== null) api.setSidebarWidth(api.sidebarWidth);
            else onResize();
        });
        return api;
    }

    window.PowReviewPanes = { setup, SIDEBAR_DEFAULT, SIDEBAR_MIN, MAP_MIN };
})();
