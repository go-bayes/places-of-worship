// the ra portal's task states through the shared presentation contract (jb
// ruling 2026-09-19): one pill per list row, the my-work rollup, the
// actionable status as the control, the transport dot by the account name
// and the one-line empty states, all held by the actual portal class in a
// stub dom
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const values = new Map();
const localStorage = {
  get length() { return values.size; },
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
  key(index) { return [...values.keys()][index] ?? null; },
};
const classList = () => {
  const set = new Set();
  return {
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    toggle(name, force) { const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); return on; },
    contains(name) { return set.has(name); },
  };
};
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {}, classList: classList(), disabled: false,
    setAttribute(name, value) { this.attrs[name] = value; }, addEventListener() {}, querySelectorAll() { return []; }, ...extra };
  elements.set(id, item);
  return item;
};
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
};
const navigator = { geolocation: null };
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const fresh = () => {
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1", initials: "JB" };
  app.backend = { configured: true, signedIn: true };
  app.backendLastError = "";
  app.transportBusy = "";
  app.signedOutDeliberately = false;
  app.backendTasksById = new Map();
  app.latestDraftsByTaskId = new Map();
  app.revisionDraftIdsByTaskId = new Map();
  app.myWorkItems = [];
  app.myNominationItems = [];
  app.sessionEntries = [];
  app.tasks = [];
  app.filteredTasks = [];
  app.visibleLimit = 80;
  app.selectedTask = null;
  app.targetYear = "2018";
  app.syncPortalChrome = () => {};
  app.renderChangesRequestedBadge = () => {};
  return app;
};
const task = (task_id, status, extra = {}) => ({ task_id, status, name: `Place ${task_id}`, batch_id: "nz-temporal-ra-workpack-001", priority: "high", ...extra });
const feature = (t) => ({ type: "Feature", properties: { task_id: t.task_id, name: t.name, verification_priority: t.priority, automated_checks: [] }, geometry: { type: "Point", coordinates: [174.7, -41.3] } });

// 1. one state pill per list row, in the contract's words and tone
{
  const app = fresh();
  const changes = task("t-changes", "changes_requested");
  const exported = task("t-exported", "exported");
  app.backendTasksById.set(changes.task_id, changes);
  app.backendTasksById.set(exported.task_id, exported);
  app.filteredTasks = [feature(exported), feature(changes)];
  const list = element("taskList", { hidden: false });
  app.renderTaskList();
  const html = list.innerHTML;
  assert.match(html, /<span class="state-pill tone-act" title="[^"]+">Changes requested<\/span>/, "a changes_requested row wears the act pill");
  assert.match(html, /<span class="state-pill tone-done">Exported<\/span>/, "an exported row wears the done pill");
  assert.doesNotMatch(html, /backend-badge|skip-badge|closed-badge/, "the raw server badge and the session badges are gone");
  const row = html.slice(html.indexOf('data-task-id="t-changes"'));
  assert.ok(row.indexOf("Changes requested") < row.indexOf('class="status-pill'), "the state pill comes before the target-year pill");
  assert.match(html, /class="status-pill status-[a-z-]+"/, "the target-year pill keeps its classes");
  // the visible order follows urgency once the filters run
  element("searchInput", { value: "" });
  app.tasks = [feature(exported), feature(changes)];
  app.renderMarkers = () => {};
  app.updateStats = () => {};
  app.applyFilters();
  // joined: the vm realm's arrays fail a cross-realm deep equality
  assert.equal(app.filteredTasks.map((f) => f.properties.task_id).join(","), "t-changes,t-exported", "changes requested sorts above exported");
}

// 2. a row known only from this browser's session log presents its outcome
{
  const app = fresh();
  app.backend = { configured: false };
  app.sessionEntries = [{ task_id: "t-local", type: "skipped" }];
  app.filteredTasks = [feature(task("t-local", undefined))];
  const list = element("taskList", { hidden: false });
  app.renderTaskList();
  assert.match(list.innerHTML, /<span class="state-pill tone-rest" title="[^"]+">Skipped<\/span>/);
}

