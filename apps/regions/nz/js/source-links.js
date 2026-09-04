// the open source links (jb 2026-09-04: "we should have all the open source
// links available at the submit portal as we will need this evidence for
// review"): the same eight actions wherever a place is worked, on the
// review map's popups, in the review cards, and on the submit portal's
// popups and entry form. street view, google maps, open osm, copy coords,
// osm object, osm history, osm map, name search. each renders only when
// its inputs exist: coordinates for the first four, an osm object for the
// next three, a name for the search. osm history expands in place through
// js/osm-history.js when it is loaded, else it opens the osm page.
(function () {
    const OSM_SITE = "https://www.openstreetmap.org";
    const TYPES = new Set(["node", "way", "relation"]);

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // "n" / "node" / "NODE" → "node"; anything else → ""
    function normaliseType(type) {
        const t = String(type || "").toLowerCase().trim();
        if (TYPES.has(t)) return t;
        if (t === "n") return "node";
        if (t === "w") return "way";
        if (t === "r") return "relation";
        return "";
    }

    function fixed(value) {
        return Number(value).toFixed(5);
    }

    // the eight urls for a place; missing inputs leave empty strings.
    // place: { lat, lng, osmType, osmId, name, locality, countryName }
    function urls(place = {}) {
        const lat = Number(place.lat);
        const lng = Number(place.lng);
        const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
        const osmType = normaliseType(place.osmType);
        const osmId = place.osmId === undefined || place.osmId === null || place.osmId === "" ? "" : String(place.osmId);
        const hasObject = Boolean(osmType && osmId);
        const objectUrl = hasObject ? `${OSM_SITE}/${osmType}/${encodeURIComponent(osmId)}` : "";
        const query = [place.name, place.locality, place.countryName, "place of worship"]
            .map(part => String(part || "").trim())
            .filter(Boolean)
            .join(" ");
        return {
            street_view: hasPoint ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${lat},${lng}`)}` : "",
            google_maps: hasPoint ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}` : "",
            osm_point: hasPoint ? `${OSM_SITE}/?mlat=${fixed(lat)}&mlon=${fixed(lng)}#map=18/${fixed(lat)}/${fixed(lng)}` : "",
            coords: hasPoint ? `${fixed(lat)},${fixed(lng)}` : "",
            osm_object: objectUrl,
            osm_history: hasObject ? `${objectUrl}/history` : "",
            osm_map: objectUrl,
            name_search: place.name ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : "",
            osm_ref: hasObject ? `${osmType}/${osmId}` : "",
        };
    }

    // the ordered actions, in the order the ra portal's detail lists them
    // (jb 2026-09-04): each entry is a link { href }, the copy button
    // { copy }, or the history button { history, href }
    function entries(place = {}, options = {}) {
        const u = urls(place);
        const approximate = Boolean(options.approximate);
        const list = [];
        if (u.street_view) list.push({ key: "street_view", label: "Street View", href: u.street_view, primary: true });
        if (u.google_maps) list.push({ key: "google_maps", label: approximate ? "Approximate centre in Google Maps" : "Google Maps", href: u.google_maps, primary: true });
        if (u.osm_point) list.push({ key: "open_osm", label: "Open OSM", href: u.osm_point });
        if (u.coords) list.push({ key: "copy_coords", label: approximate ? "Copy area centre" : "Copy coords", copy: u.coords });
        if (u.osm_object) list.push({ key: "osm_object", label: "OSM object", href: u.osm_object });
        if (u.osm_history) list.push({ key: "osm_history", label: "OSM history", href: u.osm_history, history: u.osm_ref });
        if (u.osm_map) list.push({ key: "osm_map", label: "OSM map", href: u.osm_map });
        if (u.name_search) list.push({ key: "name_search", label: "Name search", href: u.name_search });
        return list;
    }

    // the actions as html to drop inside a .popup-actions or .link-grid
    // container. options.className styles every item (default "popup-link");
    // options.primaryClassName is added to street view and google maps;
    // options.inlineHistory (default true when js/osm-history.js is loaded)
    // renders osm history as a button that expands a body below the row
    function itemsHtml(place = {}, options = {}) {
        const className = options.className !== undefined ? String(options.className) : "popup-link";
        const primaryClassName = options.primaryClassName || "";
        const inlineHistory = options.inlineHistory !== undefined
            ? Boolean(options.inlineHistory)
            : Boolean(typeof window !== "undefined" && window.PowOsmHistory);
        const list = entries(place, options);
        let hasHistoryButton = false;
        const classAttr = (...names) => {
            const classes = names.filter(Boolean).join(" ");
            return classes ? ` class="${escapeHtml(classes)}"` : "";
        };
        const items = list.map(entry => {
            const primary = entry.primary ? primaryClassName : "";
            if (entry.copy) {
                return `<button${classAttr(className, "popup-copy-coords")} type="button" data-copy="${escapeHtml(entry.copy)}">${escapeHtml(entry.label)}</button>`;
            }
            if (entry.history && inlineHistory) {
                hasHistoryButton = true;
                return `<button${classAttr(className, "popup-osm-history")} type="button" data-osm-history="${escapeHtml(entry.history)}" title="Show the edit history of this OpenStreetMap object here">${escapeHtml(entry.label)}</button>`;
            }
            return `<a${classAttr(className, primary)} href="${escapeHtml(entry.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.label)}</a>`;
        });
        if (hasHistoryButton) {
            items.push(`<div class="popup-osm-history-body" hidden></div>`);
        }
        return items.join("\n");
    }

    // wires the copy and history buttons under a root element; safe to
    // call more than once on the same root, and beside the ra portal's own
    // copy binder, which marks the same data-copy-bound flag
    function bind(root) {
        if (!root || typeof root.querySelectorAll !== "function") return;
        root.querySelectorAll("[data-copy]").forEach(button => {
            if (button.dataset.copyBound === "1") return;
            button.dataset.copyBound = "1";
            const original = button.textContent;
            button.addEventListener("click", async event => {
                event.preventDefault();
                try {
                    await navigator.clipboard.writeText(button.getAttribute("data-copy") || "");
                    button.textContent = "Copied";
                } catch (error) {
                    button.textContent = "Copy failed";
                }
                window.setTimeout(() => { button.textContent = original; }, 1200);
            });
        });
        root.querySelectorAll("[data-osm-history]").forEach(button => {
            if (button.dataset.historyBound === "1") return;
            button.dataset.historyBound = "1";
            button.addEventListener("click", async () => {
                const [type, id] = String(button.getAttribute("data-osm-history") || "").split("/");
                // the body sits in the same container as the row, after it
                const container = button.parentElement;
                const body = container?.querySelector(".popup-osm-history-body");
                if (!body || !window.PowOsmHistory) {
                    window.open(`${OSM_SITE}/${type}/${id}/history`, "_blank", "noopener");
                    return;
                }
                body.hidden = false;
                button.disabled = true;
                // no popup.update() afterwards: leaflet would re-render the
                // stored content string and wipe the loaded timeline
                await window.PowOsmHistory.loadInto(body, type, id);
            });
        });
    }

    window.PowSourceLinks = { urls, entries, itemsHtml, bind, normaliseType };
})();
