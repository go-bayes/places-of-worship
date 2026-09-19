// table tests for the task presentation contract: label, tone, precedence
// and next action per status and viewer, the batch rollup, terminal
// absorption and the transport axis. pure, no dom.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "task-presentation.js"), "utf8"), { window });
const { present, rollup, compare, absorb, transport, TONES } = window.PowTaskPresentation;

const RA_TABLE = [
    ["changes_requested", "Changes requested", "act", 6, "revise"],
    ["reopened", "Reopened", "act", 5, "continue"],
    ["in_progress", "In progress", "motion", 4, "continue"],
    ["draft_saved", "Draft saved", "motion", 4, "continue"],
    ["open", "Open", "rest", 3, "start"],
    ["needs_review", "Awaiting review", "rest", 2, null],
    ["unresolved_note", "Note awaiting review", "rest", 2, null],
    ["provisionally_closed", "Provisionally closed", "rest", 1, "reopen"],
    ["skipped", "Skipped", "rest", 1, null],
    ["reviewed", "Reviewed", "done", 1, null],
    ["pi_accepted", "Accepted", "done", 0, null],
    ["exported", "Exported", "done", 0, null],
];

test("ra viewer: every task status has one label, tone, priority and action", () => {
    for (const [status, label, tone, priority, action] of RA_TABLE) {
        const row = present({ status }, { viewer: "ra" });
        assert.equal(row.label, label, status);
        assert.equal(row.tone, tone, status);
        assert.equal(row.priority, priority, status);
        assert.equal(row.action?.id ?? null, action, status);
        assert.ok(TONES.includes(row.tone));
    }
});

test("ra viewer is the default and unknown statuses degrade to a humanised resting label", () => {
    assert.equal(present({ status: "in_progress" }).viewer, "ra");
    const odd = present({ status: "some_new_status" });
    assert.equal(odd.label, "Some new status");
    assert.equal(odd.tone, "rest");
    assert.equal(present(undefined).tone, "rest");
});

test("colour is reserved: only act, motion and broken carry colour, and act outranks motion outranks rest", () => {
    const act = present({ status: "changes_requested" });
    const motion = present({ status: "draft_saved" });
    const rest = present({ status: "needs_review" });
    const done = present({ status: "exported" });
    assert.ok(act.priority > motion.priority && motion.priority > rest.priority && rest.priority > done.priority);
});

test("a reviewer's decision colours what the ra sees on a reviewed task", () => {
    assert.deepEqual(
        [present({ status: "reviewed", latest_decision_status: "rejected" }).label, present({ status: "reviewed", latest_decision_status: "rejected" }).tone],
        ["Rejected", "broken"],
    );
    assert.equal(present({ status: "reviewed", latest_decision_status: "accepted_for_export" }).label, "Accepted by reviewer");
    assert.equal(present({ status: "reviewed", latest_decision_status: "duplicate_task" }).label, "Duplicate");
    assert.equal(present({ status: "reviewed", latest_decision_status: "deferred" }).label, "Deferred");
    // the ra may still reopen a reviewed task (raReopenable in convex/tasks.ts)
    assert.equal(present({ status: "reviewed" }).secondary[0].id, "reopen");
});

test("a saved revision outranks the queue status the task keeps meanwhile", () => {
    const row = present({ status: "needs_review", revision_draft_saved: true });
    assert.equal(row.label, "Revision draft saved");
    assert.equal(row.tone, "motion");
    assert.equal(row.action.id, "continue");
});

test("reviewer viewer: submitted work is the act-now state, contributor work is resting", () => {
    const r = (status, extra) => present(Object.assign({ status }, extra), { viewer: "reviewer" });
    assert.deepEqual([r("needs_review").label, r("needs_review").tone, r("needs_review").action.id], ["Needs review", "act", "review"]);
    assert.deepEqual([r("unresolved_note").label, r("unresolved_note").tone], ["Note to resolve", "act"]);
    assert.deepEqual([r("provisionally_closed").tone, r("provisionally_closed").priority], ["act", 5]);
    assert.deepEqual([r("changes_requested").label, r("changes_requested").tone], ["With the contributor", "rest"]);
    for (const s of ["open", "in_progress", "draft_saved", "reopened"]) assert.equal(r(s).label, "In hand", s);
    assert.equal(r("skipped").action.id, "reopen");
    assert.deepEqual([r("reviewed").label, r("reviewed").tone], ["Reviewed", "done"]);
    assert.deepEqual([r("reviewed", { latest_decision_status: "accepted_for_export" }).label, r("reviewed", { latest_decision_status: "accepted_for_export" }).tone], ["Awaiting PI", "rest"]);
    assert.equal(r("reviewed", { latest_decision_status: "rejected" }).tone, "rest");
    assert.equal(r("exported").tone, "done");
});

