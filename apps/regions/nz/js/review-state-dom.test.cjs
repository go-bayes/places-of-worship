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
    PowConvexTaskClient: class { constructor() { this.configured = true; this.authToken = null; } setLifecycle(handlers) { window.__lifecycle = handlers; } },
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

// a queue response that arrives after the session ended lands nowhere (c1
// review, sol m1): the sign-out bumps the session epoch, and a response for
// another reviewer is dropped as well
(async () => {
    const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    portal.client.renderSignInButton = () => Promise.resolve();
    portal.state.busy = false;
    portal.state.user = { _id: "reviewer_1", display_name: "Reviewer", roles: ["reviewer"] };
    portal.state.queue = [];
    let pending = deferred();
    portal.client.listReviewQueue = () => pending.promise;
    const inFlight = portal.loadQueue();
    portal.showSignedOut("Your sign-in ended.");
    pending.resolve([row("secret", "needs_review")]);
    await inFlight;
    assert.equal(portal.state.queue.length, 0, "the ended session's queue is not restored");
    assert.doesNotMatch(elements.get("queueList").innerHTML, /Task secret/);

    portal.state.user = { _id: "reviewer_1", display_name: "Reviewer", roles: ["reviewer"] };
    pending = deferred();
    const second = portal.loadQueue();
    portal.showSignedOut("Signed out.");
    portal.state.user = { _id: "reviewer_2", display_name: "Other", roles: ["reviewer"] };
    pending.resolve([row("secret", "needs_review")]);
    await second;
    assert.equal(portal.state.queue.length, 0, "nor handed to the next reviewer");

    pending = deferred();
    const third = portal.loadQueue();
    pending.resolve([row("mine", "needs_review")]);
    await third;
    assert.equal(portal.state.queue.length, 1, "a current response still lands");

    // round 4: every other review action checks its session after each
    // await, in success and error paths alike
    const signIn = (id) => { portal.state.user = { _id: id, display_name: id, roles: ["reviewer"] }; };
    const detail = elements.get("detailPanel");

    // a private attachment url that arrives after sign-out is never opened
    signIn("reviewer_1");
    pending = deferred();
    portal.client.requestAttachmentView = () => pending.promise;
    const opened = [];
    window.open = (url) => opened.push(url);
    const button = { dataset: { attachmentId: "att_1" }, disabled: false, textContent: "Open" };
    const opening = portal.openAttachment(button);
    portal.showSignedOut("Signed out.");
    pending.resolve({ view_url: "https://r2.example/signed" });
    await opening;
    assert.deepEqual(opened, [], "the url is not opened after sign-out");
    signIn("reviewer_1");
    pending = deferred();
    const current = portal.openAttachment(button);
    pending.resolve({ view_url: "https://r2.example/current" });
    await current;
    assert.deepEqual(opened, ["https://r2.example/current"], "a current request still opens");

    // an occupancy load for a task that the next reviewer has since opened
    element("occupancyPanelHost");
    window.PowOccupancyReview = {};
    signIn("reviewer_1");
    const task = row("occ", "needs_review").task;
    portal.state.selected = { task };
    pending = deferred();
    portal.client.listTaskOccupancies = () => pending.promise;
    portal.client.listDerivedStates = async () => ({ presence: [], locations: [], events: [] });
    const occupancy = portal.loadOccupancyPanel(task);
    portal.showSignedOut("Signed out.");
    signIn("reviewer_2");
    portal.state.selected = { task };
    pending.resolve([{ private: "reviewer_1's view" }]);
    await occupancy;
    assert.equal(portal.state.occupancy, null, "reviewer 1's occupancy load never reaches reviewer 2's view of the same task");

    // a derived-year decision whose answer arrives after sign-out
    signIn("reviewer_1");
    portal.state.selected = { task };
    pending = deferred();
    let panelLoads = 0;
    portal.client.decideDerivedYear = () => pending.promise;
    portal.client.listTaskOccupancies = async () => { panelLoads += 1; return []; };
    const deciding = portal.decideOccupancyYear(task, "d1", 2000, "confirm");
    portal.showSignedOut("Signed out.");
    signIn("reviewer_2");
    portal.state.selected = { task };
    pending.resolve({ target_year: 2000, review_state: "confirmed" });
    await deciding;
    assert.equal(panelLoads, 0, "no panel reload after sign-out");
    assert.equal(portal.state.occupancyBusy, false, "the sign-out reset the busy flag");

    // claim, release, extra opinion and return for comment share one runner
    const claimButton = { disabled: false, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
    const statusLine = element("claimStatusText");
    elements.set("claimReviewButton", claimButton);
    signIn("reviewer_1");
    portal.state.queue = [row("claim", "needs_review")];
    portal.wireClaimControls(row("claim", "needs_review").task);
    pending = deferred();
    let queueLoads = 0;
    portal.client.claimReviewTask = () => pending.promise;
    portal.client.listReviewQueue = async () => { queueLoads += 1; return []; };
    const claiming = claimButton.handlers.click({ currentTarget: claimButton });
    portal.showSignedOut("Signed out.");
    signIn("reviewer_2");
    statusLine.textContent = "reviewer 2's status";
    pending.resolve({});
    await claiming;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(queueLoads, 0, "no queue reload for the ended session");
    assert.equal(statusLine.textContent, "reviewer 2's status", "the next reviewer's status line is untouched");

    // a recorded decision whose answer arrives after sign-out
    const decisionStatusText = element("decisionStatusText");
    signIn("reviewer_1");
    portal.state.busy = false;
    portal.state.selected = { task: row("dec", "needs_review").task, latestDraft: { evidence_draft_id: "d9" } };
    portal.state.content = null;
    pending = deferred();
    portal.client.recordReviewDecision = () => pending.promise;
    const form = {
        decisionStatus: { value: "needs_more_evidence" },
        decisionNote: { value: "please add the source" },
        acceptedAction: { value: "" },
        identityDecision: { value: "" },
        requiredFollowUp: { value: "" },
        querySelector: () => null,
    };
    const deciding2 = portal.submitDecision({ preventDefault() {}, currentTarget: form });
    portal.showSignedOut("Signed out.");
    signIn("reviewer_2");
    portal.state.selected = { task: row("other", "needs_review").task };
    decisionStatusText.textContent = "reviewer 2's form";
    pending.resolve({ task_status: "changes_requested" });
    await deciding2;
    assert.equal(decisionStatusText.textContent, "reviewer 2's form", "no confirmation lands on the next reviewer's page");
    assert.equal(portal.state.selected.task.task_id, "other", "and their selection stands");

    // the stale-snapshot reload of an ended session does nothing
    signIn("reviewer_1");
    pending = deferred();
    portal.client.recordReviewDecision = () => pending.promise;
    portal.state.busy = false;
    portal.state.selected = { task: row("dec", "needs_review").task, latestDraft: { evidence_draft_id: "d9" } };
    queueLoads = 0;
    const stale = portal.submitDecision({ preventDefault() {}, currentTarget: form });
    portal.showSignedOut("Signed out.");
    pending.resolve(Promise.reject(new Error("Stale review snapshot.")));
    await stale.catch(() => {});
    assert.equal(queueLoads, 0, "no reload for an ended session");

    // the client reports a session replaced by another account, or a
    // refused token, through the lifecycle handler the portal registered
    // before any restore: the previous reviewer's queue and task leave, and
    // their outstanding guards go stale (#153 round 1)
    assert.equal(typeof window.__lifecycle?.onSignedOut, "function", "the portal registers its lifecycle");
    signIn("reviewer_1");
    portal.state.queue = [row("q1", "needs_review")];
    portal.state.selected = { task: row("q1", "needs_review").task };
    const reviewerOneGuard = portal.sessionGuard();
    window.__lifecycle.onSignedOut({ deliberate: false, replaced: true });
    assert.equal(portal.state.user, null);
    assert.equal(portal.state.queue.length, 0);
    assert.equal(portal.state.selected, null);
    assert.equal(reviewerOneGuard(), false, "reviewer 1's late answers land nowhere");
    signIn("reviewer_2");
    assert.equal(reviewerOneGuard(), false, "nor on reviewer 2's page");
    // #153 round 3 (sol): startup's restore of reviewer a is still out when
    // clerk replaces a's session and the card admits reviewer b. a's late
    // answer must not overwrite b, whether it names a or nobody
    element("signOut");
    element("transportDot");
    for (const lateAnswer of ["nobody", "reviewer a"]) {
        portal.showSignedOut("Signed out.");
        const restore = deferred();
        const reviewerA = { _id: "reviewer_a", display_name: "A", roles: ["reviewer"] };
        portal.client.mayHaveSession = true;
        portal.client.restoreSession = () => restore.promise;
        portal.client.renderSignInButton = async () => {};
        portal.client.listReviewQueue = async () => [];
        portal.client.user = null;
        const starting = portal.init();
        // clerk replaces a's session; the card admits b
        window.__lifecycle.onSignedOut({ deliberate: false, replaced: true });
        const reviewerB = { _id: "reviewer_b", display_name: "B", roles: ["reviewer"] };
        portal.state.user = reviewerB;
        portal.client.user = reviewerB;
        restore.resolve(lateAnswer === "nobody" ? null : reviewerA);
        await starting;
        assert.equal(portal.state.user, reviewerB, `a's late restore (${lateAnswer}) leaves b in place`);
    }
    // an unchanged restore still admits the restored reviewer
    {
        portal.showSignedOut("Signed out.");
        const reviewerA = { _id: "reviewer_a", display_name: "A", roles: ["reviewer"] };
        portal.client.restoreSession = async () => { portal.client.user = reviewerA; return reviewerA; };
        await portal.init();
        assert.equal(portal.state.user, reviewerA);
    }
    console.log("review state dom test passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
