// the review map's Map data panel (2026-11-03, ui item 6 step two): the
// contributor portal's idiom (jb 2026-09-19) on the review page. one bar
// carries the grip that moves the panel, the `Map data` fold, a small count
// of the queue on the map and the unreviewed-places switch as an outline
// button; the legend opens above the bar. the fold and the spot are kept
// on the device. the review page's map is short, so the panel opens folded
// until the reviewer opens it. styles: ../_shared/map-data-panel.css.
// verification-map.js keeps its own copy for now; a shared module is a
// later, separate change with a byte-identical check on that portal.
(function () {
    const FOLD_KEY = "pow-review-map-data-folded";
    const OFFSET_KEY = "pow-review-map-data-offset";

    function read(key) {
        try {
            return window.localStorage?.getItem(key) ?? null;
        } catch (error) {
            return null;
        }
    }

    function write(key, value) {
        try {
            window.localStorage?.setItem(key, value);
        } catch (error) {
            // storage unavailable: the choice lives for this page only
        }
    }

    // folded unless the reviewer opened it on this device
    function foldedOnDevice() {
        return read(FOLD_KEY) !== "0";
    }

    // what the count pill says: the queue's submissions drawn on the map,
    // and whether the unreviewed places are on; nothing before a queue loads
    function countLabel(mapped, total, pointsOn) {
        const drawn = Number(mapped) || 0;
        const all = Number(total) || 0;
        if (all <= 0) return "";
        const queue = drawn === all ? `${all} in this queue` : `${drawn} of ${all} in this queue on the map`;
        return pointsOn ? `${queue} · unreviewed shown` : queue;
    }

    function make(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    // drags the panel by its grip (pointer events, so touch and mouse
    // alike); the control keeps its corner and carries an offset as a
    // transform, clamped so it never leaves the map, and kept per device
    function makeMovable(map, div, grip) {
        let offset = { x: 0, y: 0 };
        try {
            const saved = JSON.parse(read(OFFSET_KEY) || "null");
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) offset = saved;
        } catch (error) {
            // unreadable: start in the corner
        }
        const apply = () => {
            div.style.transform = offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : "";
        };
        const clamp = () => {
            const mapRect = map.getContainer?.()?.getBoundingClientRect?.();
            // a detached or unsized panel measures zero, which would wipe a
            // saved offset; leave the offset alone until it can be measured
            if (!mapRect || !mapRect.width || div.isConnected === false) { apply(); return; }
            div.style.transform = "";
            const rest = div.getBoundingClientRect();
            if (!rest.width && !rest.height) { apply(); return; }
            const minX = mapRect.left - rest.left;
            const maxX = mapRect.right - rest.right;
            const minY = mapRect.top - rest.top;
            const maxY = mapRect.bottom - rest.bottom;
            offset = {
                x: Math.round(Math.min(Math.max(offset.x, Math.min(minX, 0)), Math.max(maxX, 0))),
                y: Math.round(Math.min(Math.max(offset.y, Math.min(minY, 0)), Math.max(maxY, 0))),
            };
            apply();
        };
        let drag = null;
        grip.addEventListener("pointerdown", (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            drag = { startX: event.clientX, startY: event.clientY, fromX: offset.x, fromY: offset.y };
            grip.setPointerCapture?.(event.pointerId);
            div.classList.add("dragging");
            event.preventDefault?.();
        });
        grip.addEventListener("pointermove", (event) => {
            if (!drag) return;
            offset = { x: drag.fromX + event.clientX - drag.startX, y: drag.fromY + event.clientY - drag.startY };
            clamp();
        });
        const end = (event) => {
            if (!drag) return;
            drag = null;
            grip.releasePointerCapture?.(event.pointerId);
            div.classList.remove("dragging");
            clamp();
            write(OFFSET_KEY, JSON.stringify(offset));
        };
        grip.addEventListener("pointerup", end);
        grip.addEventListener("pointercancel", end);
        // a double click on the grip puts the panel back in its corner
        grip.addEventListener("dblclick", () => {
            offset = { x: 0, y: 0 };
            apply();
            write(OFFSET_KEY, JSON.stringify(offset));
        });
        map.on?.("resize", clamp);
        // after the control is in the map, so the first clamp can measure it
        setTimeout(clamp, 0);
        return { clamp };
    }

    // options: legendHtml (the marker legend, trusted markup), pointsAvailable
    // (whether the unreviewed places exist on this page) and
    // onPointsChange(on). returns the panel's api
    function create(L, map, options = {}) {
        const pointsAvailable = Boolean(options.pointsAvailable);
        const onPointsChange = typeof options.onPointsChange === "function" ? options.onPointsChange : () => {};
        const parts = {};
        let folded = foldedOnDevice();
        let pointsOn = false;
        let counts = { mapped: 0, total: 0 };

        const api = {
            parts,
            isFolded: () => folded,
            pointsOn: () => pointsOn,
            setFolded(next, { chosen = false } = {}) {
                folded = Boolean(next);
                parts.root?.classList.toggle("folded", folded);
                parts.fold?.setAttribute("aria-expanded", folded ? "false" : "true");
                // the body opens above the bar
                if (parts.caret) parts.caret.textContent = folded ? "▴" : "▾";
                if (parts.body) parts.body.hidden = folded;
                // the opened body grows upward, so pull a panel dragged near
                // the map's top back inside it (greptile, pr #212)
                parts.movable?.clamp();
                if (chosen) write(FOLD_KEY, folded ? "1" : "0");
                return folded;
            },
            setPointsOn(next, { notify = false } = {}) {
                pointsOn = Boolean(next);
                if (parts.points) {
                    parts.points.textContent = pointsOn ? "Hide unreviewed" : "Show unreviewed";
                    parts.points.setAttribute("aria-pressed", pointsOn ? "true" : "false");
                }
                api.setCount(counts.mapped, counts.total);
                if (notify) onPointsChange(pointsOn);
                return pointsOn;
            },
            setCount(mapped, total) {
                counts = { mapped: Number(mapped) || 0, total: Number(total) || 0 };
                const label = countLabel(counts.mapped, counts.total, pointsOn);
                if (parts.count) {
                    parts.count.textContent = label;
                    parts.count.hidden = !label;
                }
                return label;
            },
        };

        const control = L.control({ position: options.position || "bottomleft" });
        control.onAdd = () => {
            const div = make("div", "points-legend-control map-data-panel");
            div.setAttribute("role", "group");
            div.setAttribute("aria-label", "Map data");
            const body = make("div", "legend-body");
            body.id = "reviewMapData";
            body.innerHTML = options.legendHtml || "";
            const bar = make("div", "legend-bar");
            const grip = make("button", "legend-grip", "⠿");
            grip.type = "button";
            grip.setAttribute("aria-label", "Move this panel: drag it");
            const fold = make("button", "legend-fold");
            fold.type = "button";
            fold.setAttribute("aria-controls", "reviewMapData");
            fold.append(document.createTextNode("Map data "));
            const caret = make("span", "legend-caret");
            caret.setAttribute("aria-hidden", "true");
            fold.append(caret);
            const count = make("span", "legend-count");
            count.hidden = true;
            bar.append(grip, fold, count);
            let points = null;
            if (pointsAvailable) {
                points = make("button", "legend-points");
                points.type = "button";
                points.id = "reviewPointsToggle";
                bar.append(points);
            }
            // the body first, so at the bottom left the panel opens upward
            div.append(body, bar);
            Object.assign(parts, { root: div, body, bar, grip, fold, caret, count, points });

            L.DomEvent?.disableClickPropagation?.(div);
            L.DomEvent?.disableScrollPropagation?.(div);
            fold.addEventListener("click", () => api.setFolded(!folded, { chosen: true }));
            points?.addEventListener("click", () => api.setPointsOn(!pointsOn, { notify: true }));
            parts.movable = makeMovable(map, div, grip);
            api.setFolded(folded);
            api.setPointsOn(pointsOn);
            return div;
        };
        control.addTo(map);
        api.control = control;
        return api;
    }

    window.PowReviewMapData = { create, countLabel, foldedOnDevice, FOLD_KEY, OFFSET_KEY };
})();
