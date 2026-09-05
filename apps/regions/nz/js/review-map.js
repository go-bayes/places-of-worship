// the review portal's map (jb 2026-09-04: "on the review side, we need the
// same map as in the revise map portal with the same review cards"): the
// same basemaps as the ra portal, the same amber unreviewed places from
// js/unvalidated-places.js, and the review queue's submissions drawn with
// the ra portal's validation-ring markers. a marker click selects the task
// so its review cards render beneath; selecting a task from the queue
// flies the map to it. an issue report's original point is drawn beside a
// moved pin so the reviewer sees how far the contributor moved it.
(function () {
    const AUTO_IMAGERY_ZOOM = 16;

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // the ra portal's six-state ring, from the task status alone: the review
    // portal holds no target-year derivation, so a decided task wears the
    // validated-present ring whatever its recorded existence
    function validationState(status) {
        if (status === "reviewed" || status === "pi_accepted" || status === "exported") return "validated_present";
        if (status === "changes_requested" || status === "reopened") return "disputed";
        if (status === "needs_review" || status === "unresolved_note") return "in_review";
        return "unvalidated";
    }

    const RING_CLASS = {
        validated_present: " vm-validated-present",
        validated_absent: " vm-validated-absent",
        in_review: " vm-in-review",
        disputed: " vm-disputed",
        unvalidated: " vm-unvalidated",
    };

    function isNomination(task) {
        return Boolean(task && (task.candidate_site_id || task.task_type === "missing_from_project_map"));
    }

    function markerIcon(L, task, selected) {
        const size = selected ? 17 : 13;
        const state = validationState(task.status);
        // a nomination in a healthy state wears the dashed teal entry ring,
        // as on the ra portal; disputed and validated keep their state ring
        const nomination = isNomination(task) && (state === "unvalidated" || state === "in_review");
        const classes = nomination
            ? "verification-marker vm-nomination"
            : `verification-marker vm-unknown${RING_CLASS[state] || ""}`;
        return L.divIcon({
            className: "",
            html: `<div class="${classes}${selected ? " vm-selected" : ""}" style="width:${size}px;height:${size}px;"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    // the eight open source links (jb 2026-09-04) from js/source-links.js;
    // without it the popups carry the task's actions alone
    function sourceLinksHtml(place) {
        return window.PowSourceLinks ? window.PowSourceLinks.itemsHtml(place, { className: "popup-link" }) : "";
    }

    function bindSourceLinks(root) {
        window.PowSourceLinks?.bind(root);
    }

    function create(options = {}) {
        const L = window.L;
        const container = document.getElementById(options.containerId || "reviewMap");
        if (!L || !container) return null;
        const places = window.PowUnvalidatedPlaces || null;
        const registry = ((window.POW_COUNTRY_REGISTRY || {}).countries || [])
            .find(entry => String(entry.code || "").toLowerCase() === String(options.countryCode || "").toLowerCase());
        const centre = options.centre || registry?.centre || [-41, 174];
        const countryName = options.countryName || registry?.name || "";
        const zoom = options.zoom || registry?.zoom || 5;
        const minZoom = Math.min(5, Math.floor(zoom));
        const map = L.map(container, { preferCanvas: true }).setView(centre, zoom);
        const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
        const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution, maxZoom: 19, minZoom }).addTo(map);
        const key = String(options.maptilerKey || window.MAPTILER_API_KEY || "").trim();
        const imageryAttribution = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
        const layers = { streets };
        if (key) {
            layers.satellite = L.tileLayer(`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`, { attribution: imageryAttribution, maxZoom: 20, minZoom });
            layers.hybrid = L.tileLayer(`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`, { attribution: imageryAttribution, maxZoom: 20, minZoom });
        }
        let basemap = "streets";
        let basemapUserChosen = false;

        function setBasemap(name) {
            const next = layers[name] ? name : "streets";
            if (next !== basemap) {
                // the incoming tiles go on before the outgoing come off: with
                // only the country-scale dots layer left for a moment, leaflet
                // takes its maxZoom (7) as the map's and snaps the view out to
                // the whole country (guy, 2026-09-05)
                if (!map.hasLayer(layers[next])) layers[next].addTo(map);
                Object.entries(layers).forEach(([id, layer]) => {
                    if (id !== next && map.hasLayer(layer)) map.removeLayer(layer);
                });
                layers[next].bringToBack();
                basemap = next;
                map.getContainer().classList.toggle("basemap-imagery", next !== "streets");
            }
            container.querySelectorAll(".basemap-toggle button").forEach(button => {
                button.setAttribute("aria-pressed", button.dataset.basemap === basemap ? "true" : "false");
            });
        }

        if (key) {
            const control = L.control({ position: "topright" });
            control.onAdd = () => {
                const div = L.DomUtil.create("div", "basemap-toggle");
                div.setAttribute("role", "group");
                div.setAttribute("aria-label", "Basemap");
                div.innerHTML = `
                    <button type="button" data-basemap="streets" aria-pressed="true">Streets</button>
                    <button type="button" data-basemap="hybrid" aria-pressed="false">Hybrid</button>
                    <button type="button" data-basemap="satellite" aria-pressed="false">Satellite</button>
                `;
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);
                div.querySelectorAll("button").forEach(button => {
                    button.addEventListener("click", () => {
                        basemapUserChosen = true;
                        setBasemap(button.dataset.basemap);
                    });
                });
                return div;
            };
            control.addTo(map);
            // a submission is checked against the building: imagery takes
            // over once the map is close enough, unless chosen by hand
            map.on("zoomend", () => {
                if (basemapUserChosen) return;
                setBasemap(map.getZoom() >= AUTO_IMAGERY_ZOOM ? "satellite" : "streets");
            });
        }

        // the unreviewed places: off by default on the review page (jb
        // 2026-09-04: the reviewer's work is the queue, and the overview
        // tier costs a few hundred kilobytes per tile), switchable on
        let dotLayers = places ? places.createLayers(L) : null;
        let pointsMode = "off";
        function syncDots() {
            if (!places || !dotLayers) return;
            if (pointsMode === "off") places.removeFrom(map, dotLayers);
            else places.addTo(map, dotLayers);
            const note = container.querySelector("#reviewPointsNote");
            if (note) {
                note.textContent = pointsMode === "off"
                    ? "Unreviewed places are off; turn them on here to see every open case in amber."
                    : "amber dots are today's OpenStreetMap places, every one an open case until reviewed";
            }
        }

        const legend = L.control({ position: "bottomleft" });
        legend.onAdd = () => {
            const div = L.DomUtil.create("div", "points-legend-control");
            div.innerHTML = `
                ${dotLayers ? `
                <select id="reviewPointsSelect" aria-label="Unreviewed places">
                    <option value="off" selected>Unreviewed places: off</option>
                    <option value="all">Unreviewed places: on</option>
                </select>
                <div id="reviewPointsNote" class="points-mode-note"></div>` : ""}
                <div class="map-legend">
                    <span class="legend-caption">Submissions in this queue</span>
                    <span class="legend-row"><span class="legend-dot vm-nomination-swatch"></span>nomination awaiting review</span>
                    <span class="legend-row"><span class="legend-dot vm-in-review-swatch"></span>in review</span>
                    <span class="legend-row"><span class="legend-dot vm-disputed-swatch"></span>changes requested or reopened</span>
                    <span class="legend-row"><span class="legend-dot vm-validated-present-swatch"></span>reviewed or exported</span>
                    <span class="legend-row"><span class="legend-dot vm-unvalidated-swatch"></span>not yet reviewed (open case)</span>
                    ${dotLayers ? `<span class="legend-row"><span class="legend-dot context-dot-swatch"></span>unreviewed place, no submission yet</span>` : ""}
                </div>
            `;
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            div.querySelector("#reviewPointsSelect")?.addEventListener("change", event => {
                pointsMode = event.target.value;
                syncDots();
            });
            return div;
        };
        legend.addTo(map);
        syncDots();

        const markerLayer = L.layerGroup().addTo(map);
        const contextLayer = L.layerGroup().addTo(map);
        const markersByTaskId = new Map();
        const tasksByTaskId = new Map();
        let rows = [];
        let selectedTaskId = "";

        function popupHtml(task) {
            const coords = task.geometry?.coordinates || [];
            const lat = Number(coords[1]);
            const lng = Number(coords[0]);
            const draftStatus = task.status ? String(task.status).replaceAll("_", " ") : "";
            const approximate = task.initial_location_assertion?.mode === "approximate_area";
            return `
                <strong>${escapeHtml(task.name || "Unnamed place")}</strong><br>
                <span>${escapeHtml(draftStatus)}${task.locality ? ` · ${escapeHtml(task.locality)}` : ""}</span><br>
                <div class="popup-actions">
                    <button class="popup-report-issue popup-revise-primary" type="button" data-open-task-id="${escapeHtml(task.task_id)}">Open its review cards</button>
                    ${sourceLinksHtml({
                        lat,
                        lng,
                        osmType: task.osm_object_type,
                        osmId: task.matched_osm_id,
                        name: task.name,
                        locality: task.locality,
                        countryName,
                        approximate,
                    })}
                </div>
            `;
        }

        function rebuildMarkers() {
            markerLayer.clearLayers();
            markersByTaskId.clear();
            tasksByTaskId.clear();
            rows.forEach(row => {
                const task = row?.task;
                const coords = task?.geometry?.coordinates || [];
                const lat = Number(coords[1]);
                const lng = Number(coords[0]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                const marker = L.marker([lat, lng], {
                    icon: markerIcon(L, task, task.task_id === selectedTaskId),
                    zIndexOffset: task.task_id === selectedTaskId ? 1000 : 0,
                });
                marker.bindPopup(() => popupHtml(task), { maxWidth: 320 });
                marker.on("popupopen", event => {
                    const el = event.popup.getElement();
                    el?.querySelector("[data-open-task-id]")?.addEventListener("click", () => {
                        map.closePopup();
                        options.onSelectTask?.(task.task_id);
                    });
                    bindSourceLinks(el);
                });
                marker.on("click", () => options.onSelectTask?.(task.task_id));
                markersByTaskId.set(task.task_id, marker);
                tasksByTaskId.set(task.task_id, task);
                markerLayer.addLayer(marker);
            });
        }

        // a selection change restyles the markers in place: rebuilding them
        // removed the clicked marker under its own popup, so the popup with
        // the source links closed the moment a marker was clicked
        function restyleMarkers() {
            markersByTaskId.forEach((marker, taskId) => {
                const task = tasksByTaskId.get(taskId);
                const selected = taskId === selectedTaskId;
                marker.setIcon(markerIcon(L, task, selected));
                marker.setZIndexOffset(selected ? 1000 : 0);
            });
        }

        // the record's original point beside a moved pin, and an
        // approximate-area circle, for the selected task only
        function drawContext(task) {
            contextLayer.clearLayers();
            if (!task) return;
            const coords = task.geometry?.coordinates || [];
            const lat = Number(coords[1]);
            const lng = Number(coords[0]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            const assertion = task.initial_location_assertion || null;
            if (assertion?.mode === "approximate_area" && Number.isFinite(assertion.uncertainty_radius_m)) {
                contextLayer.addLayer(L.circle([lat, lng], {
                    radius: assertion.uncertainty_radius_m,
                    color: "#9a6700",
                    weight: 2,
                    opacity: 0.85,
                    fillColor: "#9a6700",
                    fillOpacity: 0.14,
                    interactive: false,
                }));
            }
            const original = task.source_context?.issue_report?.original_point;
            if (Array.isArray(original) && original.length >= 2) {
                const oLat = Number(original[1]);
                const oLng = Number(original[0]);
                if (Number.isFinite(oLat) && Number.isFinite(oLng) && (Math.abs(oLat - lat) > 1e-7 || Math.abs(oLng - lng) > 1e-7)) {
                    contextLayer.addLayer(L.polyline([[oLat, oLng], [lat, lng]], { color: "#17202a", weight: 2, dashArray: "4 4", interactive: false }));
                    contextLayer.addLayer(L.circleMarker([oLat, oLng], {
                        radius: 6,
                        color: "#17202a",
                        weight: 2,
                        fillColor: "#ffffff",
                        fillOpacity: 1,
                        interactive: false,
                    }).bindTooltip("the record's original point", { direction: "top" }));
                }
            }
        }

        function setQueue(nextRows, nextSelectedId) {
            rows = Array.isArray(nextRows) ? nextRows : [];
            selectedTaskId = nextSelectedId || "";
            rebuildMarkers();
            const selected = rows.find(row => row?.task?.task_id === selectedTaskId)?.task || null;
            drawContext(selected);
            // the first load frames the queue; later loads keep the view
            if (!setQueue.framed && markersByTaskId.size) {
                setQueue.framed = true;
                const bounds = L.latLngBounds([...markersByTaskId.values()].map(marker => marker.getLatLng()));
                if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: 12 });
            }
        }

        function select(taskId, { fly = true } = {}) {
            selectedTaskId = taskId || "";
            restyleMarkers();
            const row = rows.find(entry => entry?.task?.task_id === selectedTaskId);
            drawContext(row?.task || null);
            const marker = markersByTaskId.get(selectedTaskId);
            if (marker && fly) {
                const target = Math.max(map.getZoom(), 16);
                map.flyTo(marker.getLatLng(), target, { duration: 0.6 });
            }
        }

        // a click on an unreviewed dot: the place's name and links, and the
        // queue's own submission for it when one sits at the same spot
        if (places && dotLayers) {
            map.on("click", event => {
                const hit = places.nearestDot(L, map, dotLayers, event.containerPoint);
                if (!hit) return;
                const props = hit.feature.properties || {};
                const lat = hit.latlng.lat;
                const lng = hit.latlng.lng;
                const matched = rows.find(row => {
                    const task = row?.task;
                    if (!task) return false;
                    if (props.osm_id !== undefined && String(task.matched_osm_id || "") === String(props.osm_id)) return true;
                    const coords = task.geometry?.coordinates || [];
                    return coords.length >= 2 && Math.abs(Number(coords[1]) - lat) < 5e-5 && Math.abs(Number(coords[0]) - lng) < 5e-5;
                });
                const raPortal = `verification.html?country=${encodeURIComponent(String(options.countryCode || "nz").toLowerCase())}&revise=1&name=${encodeURIComponent(props.name || "")}&lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}${props.osm_id !== undefined ? `&osm_id=${encodeURIComponent(props.osm_id)}&osm_type=${encodeURIComponent(props.osm_type || "node")}` : ""}`;
                const html = `
                    <strong>${escapeHtml(props.name || "Unnamed place")}</strong><br>
                    <span>${matched ? "A submission for this place is in the queue." : "Open case: no submission on record yet."}</span><br>
                    <div class="popup-actions">
                        ${matched
                            ? `<button class="popup-report-issue popup-revise-primary" type="button" data-open-task-id="${escapeHtml(matched.task.task_id)}">Open its review cards</button>`
                            : `<a class="popup-report-issue popup-revise-primary" href="${escapeHtml(raPortal)}">Revise it in the RA portal</a>`}
                        ${sourceLinksHtml({
                            lat,
                            lng,
                            osmType: props.osm_type || "node",
                            osmId: props.osm_id,
                            name: props.name,
                            locality: matched?.task?.locality,
                            countryName,
                        })}
                    </div>
                `;
                const popup = L.popup({ maxWidth: 320 }).setLatLng(hit.latlng).setContent(html).openOn(map);
                popup.getElement()?.querySelector("[data-open-task-id]")?.addEventListener("click", () => {
                    map.closePopup();
                    options.onSelectTask?.(matched.task.task_id);
                });
                bindSourceLinks(popup.getElement());
            });
        }

        return { map, setQueue, select, setBasemap, validationState };
    }

    window.PowReviewMap = { create, validationState, isNomination };
})();
