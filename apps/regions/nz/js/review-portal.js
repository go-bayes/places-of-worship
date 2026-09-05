(function () {
    const config = window.POW_CONVEX_CONFIG || {};
    const searchParams = new URLSearchParams(window.location.search);
    const countryLabels = {
        nz: { code: "NZ", label: "New Zealand" },
        vu: { code: "VU", label: "Vanuatu" },
        al: { code: "AL", label: "Albania" },
        au: { code: "AU", label: "Australia" },
        br: { code: "BR", label: "Brazil" },
        bs: { code: "BS", label: "Bahamas" },
        ca: { code: "CA", label: "Canada" },
        cz: { code: "CZ", label: "Czechia" },
        gh: { code: "GH", label: "Ghana" },
        ie: { code: "IE", label: "Ireland" },
        in: { code: "IN", label: "India" },
        ke: { code: "KE", label: "Kenya" },
        kr: { code: "KR", label: "South Korea" },
        mw: { code: "MW", label: "Malawi" },
        mx: { code: "MX", label: "Mexico" },
        pt: { code: "PT", label: "Portugal" },
        ro: { code: "RO", label: "Romania" },
        rw: { code: "RW", label: "Rwanda" },
        sk: { code: "SK", label: "Slovakia" },
        uk: { code: "UK", label: "United Kingdom" },
        us: { code: "US", label: "United States" },
        za: { code: "ZA", label: "South Africa" },
        zm: { code: "ZM", label: "Zambia" },
    };
    // every country has a review lane (jb ruling r-h1, 2026-09-03): a code
    // outside the hand-named table resolves through the world registry
    // (apps/shared/data/country-registry.js, generated)
    const registry = new Map(((window.POW_COUNTRY_REGISTRY || {}).countries || [])
        .map(entry => [String(entry.code || "").toLowerCase(), { code: String(entry.code || "").toUpperCase(), label: entry.name || String(entry.code || "").toUpperCase() }]));
    const countryFor = value => {
        const key = String(value || "").toLowerCase();
        return countryLabels[key] || registry.get(key) || null;
    };
    const countryFromQuery = countryFor(searchParams.get("country"));
    const countryFromConfig = countryFor(config.countryCode);
    const country = countryFromQuery || countryFromConfig || countryLabels.nz;
    const countryCode = country.code;
    const countryName = country.label;
    const client = new window.PowConvexTaskClient(config);
    const state = {
        user: null,
        queue: [],
        selected: null,
        drafts: [],
        historicalClaims: [],
        events: [],
        busy: false,
        // explicit reviewer stance on the AI recommendation, set by the
        // Use-recommendation / Decide-differently buttons; null = no
        // explicit choice, agreement derives from the decision itself
        agentAgreementChoice: null,
        // occupancy lane (jb 2026-09-02): the task's periods and the derived
        // per-year proposals, loaded after the detail renders and refreshed
        // on their own after each per-year decision
        occupancy: null,
        occupancyBusy: false,
    };

    // the ra portal's map above the review cards (jb 2026-09-04); absent
    // leaflet the page still reviews from the queue alone
    const reviewMap = window.PowReviewMap
        ? window.PowReviewMap.create({
            containerId: "reviewMap",
            countryCode: country.code,
            countryName: country.label,
            onSelectTask: (taskId) => {
                selectTask(taskId, { fromMap: true });
            },
        })
        : null;

    const els = {
        authPanel: document.getElementById("authPanel"),
        authStatus: document.getElementById("authStatus"),
        detailPanel: document.getElementById("detailPanel"),
        queueGroupBy: document.getElementById("queueGroupBy"),
        queueClaimFilter: document.getElementById("queueClaimFilter"),
        queueList: document.getElementById("queueList"),
        queueStatus: document.getElementById("queueStatus"),
        queueStatusText: document.getElementById("queueStatusText"),
        refreshQueue: document.getElementById("refreshQueue"),
        signInButton: document.getElementById("signInButton"),
    };

    function setupPageLabel() {
        document.title = `${countryName} submitted evidence | Places of Worship`;
        const heading = document.querySelector("header h1");
        const intro = document.querySelector("header p");
        if (heading) {
            heading.textContent = `Review ${countryName} submitted evidence`;
        }
        if (intro) {
            intro.innerHTML = `Review ${countryName} task submissions saved in Convex. Decisions recorded here do not update the public map or master data until an export bundle is validated through <code>pow</code>.`;
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // the eight open source links for a task (jb 2026-09-04), as a link
    // grid; osm history links out here because its own card sits below
    function sourceLinksHtml(task) {
        if (!window.PowSourceLinks) return `<p class="muted">Source links are unavailable on this page.</p>`;
        const coords = Array.isArray(task.geometry?.coordinates) ? task.geometry.coordinates : [];
        const items = window.PowSourceLinks.itemsHtml({
            lat: coords[1],
            lng: coords[0],
            osmType: task.osm_object_type,
            osmId: task.matched_osm_id,
            name: task.name,
            locality: task.locality,
            countryName,
        }, {
            className: "",
            primaryClassName: "source-link-primary",
            inlineHistory: false,
            approximate: task.initial_location_assertion?.mode === "approximate_area",
        });
        return items ? `<div class="link-grid">${items}</div>` : `<p class="muted">No coordinates or OSM object on this task.</p>`;
    }

    // great-circle distance in metres between two [lng, lat] pairs
function distanceMetres(a, b) {
    const toRad = value => (Number(value) * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function human(value) {
        return String(value ?? "")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function setStatus(element, message, kind = "") {
        element.className = `status${kind ? ` ${kind}` : ""}`;
        element.textContent = message;
    }

    function formatDateTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    }

    function userLabel(user) {
        if (!user) return "Not signed in";
        return user.display_name || user.email || user.initials || "Signed in";
    }

    function rolesLabel(user) {
        return Array.isArray(user?.roles) ? user.roles.join(", ") : "";
    }

    function taskSubtitle(task) {
        return [task.locality, task.address].filter(Boolean).join(" | ") || task.task_id;
    }

    function taskPills(task, draft, agentReview) {
        const pills = [
            `<span class="pill">${escapeHtml(task.status)}</span>`,
            `<span class="pill">${escapeHtml(task.task_type)}</span>`,
            `<span class="pill">${escapeHtml(task.priority)}</span>`,
        ];
        if (agentReview && window.PowAgentReviewPanel) {
            pills.push(window.PowAgentReviewPanel.queuePillHtml(agentReview));
        }
        if (draft?.draft_status) {
            pills.push(`<span class="pill green">${escapeHtml(draft.draft_status)}</span>`);
        }
        if (task.candidate_site_id) {
            pills.push(`<span class="pill amber">Nominate missing PoW</span>`);
        }
        if (task.status === "unresolved_note" || draft?.draft_status === "unresolved_note") {
            pills.push(`<span class="pill amber">unresolved note</span>`);
        }
        return pills.join("");
    }

    function decisionLabel(value) {
        if (value === "accepted_for_export") return "accepted for export";
        if (value === "needs_more_evidence") return "needs more evidence";
        if (value === "duplicate_task") return "duplicate task";
        return human(value || "");
    }

    function decisionHint(value) {
        if (value === "accepted_for_export") {
            return "This marks the evidence as ready for the export bundle. It still does not update the master or public map until pow validation and rebuild.";
        }
        if (value === "needs_more_evidence") {
            return "This returns the case to the RA's My work panel as needing more evidence or correction.";
        }
        if (value === "rejected") {
            return "Use this for system tests, unsupported claims, wrong-site evidence, or cases that should be excluded from export.";
        }
        if (value === "duplicate_task") {
            return "Use this when the task duplicates another task. Add the related id or explanation in the decision note.";
        }
        if (value === "deferred") {
            return "Use this when the evidence may be useful later but should not enter this export round.";
        }
        return "Choose a decision before recording review.";
    }

    function renderFieldGrid(rows) {
        const visibleRows = rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
        if (visibleRows.length === 0) {
            return `<p class="muted">No values recorded.</p>`;
        }
        return `
            <div class="field-grid">
                ${visibleRows
                    .map(([label, value]) => `
                        <div>${escapeHtml(label)}</div>
                        <div>${formatValue(value)}</div>
                    `)
                    .join("")}
            </div>
        `;
    }

    function formatValue(value) {
        if (value === undefined || value === null || value === "") return "";
        if (typeof value === "object") {
            return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
        }
        const text = String(value);
        if (/^https?:\/\//i.test(text)) {
            return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
        }
        return escapeHtml(text);
    }

    function targetYearTable(statuses, evidence, confidence) {
        const entries = Object.entries(statuses || {});
        if (entries.length === 0) {
            return `<p class="muted">No target-year statuses recorded.</p>`;
        }
        return `
            <div class="field-grid">
                ${entries
                    .map(([year, status]) => `
                        <div>${escapeHtml(year)}</div>
                        <div>
                            <span class="pill ${status === "present" ? "green" : status === "uncertain" ? "amber" : ""}">${escapeHtml(status)}</span>
                            ${confidence?.[year] ? `<span class="pill">${escapeHtml(confidence[year])} confidence</span>` : ""}
                            ${evidence?.[year] ? `<p>${escapeHtml(evidence[year])}</p>` : ""}
                        </div>
                    `)
                    .join("")}
            </div>
        `;
    }

    function wideRowDetails(draft) {
        const generated = draft?.generated_wide_row;
        if (!generated?.fields || !generated?.row) {
            return `<p class="muted">No generated wide row is attached to this draft.</p>`;
        }
        const rows = generated.fields.map((field) => [field, generated.row[field]]);
        return renderFieldGrid(rows);
    }

    function targetYearAffectsFromDraft(draft) {
        return Object.entries(draft?.target_year_statuses || {})
            .map(([year, status]) => ({
                target_year: Number(year),
                target_year_status: status,
                basis: "source_observation",
            }))
            .filter((entry) => entry.target_year_status !== "not_assessed")
            .filter((entry) => Number.isFinite(entry.target_year));
    }

    function renderAuth() {
        if (!client.configured) {
            setStatus(els.authStatus, "Convex is not configured on this deployment.", "error");
            return;
        }
        if (!state.user) {
            setStatus(els.authStatus, "Sign in to load reviewer-only tasks.");
            client.renderSignInButton(els.signInButton, {
                onSignedIn: async (user) => {
                    state.user = user;
                    renderAuth();
                    await loadQueue();
                },
                onError: (error) => {
                    setStatus(els.authStatus, error.message || "Sign-in failed.", "error");
                },
            }).catch((error) => {
                setStatus(els.authStatus, error.message || "Google sign-in failed.", "error");
            });
            return;
        }

        els.signInButton.innerHTML = "";
        els.authStatus.className = "status ok";
        els.authStatus.innerHTML = `
            Signed in as <strong>${escapeHtml(userLabel(state.user))}</strong>
            <div class="muted">${escapeHtml(rolesLabel(state.user))}</div>
            <button id="signOut" class="tertiary" type="button">Sign out</button>
        `;
        document.getElementById("signOut").addEventListener("click", () => {
            client.signOut({ deliberate: true });
            state.user = null;
            state.queue = [];
            state.selected = null;
            reviewMap?.setQueue([], "");
            renderAuth();
            renderQueue();
            renderEmptyDetail("Signed out. Sign in again to review submitted evidence.");
            setStatus(els.queueStatusText, "Sign in to load the queue.");
        });
    }

    async function loadQueue() {
        if (!state.user || state.busy) return;
        state.busy = true;
        els.refreshQueue.disabled = true;
        setStatus(els.queueStatusText, "Loading review queue...");
        try {
            const rows = await client.listReviewQueue({
                countryCode,
                status: els.queueStatus.value,
                limit: 100,
            });
            state.queue = rows || [];
            renderQueue();
            reviewMap?.setQueue(state.queue, state.selected?.task?.task_id);
            setStatus(
                els.queueStatusText,
                state.queue.length === 0
                    ? "No tasks found for this status."
                    : `${state.queue.length} task${state.queue.length === 1 ? "" : "s"} loaded.`,
                state.queue.length === 0 ? "" : "ok",
            );
        } catch (error) {
            state.queue = [];
            renderQueue();
            reviewMap?.setQueue([], "");
            setStatus(els.queueStatusText, error.message || "Could not load the review queue.", "error");
        } finally {
            state.busy = false;
            els.refreshQueue.disabled = false;
        }
    }

    function renderQueue() {
        if (!state.user) {
            els.queueList.innerHTML = "";
            return;
        }
        // claim filter mirrors the ra sidebar's assigned/unassigned split
        const claimFilter = els.queueClaimFilter?.value || "";
        const visibleQueue = state.queue.filter((row) => {
            if (claimFilter === "mine") return Boolean(row.review_claimed_by_me);
            if (claimFilter === "unclaimed") return !row.review_claimant_label;
            return true;
        });
        if (visibleQueue.length === 0) {
            els.queueList.innerHTML = `<div class="empty">No tasks in this queue${claimFilter ? " for this filter" : ""}.</div>`;
            return;
        }
        const taskButton = (row) => {
            const { task, latestDraft, latestReview, latestAgentReview } = row;
            const opinions = Number(task.extra_opinions_required || 0);
            return `
            <button class="task-button ${state.selected?.task?.task_id === task.task_id ? "active" : ""}"
                type="button"
                data-task-id="${escapeHtml(task.task_id)}">
                <strong>${escapeHtml(task.name)}</strong>
                <span class="muted">${escapeHtml(taskSubtitle(task))}</span>
                <span class="pill-row">${taskPills(task, latestDraft, latestAgentReview)}</span>
                ${row.review_claimant_label ? `<span class="muted">Claimed by ${row.review_claimed_by_me ? "you" : escapeHtml(row.review_claimant_label)}</span>` : ""}
                ${row.submitted_by_me ? `<span class="muted">Your submission — another reviewer must decide</span>` : ""}
                ${opinions ? `<span class="muted">Second opinion requested (${opinions})</span>` : ""}
                ${latestReview?.decision_status ? `<span class="muted">Last decision: ${escapeHtml(decisionLabel(latestReview.decision_status))}</span>` : ""}
            </button>
        `;
        };
        const groupBy = els.queueGroupBy?.value || "";
        if (!groupBy) {
            els.queueList.innerHTML = visibleQueue.map(taskButton).join("");
        } else {
            // group by the submitting contributor or the last reviewer, with
            // named groups alphabetical and unattributed rows at the end
            const sentinel = groupBy === "contributor" ? "No submission on record" : "Not yet reviewed";
            const labelOf = (row) => (groupBy === "contributor" ? row.contributor_label : row.reviewer_label) || sentinel;
            const groups = new Map();
            visibleQueue.forEach((row) => {
                const label = labelOf(row);
                if (!groups.has(label)) groups.set(label, []);
                groups.get(label).push(row);
            });
            const named = [...groups.keys()].filter((label) => label !== sentinel).sort();
            const rest = groups.has(sentinel) ? [sentinel] : [];
            els.queueList.innerHTML = [...named, ...rest]
                .map((label) => `
                    <div class="queue-group-header">${escapeHtml(label)} <span class="muted">(${groups.get(label).length})</span></div>
                    ${groups.get(label).map(taskButton).join("")}
                `)
                .join("");
        }
        els.queueList.querySelectorAll(".task-button").forEach((button) => {
            button.addEventListener("click", () => selectTask(button.dataset.taskId));
        });
    }

    async function selectTask(taskId, { fromMap = false } = {}) {
        const row = state.queue.find((entry) => entry.task.task_id === taskId);
        if (!row) return;
        state.selected = row;
        // the map flies to a queue pick; a marker click already sits there
        reviewMap?.select(taskId, { fly: !fromMap });
        if (fromMap) els.detailPanel?.scrollIntoView({ block: "start", behavior: "smooth" });
        state.drafts = [];
        state.historicalClaims = [];
        state.events = [];
        state.attachments = [];
        state.sharedSource = null;
        state.agentAgreementChoice = null;
        state.occupancy = null;
        renderQueue();
        renderDetail(true);
        try {
            const [drafts, historicalClaims, events, attachments] = await Promise.all([
                client.listTaskEvidence({ taskId, limit: 20 }),
                client.listTaskHistoricalClaims({ taskId, limit: 100 }),
                client.getTaskEvents({ taskId, limit: 50 }),
                // deployments without a bucket simply show no files section
                client.listTaskAttachments({ taskId }).catch(() => []),
            ]);
            state.drafts = drafts || [];
            state.historicalClaims = historicalClaims || [];
            state.events = events || [];
            state.attachments = attachments || [];
            state.sharedSource = null;
            // a draft citing the shared register shows the register row and
            // how many other entries cite it (visible to all collaborators)
            const draftWithSource = state.selected?.latestDraft || state.drafts[0] || null;
            if (draftWithSource?.source_id) {
                try {
                    const [register, citing] = await Promise.all([
                        client.getSource({ sourceId: draftWithSource.source_id }),
                        client.listDraftsCitingSource({ sourceId: draftWithSource.source_id }),
                    ]);
                    state.sharedSource = register
                        ? { ...register, cited_by: (citing || []).length }
                        : null;
                } catch (error) {
                    state.sharedSource = null;
                }
            }
            renderDetail(false);
        } catch (error) {
            renderDetail(false, error.message || "Could not load task details.");
        }
    }

    function currentDraft() {
        return state.selected?.latestDraft || state.drafts[0] || null;
    }

    function currentReview() {
        return state.selected?.latestReview || null;
    }

    function renderEmptyDetail(message) {
        els.detailPanel.innerHTML = `<div class="panel empty">${escapeHtml(message)}</div>`;
    }

    // "no building here now" is one action for one fact (a rapid "used to
    // exist here, but no longer does" answer routes to it); when the author
    // recorded periods, say so
    function actionLabel(draft) {
        if (!draft) return "";
        if (draft.action !== "no_building_present") return draft.action;
        const periods = (state.occupancy?.occupancies || []).filter((row) => row.parent_evidence_draft_id === draft.evidence_draft_id && row.claim_status !== "superseded").length;
        return `No building here now${periods ? " — the RA recorded when it stood and was used" : ""}`;
    }

    function renderDetail(loading = false, errorMessage = "") {
        const row = state.selected;
        if (!row) {
            renderEmptyDetail("Select a submitted task after signing in.");
            return;
        }

        const { task } = row;
        const draft = currentDraft();
        const review = currentReview();
        const agentReview = row.latestAgentReview || null;
        const locationAssertion = task.initial_location_assertion || null;
        // revise-with-evidence lane: the reporter's framing and the record's
        // own point travel on the task, beside the observation they filed
        const issueReport = task.source_context?.issue_report || null;
        const issueCheck = (task.automated_checks || []).find(check => check?.check_id === "ra_issue_report") || null;
        const coordinates = Array.isArray(task.geometry?.coordinates)
            ? `${task.geometry.coordinates[1]}, ${task.geometry.coordinates[0]}`
            : "";

        els.detailPanel.innerHTML = `
            <section class="panel">
                <h2>${escapeHtml(task.name)}</h2>
                <p class="muted">${escapeHtml(task.task_brief || "")}</p>
                <div class="pill-row">${taskPills(task, draft, agentReview)}</div>
                ${loading ? `<div class="status">Loading evidence and task history...</div>` : ""}
                ${errorMessage ? `<div class="status error">${escapeHtml(errorMessage)}</div>` : ""}
                ${review ? `
                    <div class="status">
                        Last review decision: <strong>${escapeHtml(decisionLabel(review.decision_status))}</strong>
                        ${review.decision_note ? `<br>${escapeHtml(review.decision_note)}` : ""}
                    </div>
                ` : ""}
            </section>

            <div class="detail-grid">
                <section class="panel">
                    <h3>Task</h3>
                    ${renderFieldGrid([
                        ["Task id", task.task_id],
                        ["Batch", task.batch_id],
                        ["Task type", task.task_type],
                        ["Matched current site id", task.matched_current_site_id],
                        ["Candidate site id", task.candidate_site_id],
                        ["Matched OSM id", task.matched_osm_id],
                        ["OSM object type", task.osm_object_type],
                        ["Address", task.address],
                        ["Locality", task.locality],
                        [locationAssertion?.mode === "approximate_area" ? "Approximate-area centre" : "Coordinates", coordinates],
                        ["Location contract", locationAssertion?.contract_version],
                        ["Location representation", locationAssertion ? human(locationAssertion.mode) : undefined],
                        ["Location basis", locationAssertion ? human(locationAssertion.basis) : undefined],
                        ["Uncertainty radius", locationAssertion?.uncertainty_radius_m !== undefined ? `${locationAssertion.uncertainty_radius_m} m` : undefined],
                        ["Location grade", locationAssertion && window.PowLocationAssertion
                            ? window.PowLocationAssertion.gradeLabel({ mode: locationAssertion.mode, uncertaintyRadiusM: locationAssertion.uncertainty_radius_m })
                            : undefined],
                        ["Location confidence", locationAssertion?.confidence],
                        ["Contributor confirmed", locationAssertion?.contributor_confirmed ? "yes" : undefined],
                        ["Retained location wording", locationAssertion?.source_wording],
                    ])}
                </section>
                <section class="panel">
                    <h3>Open source links</h3>
                    <p class="muted">The same links the contributor had: check the place in Street View, Google Maps and OpenStreetMap. The OSM edit history has its own card below.</p>
                    ${sourceLinksHtml(task)}
                </section>
                ${issueReport ? `
                    <section class="panel">
                        <h3>Issue report</h3>
                        ${renderFieldGrid([
                            ["Issue type", issueCheck ? human(issueCheck.suggested_action) : undefined],
                            ["Reporter's note", issueCheck?.message],
                            ["Evidence lane", issueReport.evidence_lane ? human(issueReport.evidence_lane) : "flag only"],
                            ["Record's original point", Array.isArray(issueReport.original_point)
                                ? `${issueReport.original_point[1]}, ${issueReport.original_point[0]}`
                                : undefined],
                            ["Pin moved from the record", Array.isArray(issueReport.original_point) && Array.isArray(task.geometry?.coordinates)
                                ? (distanceMetres(issueReport.original_point, task.geometry.coordinates) < 1 ? "no" : `yes, about ${Math.round(distanceMetres(issueReport.original_point, task.geometry.coordinates))} m`)
                                : undefined],
                            ["Reported source", issueReport.source_title],
                            ["Reported source URL", issueReport.source_url],
                        ])}
                    </section>
                ` : ""}
                ${task.osm_object_type && task.matched_osm_id ? `
                    <section class="panel">
                        <h3>OSM history</h3>
                        <div id="reviewOsmHistory" class="osm-history-host"></div>
                    </section>
                ` : ""}

                <section class="panel">
                    <h3>Source</h3>
                    ${draft ? renderFieldGrid([
                        ["Source title", draft.source_title],
                        ["Source type", draft.source_type],
                        ["Provider", draft.provider],
                        ["URL or file", draft.source_url_or_file],
                        ["Source date", draft.source_date_or_capture_date],
                        ["Shared source", state.sharedSource
                            ? `${state.sharedSource.title}${state.sharedSource.created_by_initials ? ` — added by ${state.sharedSource.created_by_initials}` : ""}`
                            : undefined],
                        ["Locator in source", draft.source_locator],
                        ["Shared source licence", state.sharedSource?.licence],
                        ["Cited by", state.sharedSource
                            ? `${state.sharedSource.cited_by} entr${state.sharedSource.cited_by === 1 ? "y" : "ies"} across the project`
                            : undefined],
                        ["Address found", draft.address_raw],
                        ["Locality found", draft.locality_raw],
                        ["Address note", draft.address_change_note],
                        ["Licence flag", draft.licence_flag],
                        ["Privacy flag", draft.privacy_flag],
                    ]) : `<p class="muted">No evidence draft is attached.</p>`}
                </section>
            </div>

            <div class="detail-grid">
                <section class="panel">
                    <h3>Evidence summary</h3>
                    ${draft ? renderFieldGrid([
                        ["Action", actionLabel(draft)],
                        ["Starting source wording", task.source_context?.survey?.religion_as_given || task.source_context?.denomination],
                        ["Starting project taxonomy code", task.source_context?.denomination_code || task.source_context?.survey?.denomination_code],
                        ["Exact observed or reported label", draft.denomination_or_tradition_raw],
                        ["Label supplied by", draft.denomination_label_basis],
                        ["Relation to project record", draft.denomination_relation],
                        ["Current observation", draft.current_observation_status],
                        ["Observation basis", draft.current_observation_basis],
                        ["Existence status", draft.existence_status],
                        ["Worship-use status", draft.worship_use_status],
                        ["Assessment confidence", draft.assessment_confidence],
                        ["Match confidence", draft.match_confidence],
                        ["Geocoding confidence", draft.geocoding_confidence],
                        [["guided_observation_v1", "rapid_current_v1"].includes(draft.observation_contract_version) ? "Direct observation" : "Legacy evidence note", draft.evidence_note],
                        ["Interpretation", draft.interpretation_note],
                        ["Uncertainty or follow-up", draft.uncertainty_note],
                        ["Observation contract", draft.observation_contract_version],
                        ["Source notes", draft.source_notes],
                    ]) : `<p class="muted">No evidence draft is attached.</p>`}
                </section>

                <section class="panel">
                    <h3>Lifecycle</h3>
                    <p class="muted">A lifecycle event is a dated moment in the place's life as the contributor recorded it: worship beginning, ending, or moving, or the building changing use or being demolished. These are provisional claims about opening, closure, and change dates; they stay distinct from the target-year statuses below, which state whether worship was present in each census year.</p>
                    ${draft ? renderFieldGrid([
                        ["Lifecycle event", draft.lifecycle_event],
                        ["Lifecycle date", draft.lifecycle_date],
                        ["Date precision", draft.lifecycle_date_precision],
                        ["Lifecycle note", draft.lifecycle_note],
                        ["Related ids or note", draft.related_ids_or_note],
                    ]) : `<p class="muted">No lifecycle fields recorded.</p>`}
                </section>
            </div>

            <section class="panel">
                <h3>Target-year statuses</h3>
                ${draft ? targetYearTable(draft.target_year_statuses, draft.target_year_evidence, draft.target_year_confidence) : `<p class="muted">No target-year statuses recorded.</p>`}
                ${draft?.target_year_entry_reason ? `<p class="muted">Set by hand because: ${escapeHtml(draft.target_year_entry_reason)}</p>` : ""}
            </section>

            <div id="occupancyPanelHost"></div>

            <section class="panel">
                <h3>Known history claims</h3>
                ${state.historicalClaims.length === 0
                    ? `<p class="muted">No separate historical claims recorded.</p>`
                    : state.historicalClaims.map((claim, index) => `
                        <details${index === 0 ? " open" : ""}>
                            <summary>${escapeHtml(human(claim.claim_kind))} — ${escapeHtml(claim.claim_text)}</summary>
                            ${renderFieldGrid([
                                ["Claim status", claim.claim_status],
                                ["Contract", claim.contract_version],
                                ["Temporal form", claim.claim_timing],
                                ["Evidence reference date", claim.reference_date],
                                ["Reference-date basis", claim.reference_date_basis],
                                ["Earliest supported date", claim.earliest_supported_date],
                                ["Latest supported date", claim.latest_supported_date],
                                ["Open through reference date", claim.continues_through_observation ? "yes" : "no"],
                                ["Confidence", claim.confidence],
                                ["Confidence basis", claim.confidence_basis],
                                ["Source or informant basis", claim.source_basis],
                                ["Source title or description", claim.source_title],
                                ["Source reference", claim.source_reference],
                                ["Retained source wording or account", claim.source_account],
                                ["Uncertainty", claim.uncertainty_note],
                                ["Privacy flag", claim.privacy_flag],
                            ])}
                        </details>
                    `).join("")}
                <p class="muted">These provisional claims remain distinct evidence for review. They do not fill target-year states or become accepted events automatically.</p>
            </section>

            <section class="panel">
                <h3>Evidence files</h3>
                ${state.attachments.length === 0
                    ? `<p class="muted">No photos or documents were added for this task.</p>`
                    : state.attachments.map((file) => `
                        <p>
                            ${escapeHtml(file.content_type === "application/pdf" ? "PDF" : "Photo")}
                            · ${Math.max(1, Math.round(file.byte_size / 1024))} KB
                            ${file.caption ? `— ${escapeHtml(file.caption)}` : ""}
                            <button type="button" class="secondary attachment-open" data-attachment-id="${escapeHtml(file.attachment_id)}">Open</button>
                        </p>
                    `).join("")}
            </section>

            ${window.PowAgentReviewPanel ? window.PowAgentReviewPanel.panelHtml(agentReview) : ""}

            <section class="panel decision-panel">
                <h3>Review decision</h3>
                ${decisionForm(task, draft)}
            </section>

            <section class="panel">
                <h3>Generated wide row</h3>
                <details>
                    <summary>Show exported evidence fields</summary>
                    ${wideRowDetails(draft)}
                </details>
            </section>

            <section class="panel">
                <h3>Task history</h3>
                ${state.events.length === 0
                    ? `<p class="muted">No task events loaded.</p>`
                    : state.events.map((event) => `
                        <details>
                            <summary>${escapeHtml(formatDateTime(event.occurred_at))} | ${escapeHtml(event.event_type)}</summary>
                            <pre>${escapeHtml(JSON.stringify(event, null, 2))}</pre>
                        </details>
                    `).join("")}
            </section>
        `;
        window.PowSourceLinks?.bind(els.detailPanel);
        // osm edit history for the matched object (jb 2026-09-02): fetched
        // on demand from the public osm api, cached per object per session
        if (task.osm_object_type && task.matched_osm_id && window.PowOsmHistory) {
            window.PowOsmHistory.loadInto(document.getElementById("reviewOsmHistory"), task.osm_object_type, task.matched_osm_id);
        }
        // occupancy periods and derived census years, fetched once the
        // detail is settled; the panel stays empty for tasks without periods
        if (!loading) {
            loadOccupancyPanel(task);
        }
        const form = document.getElementById("reviewDecisionForm");
        if (form) {
            wireDecisionForm(form);
            form.addEventListener("submit", submitDecision);
        }
        wireClaimControls(task);
        wireAgentReviewPanel(form, agentReview);
        // evidence files open through a fresh short-lived url per click —
        // nothing in the page holds a durable link to the private bucket
        els.detailPanel.querySelectorAll(".attachment-open").forEach((button) => {
            button.addEventListener("click", async () => {
                button.disabled = true;
                try {
                    const grant = await client.requestAttachmentView({ attachmentId: button.dataset.attachmentId });
                    window.open(grant.view_url, "_blank", "noopener");
                } catch (error) {
                    button.textContent = "Could not open";
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    // occupancy panel (jb 2026-09-02, docs/development/occupancy-build-brief-2026-09-02.md
    // section 5): the drawn interval per parent draft, the derived year rows
    // with their rules in words, per-year confirm / override / reject, the
    // event trail, and a scatter of the periods' points. loads into its host
    // after the detail renders and re-renders alone after each decision.
    async function loadOccupancyPanel(task, message = "", messageKind = "ok") {
        const host = document.getElementById("occupancyPanelHost");
        if (!host || !window.PowOccupancyReview) return;
        try {
            const [occupancies, derived] = await Promise.all([
                client.listTaskOccupancies({ taskId: task.task_id, limit: 200 }),
                client.listDerivedStates({ taskId: task.task_id }),
            ]);
            // the reviewer may have moved on while the fetch was in flight
            if (state.selected?.task?.task_id !== task.task_id) return;
            state.occupancy = {
                occupancies: occupancies || [],
                derived: derived || { presence: [], locations: [], events: [] },
            };
        } catch (error) {
            if (state.selected?.task?.task_id !== task.task_id) return;
            state.occupancy = null;
            host.innerHTML = `
                <section class="panel occupancy-panel">
                    <h3>Occupancy and derived years</h3>
                    <div class="status error">${escapeHtml(error.message || "Could not load the occupancy periods.")}</div>
                </section>
            `;
            return;
        }
        renderOccupancyPanel(task, message, messageKind);
    }

    function occupancyTaskPoint(task) {
        const coordinates = task.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
        return { latitude: Number(coordinates[1]), longitude: Number(coordinates[0]) };
    }

    // the inline svg interval: census bands and ticks along the top, one row
    // per period with a solid core, dashed uncertainty windows, an open fade
    // past a still-active anchor, and the anchor marker
    function occupancyBarSvg(segments, targetYears, key) {
        const occ = window.PowOccupancyReview;
        const g = occ.barGeometry(segments, targetYears, { width: 640, rowHeight: 22, top: 18 });
        const barH = 10;
        const fadeId = `obFade-${key}`;
        const width = (pair) => Math.max(1, pair.x2 - pair.x1);
        const ticks = g.ticks.map((tick) => `
            <rect class="ob-band" x="${tick.x1.toFixed(1)}" y="${g.top - 4}" width="${width(tick).toFixed(1)}" height="${(g.height - g.top).toFixed(1)}"></rect>
            <line class="ob-tick" x1="${tick.x.toFixed(1)}" y1="${g.top - 4}" x2="${tick.x.toFixed(1)}" y2="${g.height - 2}"></line>
            <text class="ob-tick-label" x="${tick.x.toFixed(1)}" y="11" text-anchor="middle">${tick.year}</text>
        `).join("");
        const bars = g.bars.map((bar) => {
            const cy = bar.y + g.rowHeight / 2;
            const y = (cy - barH / 2).toFixed(1);
            const parts = [];
            if (bar.startWindow) {
                parts.push(`<rect class="ob-window" x="${bar.startWindow.x1.toFixed(1)}" y="${y}" width="${width(bar.startWindow).toFixed(1)}" height="${barH}"></rect>`);
            }
            if (bar.core) {
                parts.push(`<rect class="ob-core" x="${bar.core.x1.toFixed(1)}" y="${y}" width="${width(bar.core).toFixed(1)}" height="${barH}"></rect>`);
            }
            if (bar.endWindow) {
                parts.push(`<rect class="ob-window" x="${bar.endWindow.x1.toFixed(1)}" y="${y}" width="${width(bar.endWindow).toFixed(1)}" height="${barH}"></rect>`);
            }
            if (bar.open) {
                const x2 = bar.open.x2;
                parts.push(`<rect class="ob-open" fill="url(#${fadeId})" x="${bar.open.x1.toFixed(1)}" y="${y}" width="${width(bar.open).toFixed(1)}" height="${barH}"></rect>`);
                parts.push(`<polygon class="ob-arrow" points="${(x2 - 6).toFixed(1)},${(cy - 5).toFixed(1)} ${x2.toFixed(1)},${cy.toFixed(1)} ${(x2 - 6).toFixed(1)},${(cy + 5).toFixed(1)}"></polygon>`);
            }
            if (bar.asof !== null) {
                parts.push(`<line class="ob-asof" x1="${bar.asof.toFixed(1)}" y1="${(cy - 8).toFixed(1)}" x2="${bar.asof.toFixed(1)}" y2="${(cy + 8).toFixed(1)}"></line>`);
            }
            parts.push(`<text class="ob-label" x="2" y="${(cy + 3.5).toFixed(1)}">${bar.segment_index + 1}</text>`);
            return parts.join("");
        }).join("");
        return `
            <svg class="occupancy-bar" viewBox="0 0 ${g.width} ${g.height}" width="100%" height="${g.height}" role="img" aria-label="Occupancy periods against the census years">
                <defs>
                    <linearGradient id="${fadeId}" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0" style="stop-color: var(--not-assessed)" stop-opacity="0.85"></stop>
                        <stop offset="1" style="stop-color: var(--not-assessed)" stop-opacity="0.08"></stop>
                    </linearGradient>
                </defs>
                ${ticks}
                ${bars}
            </svg>
        `;
    }

    // the tiny scatter of the periods' points around the task point, used
    // only when no map library is on the page
    function occupancyScatterHtml(segments, taskPoint) {
        const occ = window.PowOccupancyReview;
        if (!taskPoint) return `<p class="muted">This task has no point, so the periods cannot be placed against it.</p>`;
        const s = occ.scatterGeometry(segments, taskPoint, { size: 120, margin: 14 });
        const points = s.points.map((p) => `
            <circle class="os-point${p.approximate ? " approx" : ""}" cx="${p.cx.toFixed(1)}" cy="${p.cy.toFixed(1)}" r="${p.r.toFixed(1)}"></circle>
            <text class="os-label" x="${(p.cx + 5).toFixed(1)}" y="${(p.cy - 5).toFixed(1)}">${p.segment_index + 1}</text>
        `).join("");
        const legend = s.points.map((p) => {
            const segment = segments.find((row) => row.segment_index === p.segment_index) || {};
            const radius = segment.location_mode === "approximate_area" && Number.isFinite(segment.uncertainty_radius_m)
                ? ` (${Math.round(segment.uncertainty_radius_m)} m radius)`
                : "";
            return `Period ${p.segment_index + 1}: ${p.distance_m === 0 ? "at the pin" : `${p.distance_m} m from the pin`}${radius}`;
        }).join(" · ");
        return `
            <div class="occupancy-scatter-wrap">
                <svg class="occupancy-scatter" viewBox="0 0 ${s.size} ${s.size}" width="${s.size}" height="${s.size}" role="img" aria-label="Period points relative to the task point">
                    <line class="os-axis" x1="${s.centre}" y1="4" x2="${s.centre}" y2="${s.size - 4}"></line>
                    <line class="os-axis" x1="4" y1="${s.centre}" x2="${s.size - 4}" y2="${s.centre}"></line>
                    ${points}
                    <circle class="os-task" cx="${s.centre}" cy="${s.centre}" r="3"></circle>
                </svg>
                <div class="muted occupancy-scatter-legend">
                    ${escapeHtml(legend)}
                    ${s.extent_m > 0 ? `<br>Box spans about ±${s.extent_m} m; north is up.` : "<br>All periods sit at the pin."}
                </div>
            </div>
        `;
    }

    function derivedLocationLine(location, segments, taskPoint) {
        const occ = window.PowOccupancyReview;
        const segment = segments.find((row) => row.occupancy_id === location.occupancy_id) || null;
        const label = segment ? `period ${segment.segment_index + 1}` : "period";
        const where = segment ? occ.describeLocation(segment, taskPoint) : `${location.latitude}, ${location.longitude}`;
        const status = human(location.location_status).toLowerCase();
        const rule = occ.LOCATION_RULE_TEXT[location.rule_id] || location.rule_id;
        const gap = location.gap_years !== undefined ? `, ${location.gap_years} year${location.gap_years === 1 ? "" : "s"} from the nearest dated bound` : "";
        const overridden = location.override_latitude !== undefined
            ? ` — overridden to ${location.override_latitude}, ${location.override_longitude}${location.override_uncertainty_radius_m !== undefined ? `, ${location.override_uncertainty_radius_m} m radius` : ""}`
            : location.override_uncertainty_radius_m !== undefined
                ? ` — radius overridden to ${location.override_uncertainty_radius_m} m`
                : "";
        return `<div>${escapeHtml(label)}: ${escapeHtml(where)} — <em>${escapeHtml(status)}</em>, ${escapeHtml(rule)}${escapeHtml(gap)}${escapeHtml(overridden)}</div>`;
    }

    // pr-f: the denomination line of a derived year, beside the presence
    // line; its own confirm / override / reject act on the function row
    function derivedFunctionHtml(fn, isAuthor) {
        const occ = window.PowOccupancyReview;
        if (!fn) return `<div class="muted">Denomination: none derived (no function chain recorded).</div>`;
        const label = occ.effectiveLabel(fn);
        const pill = occ.reviewStatePill(fn.review_state);
        const rule = occ.FUNCTION_RULE_TEXT[fn.rule_id] || fn.rule_id;
        const words = fn.derived_status === "stated"
            ? `<strong>${escapeHtml(label || fn.label || "")}</strong>`
            : `uncertain — ${escapeHtml((fn.candidate_labels || []).join(" or "))}`;
        const overriddenFrom = fn.review_state === "reviewer_overridden" && fn.override_label
            ? ` <span class="muted">(derived ${escapeHtml(fn.derived_status === "stated" ? fn.label : (fn.candidate_labels || []).join(" or "))})</span>`
            : "";
        const actions = isAuthor ? "" : `
                <div class="review-actions derived-year-actions derived-function-actions">
                    <button type="button" data-fn-action="confirm" ${fn.derived_status !== "stated" ? `disabled title="An uncertain denomination needs an override naming the label, or a rejection."` : ""}>Confirm denomination</button>
                    <button type="button" class="secondary" data-fn-action="override">Override</button>
                    <button type="button" class="danger-outline" data-fn-action="reject">Reject</button>
                </div>
                <div class="derived-function-form-host"></div>`;
        return `
            <div class="derived-year-function" data-fn-year="${fn.target_year}">
                <div>Denomination: ${words} <span class="pill ${pill.cls}">${escapeHtml(pill.label)}</span>${overriddenFrom}</div>
                <div class="muted">${escapeHtml(rule)}.</div>
                ${actions}
            </div>`;
    }

    function functionFormHtml(action, fn) {
        return `
            <form class="derived-year-form decision-form" data-fn-form="${action}">
                ${action === "override" ? `
                <div class="wide">
                    <label>Denomination to write (as the source gives it)</label>
                    <input name="label" type="text" maxlength="256" required value="${escapeHtml(fn.derived_status === "stated" ? fn.label || "" : "")}">
                </div>` : ""}
                <div class="wide">
                    <label>Note (at least 8 characters)</label>
                    <textarea name="note" required minlength="8" placeholder="${action === "override" ? "Why the derived label is wrong and what the source supports." : "Why this derived denomination should not be written."}"></textarea>
                </div>
                <div class="wide review-actions">
                    <button type="submit" ${action === "override" ? "" : `class="danger"`}>${action === "override" ? "Save override" : "Reject this denomination"}</button>
                    <button type="button" class="secondary" data-fn-cancel>Cancel</button>
                    <span class="muted" data-fn-form-status></span>
                </div>
            </form>`;
    }

    // the chain's claims, listed under the periods in chain order
    function chainClaimsHtml(claims) {
        const occ = window.PowOccupancyReview;
        const chain = (claims || [])
            .filter((claim) => claim.chain_id !== undefined && claim.claim_status === "submitted")
            .sort((a, b) => (a.chain_index ?? 0) - (b.chain_index ?? 0));
        if (chain.length === 0) return "";
        return `
            <div class="occupancy-chain">
                <strong>What it was, and how that changed</strong>
                <ol class="occupancy-chain-list">
                    ${chain.map((claim) => `<li>${escapeHtml(claim.claim_text)} <span class="muted">(${escapeHtml(occ.CHAIN_CHANGE_TEXT[claim.chain_change] || claim.chain_change || "")})</span></li>`).join("")}
                </ol>
            </div>`;
    }

    function derivedYearRowHtml(presence, locations, segments, taskPoint, observedStatus, isAuthor, fn) {
        const occ = window.PowOccupancyReview;
        const status = occ.effectiveStatus(presence);
        const reviewPill = occ.reviewStatePill(presence.review_state);
        const statusCls = occ.statusPillClass(status, presence.review_state);
        const overriddenFrom = presence.review_state === "reviewer_overridden" && presence.override_status && presence.override_status !== presence.derived_status
            ? ` <span class="muted">(derived ${escapeHtml(presence.derived_status)})</span>`
            : "";
        const rule = occ.PRESENCE_RULE_TEXT[presence.rule_id] || presence.rule_id;
        const firings = (presence.segment_rules || []).length > 1
            ? `<div class="muted">${(presence.segment_rules || []).map((f) => {
                const segment = segments.find((row) => row.occupancy_id === f.occupancy_id);
                return `period ${segment ? segment.segment_index + 1 : "?"}: ${escapeHtml(f.status)} — ${escapeHtml(occ.PRESENCE_RULE_TEXT[f.rule_id] || f.rule_id)}`;
            }).join("; ")}</div>`
            : "";
        const yearLocations = locations.filter((row) => row.target_year === presence.target_year);
        const locationHtml = yearLocations.length === 0
            ? `<div class="muted">Location: none proposed${status === "absent" ? " (absent)" : ""}.</div>`
            : `<div class="derived-year-locations">Location: ${yearLocations.map((row) => derivedLocationLine(row, segments, taskPoint)).join("")}</div>`;
        const conflict = presence.conflicts_observation
            ? `<div class="review-warning">Conflicts with the observed status for ${presence.target_year}${observedStatus ? ` (observed <strong>${escapeHtml(observedStatus)}</strong>, derived <strong>${escapeHtml(presence.derived_status)}</strong>)` : ""}. Confirm is refused; override with a note or reject.</div>`
            : "";
        const actions = isAuthor
            ? `<div class="muted">You submitted this evidence; another team member must decide its derived years.</div>`
            : `
                <div class="review-actions derived-year-actions">
                    <button type="button" data-occ-action="confirm" ${presence.conflicts_observation ? `disabled title="Confirm is refused while the derived state conflicts with an observed status; override with a note or reject."` : ""}>Confirm</button>
                    <button type="button" class="secondary" data-occ-action="override">Override</button>
                    <button type="button" class="danger-outline" data-occ-action="reject">Reject</button>
                </div>
                <div class="derived-year-form-host"></div>
            `;
        return `
            <div class="derived-year-row" data-year="${presence.target_year}">
                <div class="derived-year-head">
                    <strong>${presence.target_year}</strong>
                    <span class="pill ${statusCls}">${escapeHtml(status)}</span>${overriddenFrom}
                    ${status === "present" ? `<span class="pill grey">${presence.use_level ? `${escapeHtml(presence.use_level)} use` : "level of use not stated"}</span>` : ""}
                    <span class="pill ${reviewPill.cls}">${escapeHtml(reviewPill.label)}</span>
                </div>
                <div>Presence: ${escapeHtml(rule)}.${status === "present" ? (presence.use_level ? ` Level of use: ${escapeHtml(presence.use_level)}, confirmed with the presence.` : " Level of use not stated: the period carries no frequency, so confirming writes none.") : ""}</div>
                ${firings}
                ${locationHtml}
                ${conflict}
                ${actions}
                ${derivedFunctionHtml(fn, isAuthor)}
            </div>
        `;
    }

    function derivedEventLine(event) {
        const note = event.note ? ` — ${escapeHtml(event.note)}` : "";
        const kind = event.derivation === "function" ? " denomination" : "";
        return `<li><span class="derived-event-time">${escapeHtml(formatDateTime(event.created_at))}</span> ${event.target_year}${kind} ${escapeHtml(event.action)} · ${escapeHtml(event.actor_role || "")}${note}</li>`;
    }

    function renderOccupancyPanel(task, message = "", messageKind = "ok") {
        const host = document.getElementById("occupancyPanelHost");
        const occ = window.PowOccupancyReview;
        if (!host || !occ || !state.occupancy) return;
        const groups = occ.groupByParent(state.occupancy.occupancies);
        if (groups.length === 0) {
            host.innerHTML = "";
            return;
        }
        const derived = state.occupancy.derived;
        const taskPoint = occupancyTaskPoint(task);
        const presenceYears = derived.presence.map((row) => row.target_year);
        const targetYears = Array.isArray(task.target_years) && task.target_years.length > 0
            ? task.target_years
            : [...new Set(presenceYears)];
        const hasLeaflet = typeof window.L !== "undefined" && window.L && typeof window.L.map === "function";

        const groupHtml = groups.map((group, groupIndex) => {
            const parentId = group.parent_evidence_draft_id;
            const parentDraft = state.drafts.find((draft) => draft.evidence_draft_id === parentId) || null;
            const authorId = parentDraft?.created_by || group.created_by;
            const isAuthor = Boolean(state.user?._id) && authorId === state.user._id;
            const presence = derived.presence
                .filter((row) => row.parent_evidence_draft_id === parentId && row.review_state !== "superseded")
                .sort((a, b) => a.target_year - b.target_year);
            const locations = derived.locations
                .filter((row) => row.parent_evidence_draft_id === parentId && row.review_state !== "superseded");
            const functions = (derived.functions || [])
                .filter((row) => row.parent_evidence_draft_id === parentId && row.review_state !== "superseded");
            const parentClaims = (state.historicalClaims || []).filter((claim) => claim.parent_evidence_draft_id === parentId);
            const events = derived.events
                .filter((row) => row.parent_evidence_draft_id === parentId)
                .sort((a, b) => b.created_at - a.created_at);
            const eligible = isAuthor ? [] : occ.confirmAllEligibleYears(presence, locations);
            const eligibleFunctions = isAuthor ? [] : occ.confirmAllEligibleFunctionYears(functions);
            const eligibleWords = [
                eligible.length ? `states ${eligible.join(", ")}` : "",
                eligibleFunctions.length ? `denominations ${eligibleFunctions.join(", ")}` : "",
            ].filter(Boolean).join("; ");
            const observed = parentDraft?.target_year_statuses || {};
            const periodLines = group.segments.map((segment) => `
                <li>
                    <strong>Period ${segment.segment_index + 1}</strong>:
                    ${escapeHtml(occ.describeStart(segment))}; ${escapeHtml(occ.describeEnd(segment))}; ${escapeHtml(occ.describeLocation(segment, taskPoint))}${occ.describeFrequency(segment) ? `; ${escapeHtml(occ.describeFrequency(segment))}` : ""}
                    <span class="muted">(${escapeHtml(segment.confidence)} confidence, ${escapeHtml(human(segment.source_basis).toLowerCase())})</span>
                </li>
            `).join("");
            const eventList = events.map(derivedEventLine).join("");
            const eventsHtml = events.length === 0
                ? `<p class="muted">No events recorded yet.</p>`
                : events.length > 5
                    ? `<details><summary>${events.length} events</summary><ul class="derived-events">${eventList}</ul></details>`
                    : `<ul class="derived-events">${eventList}</ul>`;
            return `
                <div class="occupancy-parent" data-parent="${escapeHtml(parentId)}">
                    ${groups.length > 1 ? `<h4>${groupIndex === 0 ? "Latest submission" : "Earlier submission"} <span class="muted">${escapeHtml(parentId)}</span></h4>` : ""}
                    ${occupancyBarSvg(group.segments, targetYears, `${groupIndex}`)}
                    <div class="occupancy-key muted">Solid: certain core. Dashed: start or end uncertainty window. Fade with arrow: still active past the marked as-of date. Shaded bands: census years.</div>
                    <ul class="occupancy-periods">${periodLines}</ul>
                    ${chainClaimsHtml(parentClaims)}
                    <div class="derived-year-list">
                        <div class="derived-year-toolbar">
                            <strong>Derived census years</strong>
                            ${eligible.length > 0 || eligibleFunctions.length > 0 ? `<button type="button" data-occ-confirm-all ${state.occupancyBusy ? "disabled" : ""}>Confirm all eligible (${eligibleWords})</button>` : ""}
                            ${isAuthor ? `<span class="muted">You submitted this evidence.</span>` : ""}
                        </div>
                        ${presence.length === 0
                            ? `<p class="muted">No census year was derived from these periods.</p>`
                            : presence.map((row) => derivedYearRowHtml(row, locations, group.segments, taskPoint, observed[String(row.target_year)], isAuthor, functions.find((fn) => fn.target_year === row.target_year) || null)).join("")}
                        ${functions.filter((fn) => !presence.some((row) => row.target_year === fn.target_year)).map((fn) => `<div class="derived-year-row" data-year="${fn.target_year}"><div class="derived-year-head"><strong>${fn.target_year}</strong></div>${derivedFunctionHtml(fn, isAuthor)}</div>`).join("")}
                    </div>
                    <div class="derived-trail">
                        <strong>Event trail</strong>
                        ${eventsHtml}
                    </div>
                    ${hasLeaflet ? "" : `<div class="occupancy-map-strip"><strong>Period points</strong>${occupancyScatterHtml(group.segments, taskPoint)}</div>`}
                </div>
            `;
        }).join("");

        host.innerHTML = `
            <section class="panel occupancy-panel">
                <h3>Occupancy and derived years</h3>
                <p class="muted">Derived states are proposals from the recorded periods. Only a confirmation or override writes a census-year status onto the evidence record.</p>
                ${message ? `<div class="status ${escapeHtml(messageKind)}" id="occupancyStatus" aria-live="polite">${escapeHtml(message)}</div>` : `<div id="occupancyStatus" aria-live="polite"></div>`}
                ${groupHtml}
            </section>
        `;
        wireOccupancyPanel(task);
    }

    function occupancyFormHtml(action, presence) {
        const noteField = `
            <div class="wide">
                <label>Note (at least 8 characters)</label>
                <textarea name="note" required minlength="8" placeholder="${action === "override" ? "Why the derived value is wrong and what the source supports." : "Why this derived year should not be written."}"></textarea>
            </div>
        `;
        const overrideFields = action === "override" ? `
            <div>
                <label>Status</label>
                <select name="status">
                    <option value="">keep derived (${escapeHtml(presence.derived_status)})</option>
                    <option value="present">present</option>
                    <option value="absent">absent</option>
                    <option value="uncertain">uncertain</option>
                </select>
            </div>
            <div>
                <label>Level of use (with present)</label>
                <select name="use_level">
                    <option value="">keep derived (${escapeHtml(presence.use_level || "not stated")})</option>
                    <option value="regular">regular</option>
                    <option value="intermittent">intermittent</option>
                </select>
            </div>
            <div>
                <label>Uncertainty radius (m, optional)</label>
                <input name="radius" type="number" min="0" step="1" placeholder="leave blank to keep">
            </div>
            <div>
                <label>Latitude (optional)</label>
                <input name="latitude" type="number" step="any" placeholder="leave blank to keep">
            </div>
            <div>
                <label>Longitude (optional)</label>
                <input name="longitude" type="number" step="any" placeholder="leave blank to keep">
            </div>
        ` : "";
        return `
            <form class="derived-year-form decision-form" data-occ-form="${action}">
                ${overrideFields}
                ${noteField}
                <div class="wide review-actions">
                    <button type="submit" ${action === "override" ? "" : `class="danger"`}>${action === "override" ? "Save override" : "Reject this year"}</button>
                    <button type="button" class="secondary" data-occ-cancel>Cancel</button>
                    <span class="muted" data-occ-form-status></span>
                </div>
            </form>
        `;
    }

    // one per-year decision against the server; the panel alone re-renders
    async function decideOccupancyYear(task, parentId, year, action, note, override, derivation) {
        if (state.occupancyBusy) return;
        state.occupancyBusy = true;
        try {
            const result = await client.decideDerivedYear({
                taskId: task.task_id,
                parentEvidenceDraftId: parentId,
                targetYear: year,
                action,
                ...(derivation ? { derivation } : {}),
                ...(note ? { note } : {}),
                ...(override ? { override } : {}),
            });
            const stateWords = String(result.review_state || "").replaceAll("_", " ");
            const written = result.written_status
                ? ` ${result.written_status} written to the evidence record.`
                : " Nothing written to the evidence record.";
            state.occupancyBusy = false;
            await loadOccupancyPanel(task, `${result.target_year}: ${stateWords}.${written}`, "ok");
        } catch (error) {
            state.occupancyBusy = false;
            await loadOccupancyPanel(task, error.message || "The decision failed.", "error");
        }
    }

    function wireOccupancyPanel(task) {
        const host = document.getElementById("occupancyPanelHost");
        if (!host) return;
        host.querySelectorAll(".occupancy-parent").forEach((parentEl) => {
            const parentId = parentEl.dataset.parent;
            parentEl.querySelector("[data-occ-confirm-all]")?.addEventListener("click", async (event) => {
                if (state.occupancyBusy) return;
                event.currentTarget.disabled = true;
                state.occupancyBusy = true;
                try {
                    const result = await client.confirmAllDerived({ taskId: task.task_id, parentEvidenceDraftId: parentId });
                    state.occupancyBusy = false;
                    await loadOccupancyPanel(task, window.PowOccupancyReview.confirmAllSummary(result), result.confirmed.length > 0 ? "ok" : "");
                } catch (error) {
                    state.occupancyBusy = false;
                    await loadOccupancyPanel(task, error.message || "Confirm all failed.", "error");
                }
            });
            parentEl.querySelectorAll(".derived-year-function").forEach((fnEl) => {
                const year = Number(fnEl.dataset.fnYear);
                const fn = (state.occupancy?.derived?.functions || []).find(
                    (row) => row.parent_evidence_draft_id === parentId && row.target_year === year && row.review_state !== "superseded",
                );
                const formHost = fnEl.querySelector(".derived-function-form-host");
                fnEl.querySelectorAll("[data-fn-action]").forEach((button) => {
                    button.addEventListener("click", () => {
                        const action = button.dataset.fnAction;
                        if (action === "confirm") {
                            fnEl.querySelectorAll("[data-fn-action]").forEach((b) => { b.disabled = true; });
                            decideOccupancyYear(task, parentId, year, "confirm", undefined, undefined, "function");
                            return;
                        }
                        if (!formHost || !fn) return;
                        if (formHost.dataset.open === action) {
                            formHost.innerHTML = "";
                            delete formHost.dataset.open;
                            return;
                        }
                        formHost.dataset.open = action;
                        formHost.innerHTML = functionFormHtml(action, fn);
                        const form = formHost.querySelector("form");
                        form.querySelector("[data-fn-cancel]").addEventListener("click", () => {
                            formHost.innerHTML = "";
                            delete formHost.dataset.open;
                        });
                        form.addEventListener("submit", (event) => {
                            event.preventDefault();
                            const statusEl = form.querySelector("[data-fn-form-status]");
                            const note = form.note.value.trim();
                            if (note.length < 8) {
                                statusEl.textContent = "Add a note of at least 8 characters.";
                                return;
                            }
                            let override;
                            if (action === "override") {
                                const label = form.label.value.trim();
                                if (label.length < 2) {
                                    statusEl.textContent = "Name the denomination to write.";
                                    return;
                                }
                                override = { label };
                            }
                            decideOccupancyYear(task, parentId, year, action, note, override, "function");
                        });
                    });
                });
            });
            parentEl.querySelectorAll(".derived-year-row").forEach((rowEl) => {
                const year = Number(rowEl.dataset.year);
                const presence = (state.occupancy?.derived?.presence || []).find(
                    (row) => row.parent_evidence_draft_id === parentId && row.target_year === year && row.review_state !== "superseded",
                );
                const formHost = rowEl.querySelector(".derived-year-form-host");
                rowEl.querySelectorAll("[data-occ-action]").forEach((button) => {
                    button.addEventListener("click", () => {
                        const action = button.dataset.occAction;
                        if (action === "confirm") {
                            rowEl.querySelectorAll("[data-occ-action]").forEach((b) => { b.disabled = true; });
                            decideOccupancyYear(task, parentId, year, "confirm");
                            return;
                        }
                        if (!formHost || !presence) return;
                        // one open form per row; clicking the same action again closes it
                        if (formHost.dataset.open === action) {
                            formHost.innerHTML = "";
                            delete formHost.dataset.open;
                            return;
                        }
                        formHost.dataset.open = action;
                        formHost.innerHTML = occupancyFormHtml(action, presence);
                        const form = formHost.querySelector("form");
                        form.querySelector("[data-occ-cancel]").addEventListener("click", () => {
                            formHost.innerHTML = "";
                            delete formHost.dataset.open;
                        });
                        form.addEventListener("submit", (event) => {
                            event.preventDefault();
                            const statusEl = form.querySelector("[data-occ-form-status]");
                            const note = form.note.value.trim();
                            if (note.length < 8) {
                                statusEl.textContent = "Add a note of at least 8 characters.";
                                return;
                            }
                            let override;
                            if (action === "override") {
                                const status = form.status.value || undefined;
                                const useLevel = form.use_level?.value || undefined;
                                const lat = form.latitude.value.trim();
                                const lng = form.longitude.value.trim();
                                const radius = form.radius.value.trim();
                                if ((lat === "") !== (lng === "")) {
                                    statusEl.textContent = "An overriding point needs both latitude and longitude.";
                                    return;
                                }
                                override = {
                                    ...(status ? { status } : {}),
                                    ...(useLevel ? { use_level: useLevel } : {}),
                                    ...(lat !== "" ? { latitude: Number(lat), longitude: Number(lng) } : {}),
                                    ...(radius !== "" ? { uncertainty_radius_m: Number(radius) } : {}),
                                };
                                if (Object.keys(override).length === 0) {
                                    statusEl.textContent = "An override needs a status, a level of use, a point, or a radius.";
                                    return;
                                }
                                if ([override.latitude, override.longitude, override.uncertainty_radius_m].some((v) => v !== undefined && !Number.isFinite(v))) {
                                    statusEl.textContent = "Latitude, longitude, and radius must be numbers.";
                                    return;
                                }
                            }
                            form.querySelector('button[type="submit"]').disabled = true;
                            statusEl.textContent = "Recording...";
                            decideOccupancyYear(task, parentId, year, action, note, override);
                        });
                        form.note.focus();
                    });
                });
            });
        });
    }

    // claim-pool controls (jb 2026-09-01): claiming is coordination, the
    // recorded decision stays the act; only the submission's author is
    // excluded from judging it
    function wireClaimControls(task) {
        const statusLine = () => document.getElementById("claimStatusText");
        const run = async (button, action, doneMessage) => {
            button.disabled = true;
            try {
                await action();
                await loadQueue();
                const refreshed = state.queue.find((entry) => entry.task.task_id === task.task_id);
                if (refreshed) {
                    await selectTask(task.task_id);
                } else {
                    renderDetail(false);
                }
                if (statusLine()) statusLine().textContent = doneMessage;
            } catch (error) {
                button.disabled = false;
                if (statusLine()) statusLine().textContent = error.message || "The action failed.";
            }
        };
        document.getElementById("claimReviewButton")?.addEventListener("click", (event) => {
            run(event.currentTarget, () => client.claimReviewTask({ taskId: task.task_id }), "Claimed for review.");
        });
        document.getElementById("releaseReviewButton")?.addEventListener("click", (event) => {
            run(event.currentTarget, () => client.releaseReviewTask({ taskId: task.task_id }), "Review claim released.");
        });
        document.getElementById("requestOpinionButton")?.addEventListener("click", (event) => {
            const note = window.prompt("Why is another opinion needed? (at least 8 characters)") || "";
            if (!note.trim()) return;
            run(
                event.currentTarget,
                () => client.requestAdditionalOpinion({ taskId: task.task_id, note: note.trim() }),
                "Another opinion requested before acceptance.",
            );
        });
        // return-for-comment: hold the decision and ask the contributor to
        // answer — e.g. respond to an AI recommendation to reject
        document.getElementById("requestCommentButton")?.addEventListener("click", (event) => {
            const comment = window.prompt("Question or comment for the contributor (at least 8 characters):") || "";
            if (!comment.trim()) return;
            run(
                event.currentTarget,
                () => client.requestContributorComment({ taskId: task.task_id, comment: comment.trim() }),
                "Returned to the contributor for comment; the task comes back to the queue when they answer.",
            );
        });
    }

    // the explicit affordances on the AI recommendation: prefill-and-agree
    // or record disagreement. Neither submits; the decision note and the
    // Record button remain the human act.
    function wireAgentReviewPanel(form, agentReview) {
        if (!form || !agentReview || !window.PowAgentReviewPanel) return;
        const statusLine = document.getElementById("agentAgreementStatus");
        document.getElementById("useAgentRecommendation")?.addEventListener("click", () => {
            const mapped = window.PowAgentReviewPanel.decisionForRecommendation(agentReview.recommendation);
            if (mapped) {
                setDecisionFormValues(form, { decisionStatus: mapped });
            }
            state.agentAgreementChoice = "followed";
            if (statusLine) {
                statusLine.textContent = "Decision prefilled from the recommendation. Add your decision note, then record.";
            }
            form.decisionNote.focus();
        });
        document.getElementById("disagreeAgentRecommendation")?.addEventListener("click", () => {
            state.agentAgreementChoice = "disagreed";
            if (statusLine) {
                statusLine.textContent = "Your disagreement will be recorded with the decision. Choose your own decision below.";
            }
            form.decisionStatus.focus();
        });
    }

    function setDecisionFormValues(form, values) {
        if (values.decisionStatus !== undefined) form.decisionStatus.value = values.decisionStatus;
        if (values.identityDecision !== undefined) form.identityDecision.value = values.identityDecision;
        if (values.acceptedAction !== undefined) form.acceptedAction.value = values.acceptedAction;
        if (values.requiredFollowUp !== undefined) form.requiredFollowUp.value = values.requiredFollowUp;
        if (values.decisionNote !== undefined) form.decisionNote.value = values.decisionNote;
        updateDecisionHelp(form);
    }

    function updateDecisionHelp(form) {
        const help = document.getElementById("decisionHelp");
        if (!help) return;
        help.textContent = decisionHint(form.decisionStatus.value);
    }

    function wireDecisionForm(form) {
        form.decisionStatus?.addEventListener("change", () => updateDecisionHelp(form));
        // cmd/ctrl+enter from anywhere in the decision form records the
        // decision without a mouse trip, matching the ra portal's scope;
        // submitDecision keeps the busy guard and validation messages
        form.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                form.requestSubmit();
            }
        });
        document.getElementById("markSystemTest")?.addEventListener("click", () => {
            setDecisionFormValues(form, {
                decisionStatus: "rejected",
                identityDecision: "uncertain",
                acceptedAction: "",
                requiredFollowUp: "",
                decisionNote: "JB system test; exclude from export.",
            });
        });
        document.getElementById("requestMoreEvidence")?.addEventListener("click", () => {
            setDecisionFormValues(form, {
                decisionStatus: "needs_more_evidence",
                requiredFollowUp: "Clarify the source, date, site identity, or target-year status.",
            });
            form.decisionNote.focus();
        });
    }

    function decisionForm(task, draft) {
        const defaultAction = draft?.action || "";
        const canDecide = task.status === "needs_review"
            || task.status === "unresolved_note"
            || task.status === "changes_requested"
            || task.status === "provisionally_closed";
        const row = state.selected || {};
        const mine = Boolean(row.review_claimed_by_me);
        const claimedByOther = Boolean(row.review_claimant_label) && !mine;
        const ownSubmission = Boolean(row.submitted_by_me);
        const opinions = Number(task.extra_opinions_required || 0);
        const claimBar = canDecide ? `
            <div class="review-claim-bar">
                ${ownSubmission ? `<div class="review-warning">You submitted this evidence; another team member must record the decision (only the author is excluded).</div>` : ""}
                ${claimedByOther ? `<div class="review-warning">Claimed for review by ${escapeHtml(row.review_claimant_label)}. Coordinate before deciding, or ask a curator to release the claim.</div>` : ""}
                ${opinions ? `<div class="review-warning">Second opinion requested (${opinions}): acceptance for export needs ${opinions} other reviewer decision${opinions === 1 ? "" : "s"} on record first.</div>` : ""}
                ${task.pending_reviewer_comment ? `<div class="review-warning">Awaiting the contributor's answer: "${escapeHtml(task.pending_reviewer_comment)}"</div>` : ""}
                <div class="review-actions">
                    ${ownSubmission || claimedByOther ? "" : mine
                        ? `<button type="button" class="secondary" id="releaseReviewButton">Release review claim</button>`
                        : `<button type="button" class="secondary" id="claimReviewButton">Claim for review</button>`}
                    ${opinions >= 2 ? "" : `<button type="button" class="secondary" id="requestOpinionButton">Call for another opinion</button>`}
                    ${task.pending_reviewer_comment ? "" : `<button type="button" class="secondary" id="requestCommentButton">Return for comment</button>`}
                </div>
                <div id="claimStatusText" class="muted" aria-live="polite"></div>
            </div>
        ` : "";
        return `
            ${claimBar}
            <form id="reviewDecisionForm" class="decision-form">
                <div>
                    <label for="decisionStatus">Decision</label>
                    <select id="decisionStatus" name="decisionStatus" required ${canDecide ? "" : "disabled"}>
                        <option value="">choose decision...</option>
                        <option value="accepted_for_export">accepted for export</option>
                        <option value="needs_more_evidence">needs more evidence</option>
                        <option value="rejected">rejected</option>
                        <option value="duplicate_task">duplicate task</option>
                        <option value="deferred">deferred</option>
                    </select>
                </div>
                <div>
                    <label for="identityDecision">Identity decision</label>
                    <select id="identityDecision" name="identityDecision" ${canDecide ? "" : "disabled"}>
                        <option value="">not specified</option>
                        <option value="same_site">same site</option>
                        <option value="new_candidate">new candidate</option>
                        <option value="duplicate">duplicate</option>
                        <option value="split">split</option>
                        <option value="merge">merge</option>
                        <option value="relocation">relocation</option>
                        <option value="uncertain">uncertain</option>
                    </select>
                </div>
                <div>
                    <label for="acceptedAction">Accepted action</label>
                    <input id="acceptedAction" name="acceptedAction" value="${escapeHtml(defaultAction)}" placeholder="Usually copied from the draft action" ${canDecide ? "" : "disabled"}>
                </div>
                <div>
                    <label for="requiredFollowUp">Required follow-up</label>
                    <input id="requiredFollowUp" name="requiredFollowUp" placeholder="Only needed for more evidence" ${canDecide ? "" : "disabled"}>
                </div>
                <div class="wide">
                    <label for="decisionNote">Decision note</label>
                    <textarea id="decisionNote" name="decisionNote" placeholder="Record why this decision is appropriate. Mention source gaps, identity uncertainty, or any changes needed." ${canDecide ? "" : "disabled"}></textarea>
                </div>
                <div class="wide">
                    <div id="decisionHelp" class="review-warning">${escapeHtml(canDecide ? decisionHint("") : "This task is already reviewed or exported. Change the queue status to inspect other work, or reopen from the maintainer workflow if new evidence requires action.")}</div>
                    ${canDecide ? `
                        <div class="review-actions">
                            <button type="button" class="secondary" id="markSystemTest">Exclude as system test</button>
                            <button type="button" class="secondary" id="requestMoreEvidence">Needs more evidence</button>
                        </div>
                    ` : ""}
                    <button type="submit" ${state.busy || !canDecide || ownSubmission ? "disabled" : ""}>Record review decision</button>
                    <span id="decisionStatusText" class="muted">${draft ? `Draft: ${escapeHtml(draft.evidence_draft_id)}` : "Accepted-for-export requires an evidence draft."}</span>
                </div>
                <input type="hidden" name="taskId" value="${escapeHtml(task.task_id)}">
            </form>
        `;
    }

    // next task id after the decided row, walking the pre-reload queue order
    // and keeping only rows still present after the reload; wraps to the top
    function nextQueueTaskId(previousIds, decidedTaskId) {
        if (state.queue.length === 0) return null;
        const remaining = new Set(state.queue.map((entry) => entry.task.task_id));
        const start = previousIds.indexOf(decidedTaskId);
        for (let offset = 1; offset <= previousIds.length; offset += 1) {
            const candidate = previousIds[(start + offset) % previousIds.length];
            if (candidate !== decidedTaskId && remaining.has(candidate)) return candidate;
        }
        return state.queue[0].task.task_id;
    }

    // post-decision pane mirroring the RA portal's "Open next task" idiom:
    // advancing stays the reviewer's click, never an auto-select
    function renderDecisionRecorded(taskStatus, previousIds, decidedTaskId) {
        const queueEmpty = state.queue.length === 0;
        els.detailPanel.innerHTML = `
            <div class="panel">
                <h2>Decision recorded</h2>
                <div class="status ok">Task status is now ${escapeHtml(taskStatus)}.</div>
                <div class="review-actions">
                    <button id="openNextInQueue" type="button" ${queueEmpty ? "disabled" : ""}>Open next in queue</button>
                </div>
                <div id="nextInQueueStatus" class="muted" aria-live="polite">
                    ${queueEmpty
                        ? "The queue for this status is empty. Change the queue status or refresh to load more work."
                        : "Or select another submitted task from the list."}
                </div>
            </div>
        `;
        document.getElementById("openNextInQueue")?.addEventListener("click", () => {
            const nextId = nextQueueTaskId(previousIds, decidedTaskId);
            if (!nextId) {
                document.getElementById("nextInQueueStatus").textContent =
                    "The queue for this status is empty. Change the queue status or refresh to load more work.";
                return;
            }
            selectTask(nextId);
        });
    }

    async function submitDecision(event) {
        event.preventDefault();
        if (!state.selected || state.busy) return;
        const draft = currentDraft();
        const form = event.currentTarget;
        const statusText = document.getElementById("decisionStatusText");
        const decisionStatus = form.decisionStatus.value;
        if (!decisionStatus) {
            statusText.textContent = "Choose a review decision.";
            statusText.className = "status error";
            return;
        }
        if (form.decisionNote.value.trim().length < 8) {
            statusText.textContent = "Add a short decision note.";
            statusText.className = "status error";
            return;
        }
        if (decisionStatus === "accepted_for_export" && !draft) {
            statusText.textContent = "Accepted-for-export decisions require an evidence draft.";
            statusText.className = "status error";
            return;
        }

        const decision = {
            evidence_draft_id: draft?.evidence_draft_id,
            decision_status: decisionStatus,
            decision_note: form.decisionNote.value.trim() || undefined,
            accepted_action: form.acceptedAction.value.trim() || undefined,
            identity_decision: form.identityDecision.value || undefined,
            target_year_affects: decisionStatus === "accepted_for_export"
                ? targetYearAffectsFromDraft(draft)
                : undefined,
            required_follow_up: form.requiredFollowUp.value.trim() || undefined,
        };
        // provenance: which AI recommendation was on screen and whether the
        // human followed it — explicit button choice wins, otherwise derived
        // from the decision so the record never overstates agreement
        const agentReview = state.selected.latestAgentReview;
        if (agentReview && window.PowAgentReviewPanel) {
            decision.agent_review_id = agentReview.agent_review_id;
            decision.agent_review_agreement = window.PowAgentReviewPanel.deriveAgreement(
                agentReview,
                decisionStatus,
                state.agentAgreementChoice || undefined,
            );
        }

        state.busy = true;
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        statusText.textContent = "Recording review decision...";
        statusText.className = "muted";
        try {
            const result = await client.recordReviewDecision({
                taskId: state.selected.task.task_id,
                decision,
            });
            statusText.textContent = `Recorded. Task status is now ${result.task_status}.`;
            statusText.className = "status ok";
            // keep the pre-reload order so "next" follows the reviewed row
            const decidedTaskId = state.selected.task.task_id;
            const previousIds = state.queue.map((entry) => entry.task.task_id);
            state.selected = null;
            await loadQueue();
            renderDecisionRecorded(result.task_status, previousIds, decidedTaskId);
        } catch (error) {
            statusText.textContent = error.message || "Could not record the review decision.";
            statusText.className = "status error";
        } finally {
            state.busy = false;
            if (submitButton) submitButton.disabled = false;
        }
    }

    // r-d3 (jb 2026-09-04): the standing review boundary is open on a
    // reviewer's first visit and closed on later ones; without storage it
    // stays open every time
    function setupBoundary() {
        const boundary = document.getElementById("reviewBoundary");
        if (!boundary) return;
        const key = "pow-review-boundary-seen";
        try {
            const seen = window.localStorage.getItem(key) === "1";
            boundary.open = !seen;
            if (!seen) window.localStorage.setItem(key, "1");
        } catch (_error) {
            boundary.open = true;
        }
    }

    async function init() {
        setupPageLabel();
        setupBoundary();
        // a sign-in kept on the device from before a reload (jb 2026-09-05)
        if (client.authToken) {
            state.user = await client.restoreSession().catch(() => null);
        }
        els.refreshQueue.addEventListener("click", loadQueue);
        els.queueStatus.addEventListener("change", () => {
            state.selected = null;
            renderEmptyDetail("Select a submitted task after the queue loads.");
            loadQueue();
        });
        els.queueGroupBy?.addEventListener("change", () => renderQueue());
        els.queueClaimFilter?.addEventListener("change", () => renderQueue());
        renderAuth();
        renderQueue();
        if (state.user) await loadQueue();
    }

    init();
})();