// 3. the my-work rollup and the actionable pill as the control
{
  const app = fresh();
  app.myWorkItems = [
    { task: task("t-1", "changes_requested"), latestDraft: null, latestReview: { decision_status: "changes_requested", decision_note: "Add a source." } },
    { task: task("t-2", "draft_saved"), latestDraft: { draft_status: "draft" }, latestReview: null },
    { task: task("t-3", "exported"), latestDraft: null, latestReview: null },
  ];
  const panel = element("myWorkPanel", { hidden: false });
  app.renderMyWorkPanel(panel);
  const html = panel.innerHTML;
  assert.match(html, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><span>of 3<\/span><\/span>/, "the rollup names the act count over the total");
  assert.doesNotMatch(html, /needs? attention|ra-initials/, "the hand-rolled count is gone");
  assert.match(html, /<button type="button" class="state-pill tone-act my-work-open" data-task-id="t-1" data-action="revise"[^>]*>Changes requested<\/button>/, "an actionable status is the control");
  assert.match(html, /<button type="button" class="state-pill tone-motion my-work-open" data-task-id="t-2" data-action="continue">Draft saved<\/button>/);
  assert.match(html, /<span class="state-pill tone-done">Exported<\/span>/, "a row without an action keeps a span");
  assert.doesNotMatch(html, /revision draft saved|submitted, waiting for review|needs more evidence/, "the inline label ladder is gone");
  // a queued task with an editable draft alongside is a revision in hand
  app.myWorkItems = [{ task: task("t-4", "needs_review"), latestDraft: { draft_status: "draft" }, latestReview: null }];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /tone-motion my-work-open" data-task-id="t-4" data-action="continue">Revision draft saved</);
  // the rollup omits "of N" when the pill already counts every row
  app.myWorkItems = [{ task: task("t-5", "changes_requested"), latestDraft: null, latestReview: null }];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><\/span>/);
  // empty: one line, no button
  app.myWorkItems = [];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /<div class="state-empty">Nothing saved or submitted yet.<\/div>/);
  assert.doesNotMatch(panel.innerHTML, /session-empty/);
}

// 4. the transport dot by the account name, and the batch rollup on the card
{
  const app = fresh();
  app.portalMode = "assigned";
  app.getRaInitials = () => "JB";
  const open = task("t-open", "open");
  app.backendTasksById.set(open.task_id, open);
  app.tasks = [feature(open)];
  app.myWorkItems = [{ task: task("t-6", "changes_requested"), latestDraft: null, latestReview: null }];
  const panel = element("backendPanel", { hidden: false });
  app.renderBackendPanel();
  let html = panel.innerHTML;
  assert.match(html, /Signed in as JB\. <span class="transport-dot tone-done" id="transportDot" aria-live="polite" data-state="ready">Connected<\/span>/, "connected reads as a done-toned dot");
  assert.match(html, /Assigned batch: <strong>nz-temporal-ra-workpack-001<\/strong>/, "the batch line stays");
  assert.match(html, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><span>of 2<\/span><\/span>/, "the card carries one rollup over available tasks and my work");
  assert.doesNotMatch(html, /available task|in My work\./, "the two counts are gone");
  // a backend error is a broken dot
  app.backendLastError = "Session expired. Sign in again.";
  app.renderBackendPanel();
  html = panel.innerHTML;
  assert.match(html, /<span class="transport-dot tone-broken" id="transportDot" aria-live="polite" data-state="error">Connection problem<\/span>/);
  // a save in flight updates the dot in place
  app.backendLastError = "";
  app.renderBackendPanel();
  const dot = element("transportDot", { hidden: false });
  app.setTransportBusy("saving");
  assert.equal(app.transportState(), "saving");
  assert.equal(dot.textContent, "Saving");
  assert.equal(dot.className, "transport-dot tone-motion");
  app.setTransportBusy("");
  assert.equal(dot.textContent, "Connected");
  // a deliberate sign-out is not a connection problem; an expired session is
  app.backendUser = null;
  app.backendLastError = "Signed out here.";
  app.signedOutDeliberately = true;
  assert.equal(app.transportState(), "signed_out");
  app.signedOutDeliberately = false;
  assert.equal(app.transportState(), "error");
  app.backend = { configured: false };
  assert.equal(app.transportState(), "unconfigured");
}

// 5. the empty task list: one line and one action
{
  const app = fresh();
  const list = element("taskList", { hidden: false });
  element("searchInput", { value: "" });
  element("priorityFilter", { value: "all" });
  app.renderTaskList();
  assert.match(list.innerHTML, /<div class="state-empty">\s*<span>Nothing assigned in this batch yet.<\/span>\s*<button type="button" id="taskListEmptyAction">Refresh<\/button>/);
  elements.get("priorityFilter").value = "high";
  app.renderTaskList();
  assert.match(list.innerHTML, /<span>No tasks match your filters.<\/span>\s*<button type="button" id="taskListEmptyAction">Clear filters<\/button>/);
  app.backendUser = null;
  app.renderTaskList();
  assert.match(list.innerHTML, /<div class="state-empty">\s*<span>Sign in to load this workpack.<\/span>\s*<\/div>/, "the signed-out case has no button");
  assert.doesNotMatch(list.innerHTML, /disabled-panel/);
  // clear filters resets every control and re-runs the filters
  app.backendUser = { _id: "user_1" };
  let applied = 0;
  app.applyFilters = () => { applied += 1; };
  app.clearFilters();
  assert.equal(elements.get("priorityFilter").value, "all");
  assert.equal(applied, 1);
}

