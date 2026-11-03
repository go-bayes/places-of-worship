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
for (const id of ["authPanel", "authStatus", "detailPanel", "queueGroupBy", "queueClaimFilter", "queueList", "queueStatus", "queueStatusText", "refreshQueue", "signInButton", "reviewSnapshotHost", "headerAccount", "queueRollup", "queueControls", "pageHeading", "reviewBoundary"]) element(id);
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

// each row leads with its state pill (ui item 6, 2026-11-03): the pill
// comes before the name, and the pill row under it does not repeat it
const firstRow = list.split('data-task-id="t2"')[0];
assert.match(firstRow, /<span class="task-row-head"><span class="state-pill tone-act"[^>]*>Needs review<\/span><strong>Task t1<\/strong><\/span>/);
const firstPillRow = firstRow.match(/<span class="pill-row">([\s\S]*?)<\/span>\s*\n/)?.[1] || "";
assert.doesNotMatch(firstPillRow, /state-pill/, "the pill row leaves the leading state out");
assert.match(firstPillRow, /<span class="pill">Verify<\/span>/);
assert.equal((list.match(/state-pill tone-/g) || []).length, 3, "one state pill per row");

// rollup: the act tone wins and counts only its rows; it sits in the
// queue's header, and the status line under the controls clears
const statusLine = elements.get("queueStatusText");
statusLine.className = "status";
statusLine.textContent = "Loading review queue...";
portal.renderQueueRollup();
const roll = elements.get("queueRollup");
assert.equal(roll.className, "state-rollup");
assert.match(roll.innerHTML, /tone-act">2 to review<\/span><span>of 3 loaded<\/span>/);
assert.equal(statusLine.textContent, "", "the loading line clears once the rollup shows");
assert.equal(statusLine.hidden, true, "and the empty status box hides");
assert.doesNotMatch(statusLine.innerHTML, /state-pill/, "the rollup is no longer in the status line");
const reviewHtml = fs.readFileSync(path.join(__dirname, "..", "review.html"), "utf8");
assert.match(reviewHtml, /<div class="queue-head">\s*<h2 id="queueHeading">Queue<\/h2>\s*<div id="queueRollup" class="state-rollup" aria-live="polite"><\/div>/, "the rollup host sits beside the queue heading");

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

// identity bases of definition 0.1.6; relocation is no longer offered
for (const [value, label] of [["same_site", "same place"], ["conversion", "conversion"], ["successor_at_new_site", "successor at a new site"], ["end_and_new_foundation", "end and new foundation"], ["new_candidate", "new place, no predecessor"]]) {
    assert.match(form, new RegExp(`<option value="${value}">${label}</option>`));
}
assert.doesNotMatch(form, /value="relocation"/);

// the linked place field and its client check, mirroring convex/lib/identityLinks.ts
assert.match(form, /<label for="linkedSiteIds">Linked place<\/label>/);
assert.match(form, /<input id="linkedSiteIds" name="linkedSiteIds" type="text"/);
// the help names the identifier forms the server resolves, and what it stores
assert.match(form, /site identifier, such as n123 or w456, an OpenStreetMap reference such as osm:node\/123, a candidate identifier, or the task identifier or source record of a place in the portal/);
assert.match(form, /A place in any country may be linked; a task or source record is recorded as its place's site identifier/);
assert.deepEqual([...portal.parseLinkedSiteIds(" nz-a ,\n nz-b,, ")], ["nz-a", "nz-b"]);
assert.deepEqual([...portal.parseLinkedSiteIds(undefined)], []);
for (const basis of ["successor_at_new_site", "end_and_new_foundation", "split", "merge"]) {
    assert.match(portal.linkedSiteIdsProblem(basis, []), /give the linked place's identifier/);
    assert.equal(portal.linkedSiteIdsProblem(basis, ["nz-a"]), "");
}
for (const basis of ["duplicate", "uncertain"]) {
    assert.equal(portal.linkedSiteIdsProblem(basis, []), "");
    assert.equal(portal.linkedSiteIdsProblem(basis, ["nz-a"]), "");
}
for (const basis of ["same_site", "conversion", "new_candidate", undefined]) {
    assert.match(portal.linkedSiteIdsProblem(basis, ["nz-a"]), /applies only to/);
    assert.equal(portal.linkedSiteIdsProblem(basis, []), "");
}
assert.match(portal.linkedSiteIdsProblem("split", ["nz-a", "nz-a"]), /once/);
assert.match(portal.linkedSiteIdsProblem("split", ["x".repeat(201)]), /200 characters/);
assert.match(portal.linkedSiteIdsProblem("merge", Array.from({ length: 11 }, (_, i) => `nz-${i}`)), /at most 10/);
assert.match(portal.linkedSiteIdsProblem("split", ["nz\u0007a"]), /control characters/);
const ownTask = { task_id: "t1", matched_current_site_id: "nz-site-1", candidate_site_id: "candidate:nz:b:1" };
for (const own of ["t1", "nz-site-1", "candidate:nz:b:1"]) {
    assert.match(portal.linkedSiteIdsProblem("successor_at_new_site", [own], ownTask), /another place/);
}
const intakeTask = { task_id: "t2", source_record_id: "osm:node/123", osm_object_type: "way", matched_osm_id: "456" };
for (const own of ["osm:node/123", "osm:way/456"]) {
    assert.match(portal.linkedSiteIdsProblem("successor_at_new_site", [own], intakeTask), /another place/);
}
assert.equal(portal.linkedSiteIdsProblem("successor_at_new_site", ["osm:node/789"], intakeTask), "");
// the bare spelling of the task's own osm object is its own place too
for (const own of ["n123", "w456"]) {
    assert.match(portal.linkedSiteIdsProblem("successor_at_new_site", [own], intakeTask), /another place/);
}
assert.equal(portal.linkedSiteIdsProblem("successor_at_new_site", ["n456"], intakeTask), "");
assert.equal(portal.linkedSiteIdsProblem("successor_at_new_site", ["nz-site-2"], ownTask), "");

// the last decision shows its identity basis and escaped links
portal.state.attachments = [];
portal.state.selected = {
    task: { task_id: "t-linked", name: "Linked", status: "reviewed", task_type: "verify", priority: "high" },
    latestReview: { decision_status: "accepted_for_export", identity_decision: "successor_at_new_site", linked_site_ids: ["nz-a", "<b>x</b>"], decision_note: "Moved to a new property." },
};
portal.renderDetail();
const linkedDetail = elements.get("detailPanel").innerHTML;
assert.match(linkedDetail, /<br>Identity: successor at a new site/);
assert.match(linkedDetail, /<br>Linked place: nz-a, &lt;b&gt;x&lt;\/b&gt;/);
assert.equal(portal.identityLabel("relocation"), "relocation (before definition 0.1.6)");

// a task that cannot be decided offers no chooser menu and disables the two buttons
const closed = portal.decisionForm(row("t9", "exported").task, null);
assert.doesNotMatch(closed, /More outcomes/);
assert.match(closed, /data-decision="accepted_for_export" aria-pressed="false" disabled/);

// reopened-after-decision rows (jb ruling 2026-10-15): listed under the
// "reopened" status with the marker and reason escaped, and the panel says no
// decision can be recorded rather than offering buttons the server refuses
const flaggedTask = row("t-re", "reopened", null, {
    reopened_after_decision: { from_status: "exported", reopened_at: 5, reopened_by: "u1", reason: "<script>x</script> later register" },
});
portal.state.queue = [flaggedTask];
portal.renderQueue();
const reopenedList = elements.get("queueList").innerHTML;
assert.match(reopenedList, />Reopened after decision<\/span>/);
assert.match(reopenedList, /title="Reopened after decision \(was exported\): &lt;script&gt;/);
assert.doesNotMatch(reopenedList, /<script>/);
const reopenedForm = portal.decisionForm(flaggedTask.task, null);
assert.match(reopenedForm, /Reopened after decision \(was exported\)\. Reason given: &lt;script&gt;x&lt;\/script&gt; later register/);
assert.match(reopenedForm, /This task was reopened and is with the contributor/);
assert.doesNotMatch(reopenedForm, /More outcomes/);
assert.match(reopenedForm, /data-decision="accepted_for_export" aria-pressed="false" disabled/);
assert.match(fs.readFileSync(path.join(__dirname, "..", "review.html"), "utf8"), /<option value="reopened">reopened after a decision<\/option>/);

// the one-line header (ui item 6, 2026-11-03): the surface and the country
portal.setupPageLabel();
assert.equal(elements.get("pageHeading").textContent, "Review · New Zealand");
assert.match(reviewHtml, /<span class="product-name">religionmap\.org<\/span>\s*<h1 id="pageHeading">Review · New Zealand<\/h1>/);
assert.match(reviewHtml, /<a class="header-guide" href="https:\/\/religionmap\.org\/apps\/guides\/pi\.html"/);
const introText = (reviewHtml.match(/<p class="review-intro"[^>]*>([\s\S]*?)<\/p>/)?.[1] || "").replace(/<[^>]+>/g, "").trim();
assert.ok(introText.length > 0, "the header carries a sentence");
assert.equal((introText.match(/[.!?](\s|$)/g) || []).length, 1, "and only one");

// signed in, the account, its transport dot and Sign out sit in the
// header; the sign-in card hides and the queue controls show
{
    let signedOut = 0;
    window.PowConvexTaskClient.prototype.signOut = () => { signedOut += 1; };
    window.PowConvexTaskClient.prototype.renderSignInButton = async () => {};
    element("signOut");
    portal.state.user = { display_name: "Reviewer <b>", roles: ["reviewer", "curator"] };
    elements.get("authPanel").hidden = false;
    elements.get("queueControls").hidden = true;
    portal.renderAuth();
    const account = elements.get("headerAccount");
    assert.equal(account.hidden, false);
    assert.match(account.innerHTML, /<span id="transportDot" class="transport-dot tone-done" aria-live="polite">Connected<\/span>/);
    assert.match(account.innerHTML, /class="account-name"[^>]*>Reviewer &lt;b&gt;<\/span>/, "the name is escaped");
    assert.match(account.innerHTML, /class="account-roles">reviewer, curator</);
    assert.match(account.innerHTML, /<button id="signOut" class="tertiary" type="button">Sign out<\/button>/);
    assert.equal(elements.get("authPanel").hidden, true, "the sign-in card gives way");
    assert.equal(elements.get("queueControls").hidden, false, "the queue's controls show once they can work");
    assert.equal(elements.get("authStatus").textContent, "");
    // sign out: the card returns, the header empties, the queue asks for a sign-in
    for (const fn of elements.get("signOut").listeners.click || []) fn();
    assert.equal(signedOut, 1);
    assert.equal(account.hidden, true);
    assert.equal(account.innerHTML, "");
    assert.equal(elements.get("authPanel").hidden, false);
    assert.equal(elements.get("queueControls").hidden, true);
    assert.equal(statusLine.textContent, "Sign in to load the queue.");
    assert.equal(statusLine.hidden, false);
    assert.equal(roll.textContent, "", "no rollup speaks for a queue the page no longer holds");
    delete window.PowConvexTaskClient.prototype.signOut;
}

// the queue comes first in the sidebar once signed in: the sign-in card
// (signed out only), then the queue, then the review boundary
{
    const sidebar = reviewHtml.slice(reviewHtml.indexOf('<aside class="sidebar">'), reviewHtml.indexOf("</aside>"));
    const at = (needle) => sidebar.indexOf(needle);
    assert.ok(at('id="authPanel"') < at('id="queuePanel"'), "sign-in card before the queue");
    assert.ok(at('id="queuePanel"') < at('id="reviewBoundary"'), "the queue before the boundary");
    assert.match(sidebar, /<summary><h2>Review boundary<\/h2> <span class="summary-line">When to accept, keep a note open, or ask for more evidence<\/span><\/summary>/, "the boundary's summary says what it holds");
}

// r-d3 kept: the boundary is open on a reviewer's first visit and closed
// after; without storage it stays open
{
    const saved = window.localStorage;
    const store = new Map();
    window.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    const boundary = elements.get("reviewBoundary");
    boundary.open = false;
    portal.setupBoundary();
    assert.equal(boundary.open, true, "open on the first visit");
    assert.equal(store.get("pow-review-boundary-seen"), "1");
    portal.setupBoundary();
    assert.equal(boundary.open, false, "closed on a later visit");
    window.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    portal.setupBoundary();
    assert.equal(boundary.open, true, "open every time without storage");
    window.localStorage = saved;
}

// reverting a reopen (JB, 2026-10-15): the control shows only on a reopened
// task that carries the flag, explains its condition, checks the reason
// client-side and calls the client with the trimmed reason
assert.match(reopenedForm, /id="revertReopenButton">Revert the reopen</);
assert.match(reopenedForm, /only while nothing has been written to the task since the reopen|works only while nothing has been written/);
assert.doesNotMatch(portal.decisionForm(row("t-plain", "reopened").task, null), /revertReopenButton/, "no flag, no control");
assert.doesNotMatch(portal.decisionForm(row("t-ex", "exported", null, { reopened_after_decision: { from_status: "exported", reason: "x" } }).task, null), /revertReopenButton/, "not reopened, no control");
(async () => {
    const reverted = [];
    window.PowConvexTaskClient.prototype.revertReopen = async (args) => { reverted.push(args); return { task_id: args.taskId, status: "pi_accepted" }; };
    window.PowConvexTaskClient.prototype.listReviewQueue = async () => [];
    for (const id of ["revertReopenButton", "revertReopenForm", "revertReopenReason", "revertReopenConfirm", "revertReopenCancel", "revertReopenProblem"]) element(id);
    const fire = async (id) => { for (const fn of elements.get(id).listeners.click || []) await fn(); };
    elements.get("revertReopenForm").hidden = true;
    portal.state.user = { display_name: "Reviewer", roles: ["reviewer"] };
    portal.wireRevertReopen(flaggedTask.task);
    await fire("revertReopenButton");
    assert.equal(elements.get("revertReopenForm").hidden, false);
    assert.equal(elements.get("revertReopenButton").hidden, true);
    elements.get("revertReopenReason").value = "short";
    await fire("revertReopenConfirm");
    assert.match(elements.get("revertReopenProblem").textContent, /at least 8 characters/);
    assert.equal(reverted.length, 0, "a short reason is not sent");
    elements.get("revertReopenReason").value = "  Opened in error, no new evidence.  ";
    await fire("revertReopenConfirm");
    assert.deepEqual(JSON.parse(JSON.stringify(reverted)), [{ taskId: "t-re", reason: "Opened in error, no new evidence." }]);
    // the success transition: no stale selection, and a message in place of the old detail
    assert.equal(portal.state.selected, null);
    const done = elements.get("detailPanel").innerHTML;
    assert.match(done, /The reopen was reverted\./);
    assert.match(done, /Task t-re is back to accepted\./);
    assert.doesNotMatch(done, /revertReopenButton|reviewDecisionForm/);
    // a refusal from the server is shown, not swallowed
    window.PowConvexTaskClient.prototype.revertReopen = async () => { throw new Error("Something has been written to this task since it was reopened."); };
    elements.get("revertReopenConfirm").disabled = false;
    await fire("revertReopenConfirm");
    assert.match(elements.get("revertReopenProblem").textContent, /written to this task since/);
    assert.equal(elements.get("revertReopenConfirm").disabled, false);
})().catch((error) => { console.error(error); process.exit(1); });

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
