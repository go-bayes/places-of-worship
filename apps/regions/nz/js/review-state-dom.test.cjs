// review portal state presentation (jb ruling 2026-09-19): one state pill
// per queue row, a rollup line instead of a count, empty states with one
// action, the decision chooser with two primary outcomes and the rest
// behind "More outcomes", and the transport dot by the account name.
// hand-rolled dom, no jsdom, following portal-walkthrough-dom.test.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const elements = new Map();
function element(id) {
    const el = {
        id,
        className: "",
        textContent: "",
        innerHTML: "",
        hidden: false,
        value: "",
        disabled: false,
        listeners: {},
        attrs: {},
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        querySelectorAll() { return []; },
        querySelector() { return null; },
        setAttribute(k, v) { this.attrs[k] = v; },
        hasAttribute(k) { return k in this.attrs; },
        getAttribute(k) { return this.attrs[k]; },
        scrollIntoView() {},
    };
    elements.set(id, el);
    return el;
}
for (const id of ["authPanel", "authStatus", "detailPanel", "queueGroupBy", "queueClaimFilter", "queueList", "queueStatus", "queueStatusText", "refreshQueue", "signInButton", "reviewSnapshotHost"]) element(id);
elements.get("queueStatus").value = "needs_review";

const document = {
    title: "",
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => element(`el-${elements.size}`),
};
const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search: "" },
    localStorage: { getItem: () => null, setItem() {} },
    POW_CONVEX_CONFIG: { url: "https://example.convex.cloud" },
    POW_COUNTRY_REGISTRY: { countries: [] },
    PowConvexTaskClient: class { constructor() { this.configured = true; this.authToken = null; } },
};
window.window = window;
const context = vm.createContext({ window, document, URLSearchParams, Map, Set, Number, String, Boolean, Array, Object, Promise, console, setTimeout, clearTimeout });
for (const file of ["task-presentation.js", "review-portal.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
const portal = window.__PowReviewPortalTest;
assert.ok(portal, "test hook exposed");

const row = (task_id, status, decision, extra = {}) => ({
    task: Object.assign({ task_id, name: `Task ${task_id}`, status, task_type: "verify", priority: "high", locality: "Wellington" }, extra),
    latestReview: decision ? { decision_status: decision } : null,
});

// queue rows: one state pill each, the raw status string gone
portal.state.user = { display_name: "Reviewer", roles: ["reviewer"] };
portal.state.queue = [row("t1", "needs_review"), row("t2", "unresolved_note"), row("t3", "reviewed", "rejected")];
portal.renderQueue();
const list = elements.get("queueList").innerHTML;
assert.match(list, /class="state-pill tone-act"[^>]*>Needs review</);
assert.match(list, /class="state-pill tone-act"[^>]*>Note to resolve</);
assert.match(list, /class="state-pill tone-rest"[^>]*>Rejected</);
assert.doesNotMatch(list, /<span class="pill">needs_review</);
assert.doesNotMatch(list, /unresolved note</);
assert.match(list, /<span class="pill">Verify<\/span>/);

// rollup: the act tone wins and counts only its rows
portal.renderQueueRollup();
const roll = elements.get("queueStatusText");
assert.equal(roll.className, "state-rollup");
assert.match(roll.innerHTML, /tone-act">2 to review<\/span><span>of 3 loaded<\/span>/);

// empty queue: one line and one action; the filter case offers to clear it
portal.state.queue = [];
portal.renderQueue();
assert.match(elements.get("queueList").innerHTML, /state-empty.*Nothing in this queue.*id="queueRefreshEmpty">Refresh</);
portal.renderQueueRollup();
assert.equal(roll.textContent, "");
elements.get("queueClaimFilter").value = "mine";
portal.state.queue = [row("t1", "needs_review")];
portal.renderQueue();
assert.match(elements.get("queueList").innerHTML, /No tasks in this queue for this filter.*id="queueShowAll">Show all tasks</);
elements.get("queueClaimFilter").value = "";

// empty detail: one line, and signed-in wording
portal.state.selected = null;
portal.renderDetail();
assert.match(elements.get("detailPanel").innerHTML, /state-empty"><strong>Select a task from the queue\.<\/strong>/);

// decision chooser: two primary outcomes as buttons, the rest behind "More outcomes"
portal.state.selected = row("t1", "needs_review");
const form = portal.decisionForm(portal.state.selected.task, { evidence_draft_id: "d1", action: "verify" });
assert.match(form, /data-decision="accepted_for_export" aria-pressed="false"[^>]*>Accept for export</);
assert.match(form, /id="requestMoreEvidence" data-decision="needs_more_evidence"[^>]*>Request changes</);
assert.match(form, /<summary>More outcomes<\/summary>/);
for (const outcome of ["duplicate_task", "deferred", "rejected"]) assert.match(form, new RegExp(`data-decision="${outcome}"`));
assert.match(form, /id="markSystemTest"/);
assert.match(form, /<select id="decisionStatus" name="decisionStatus" required hidden/);
assert.match(form, /id="recordDecisionButton"[^>]*>Record decision</);
assert.doesNotMatch(form, /<option value="accepted_for_export">[^<]*<\/option>\s*<\/select>\s*<\/div>\s*<div>\s*<label for="identityDecision"/);

// a task that cannot be decided offers no chooser menu and disables the two buttons
const closed = portal.decisionForm(row("t9", "exported").task, null);
assert.doesNotMatch(closed, /More outcomes/);
assert.match(closed, /data-decision="accepted_for_export" aria-pressed="false" disabled/);

// the transport dot is its own axis
element("transportDot");
portal.setTransport("saving");
assert.equal(elements.get("transportDot").className, "transport-dot tone-motion");
assert.equal(elements.get("transportDot").textContent, "Saving");
portal.setTransport("error");
assert.equal(elements.get("transportDot").className, "transport-dot tone-broken");
portal.setTransport("ready");
assert.equal(elements.get("transportDot").textContent, "Connected");

console.log("review state dom test passed");