// 6. the detail heading carries the same pill as the list row, with its hint
{
  const app = fresh();
  const changes = task("t-changes", "changes_requested");
  app.backendTasksById.set(changes.task_id, changes);
  assert.equal(
    app.detailStateHtml("t-changes"),
    '<div class="detail-state"><span class="state-pill tone-act" title="The reviewer asked for more evidence.">Changes requested</span><span class="muted">The reviewer asked for more evidence.</span></div>',
  );
  assert.equal(app.detailStateHtml("t-unknown"), "", "a task the page knows nothing about shows no pill");
}

// 7. reopening a decided task (jb ruling 2026-10-15): the flag shows on the
// row, the detail and my work with its reason escaped; a decided task's note
// offers "Reopen with a reason"; the reason is checked before anything is sent
{
  const flagged = task("t-flag", "reopened", {
    reopened_after_decision: { from_status: "pi_accepted", reopened_at: 5, reopened_by: "user_1", reason: "<img src=x onerror=alert(1)> new register" },
  });
  const app = fresh();
  app.rapidCorrectionTaskIds = new Set();
  app.backendTasksById.set(flagged.task_id, flagged);
  app.filteredTasks = [feature(flagged)];
  const list = element("taskList", { hidden: false });
  app.renderTaskList();
  assert.match(list.innerHTML, /<span class="state-pill tone-act" title="Reopened after decision \(was accepted\): &lt;img[^"]*">Reopened after decision<\/span>/, "the row carries the marker, reason escaped in the title");
  assert.doesNotMatch(list.innerHTML, /<img/);
  const detail = app.detailStateHtml("t-flag");
  assert.match(detail, /Reopened after decision<\/span>/);
  assert.match(detail, /Reopened after decision \(was accepted\)\. Reason given: &lt;img src=x onerror=alert\(1\)&gt; new register/);
  assert.doesNotMatch(detail, /<img/);
  const mine = app.myWorkEntryHtml({ task: flagged, latestDraft: null, latestReview: null });
  assert.match(mine, />Reopened after decision<\/span>/);
  // an unflagged task shows no marker
  app.backendTasksById.set("t-plain", task("t-plain", "reopened"));
  assert.equal(app.reopenFlagPillHtml(app.backendTasksById.get("t-plain")), "");
  assert.doesNotMatch(app.detailStateHtml("t-plain"), /Reopened after decision/);

  // a decided task's notice offers the reopen control, each decided status once
  for (const status of ["reviewed", "pi_accepted", "exported"]) {
    const decided = task(`t-${status}`, status);
    app.backendTasksById.set(decided.task_id, decided);
    const note = app.formModeNoticeHtml({ task_id: decided.task_id });
    assert.match(note, /data-detail-reopen="t-/, status);
    assert.match(note, />Reopen with a reason<\/button>/, status);
    assert.doesNotMatch(note, /unless JB reopens it/, status);
  }
  const waiting = task("t-waiting", "needs_review");
  app.backendTasksById.set(waiting.task_id, waiting);
  assert.doesNotMatch(app.formModeNoticeHtml({ task_id: "t-waiting" }), /data-detail-reopen/);

  // the reason block is markup only: the task id is escaped, no prompt
  const block = app.reopenReasonBlockHtml('t-"><b>');
  assert.match(block, /data-reopen-reason-for="t-&quot;&gt;&lt;b&gt;"/);
  assert.match(block, /<textarea id="reopenReason\d+"/);

  // pi_accepted and exported are now reopenable from the map
  const { REOPEN_ELIGIBLE } = (() => {
    const src = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
    const match = src.match(/const REOPEN_ELIGIBLE_STATUSES = new Set\(\[([^\]]*)\]\)/);
    return { REOPEN_ELIGIBLE: [...match[1].matchAll(/"(\w+)"/g)].map((m) => m[1]) };
  })();
  for (const status of ["pi_accepted", "exported", "reviewed", "needs_review"]) assert.ok(REOPEN_ELIGIBLE.includes(status), status);
  assert.ok(!REOPEN_ELIGIBLE.includes("open"));
}

