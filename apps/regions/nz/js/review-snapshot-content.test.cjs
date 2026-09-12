const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// the module attaches itself to window, as in the portal page
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "review-snapshot-content.js"), "utf8"), { window });
const { contentFromSnapshot, loadSelection } = window.PowReviewSnapshotContent;

// review finding 2026-09-12: the panels must render the content whose hash
// the decision submits, not the queue row cached at queue load
const queueRow = {
    task: { task_id: "t1", name: "Cached task name" },
    latestDraft: { evidence_draft_id: "t1:d", evidence_note: "cached at queue load" },
    latestReview: { review_decision_id: "r0", decision_status: "needs_more_evidence", created_at: 10 },
    latestAgentReview: { agent_review_id: "a0", evidence_draft_id: "t1:d", created_at: 10 },
};
const fetched = {
    drafts: [
        { evidence_draft_id: "t1:d", evidence_note: "fetched separately" },
        { evidence_draft_id: "t1:older", evidence_note: "an earlier submission" },
    ],
    historicalClaims: [{ claim_id: "c-fetched" }],
    events: [{ event_type: "fetched_event", occurred_at: 5 }],
};
const snapshot = {
    snapshot_hash: "abc",
    snapshot: {
        task: { task_id: "t1", name: "Snapshot task name" },
        draft: { evidence_draft_id: "t1:d", evidence_note: "exactly what the hash covers", evidence_version_hash: "sha256:v2" },
        task_events: [
            { event_type: "submitted_for_review", occurred_at: 1 },
            { event_type: "note_added", occurred_at: 3 },
            { event_type: "reviewer_edit", occurred_at: 2 },
        ],
        historical_claims: [{ claim_id: "c-snapshot" }],
        review_decisions: [
            { review_decision_id: "r1", decision_status: "rejected", created_at: 20 },
            { review_decision_id: "r2", decision_status: "accepted_for_export", created_at: 30 },
        ],
        agent_reviews: [
            { agent_review_id: "a1", evidence_draft_id: "t1:other", created_at: 40 },
            { agent_review_id: "a2", evidence_draft_id: "t1:d", created_at: 35 },
        ],
    },
};

test("with a snapshot, every panel input comes from the snapshot, newest first, and other drafts stay listed", () => {
    const content = contentFromSnapshot({ snapshot, queueRow, fetched });
    assert.equal(content.source, "snapshot");
    assert.equal(content.task.name, "Snapshot task name");
    assert.equal(content.draft.evidence_note, "exactly what the hash covers");
    assert.deepEqual(content.drafts.map((row) => row.evidence_draft_id), ["t1:d", "t1:older"]);
    assert.deepEqual(content.events.map((row) => row.event_type), ["note_added", "reviewer_edit", "submitted_for_review"]);
    assert.deepEqual(content.historicalClaims, [{ claim_id: "c-snapshot" }]);
    assert.equal(content.latestReview.review_decision_id, "r2");
    // the advisory review for the snapshot's own draft wins over a newer one on another draft
    assert.equal(content.latestAgentReview.agent_review_id, "a2");
});

test("without a snapshot, freshly fetched rows lead and the queue row is the last resort", () => {
    const fetchedOnly = contentFromSnapshot({ snapshot: null, queueRow, fetched });
    assert.equal(fetchedOnly.source, "fetched");
    assert.equal(fetchedOnly.draft.evidence_note, "fetched separately");
    assert.equal(fetchedOnly.drafts.length, 2);
    assert.equal(fetchedOnly.events[0].event_type, "fetched_event");
    assert.equal(fetchedOnly.latestReview.review_decision_id, "r0");

    const queueOnly = contentFromSnapshot({ snapshot: null, queueRow, fetched: { drafts: [], historicalClaims: [], events: [] } });
    assert.equal(queueOnly.source, "queue");
    assert.equal(queueOnly.draft.evidence_note, "cached at queue load");
    assert.deepEqual(queueOnly.drafts.map((row) => row.evidence_draft_id), ["t1:d"]);

    const nothing = contentFromSnapshot({ snapshot: null, queueRow: { task: { task_id: "t2" } }, fetched: null });
    assert.equal(nothing.draft, null);
    assert.deepEqual(nothing.drafts, []);
    assert.equal(nothing.latestReview, null);
});

test("a snapshot response without a draft falls back like no snapshot", () => {
    const content = contentFromSnapshot({ snapshot: { snapshot: { task: {}, draft: null } }, queueRow, fetched });
    assert.equal(content.source, "fetched");
    assert.equal(content.draft.evidence_note, "fetched separately");
});