test("pi viewer: a reviewer-accepted task is the pi's act-now state", () => {
    const row = present({ status: "reviewed", latest_decision_status: "accepted_for_export" }, { viewer: "pi" });
    assert.deepEqual([row.label, row.tone, row.action.id], ["Awaiting your acceptance", "act", "accept"]);
});

test("terminal statuses are absorbing against a stale read", () => {
    const exported = { status: "exported", task_id: "t1" };
    const stale = { status: "needs_review", task_id: "t1" };
    assert.equal(absorb(exported, stale), exported);
    assert.equal(absorb(stale, exported), exported);
    assert.equal(absorb(null, stale), stale);
    assert.ok(present(exported).terminal);
    assert.ok(!present(stale).terminal);
});

test("compare sorts the most urgent row first, then by name", () => {
    const rows = [
        { status: "exported", task_name: "Zed" },
        { status: "open", task_name: "Beta" },
        { status: "changes_requested", task_name: "Alpha" },
        { status: "open", task_name: "Alpha" },
    ];
    const sorted = rows.slice().sort((a, b) => compare(a, b));
    assert.deepEqual(sorted.map((r) => `${r.status}:${r.task_name}`), ["changes_requested:Alpha", "open:Alpha", "open:Beta", "exported:Zed"]);
});

test("rollup: the most urgent tone wins and the label counts only that tone", () => {
    const tasks = [
        { status: "exported" },
        { status: "draft_saved" },
        { status: "changes_requested" },
        { status: "changes_requested" },
        { status: "needs_review" },
    ];
    const ra = rollup(tasks);
    assert.deepEqual([ra.label, ra.tone, ra.total], ["2 need your action", "act", 5]);
    assert.deepEqual({ ...ra.counts }, { act: 2, motion: 1, broken: 0, rest: 1, done: 1 });
    const reviewer = rollup(tasks, { viewer: "reviewer" });
    assert.deepEqual([reviewer.label, reviewer.tone], ["1 to review", "act"]);
    assert.deepEqual([rollup([{ status: "draft_saved" }, { status: "exported" }]).label, rollup([{ status: "draft_saved" }]).tone], ["1 in hand", "motion"]);
    assert.equal(rollup([{ status: "reviewed", latest_decision_status: "rejected" }, { status: "needs_review" }]).label, "1 rejected");
    assert.equal(rollup([{ status: "needs_review" }]).label, "1 awaiting review");
    assert.equal(rollup([{ status: "needs_review" }], { viewer: "reviewer" }).label, "1 to review");
    assert.equal(rollup([{ status: "changes_requested" }], { viewer: "reviewer" }).label, "1 waiting on others");
    assert.deepEqual([rollup([{ status: "exported" }, { status: "pi_accepted" }]).label, rollup([]).label], ["All done", "Nothing here"]);
});

test("rollup never manufactures an act-now state from an empty or resting batch", () => {
    assert.equal(rollup([]).tone, "rest");
    assert.notEqual(rollup([{ status: "needs_review" }]).tone, "act");
});

test("transport is a separate axis with its own labels, and unknown states read as a problem", () => {
    assert.deepEqual({ ...transport("saving") }, { state: "saving", label: "Saving", tone: "motion", pulse: true });
    assert.deepEqual({ ...transport("ready") }, { state: "ready", label: "Connected", tone: "done", pulse: false });
    assert.equal(transport("signed_out").tone, "rest");
    assert.equal(transport("offline").tone, "broken");
    assert.equal(transport("nonsense").state, "error");
});