// 8. the reason is checked before it is sent: under 8 characters after
// trimming nothing goes to the server; the trimmed reason goes when it passes
{
  const sent = [];
  const mkBlock = (value) => {
    const handlers = {};
    const problem = { textContent: "" };
    const input = { value, focus() { this.focused = true; } };
    const pick = { "[data-reopen-reason-input]": input, "[data-reopen-reason-problem]": problem };
    const confirm = { addEventListener(_t, fn) { handlers.confirm = fn; } };
    const cancel = { addEventListener(_t, fn) { handlers.cancel = fn; } };
    pick["[data-reopen-reason-confirm]"] = confirm;
    pick["[data-reopen-reason-cancel]"] = cancel;
    return { handlers, problem, input, removed: false, remove() { this.removed = true; }, querySelector: (sel) => pick[sel] || null };
  };
  const app = fresh();
  for (const typed of ["", "short", "   1234567   "]) {
    const block = mkBlock(typed);
    app.bindReopenReason(block, (reason) => sent.push(reason));
    block.handlers.confirm();
    assert.match(block.problem.textContent, /at least 8 characters/, JSON.stringify(typed));
    assert.equal(block.input.focused, true);
  }
  assert.equal(sent.length, 0, "no short reason is sent");
  const ok = mkBlock("  New evidence from the 1931 register.  ");
  let cancelled = 0;
  app.bindReopenReason(ok, (reason) => sent.push(reason), () => { cancelled += 1; });
  ok.handlers.confirm();
  assert.equal(sent.join("|"), "New evidence from the 1931 register.");
  ok.handlers.cancel();
  assert.ok(ok.removed);
  assert.equal(cancelled, 1);
}

// 9. reopenIssueFromContext sends the typed reason for a decided task and
// the fixed reason otherwise; a decided task with no valid reason sends nothing
(async () => {
  const calls = [];
  const app = fresh();
  app.backend = { configured: true, signedIn: true, async reopenTask(args) { calls.push(args); } };
  app.map = { closePopup() {} };
  app.taskHistoryByTaskId = new Map();
  app.refreshBackendTasks = async () => {};
  app.applyFilters = () => {};
  app.selectTaskById = () => {};
  const status = element("copyStatus", { hidden: false });
  app.backendTasksById.set("t-dec", task("t-dec", "exported"));
  app.backendTasksById.set("t-rev", task("t-rev", "needs_review"));
  await app.reopenIssueFromContext("t-dec", null);
  await app.reopenIssueFromContext("t-dec", null, "short");
  assert.equal(calls.length, 0);
  assert.match(status.textContent, /at least 8 characters/);
  await app.reopenIssueFromContext("t-dec", null, "  A corrected opening date.  ");
  await app.reopenIssueFromContext("t-rev", null);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].reason, "A corrected opening date.");
  assert.equal(calls[1].reason, "Reopened from map context-dot inspection.");
  console.log("task-state-dom: reopen ok");
})().catch((error) => { console.error(error); process.exit(1); });

// 10. the rapid-observation detail path (reviewFormHtml -> rapidReadOnlyHtml)
// offers the same "Reopen with a reason" control for each decided status, and
// still says nothing about asking JB; a task waiting for review gets its plain note
{
  const app = fresh();
  app.rapidCorrectionTaskIds = new Set();
  app.taskUsesRapidForm = () => true;
  for (const status of ["reviewed", "pi_accepted", "exported"]) {
    const decided = task(`t-rapid-${status}`, status);
    app.backendTasksById.set(decided.task_id, decided);
    app.latestDraftsByTaskId.set(decided.task_id, { observation_contract_version: "rapid_current_v1", current_observation_status: "present", source_date_or_capture_date: "2026-10-01", privacy_flag: "clear" });
    const html = app.reviewFormHtml({ task_id: decided.task_id });
    assert.match(html, /<h3>Recorded observation<\/h3>/, status);
    assert.match(html, new RegExp(`data-detail-reopen="t-rapid-${status}"`), status);
    assert.match(html, />Reopen with a reason<\/button>/, status);
    assert.doesNotMatch(html, /Ask JB to reopen|unless JB reopens/, status);
    assert.match(html, /reopen the task with a reason first/, status);
  }
  const waiting = task("t-rapid-wait", "needs_review");
  app.backendTasksById.set(waiting.task_id, waiting);
  app.latestDraftsByTaskId.set(waiting.task_id, { observation_contract_version: "rapid_current_v1", current_observation_status: "present", privacy_flag: "clear" });
  const waitHtml = app.reviewFormHtml({ task_id: waiting.task_id });
  assert.match(waitHtml, /This observation is waiting for review\./);
  assert.doesNotMatch(waitHtml, /data-detail-reopen/);
}

console.log("task-state-dom: ok");
