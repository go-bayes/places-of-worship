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

    const api = { contentFromSnapshot };
    if (typeof window !== "undefined") window.PowReviewSnapshotContent = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
