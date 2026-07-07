// Claude batch-review panel: renders AI review artifacts in the reviewer
// portal and carries the agreement semantics for the disagree affordance.
// Advisory display only — every function here is pure rendering or pure
// mapping; nothing submits, and the human decision form stays the only
// write path (docs/portal-claude-batch-review.md).
(function () {
    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDateTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    }

    function recommendationLabel(recommendation) {
        if (recommendation === "accept") return "accept";
        if (recommendation === "revise") return "revise";
        if (recommendation === "reject") return "reject";
        if (recommendation === "defer_cultural") return "human judgement";
        return String(recommendation ?? "");
    }

    function pillClass(recommendation) {
        if (recommendation === "accept") return "green";
        if (recommendation === "reject") return "red";
        return "amber";
    }

    // maps a recommendation onto the decision select; defer_cultural has
    // deliberately no mapping — the human's own judgement is the ask
    function decisionForRecommendation(recommendation) {
        if (recommendation === "accept") return "accepted_for_export";
        if (recommendation === "revise") return "needs_more_evidence";
        if (recommendation === "reject") return "rejected";
        return null;
    }

    // agreement provenance for the recorded decision. An explicit choice
    // (the reviewer pressed a button) wins; otherwise derive it from
    // whether the decision matched, so the record never claims the human
    // followed advice they contradicted. For defer_cultural any human
    // decision enacts the recommendation, so it derives as followed.
    function deriveAgreement(artifact, decisionStatus, explicitChoice) {
        if (!artifact) return undefined;
        if (explicitChoice) return explicitChoice;
        const mapped = decisionForRecommendation(artifact.recommendation);
        if (mapped === null) return "followed";
        return mapped === decisionStatus ? "followed" : "disagreed";
    }

    function queuePillHtml(artifact) {
        if (!artifact) return "";
        return `<span class="pill ${pillClass(artifact.recommendation)}">AI: ${escapeHtml(recommendationLabel(artifact.recommendation))}</span>`;
    }

    function outcomeLabel(outcome) {
        return String(outcome ?? "").replaceAll("_", " ");
    }

    function sourceChecksHtml(checks) {
        if (!Array.isArray(checks) || checks.length === 0) {
            return `<p class="muted">No source checks were possible for this claim.</p>`;
        }
        return `
            <div class="field-grid">
                ${checks
                    .map((check) => `
                        <div>${escapeHtml(outcomeLabel(check.check))}</div>
                        <div>
                            <span class="pill ${check.outcome === "supported" ? "green" : check.outcome === "not_supported" ? "red" : "amber"}">${escapeHtml(outcomeLabel(check.outcome))}</span>
                            <span class="muted">via ${escapeHtml(outcomeLabel(check.method))}</span>
                            ${check.note ? `<p class="muted">${escapeHtml(check.note)}</p>` : ""}
                            ${check.url_or_file ? `<p class="muted">${escapeHtml(check.url_or_file)}</p>` : ""}
                        </div>
                    `)
                    .join("")}
            </div>
        `;
    }

    // the full detail-page panel. handlers are wired by the caller via the
    // returned element ids; this function only renders.
    function panelHtml(artifact) {
        if (!artifact) {
            return "";
        }
        const label = recommendationLabel(artifact.recommendation);
        const mapped = decisionForRecommendation(artifact.recommendation);
        const cultural = artifact.cultural_sensitivity?.flagged
            ? `<div class="review-warning">Flagged culturally sensitive: ${escapeHtml(artifact.cultural_sensitivity.basis || "requires human cultural judgement")} Claude checked sources only and made no judgement on the cultural claim.</div>`
            : "";
        return `
            <section class="panel" id="claudeReviewPanel">
                <h3>Claude recommendation</h3>
                <div class="pill-row">
                    <span class="pill ${pillClass(artifact.recommendation)}">${escapeHtml(label)}</span>
                    <span class="pill">AI-generated</span>
                    ${artifact.version > 1 ? `<span class="pill">review ${escapeHtml(String(artifact.version))} of this task</span>` : ""}
                </div>
                <p class="muted">
                    ${escapeHtml(artifact.model_name || "")} · ${escapeHtml(formatDateTime(artifact.created_at))}
                    · prompt ${escapeHtml(artifact.prompt_version || "")}
                </p>
                ${cultural}
                <details>
                    <summary>Reasoning</summary>
                    <p>${escapeHtml(artifact.reasoning || "")}</p>
                </details>
                <details>
                    <summary>Sources checked (${Array.isArray(artifact.sources_checked) ? artifact.sources_checked.length : 0})</summary>
                    ${sourceChecksHtml(artifact.sources_checked)}
                </details>
                <div class="review-actions">
                    ${mapped !== null ? `<button type="button" class="secondary" id="useAgentRecommendation">Use recommendation</button>` : ""}
                    <button type="button" class="secondary" id="disagreeAgentRecommendation">Decide differently</button>
                </div>
                <p class="muted" id="agentAgreementStatus">
                    ${mapped !== null
                        ? "Use recommendation prefills the decision; Decide differently records your disagreement. Either way the decision, note, and Record button stay yours."
                        : "This item requires your cultural judgement; no prefill is offered. Your decision is recorded as your own."}
                </p>
            </section>
        `;
    }

    window.PowClaudeReviewPanel = {
        recommendationLabel,
        pillClass,
        decisionForRecommendation,
        deriveAgreement,
        queuePillHtml,
        panelHtml,
    };
})();
