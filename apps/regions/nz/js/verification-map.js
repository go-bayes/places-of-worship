const DATA_BASE = (() => {
    const prefix = window.location.pathname.includes("/places-of-worship/") ? "/places-of-worship" : "";
    return `${window.location.origin}${prefix}/apps/regions/nz/data/`;
})();

function dataUrl(path) {
    return new URL(path, DATA_BASE).toString();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function cap(value) {
    return String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function priorityColor(priority) {
    if (priority === "high") return "#c0392b";
    if (priority === "medium") return "#d68910";
    return "#1e8449";
}

class NzVerificationMap {
    constructor() {
        this.map = null;
        this.cluster = null;
        this.tasks = [];
        this.filteredTasks = [];
        this.markersByTaskId = new Map();
        this.selectedTask = null;
        this.visibleLimit = 80;
        this.init();
    }

    async init() {
        this.setupMap();
        this.setupFilters();
        await this.loadTasks();
        this.applyFilters();
    }

    setupMap() {
        this.map = L.map("map", { preferCanvas: true }).setView([-41.235726, 172.5118422], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            minZoom: 5,
        }).addTo(this.map);

        this.cluster = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 48,
        });
        this.map.addLayer(this.cluster);
    }

    setupFilters() {
        ["searchInput", "priorityFilter", "actionFilter"].forEach(id => {
            const element = document.getElementById(id);
            element?.addEventListener("input", () => this.applyFilters());
            element?.addEventListener("change", () => this.applyFilters());
        });
    }

    async loadTasks() {
        const response = await fetch(dataUrl("verification_tasks.geojson"));
        if (!response.ok) {
            throw new Error(`Failed to load verification tasks: ${response.status}`);
        }
        const geojson = await response.json();
        this.tasks = geojson.features || [];

        const snapshotEl = document.getElementById("snapshotId");
        if (snapshotEl) {
            const meta = geojson.metadata || {};
            snapshotEl.textContent = `${meta.master_snapshot_id || "unknown snapshot"} | ${meta.feature_count || this.tasks.length} tasks`;
        }
    }

    applyFilters() {
        const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
        const priority = document.getElementById("priorityFilter")?.value || "all";
        const action = document.getElementById("actionFilter")?.value || "all";

        this.filteredTasks = this.tasks.filter(feature => {
            const props = feature.properties || {};
            const searchText = [
                props.name,
                props.address,
                props.master_site_id,
                props.osm_id,
                props.religion,
                props.denomination,
            ].join(" ").toLowerCase();

            if (search && !searchText.includes(search)) return false;
            if (priority !== "all" && props.verification_priority !== priority) return false;
            if (action !== "all" && props.automated_suggested_action !== action) return false;
            return true;
        });

        this.renderMarkers();
        this.renderTaskList();
        this.updateStats();
    }

    renderMarkers() {
        this.cluster.clearLayers();
        this.markersByTaskId.clear();

        this.filteredTasks.forEach(feature => {
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties || {};
            const marker = L.marker([lat, lng], {
                icon: this.createIcon(props.verification_priority),
                title: props.name || props.master_site_id,
            });

            marker.on("click", () => this.selectTask(feature, true));
            marker.bindPopup(this.popupHtml(props), { maxWidth: 360 });
            this.cluster.addLayer(marker);
            this.markersByTaskId.set(props.task_id, marker);
        });
    }

    createIcon(priority) {
        const size = priority === "high" ? 15 : priority === "medium" ? 13 : 11;
        const color = priorityColor(priority);
        return L.divIcon({
            className: "",
            html: `<div class="verification-marker" style="width:${size}px;height:${size}px;background:${color};"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    popupHtml(props) {
        return `
            <strong>${escapeHtml(props.name || "Unnamed site")}</strong><br>
            <span>${escapeHtml(cap(props.religion))}${props.denomination ? ` | ${escapeHtml(cap(props.denomination))}` : ""}</span><br>
            <span>Priority: ${escapeHtml(props.verification_priority)}</span><br>
            <span>Action: ${escapeHtml(props.automated_suggested_action)}</span><br>
            <button type="button" onclick="window.nzVerificationMap.selectTaskById('${escapeHtml(props.task_id)}')">Open task</button>
        `;
    }

    renderTaskList() {
        const taskList = document.getElementById("taskList");
        if (!taskList) return;

        const visible = this.filteredTasks.slice(0, this.visibleLimit);
        taskList.innerHTML = visible.map(feature => {
            const props = feature.properties || {};
            const activeClass = this.selectedTask?.properties?.task_id === props.task_id ? " active" : "";
            return `
                <button class="task-row${activeClass}" type="button" data-task-id="${escapeHtml(props.task_id)}">
                    <span class="task-row-title">
                        <span class="priority-dot priority-${escapeHtml(props.verification_priority)}"></span>
                        ${escapeHtml(props.name || "Unnamed site")}
                    </span>
                    <span class="task-row-meta">${escapeHtml(cap(props.religion)) || "Unknown"} | ${escapeHtml(props.master_site_id)}</span>
                    <span class="task-row-meta">${escapeHtml(props.automated_suggested_action)} | ${props.automated_check_count} checks</span>
                </button>
            `;
        }).join("");

        taskList.querySelectorAll(".task-row").forEach(row => {
            row.addEventListener("click", () => this.selectTaskById(row.dataset.taskId));
        });

        if (this.filteredTasks.length > this.visibleLimit) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "secondary";
            more.textContent = `Show ${Math.min(80, this.filteredTasks.length - this.visibleLimit)} more`;
            more.addEventListener("click", () => {
                this.visibleLimit += 80;
                this.renderTaskList();
            });
            taskList.appendChild(more);
        }
    }

    updateStats() {
        const shown = this.filteredTasks.length;
        const high = this.filteredTasks.filter(feature => feature.properties?.verification_priority === "high").length;
        const noAction = this.filteredTasks.filter(feature => feature.properties?.automated_suggested_action === "candidate_no_action").length;
        document.getElementById("shownCount").textContent = shown.toLocaleString();
        document.getElementById("highCount").textContent = high.toLocaleString();
        document.getElementById("noActionCount").textContent = noAction.toLocaleString();
    }

    selectTaskById(taskId) {
        const task = this.tasks.find(feature => feature.properties?.task_id === taskId);
        if (task) {
            this.selectTask(task, false);
        }
    }

    selectTask(feature, fromMarker) {
        this.selectedTask = feature;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;

        if (!fromMarker) {
            this.map.setView([lat, lng], Math.max(this.map.getZoom(), 16));
            const marker = this.markersByTaskId.get(props.task_id);
            if (marker) {
                marker.openPopup();
            }
        }

        this.renderTaskList();
        this.renderDetail(feature);
    }

    renderDetail(feature) {
        const props = feature.properties || {};
        const checks = props.automated_checks || [];
        const searches = props.search_queries || {};
        const panel = document.getElementById("detailPanel");
        if (!panel) return;

        panel.innerHTML = `
            <h2>${escapeHtml(props.name || "Unnamed site")}</h2>
            <dl class="kv">
                <dt>Priority</dt><dd>${escapeHtml(props.verification_priority)}</dd>
                <dt>Action</dt><dd>${escapeHtml(props.automated_suggested_action)}</dd>
                <dt>Master id</dt><dd>${escapeHtml(props.master_site_id)}</dd>
                <dt>OSM</dt><dd>${escapeHtml(props.osm_type || "")} ${escapeHtml(props.osm_id || "")}</dd>
                <dt>Religion</dt><dd>${escapeHtml(cap(props.religion)) || "Unknown"}</dd>
                <dt>Denom.</dt><dd>${escapeHtml(cap(props.denomination)) || "Unknown"}</dd>
                <dt>Address</dt><dd>${escapeHtml(props.address || "Missing")}</dd>
                <dt>Start date</dt><dd>${escapeHtml(props.osm_start_date || "Missing")}</dd>
            </dl>

            <div class="detail-section">
                <h3>Links</h3>
                <div class="link-grid">
                    ${this.linkHtml("OSM object", props.osm_object_url)}
                    ${this.linkHtml("OSM history", props.osm_history_url)}
                    ${this.linkHtml("OSM map", props.osm_map_url)}
                    ${this.linkHtml("Google Maps", props.google_maps_url)}
                    ${this.linkHtml("Street View", props.street_view_url)}
                    ${this.linkHtml("Name search", searches.name_locality?.google_url)}
                </div>
            </div>

            <div class="detail-section">
                <h3>Automated checks</h3>
                <ul class="check-list">
                    ${checks.length ? checks.map(check => `
                        <li>
                            <strong>${escapeHtml(check.severity)} | ${escapeHtml(check.check_id)}</strong><br>
                            ${escapeHtml(check.message)}<br>
                            <span>${escapeHtml(check.suggested_action)}</span>
                        </li>
                    `).join("") : "<li><strong>info | no_flags</strong><br>No automated checks flagged this record.</li>"}
                </ul>
            </div>

            <div class="detail-section">
                <h3>Review decision</h3>
                <div class="review-form">
                    <label>
                        Decision
                        <select id="decisionSelect">
                            <option value="accept_current_record">Accept current record</option>
                            <option value="needs_more_evidence">Needs more evidence</option>
                            <option value="wrong_location">Wrong location</option>
                            <option value="duplicate_or_merge_candidate">Duplicate or merge candidate</option>
                            <option value="not_place_of_worship">Not a place of worship</option>
                            <option value="closed_or_changed_use">Closed or changed use</option>
                            <option value="moved_or_relocated">Moved or relocated</option>
                            <option value="historical_only">Historical only</option>
                            <option value="target_year_status_uncertain">Target-year status uncertain</option>
                        </select>
                    </label>
                    <label>
                        Note
                        <textarea id="decisionNote" rows="3" placeholder="Short evidence note"></textarea>
                    </label>
                    <button id="copyDecisionButton" type="button">Copy staged decision JSON</button>
                    <div id="copyStatus" class="copy-status"></div>
                </div>
            </div>
        `;

        document.getElementById("copyDecisionButton")?.addEventListener("click", () => this.copyDecision(props));
    }

    linkHtml(label, url) {
        if (!url) {
            return `<span></span>`;
        }
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }

    async copyDecision(props) {
        const decision = document.getElementById("decisionSelect")?.value || "";
        const note = document.getElementById("decisionNote")?.value || "";
        const payload = {
            task_id: props.task_id,
            master_snapshot_id: props.master_snapshot_id,
            master_site_id: props.master_site_id,
            decision,
            note,
            source: "nz_verification_static_map",
        };

        const status = document.getElementById("copyStatus");
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            if (status) status.textContent = "Copied staged decision JSON.";
        } catch (error) {
            if (status) status.textContent = "Clipboard unavailable; select and copy from console.";
            console.log("Staged decision JSON:", payload);
        }
    }
}

window.nzVerificationMap = new NzVerificationMap();
