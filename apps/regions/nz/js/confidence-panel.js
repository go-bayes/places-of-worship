// recorded-confidence panel (p4, 2026-10-01): renders the agent judgments
// about the place a task is about, from getReviewSnapshot.displayed_judgments
// (stored rows, each with its newest dispositions embedded),
// beside the human controls. pure rendering and pure mapping: nothing here
// submits. the portal wires the disposition buttons, and the decision form
// stays the only path to a review decision. a tier orders review and decides
// nothing (docs/confidence-standard.md); humans decide.
(function () {
    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // dates read as YYYY-MM-DD, the project's date form, on the viewer's
    // calendar (a utc date lags the new zealand day by up to thirteen hours)
    function isoDate(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    // osm-pow:<country>:edition:<date>:<hash prefix> -> the date
    function editionDate(editionId) {
        const parts = String(editionId ?? "").split(":");
        return parts.length === 5 && parts[2] === "edition" ? parts[3] : String(editionId ?? "");
    }

    // closed vocabulary terms read as words: underscores become spaces and a
    // dot between letters (tag_completeness.score) too, while a dot between
    // digits (composite_below_0.6) stays
    function words(term) {
        return String(term ?? "").replaceAll("_", " ").replace(/([a-z])\.([a-z])/g, "$1 $2");
    }

    const KIND_LABELS = {
        registration_confidence: "Registration confidence",
        status_assessment: "Status",
        location: "Location",
        duplicate: "Duplicate",
        claim_support: "Claim support",
        recommendation: "Recommendation",
        annotation: "Annotation",
    };

    function kindLabel(kind) {
        return KIND_LABELS[kind] || words(kind);
    }

    // one line under the pills; the pill itself carries the tier word alone
    const TIER_HINTS = {
        screened: "Machine-screened. No tier accepts; the decision stays yours.",
        review: "The composite, a component or an indicator fell short of the cut points.",
        escalate: "The scorer asks for a closer look before any decision.",
    };

    // amber is the open-case colour and marks escalate alone; no tier is
    // green, because no tier accepts
    function tierClass(tier) {
        return tier === "escalate" ? "amber" : "grey";
    }

    const DISPOSITION_LABELS = {
        agreed: "Agreed",
        disagreed: "Disagreed",
        corrected: "Corrected",
        not_considered: "Not considered",
    };

    function dispositionLabel(disposition) {
        return DISPOSITION_LABELS[disposition] || words(disposition);
    }

    // the server's rule: a disagreement or correction says why
    function needsNote(disposition) {
        return disposition === "disagreed" || disposition === "corrected";
    }

    function stamp(row) {
        return row?.created_at ?? row?._creationTime ?? 0;
    }

    function newest(rows) {
        return rows.reduce((best, row) => (best === null || stamp(row) > stamp(best) ? row : best), null);
    }

    // the row whose score the panel shows: the newest registration_confidence
    // row with a score, else the newest scored row, else null (model rows only)
    function leadJudgment(judgments) {
        const scored = (judgments || []).filter((row) => row && row.score);
        return newest(scored.filter((row) => row.judgment_kind === "registration_confidence")) || newest(scored);
    }

    // sibling rows of one scoring run share the lead's score block; a row
    // from another edition or vector file says so in its own block
    function sameScore(row, lead) {
        return Boolean(row?.score && lead?.score)
            && row.score.edition_id === lead.score.edition_id
            && row.judge?.signal_vector_sha256 === lead.judge?.signal_vector_sha256;
    }

    // rows are [labelHtml, valueHtml], escaped by the caller
    function grid(rows) {
        return `<div class="field-grid">${rows.map(([label, value]) => `<div>${label}</div><div>${value}</div>`).join("")}</div>`;
    }

    function num(value) {
        return escapeHtml(String(value));
    }

    function flag(value) {
        return value ? `<span class="pill amber">yes</span>` : "no";
    }

    function termList(terms) {
        return Array.isArray(terms) && terms.length > 0 ? escapeHtml(terms.map(words).join(", ")) : "none";
    }

    function provenanceHtml(lead) {
        const judge = lead.judge || {};
        const score = lead.score || {};
        return [
            [judge.agent_name, judge.prompt_version].filter(Boolean).join(" "),
            judge.standard_version,
            score.edition_id ? `edition ${editionDate(score.edition_id)}` : "",
            judge.signal_vector_sha256 ? `vectors ${String(judge.signal_vector_sha256).slice(0, 12)}` : "",
            judge.code_revision ? `code ${String(judge.code_revision).slice(0, 12)}` : "",
            stamp(lead) ? `recorded ${isoDate(stamp(lead))}` : "",
        ]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" · ");
    }

    // the composite and its components beside the cut points that set the
    // tier; a component under its floor is marked. no bar is drawn: a number
    // without its basis invites acceptance by number
    function scoreHtml(score) {
        const cut = score.cut_points || {};
        const components = score.components || {};
        const floor = Number.isFinite(cut.component_floor) ? cut.component_floor : null;
        const component = (label, value, note = "") => [
            label,
            `${num(value)}${floor !== null && value < floor ? ` <span class="pill amber">below floor</span>` : ""}${floor !== null ? ` <span class="muted score-note">floor ${num(floor)}</span>` : ""}${note}`,
        ];
        const composite = [
            Number.isFinite(cut.screened_min_composite) ? `screened ≥ ${num(cut.screened_min_composite)}` : "",
            Number.isFinite(cut.review_min_composite) ? `review ≥ ${num(cut.review_min_composite)}` : "",
        ].filter(Boolean).join(", ");
        return grid([
            ["Composite", `${num(score.composite)}${composite ? ` <span class="muted score-note">${composite}</span>` : ""}`],
            component("Identity", components.identity),
            component("Location", components.location),
            component("Status", components.status),
            component("Denomination", components.denomination, ` <span class="muted score-note">outside the composite</span>`),
        ]);
    }

    function reasonsHtml(score) {
        return `<p class="muted">Reasons: ${termList(score.tier_reasons)}. Pending: ${termList(score.tier_pending)}.</p>`;
    }

    // the fired terms per component, the allowlisted numeric and boolean
    // signal values (a null is a signal that does not apply to this
    // geometry), and the indicator flags
    function signalsHtml(score) {
        const fired = score.signals_fired || {};
        const values = Object.entries(score.signal_values || {});
        const present = values.filter(([, value]) => value !== null && value !== undefined);
        const omitted = values.length - present.length;
        const indicators = score.indicators || {};
        const crossSource = indicators.cross_source_match === "match"
            ? `match${Number.isFinite(indicators.cross_source_sources_matched) ? `, ${num(indicators.cross_source_sources_matched)} source${indicators.cross_source_sources_matched === 1 ? "" : "s"}` : ""}`
            : indicators.cross_source_match === "no_match" ? "no match" : "not computed";
        return `
            <details class="confidence-signals">
                <summary>Signals</summary>
                <h4>Fired</h4>
                ${grid(["identity", "location", "status", "denomination"].map((component) => [escapeHtml(words(component)), termList(fired[component])]))}
                <h4>Values</h4>
                ${present.length > 0
                    ? grid(present.map(([key, value]) => [escapeHtml(words(key)), typeof value === "boolean" ? (value ? "yes" : "no") : num(value)]))
                    : `<p class="muted">No signal values recorded.</p>`}
                ${omitted > 0 ? `<p class="muted">${omitted} signal${omitted === 1 ? "" : "s"} unknown or not applicable.</p>` : ""}
                <h4>Indicators</h4>
                ${grid([
                    ["Duplicate", flag(indicators.duplicate)],
                    ["Conflict", `${flag(indicators.conflict)}${Array.isArray(indicators.conflict_reasons) && indicators.conflict_reasons.length > 0 ? ` <span class="muted">${termList(indicators.conflict_reasons)}</span>` : ""}`],
                    ["Generic name", flag(indicators.generic_name)],
                    ["Missing name", flag(indicators.missing_name)],
                    ["Cross-source", escapeHtml(crossSource)],
                ])}
            </details>
        `;
    }

    function rowMetaHtml(row) {
        const judge = row.judge || {};
        const parts = [];
        if (judge.kind === "deterministic") {
            parts.push(judge.agent_name);
            parts.push(row.confidence ? `confidence ${row.confidence} · provisional and uncalibrated (until calibration replaces it)` : "legacy row: categorical confidence unrecorded");
            parts.push(judge.standard_version);
        } else {
            const model = judge.model_reported
                ? judge.model_reported
                : (judge.model_requested ? `${judge.model_requested} requested, returned model not reported${judge.model_unreported_reason ? ` (${judge.model_unreported_reason})` : ""}` : "");
            parts.push([judge.agent_name, judge.model_provider, model].filter(Boolean).join(" · "));
            if (row.confidence) parts.push(`confidence ${row.confidence}`);
        }
        if (stamp(row)) parts.push(isoDate(stamp(row)));
        return parts.filter(Boolean).map(escapeHtml).join(" · ");
    }

    // what people did with the row, newest first; the viewer is "you", any
    // other reviewer is unnamed here
    function dispositionsHtml(row, viewerId) {
        const rows = Array.isArray(row.dispositions) ? [...row.dispositions].sort((a, b) => stamp(b) - stamp(a)) : [];
        if (rows.length === 0) return "";
        return `<p class="muted judgment-dispositions">${rows.map((entry) => {
            const who = viewerId && entry.reviewer_user_id === viewerId ? "you" : "another reviewer";
            return `${escapeHtml(dispositionLabel(entry.disposition))} · ${who} · ${escapeHtml(isoDate(stamp(entry)))}${entry.note ? ` · “${escapeHtml(entry.note)}”` : ""}`;
        }).join("<br>")}</p>`;
    }

    // one block per judgment row with its own controls; the portal wires
    // them by data-judgment-id and data-disposition
    function judgmentBlockHtml(row, lead, viewerId) {
        const deterministic = row.judge?.kind === "deterministic";
        const earlier = row.score && lead && !sameScore(row, lead)
            ? `<p class="muted">Scored under edition ${escapeHtml(editionDate(row.score.edition_id))}: composite ${num(row.score.composite)}, tier ${escapeHtml(row.score.tier)}.</p>`
            : "";
        const basis = row.basis_note
            ? (deterministic
                ? `<details><summary>Basis note</summary><p class="muted">${escapeHtml(row.basis_note)}</p></details>`
                : `<p class="muted">${escapeHtml(row.basis_note)}</p>`)
            : "";
        return `
            <div class="judgment-block" data-judgment-id="${escapeHtml(row.judgment_id)}">
                <p><strong>${escapeHtml(kindLabel(row.judgment_kind))}: ${escapeHtml(words(row.outcome))}</strong>${deterministic ? ' <span class="pill">provisional</span>' : ""} <span class="muted">· ${rowMetaHtml(row)}</span></p>
                ${earlier}
                ${basis}
                ${dispositionsHtml(row, viewerId)}
                <div class="review-actions judgment-actions">
                    <button type="button" data-disposition="agreed">Agree</button>
                    <button type="button" data-disposition="disagreed">Disagree</button>
                    <button type="button" data-disposition="corrected">Correct</button>
                    <button type="button" data-disposition="not_considered">Not considered</button>
                </div>
                <label class="judgment-note-label">Note
                    <textarea class="judgment-note" rows="2" placeholder="Required to disagree or correct"></textarea>
                </label>
                <div class="judgment-status muted" aria-live="polite"></div>
            </div>
        `;
    }

    // the full panel. options: { viewerId, error }. no rows and no error
    // renders nothing, like the AI recommendation panel without an artifact
    function panelHtml(judgments, options = {}) {
        const rows = (Array.isArray(judgments) ? judgments.filter(Boolean) : []).sort((a, b) => stamp(b) - stamp(a));
        const error = options.error
            ? `<p class="muted">Could not load recorded judgments: ${escapeHtml(options.error)}. Select the task again to retry.</p>`
            : "";
        if (rows.length === 0 && !error) return "";
        const lead = leadJudgment(rows);
        const score = lead?.score;
        const pills = [];
        if (score) pills.push(`<span class="pill ${tierClass(score.tier)}">${escapeHtml(score.tier)}</span>`);
        if (rows.length > 0) pills.push(`<span class="pill">AI-generated</span>`);
        if (lead?.judge?.kind === "deterministic") pills.push(`<span class="pill">Deterministic, ${score?.calibrated ? "calibrated" : "uncalibrated"}</span>`);
        const hint = score && TIER_HINTS[score.tier] ? `<p class="muted tier-hint">${escapeHtml(TIER_HINTS[score.tier])}</p>` : "";
        const scorerHint = rows.some((row) => row.judge?.kind === "deterministic")
            ? `<p class="muted">Confidence on scorer rows is the scorer's support for each component (worship continues; pin within 75 m), not a calibrated probability; low support reads as unknown or unclear, never as a negative finding.</p>`
            : "";
        return `
            <section class="panel confidence-panel" id="confidencePanel">
                <h3>Recorded confidence</h3>
                ${error}
                ${pills.length > 0 ? `<div class="pill-row">${pills.join("")}</div>` : ""}
                ${hint}
                ${scorerHint}
                ${lead ? `<p class="muted">${provenanceHtml(lead)}</p>` : ""}
                ${score ? scoreHtml(score) : ""}
                ${score ? reasonsHtml(score) : ""}
                ${score ? signalsHtml(score) : ""}
                ${rows.length > 0 ? `<h4>Judgments</h4>${rows.map((row) => judgmentBlockHtml(row, lead, options.viewerId)).join("")}` : ""}
            </section>
        `;
    }

    const api = {
        editionDate,
        kindLabel,
        tierClass,
        dispositionLabel,
        needsNote,
        leadJudgment,
        sameScore,
        // one block, so the portal can replace the disposed row alone and
        // leave a note typed under another row where it is
        judgmentBlockHtml,
        panelHtml,
    };
    if (typeof window !== "undefined") window.PowConfidencePanel = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
