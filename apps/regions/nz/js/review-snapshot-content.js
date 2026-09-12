// review snapshot content (review finding 2026-09-12): the review portal
// renders the task, evidence draft, task events, historical claims, latest
// review decision, and latest advisory review from the snapshot the
// decision form will submit, never from the queue row cached at queue load
// or from rows fetched separately that may predate or postdate the
// snapshot. a reviewer therefore decides on, and submits the hash of,
// exactly what is on screen. pure: no dom, no network.
(function () {
    function stamp(row) {
        return row?.created_at ?? row?._creationTime ?? 0;
    }

    function newest(rows) {
        return (rows || []).reduce((best, row) => (best === null || stamp(row) > stamp(best) ? row : best), null);
    }

    // { snapshot: reviews:getReviewSnapshot result or null,
    //   queueRow: { task, latestDraft, latestReview, latestAgentReview },
    //   fetched: { drafts, historicalClaims, events } from the per-task queries }
    function contentFromSnapshot({ snapshot, queueRow, fetched }) {
        const fetchedDrafts = fetched?.drafts || [];
        const inner = snapshot?.snapshot;
        if (inner && inner.draft) {
            const draft = inner.draft;
            // the snapshot's draft leads; other active drafts on the task
            // (a revision alongside, an earlier submission) stay listed
            const drafts = [draft, ...fetchedDrafts.filter((row) => row.evidence_draft_id !== draft.evidence_draft_id)];
            // the snapshot records events oldest first; the panel shows
            // newest first, as tasks:getTaskEvents does
            const events = [...(inner.task_events || [])].sort((a, b) => (b.occurred_at || 0) - (a.occurred_at || 0));
            const agentReviews = inner.agent_reviews || [];
            const agentForDraft = agentReviews.filter((row) => row.evidence_draft_id === draft.evidence_draft_id);
            return {
                source: "snapshot",
                task: inner.task || queueRow?.task || null,
                draft,
                drafts,
                historicalClaims: inner.historical_claims || [],
                events,
                latestReview: newest(inner.review_decisions),
                latestAgentReview: newest(agentForDraft.length > 0 ? agentForDraft : agentReviews),
            };
        }
        // without a snapshot (none loaded yet, no draft, or the fetch failed)
        // the freshly fetched rows lead and the queue row is the last resort;
        // acceptance for export is blocked client-side in this state
        const draft = fetchedDrafts[0] || queueRow?.latestDraft || null;
        return {
            source: fetchedDrafts.length > 0 ? "fetched" : "queue",
            task: queueRow?.task || null,
            draft,
            drafts: fetchedDrafts.length > 0 ? fetchedDrafts : (draft ? [draft] : []),
            historicalClaims: fetched?.historicalClaims || [],
            events: fetched?.events || [],
            latestReview: queueRow?.latestReview || null,
            latestAgentReview: queueRow?.latestAgentReview || null,
        };
    }

    // the selection load with a supersession guard (review finding
    // 2026-09-12): the rows, then the snapshot for the task's current
    // draft, each awaited and each followed by an isCurrent() check before
    // anything is returned. a load the reviewer has moved on from resolves
    // to null, and the caller writes nothing, so a slow response for an
    // earlier selection can never replace the displayed task's snapshot
    // (which would have sent that task's hash with a decision on this one).
    // fetchRows(taskId) -> { drafts, historicalClaims, events, attachments };
    // fetchSnapshot(taskId, evidenceDraftId) -> getReviewSnapshot result
    async function loadSelection({ taskId, queueRow, isCurrent, fetchRows, fetchSnapshot }) {
        const rows = await fetchRows(taskId);
        if (!isCurrent()) return null;
        const fetched = {
            drafts: rows?.drafts || [],
            historicalClaims: rows?.historicalClaims || [],
            events: rows?.events || [],
        };
        const snapshotDraft = fetched.drafts[0] || queueRow?.latestDraft || null;
        let snapshot = null;
        let snapshotError = "";
        if (snapshotDraft) {
            try {
                snapshot = await fetchSnapshot(taskId, snapshotDraft.evidence_draft_id);
            } catch (error) {
                snapshotError = (error && error.message) || "unknown error";
            }
            if (!isCurrent()) return null;
        }
        return {
            content: contentFromSnapshot({ snapshot, queueRow, fetched }),
            snapshot,
            snapshotError,
            attachments: rows?.attachments || [],
        };
    }

    const api = { contentFromSnapshot, loadSelection };
    if (typeof window !== "undefined") window.PowReviewSnapshotContent = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
