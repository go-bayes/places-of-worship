const DATA_BASE = (() => {
    const prefix = window.location.pathname.includes("/places-of-worship/") ? "/places-of-worship" : "";
    return `${window.location.origin}${prefix}/apps/regions/nz/data/`;
})();

const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const DEMO_MODE = SEARCH_PARAMS.get("demo") === "1";
const INTAKE_ENABLED = DEMO_MODE;

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

function actionLabel(action) {
    if (action === "needs_human_review") return "Needs human review";
    if (action === "review_when_sampling") return "Spot-check in sample";
    if (action === "candidate_no_action") return "Candidate no action";
    return cap(action);
}

class NzVerificationMap {
    constructor() {
        this.map = null;
        this.markerLayer = null;
        this.tasks = [];
        this.filteredTasks = [];
        this.markersByTaskId = new Map();
        this.selectedTask = null;
        this.visibleLimit = 80;
        this.init();
    }

    async init() {
        this.setupMap();
        this.setupPageMode();
        this.setupFilters();
        await this.loadTasks();
        this.applyFilters();
    }

    setupMap() {
        this.map = L.map("map", { preferCanvas: true }).setView([-41.235726, 172.5118422], 6);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            minZoom: 5,
        }).addTo(this.map);

        this.markerLayer = L.layerGroup();
        this.map.addLayer(this.markerLayer);
    }

    setupPageMode() {
        const notice = document.getElementById("modeNotice");
        if (notice) {
            notice.classList.toggle("demo-warning", DEMO_MODE);
            notice.textContent = DEMO_MODE
                ? "Demo mode: draft controls are shown for UI inspection only. Nothing is saved or submitted. Do not enter private or sensitive data."
                : "Feedback pilot: this page is read-only until secure staging is available.";
            notice.setAttribute("role", DEMO_MODE ? "alert" : "note");
        }

        const nominationPanel = document.getElementById("nominationPanel");
        if (nominationPanel) {
            nominationPanel.innerHTML = DEMO_MODE ? this.nominationFormHtml() : `
                <div class="disabled-panel">
                    Nominations are disabled for this feedback pilot. Use the map for inspection and send notes separately.
                </div>
            `;
        }
    }

    setupFilters() {
        ["searchInput", "priorityFilter", "actionFilter"].forEach(id => {
            const element = document.getElementById(id);
            element?.addEventListener("input", () => this.applyFilters());
            element?.addEventListener("change", () => this.applyFilters());
        });

        if (INTAKE_ENABLED) {
            document.getElementById("copyNominationButton")?.addEventListener("click", () => this.copyNomination());
        }
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
        this.markerLayer.clearLayers();
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
            marker.on("popupopen", event => this.bindPopupOpenTask(event.popup));
            this.markerLayer.addLayer(marker);
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
            <span>Action: ${escapeHtml(actionLabel(props.automated_suggested_action))}</span><br>
            <button class="popup-open-task" type="button" data-task-id="${escapeHtml(props.task_id)}">Open task</button>
        `;
    }

    bindPopupOpenTask(popup) {
        const button = popup.getElement()?.querySelector(".popup-open-task");
        if (!button) return;
        button.addEventListener("click", () => {
            this.selectTaskById(button.dataset.taskId, { focusDetail: true });
        });
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
                    <span class="task-row-meta">${escapeHtml(actionLabel(props.automated_suggested_action))} | ${props.automated_check_count} checks</span>
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

    selectTaskById(taskId, options = {}) {
        const task = this.tasks.find(feature => feature.properties?.task_id === taskId);
        if (task) {
            this.selectTask(task, false, options);
        }
    }

    selectTask(feature, fromMarker, options = {}) {
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
        if (options.focusDetail) {
            this.focusDetailPanel();
        }
    }

    focusDetailPanel() {
        const panel = document.getElementById("detailPanel");
        if (!panel) return;
        panel.scrollTop = 0;
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
                <dt>Action</dt><dd>${escapeHtml(actionLabel(props.automated_suggested_action))}</dd>
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
                ${INTAKE_ENABLED ? this.reviewFormHtml() : this.disabledIntakeHtml()}
            </div>
        `;

        if (INTAKE_ENABLED) {
            document.getElementById("copyDecisionButton")?.addEventListener("click", () => this.copyDecision(props));
        }
    }

    reviewFormHtml() {
        return `
            <h3>Review decision</h3>
            <div class="review-form">
                <div class="demo-warning" role="alert">
                    Demo only. This will generate local JSON for inspection; it will not save or submit data. Do not enter private or sensitive data.
                </div>
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
                        <option value="denomination_changed">Denomination changed</option>
                        <option value="shared_or_multi_congregation_building">Shared or multi-congregation building</option>
                        <option value="split_site_or_building_records_needed">Split site or building records needed</option>
                        <option value="charity_record_needs_site_match">Charity record needs site match</option>
                    </select>
                </label>
                <label>
                    Note
                    <textarea id="decisionNote" rows="3" placeholder="Short evidence note">Demo only: inspect source links and record what should be checked.</textarea>
                </label>
                <button id="copyDecisionButton" type="button">Generate demo decision JSON</button>
                <div id="copyStatus" class="copy-status"></div>
                <textarea id="decisionJsonOutput" class="json-output" rows="5" readonly></textarea>
            </div>
        `;
    }

    nominationFormHtml() {
        return `
            <div class="demo-warning" role="alert">
                Demo only. These fields are not saved, submitted, or linked to the master database. Do not enter private or sensitive data.
            </div>
            <details open>
                <summary>Draft nomination or complication</summary>
                <div class="nomination-form">
                    <label>
                        Type
                        <select id="nominationType">
                            <option value="current_place_missing_from_osm">Current place missing from OSM</option>
                            <option value="lost_2013_place_of_worship">Lost 2013 place of worship</option>
                            <option value="lost_2018_place_of_worship">Lost 2018 place of worship</option>
                            <option value="denomination_switch_or_reuse">Denomination switch or reuse</option>
                            <option value="shared_building_multiple_congregations">Shared building with multiple congregations</option>
                            <option value="split_or_merged_site_records">Split or merged site records</option>
                            <option value="charity_record_for_site_matching">Charity record for site matching</option>
                        </select>
                    </label>
                    <label>
                        Name
                        <input id="nominationName" type="text" value="Demo missing worship site">
                    </label>
                    <label>
                        Address or locality
                        <input id="nominationAddress" type="text" value="Example locality only">
                    </label>
                    <label>
                        Location note
                        <input id="nominationLocation" type="text" value="Demo: nearest known site or approximate area">
                    </label>
                    <label>
                        Target years
                        <input id="nominationYears" type="text" value="current">
                    </label>
                    <label>
                        Source URL
                        <input id="nominationSourceUrl" type="url" placeholder="Evidence link">
                    </label>
                    <label>
                        Evidence note
                        <textarea id="nominationNote" rows="3">Demo only: describe what source-backed evidence would go here.</textarea>
                    </label>
                    <button id="copyNominationButton" type="button">Generate demo nomination JSON</button>
                    <div id="nominationCopyStatus" class="copy-status"></div>
                    <textarea id="nominationJsonOutput" class="json-output" rows="5" readonly></textarea>
                </div>
            </details>
        `;
    }

    disabledIntakeHtml() {
        return `
            <h3>Audit intake disabled</h3>
            <div class="disabled-panel">
                This pilot is read-only. Record the site name or master id when sending feedback.
            </div>
        `;
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
        this.writeJsonOutput("decisionJsonOutput", payload);
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            if (status) status.textContent = "Copied demo JSON. Nothing was saved or submitted.";
        } catch (error) {
            if (status) status.textContent = "Demo JSON is shown below. Nothing was saved or submitted.";
        }
    }

    async copyNomination() {
        const payload = {
            nomination_type: document.getElementById("nominationType")?.value || "",
            candidate_site_name: document.getElementById("nominationName")?.value || "",
            address_or_locality: document.getElementById("nominationAddress")?.value || "",
            coordinates_or_map_note: document.getElementById("nominationLocation")?.value || "",
            target_years: document.getElementById("nominationYears")?.value || "",
            evidence_source_url: document.getElementById("nominationSourceUrl")?.value || "",
            evidence_note: document.getElementById("nominationNote")?.value || "",
            linked_master_site_id: this.selectedTask?.properties?.master_site_id || "",
            linked_task_id: this.selectedTask?.properties?.task_id || "",
            source: "nz_verification_static_map_nomination",
        };

        const status = document.getElementById("nominationCopyStatus");
        this.writeJsonOutput("nominationJsonOutput", payload);
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            if (status) status.textContent = "Copied demo JSON. Nothing was saved or submitted.";
        } catch (error) {
            if (status) status.textContent = "Demo JSON is shown below. Nothing was saved or submitted.";
        }
    }

    writeJsonOutput(elementId, payload) {
        const output = document.getElementById(elementId);
        if (output) {
            const json = JSON.stringify(payload, null, 2);
            output.value = json;
            output.textContent = json;
        }
    }
}

window.nzVerificationMap = new NzVerificationMap();
