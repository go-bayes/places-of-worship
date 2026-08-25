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
    const countryFromQuery = countryLabels[String(searchParams.get("country") || "").toLowerCase()];
    const countryFromConfig = countryLabels[String(config.countryCode || "").toLowerCase()];
    const country = countryFromQuery || countryFromConfig || countryLabels.nz;
    const countryCode = country.code;
    const countryName = country.label;
    const client = new window.PowConvexTaskClient(config);
    const state = {
        user: null,
        queue: [],
        selected: null,
        drafts: [],
        events: [],
        busy: false,
        // explicit reviewer stance on the AI recommendation, set by the
        // Use-recommendation / Decide-differently buttons; null = no
        // explicit choice, agreement derives from the decision itself
        agentAgreementChoice: null,
    };

    const els = {
        authPanel: document.getElementById("authPanel"),
        authStatus: document.getElementById("authStatus"),
        detailPanel: document.getElementById("detailPanel"),
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
            `<span class="pill amber">${escapeHtml(task.priority)}</span>`,
        ];
        if (agentReview && window.PowClaudeReviewPanel) {
            pills.push(window.PowClaudeReviewPanel.queuePillHtml(agentReview));
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

    function targetYearTable(statuses, evidence) {
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
            client.signOut();
            state.user = null;
            state.queue = [];
            state.selected = null;
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
        if (state.queue.length === 0) {
            els.queueList.innerHTML = `<div class="empty">No tasks in this queue.</div>`;
            return;
        }
        els.queueList.innerHTML = state.queue
            .map(({ task, latestDraft, latestReview, latestAgentReview }) => `
                <button class="task-button ${state.selected?.task?.task_id === task.task_id ? "active" : ""}"
                    type="button"
                    data-task-id="${escapeHtml(task.task_id)}">
                    <strong>${escapeHtml(task.name)}</strong>
                    <span class="muted">${escapeHtml(taskSubtitle(task))}</span>
                    <span class="pill-row">${taskPills(task, latestDraft, latestAgentReview)}</span>
                    ${latestReview?.decision_status ? `<span class="muted">Last decision: ${escapeHtml(decisionLabel(latestReview.decision_status))}</span>` : ""}
                </button>
            `)
            .join("");
        els.queueList.querySelectorAll(".task-button").forEach((button) => {
            button.addEventListener("click", () => selectTask(button.dataset.taskId));
        });
    }

    async function selectTask(taskId) {
        const row = state.queue.find((entry) => entry.task.task_id === taskId);
        if (!row) return;
        state.selected = row;
        state.drafts = [];
        state.events = [];
        state.agentAgreementChoice = null;
        renderQueue();
        renderDetail(true);
        try {
            const [drafts, events] = await Promise.all([
                client.listTaskEvidence({ taskId, limit: 20 }),
                client.getTaskEvents({ taskId, limit: 50 }),
            ]);
            state.drafts = drafts || [];
            state.events = events || [];
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
                        ["Coordinates", coordinates],
                    ])}
                </section>

                <section class="panel">
                    <h3>Source</h3>
                    ${draft ? renderFieldGrid([
                        ["Source title", draft.source_title],
                        ["Source type", draft.source_type],
                        ["Provider", draft.provider],
                        ["URL or file", draft.source_url_or_file],
                        ["Source date", draft.source_date_or_capture_date],
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
                        ["Action", draft.action],
                        ["Starting source wording", task.source_context?.survey?.religion_as_given || task.source_context?.denomination],
                        ["Starting project taxonomy code", task.source_context?.denomination_code || task.source_context?.survey?.denomination_code],
                        ["Exact observed or reported label", draft.denomination_or_tradition_raw],
                        ["Label supplied by", draft.denomination_label_basis],
                        ["Relation to project record", draft.denomination_relation],
                        ["Existence status", draft.existence_status],
                        ["Worship-use status", draft.worship_use_status],
                        ["Assessment confidence", draft.assessment_confidence],
                        ["Match confidence", draft.match_confidence],
                        ["Geocoding confidence", draft.geocoding_confidence],
                        [draft.observation_contract_version === "guided_observation_v1" ? "Direct observation" : "Legacy evidence note", draft.evidence_note],
                        ["Interpretation", draft.interpretation_note],
                        ["Uncertainty or follow-up", draft.uncertainty_note],
                        ["Observation contract", draft.observation_contract_version],
                        ["Source notes", draft.source_notes],
                    ]) : `<p class="muted">No evidence draft is attached.</p>`}
                </section>

                <section class="panel">
                    <h3>Lifecycle</h3>
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
                ${draft ? targetYearTable(draft.target_year_statuses, draft.target_year_evidence) : `<p class="muted">No target-year statuses recorded.</p>`}
            </section>

            ${window.PowClaudeReviewPanel ? window.PowClaudeReviewPanel.panelHtml(agentReview) : ""}

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
        const form = document.getElementById("reviewDecisionForm");
        if (form) {
            wireDecisionForm(form);
            form.addEventListener("submit", submitDecision);
        }
        wireAgentReviewPanel(form, agentReview);
    }

    // the explicit affordances on the AI recommendation: prefill-and-agree
    // or record disagreement. Neither submits; the decision note and the
    // Record button remain the human act.
    function wireAgentReviewPanel(form, agentReview) {
        if (!form || !agentReview || !window.PowClaudeReviewPanel) return;
        const statusLine = document.getElementById("agentAgreementStatus");
        document.getElementById("useAgentRecommendation")?.addEventListener("click", () => {
            const mapped = window.PowClaudeReviewPanel.decisionForRecommendation(agentReview.recommendation);
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
        return `
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
                    <button type="submit" ${state.busy || !canDecide ? "disabled" : ""}>Record review decision</button>
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
        if (agentReview && window.PowClaudeReviewPanel) {
            decision.agent_review_id = agentReview.agent_review_id;
            decision.agent_review_agreement = window.PowClaudeReviewPanel.deriveAgreement(
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

    function init() {
        setupPageLabel();
        els.refreshQueue.addEventListener("click", loadQueue);
        els.queueStatus.addEventListener("change", () => {
            state.selected = null;
            renderEmptyDetail("Select a submitted task after the queue loads.");
            loadQueue();
        });
        renderAuth();
        renderQueue();
    }

    init();
})();
