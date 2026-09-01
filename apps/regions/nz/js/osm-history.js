// osm object history for portal context (jb 2026-09-02): fetches an
// object's version history from the public osm api on demand, reduces it
// to the dated tag changes an ra or reviewer needs, and renders a compact
// timeline. editor usernames are deliberately dropped — public on osm, but
// personal details the portal does not need; changeset ids remain so the
// full record is one click away on openstreetmap.org
(function () {
    const API_BASE = "https://api.openstreetmap.org/api/0.6";
    const SITE_BASE = "https://www.openstreetmap.org";
    const TYPES = new Set(["node", "way", "relation"]);
    // the tags whose changes carry evidential weight for a place of worship
    const WATCHED_TAGS = [
        "amenity",
        "disused:amenity",
        "was:amenity",
        "name",
        "religion",
        "denomination",
        "building",
        "start_date",
        "end_date",
        "opening_date",
    ];
    const cache = new Map();

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function normaliseType(type) {
        const t = String(type || "").toLowerCase().trim();
        if (TYPES.has(t)) return t;
        if (t === "n") return "node";
        if (t === "w") return "way";
        if (t === "r") return "relation";
        return "";
    }

    function isPow(tags) {
        return (tags || {}).amenity === "place_of_worship";
    }

    function dateOnly(timestamp) {
        return String(timestamp || "").slice(0, 10);
    }

    // reduces raw history elements (osm api order) to the dated facts
    function summarise(elements) {
        const versions = (Array.isArray(elements) ? elements : [])
            .filter(e => e && Number.isFinite(Number(e.version)))
            .slice()
            .sort((a, b) => Number(a.version) - Number(b.version));
        if (!versions.length) return null;
        const first = versions[0];
        const last = versions[versions.length - 1];
        const firstPow = versions.find(v => v.visible !== false && isPow(v.tags));
        const everPow = Boolean(firstPow);
        const lastVisible = last.visible !== false;
        const events = [];
        let previousTags = {};
        let previousVisible = false;
        versions.forEach((v, index) => {
            const visible = v.visible !== false;
            const tags = visible ? (v.tags || {}) : {};
            const changes = [];
            if (index === 0) {
                changes.push({ key: "", from: "", to: "", kind: "created" });
            } else if (!visible && previousVisible) {
                changes.push({ key: "", from: "", to: "", kind: "deleted" });
            } else if (visible && !previousVisible && index > 0) {
                changes.push({ key: "", from: "", to: "", kind: "restored" });
            }
            if (visible) {
                WATCHED_TAGS.forEach(key => {
                    const from = previousTags[key];
                    const to = tags[key];
                    if (from === to) return;
                    if (index === 0 && to === undefined) return;
                    changes.push({ key, from: from ?? "", to: to ?? "", kind: "tag" });
                });
            }
            if (changes.length) {
                events.push({
                    version: Number(v.version),
                    date: dateOnly(v.timestamp),
                    changeset: v.changeset,
                    changes,
                });
            }
            previousTags = tags;
            previousVisible = visible;
        });
        return {
            versions: versions.length,
            created: dateOnly(first.timestamp),
            first_pow: firstPow ? dateOnly(firstPow.timestamp) : "",
            first_pow_version: firstPow ? Number(firstPow.version) : null,
            last_edited: dateOnly(last.timestamp),
            deleted: !lastVisible,
            pow_removed: everPow && lastVisible && !isPow(last.tags),
            current_tags: lastVisible ? (last.tags || {}) : {},
            events,
        };
    }

    function objectUrl(type, id) {
        return `${SITE_BASE}/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
    }

    function changeText(change) {
        if (change.kind === "created") return "object created";
        if (change.kind === "deleted") return "object deleted";
        if (change.kind === "restored") return "object restored";
        const key = escapeHtml(change.key);
        if (!change.from) return `<code>${key}</code> = ${escapeHtml(change.to)}`;
        if (!change.to) return `<code>${key}</code> removed (was ${escapeHtml(change.from)})`;
        return `<code>${key}</code> ${escapeHtml(change.from)} → ${escapeHtml(change.to)}`;
    }

    // compact timeline html; safe to drop into a popup or a panel
    function renderHtml(summary, ref = {}) {
        const type = normaliseType(ref.type);
        const id = ref.id;
        const link = type && id
            ? `<a href="${escapeHtml(objectUrl(type, id))}/history" target="_blank" rel="noopener noreferrer">Full history on OpenStreetMap</a>`
            : "";
        if (!summary) {
            return `<div class="osm-history"><p class="osm-history-note">No OSM history is available for this object.</p>${link}</div>`;
        }
        const flags = [];
        if (summary.deleted) flags.push(`<strong>Deleted from OSM</strong> (last version ${escapeHtml(summary.last_edited)})`);
        if (summary.pow_removed) flags.push(`<strong>Place-of-worship tag removed</strong> — the object remains with other tags`);
        const headline = summary.first_pow
            ? `First tagged as a place of worship on OSM: <strong>${escapeHtml(summary.first_pow)}</strong> (version ${summary.first_pow_version}). This is the earliest OSM evidence, not a founding date.`
            : "This object has never carried the place-of-worship tag on OSM.";
        const events = summary.events.map(event => `
            <li>
                <span class="osm-history-date">${escapeHtml(event.date)}</span>
                <span class="osm-history-meta">v${event.version} · changeset ${escapeHtml(event.changeset)}</span>
                <span class="osm-history-changes">${event.changes.map(changeText).join("; ")}</span>
            </li>`).join("");
        return `
            <div class="osm-history">
                <p class="osm-history-headline">${headline}</p>
                ${flags.length ? `<p class="osm-history-flags">${flags.join("<br>")}</p>` : ""}
                <p class="osm-history-note">${summary.versions} version${summary.versions === 1 ? "" : "s"}, created ${escapeHtml(summary.created)}, last edited ${escapeHtml(summary.last_edited)}. Editor names are not shown.</p>
                <ul class="osm-history-events">${events}</ul>
                ${link}
            </div>`;
    }

    // one request per object per session; the promise is cached so
    // concurrent callers share it
    function fetchHistory(type, id) {
        const t = normaliseType(type);
        const key = `${t}/${id}`;
        if (!t || !id) return Promise.reject(new Error("This record has no OSM object reference."));
        if (cache.has(key)) return cache.get(key);
        const promise = fetch(`${API_BASE}/${t}/${encodeURIComponent(id)}/history.json`, {
            headers: { Accept: "application/json" },
        }).then(response => {
            if (response.status === 404 || response.status === 410) {
                // 410 gone: the object was deleted; the history call still
                // answers for deleted objects, so a 404 means an unknown id
                return { elements: [] };
            }
            if (!response.ok) throw new Error(`OSM answered ${response.status}.`);
            return response.json();
        }).then(data => summarise(data.elements)).catch(error => {
            cache.delete(key);
            throw error;
        });
        cache.set(key, promise);
        return promise;
    }

    // renders a loading line into the element, then the timeline or the error
    async function loadInto(element, type, id) {
        if (!element) return;
        element.innerHTML = `<p class="osm-history-note">Loading OSM history…</p>`;
        try {
            const summary = await fetchHistory(type, id);
            element.innerHTML = renderHtml(summary, { type, id });
        } catch (error) {
            element.innerHTML = `<p class="osm-history-note">OSM history could not be loaded (${escapeHtml(error.message || "network error")}). ${renderHtml(null, { type, id })}</p>`;
        }
    }

    window.PowOsmHistory = Object.freeze({ summarise, renderHtml, fetchHistory, loadInto, normaliseType, WATCHED_TAGS });
})();