// overlapping selection loads (review finding 2026-09-12): a slow response
// for an earlier selection must never replace the displayed task's snapshot
function deferred() {
    let resolve; let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function harness() {
    const state = { token: 0, selectedTaskId: null, applied: [] };
    const pending = { rows: new Map(), snapshots: new Map() };
    const calls = { snapshots: [] };
    function select(taskId) {
        state.selectedTaskId = taskId;
        const token = ++state.token;
        const isCurrent = () => state.token === token && state.selectedTaskId === taskId;
        const rows = deferred(); pending.rows.set(taskId, rows);
        return loadSelection({
            taskId,
            queueRow: { task: { task_id: taskId }, latestDraft: { evidence_draft_id: `${taskId}:d`, evidence_note: "cached" } },
            isCurrent,
            fetchRows: () => rows.promise,
            fetchSnapshot: (id, draftId) => { calls.snapshots.push(draftId); const s = deferred(); pending.snapshots.set(id, s); return s.promise; },
        }).then((loaded) => { if (loaded !== null) state.applied.push({ taskId, hash: loaded.snapshot?.snapshot_hash, error: loaded.snapshotError }); return loaded; });
    }
    const snapshotFor = (taskId) => ({ snapshot_hash: `hash-${taskId}`, snapshot: { task: { task_id: taskId }, draft: { evidence_draft_id: `${taskId}:d`, evidence_note: `from snapshot ${taskId}` } } });
    return { state, pending, calls, select, snapshotFor };
}

test("a load superseded before its rows arrive resolves to null and never fetches its snapshot", async () => {
    const h = harness();
    const loadA = h.select("A");
    const loadB = h.select("B");
    h.pending.rows.get("B").resolve({ drafts: [{ evidence_draft_id: "B:d" }] });
    await new Promise((r) => setImmediate(r));
    h.pending.snapshots.get("B").resolve(h.snapshotFor("B"));
    const b = await loadB;
    assert.equal(b.snapshot.snapshot_hash, "hash-B");
    assert.equal(b.content.draft.evidence_note, "from snapshot B");
    // A's rows arrive late: nothing further is fetched and nothing is applied
    h.pending.rows.get("A").resolve({ drafts: [{ evidence_draft_id: "A:d" }] });
    const a = await loadA;
    assert.equal(a, null);
    assert.deepEqual(h.calls.snapshots, ["B:d"]);
    assert.deepEqual(h.state.applied.map((row) => row.hash), ["hash-B"]);
});

test("a load superseded while its snapshot is in flight resolves to null, whether the snapshot resolves or fails", async () => {
    // resolves late
    {
        const h = harness();
        const loadA = h.select("A");
        h.pending.rows.get("A").resolve({ drafts: [{ evidence_draft_id: "A:d" }] });
        await new Promise((r) => setImmediate(r));
        const loadB = h.select("B");
        h.pending.rows.get("B").resolve({ drafts: [{ evidence_draft_id: "B:d" }] });
        await new Promise((r) => setImmediate(r));
        h.pending.snapshots.get("B").resolve(h.snapshotFor("B"));
        await loadB;
        h.pending.snapshots.get("A").resolve(h.snapshotFor("A"));
        assert.equal(await loadA, null);
        assert.deepEqual(h.state.applied.map((row) => row.hash), ["hash-B"]);
    }
    // fails late: the failure is not reported against the displayed task either
    {
        const h = harness();
        const loadA = h.select("A");
        h.pending.rows.get("A").resolve({ drafts: [{ evidence_draft_id: "A:d" }] });
        await new Promise((r) => setImmediate(r));
        const loadB = h.select("B");
        h.pending.rows.get("B").resolve({ drafts: [{ evidence_draft_id: "B:d" }] });
        await new Promise((r) => setImmediate(r));
        h.pending.snapshots.get("B").resolve(h.snapshotFor("B"));
        await loadB;
        h.pending.snapshots.get("A").reject(new Error("late outage"));
        assert.equal(await loadA, null);
        assert.deepEqual(h.state.applied, [{ taskId: "B", hash: "hash-B", error: "" }]);
    }
});

test("a current load whose snapshot fails still applies, carrying the error and the fetched rows", async () => {
    const h = harness();
    const loadA = h.select("A");
    h.pending.rows.get("A").resolve({ drafts: [{ evidence_draft_id: "A:d", evidence_note: "fetched A" }], attachments: [{ id: "f1" }] });
    await new Promise((r) => setImmediate(r));
    h.pending.snapshots.get("A").reject(new Error("outage"));
    const a = await loadA;
    assert.equal(a.snapshot, null);
    assert.equal(a.snapshotError, "outage");
    assert.equal(a.content.source, "fetched");
    assert.equal(a.content.draft.evidence_note, "fetched A");
    assert.deepEqual(a.attachments, [{ id: "f1" }]);
    // a task with no draft anywhere skips the snapshot fetch
    const h2 = harness();
    const noDraft = loadSelection({ taskId: "Z", queueRow: { task: { task_id: "Z" } }, isCurrent: () => true, fetchRows: async () => ({ drafts: [] }), fetchSnapshot: () => { throw new Error("must not be called"); } });
    const z = await noDraft;
    assert.equal(z.snapshot, null);
    assert.equal(z.content.draft, null);
    assert.equal(h2.calls.snapshots.length, 0);
});
